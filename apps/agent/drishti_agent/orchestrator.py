"""
Drishti orchestrator.

Wraps a LiveKit VoicePipelineAgent with:
  - Sarvam-replaceable Deepgram STT
  - Cartesia TTS (voice persona "Meera")
  - Silero VAD
  - Claude Sonnet 4.6 LLM with 8 typed tools
  - Per-session state shared with every tool

Tool flow:
  capture_consent -> request_pan_upload -> verify_face -> check_bureau ->
  evaluate_offer -> wait_for_offer_selection -> end_session

Runtime data path between agent and UI: LiveKit data channel events
(see drishti_agent.events for shapes; mirrors apps/web/lib/events.ts).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os

from livekit import rtc
from livekit.agents import AutoSubscribe, JobContext, llm
from livekit.agents.voice_assistant import VoiceAssistant
from livekit.plugins import anthropic, cartesia, deepgram, silero

from . import events as evt
from .prompts import GREETING_TEMPLATE, SYSTEM_PROMPT
from .state import SessionState
from .tools import bureau as t_bureau
from .tools import consent as t_consent
from .tools import document as t_doc
from .tools import face as t_face
from .tools import fraud as t_fraud
from .tools import offer as t_offer
from .tools import session as t_session

log = logging.getLogger("drishti.agent")

CARTESIA_VOICE_ID = os.getenv(
    "CARTESIA_VOICE_ID", "2ee87190-8f84-4925-97da-e52547f9462c"
)


# ----------------------------------------------------------------------
# Tool wiring
# ----------------------------------------------------------------------
def build_function_context(state: SessionState) -> llm.FunctionContext:
    """Bind the 8 tools to a per-session FunctionContext."""

    fnc = llm.FunctionContext()

    @fnc.ai_callable(description="Record verbal consent (consent_type like 'data_processing'). Call AFTER customer says 'yes'.")
    async def capture_consent(consent_type: str, spoken_text: str = "I agree") -> str:
        # Surface a UI dialog as a visual confirmation; STT-captured spoken_text
        # remains the authoritative record in the audit chain.
        if state.room:
            await state.room.local_participant.publish_data(
                evt.encode(evt.ConsentRequest(
                    consent_type=consent_type,
                    prompt=f"Verbal consent for: {consent_type.replace('_', ' ')}",
                )),
                reliable=True,
            )
            state.step = "consent"
            await state.room.local_participant.publish_data(
                evt.encode(evt.StepChange(step="consent")), reliable=True
            )
        result = await t_consent.capture_consent(state, consent_type, spoken_text)
        return json.dumps(result)

    @fnc.ai_callable(description="Trigger UI to show the PAN upload form. Blocks until customer submits. Returns extracted PAN/name/dob.")
    async def request_pan_upload() -> str:
        # Nudge UI to show form
        if state.room and state.local_pub:
            await state.room.local_participant.publish_data(
                evt.encode(evt.PanRequest()), reliable=True,
            )
            state.step = "pan"
            await state.room.local_participant.publish_data(
                evt.encode(evt.StepChange(step="pan")), reliable=True,
            )
        result = await t_doc.request_pan_upload(state)
        # After PAN is captured the LLM moves into conversational Q&A
        if state.room:
            state.step = "qa"
            await state.room.local_participant.publish_data(
                evt.encode(evt.StepChange(step="qa")), reliable=True,
            )
        return json.dumps(result)

    @fnc.ai_callable(description="Compare PAN photo to live face via ArcFace. Returns cosine similarity and pass/fail.")
    async def verify_face() -> str:
        result = await t_face.verify_face(state)
        # Push fraud flag to UI if mismatch
        if not result["passed"] and state.room:
            await state.room.local_participant.publish_data(
                evt.encode(evt.FraudFlag(
                    signal="face_mismatch",
                    severity=result["severity"],
                    reason=f"ArcFace cosine {result['cosine']} < {result['threshold']}",
                )),
                reliable=True,
            )
        await _push_signals(state, vision=f"face {result['cosine']:.2f}")
        return json.dumps(result)

    @fnc.ai_callable(description="Pull mock CIBIL bureau record by PAN. Returns CIBIL, existing loans, DPD.")
    async def check_bureau() -> str:
        # Mark verification step beginning
        if state.room:
            state.step = "verify"
            await state.room.local_participant.publish_data(
                evt.encode(evt.StepChange(step="verify")), reliable=True,
            )
        result = await t_bureau.check_bureau(state)
        await _push_signals(state, cibil=result.get("cibil"))
        return json.dumps(result)

    @fnc.ai_callable(description="Submit profile to risk model + policy engine. Returns decision (offer/soft_decline/hard_decline/human_review) and offers.")
    async def evaluate_offer(
        age: int,
        monthly_income: int,
        employment_type: str,
        loan_purpose: str,
        requested_amount: int,
        declared_city: str,
    ) -> str:
        # Update profile with what LLM gathered from conversation
        state.profile.declared_age = age
        state.profile.monthly_income = monthly_income
        state.profile.employment_type = employment_type
        state.profile.loan_purpose = loan_purpose
        state.profile.requested_amount = requested_amount
        state.profile.declared_city = declared_city

        result = await t_offer.evaluate_offer(state)
        await _push_signals(state, risk=result.get("risk_band", "?"))

        # Push offer event to UI
        if state.room:
            await state.room.local_participant.publish_data(
                evt.encode(evt.OfferShow(
                    decision=result["decision"],
                    offers=result.get("offers", []),
                    reason=result.get("reason"),
                    next_best_action=result.get("next_best_action"),
                    shap_top3=result.get("shap_top3", []),
                )),
                reliable=True,
            )
            state.step = "offer"
            await state.room.local_participant.publish_data(
                evt.encode(evt.StepChange(step="offer")), reliable=True
            )
        return json.dumps(result)

    @fnc.ai_callable(description="Wait for the customer to select an offer tier (conservative/standard/stretch). Returns the selection.")
    async def wait_for_selection() -> str:
        return json.dumps(await t_offer.wait_for_offer_selection(state))

    @fnc.ai_callable(description="Manually flag a fraud signal you've detected (e.g., answer inconsistency).")
    async def flag_fraud(signal: str, severity: int, reason: str) -> str:
        return json.dumps(await t_fraud.flag_fraud(state, signal, severity, reason))

    @fnc.ai_callable(description="End the session. outcome must be one of: approved, declined, fraud_block, human_review.")
    async def end_session(outcome: str) -> str:
        result = await t_session.end_session(state, outcome)
        if state.room:
            state.step = "ended"
            await state.room.local_participant.publish_data(
                evt.encode(evt.StepChange(step="ended")), reliable=True,
            )
            await state.room.local_participant.publish_data(
                evt.encode(evt.SessionEnded(
                    outcome=outcome, audit_hash=result["audit_hash"],
                )),
                reliable=True,
            )
        return json.dumps(result)

    return fnc


async def _push_signals(state: SessionState, **kwargs):
    if not state.room:
        return
    sig = {k: str(v) for k, v in kwargs.items() if v is not None}
    await state.room.local_participant.publish_data(
        evt.encode(evt.SignalsUpdate(signals=sig)), reliable=True
    )


# ----------------------------------------------------------------------
# Data-channel handler (UI -> agent)
# ----------------------------------------------------------------------
def install_data_handler(room: rtc.Room, state: SessionState):
    @room.on("data_received")
    def on_data(*args, **kwargs):  # noqa: ARG001
        """Tolerate two LiveKit signatures:
            on_data(data_packet)                       (rtc.DataPacket)
            on_data(payload, participant, kind, topic) (legacy positional)
        """
        try:
            if args and hasattr(args[0], "data"):
                raw = args[0].data
            elif args:
                raw = args[0]
            else:
                raw = kwargs.get("data") or kwargs.get("payload") or b""
            if isinstance(raw, (bytes, bytearray)):
                payload = json.loads(raw.decode("utf-8"))
            elif isinstance(raw, str):
                payload = json.loads(raw)
            else:
                return
        except Exception:
            return
        kind = payload.get("type")

        if kind == "consent.given":
            ctype = payload.get("consent_type", "data_processing")
            fut = state.consent_futures.get(ctype)
            if fut and not fut.done():
                fut.set_result(payload)

        elif kind == "pan.uploaded":
            if state.pan_future and not state.pan_future.done():
                state.pan_future.set_result(payload)

        elif kind == "offer.selected":
            if state.offer_future and not state.offer_future.done():
                state.offer_future.set_result(payload)

        elif kind == "geo.report":
            state.geo_actual = {
                "lat": float(payload.get("lat", 0)),
                "lng": float(payload.get("lng", 0)),
            }


# ----------------------------------------------------------------------
# Entrypoint
# ----------------------------------------------------------------------
async def entrypoint(ctx: JobContext):
    """Called by LiveKit Agents worker for every new room."""
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    log.info("agent.connected room=%s", ctx.room.name)

    state = SessionState(session_id=ctx.room.name, room_name=ctx.room.name)
    # Attach room to state so tools can publish UI events
    state.room = ctx.room  # type: ignore[attr-defined]
    state.local_pub = ctx.room.local_participant  # type: ignore[attr-defined]

    install_data_handler(ctx.room, state)

    # Wait for the customer to join before starting
    participant = await ctx.wait_for_participant()
    log.info("customer.joined identity=%s", participant.identity)

    # Personalise greeting
    customer_name = participant.name or "there"
    initial_ctx = llm.ChatContext().append(
        role="system",
        text=SYSTEM_PROMPT
        + f"\n\nThe customer's display name is: {customer_name}. "
        f"Session id: {state.session_id}.",
    )

    fnc = build_function_context(state)

    assistant = VoiceAssistant(
        vad=silero.VAD.load(),
        stt=deepgram.STT(model="nova-3-general", language="en-IN"),
        llm=anthropic.LLM(model="claude-sonnet-4-6"),
        tts=cartesia.TTS(voice=CARTESIA_VOICE_ID, model="sonic-2"),
        chat_ctx=initial_ctx,
        fnc_ctx=fnc,
        allow_interruptions=True,
    )

    # Forward final transcripts to the UI as captions
    @assistant.on("user_speech_committed")
    def on_user_speech(msg):
        asyncio.create_task(
            state.room.local_participant.publish_data(
                evt.encode(evt.CaptionEvent(speaker="customer", text=msg.content, is_final=True)),
                reliable=True,
            )
        )

    @assistant.on("agent_speech_committed")
    def on_agent_speech(msg):
        asyncio.create_task(
            state.room.local_participant.publish_data(
                evt.encode(evt.CaptionEvent(speaker="drishti", text=msg.content, is_final=True)),
                reliable=True,
            )
        )

    assistant.start(ctx.room, participant)

    # Speak the first line
    await assistant.say(
        GREETING_TEMPLATE.format(name=customer_name),
        allow_interruptions=True,
    )
