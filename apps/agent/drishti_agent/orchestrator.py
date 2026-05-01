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
# Defensive helpers
# ----------------------------------------------------------------------
async def _safe_publish(state: SessionState, payload: bytes) -> None:
    """Publish to the data channel without ever crashing the caller.

    Rooms can close mid-flight, especially when the customer disconnects while
    the agent is still narrating a result. Swallow that here — the audit trail
    is already on the API side; the UI event being lost is acceptable.
    """
    if not state.room:
        log.warning("publish skipped — no room (event lost)")
        return
    try:
        await state.room.local_participant.publish_data(payload, reliable=True)
        # Log the event type so we can verify forms / step changes are leaving
        # the agent. Truncated to avoid spamming with caption text.
        try:
            head = payload[:80].decode("utf-8", errors="replace")
            log.info("publish ok: %s", head)
        except Exception:
            pass
    except Exception as e:
        log.warning("publish_data failed: %s", e)


def _clamp(value: int, lo: int, hi: int, default: int) -> int:
    """Sanitize integer args coming back from the LLM. Out-of-range -> default."""
    try:
        v = int(value)
    except (TypeError, ValueError):
        return default
    if v < lo or v > hi:
        return default
    return v


# ----------------------------------------------------------------------
# Tool wiring
# ----------------------------------------------------------------------
def build_function_context(state: SessionState) -> llm.FunctionContext:
    """Bind the 8 tools to a per-session FunctionContext."""

    fnc = llm.FunctionContext()

    @fnc.ai_callable(description="Record verbal consent (consent_type like 'data_processing'). Call AFTER customer says 'yes'.")
    async def capture_consent(consent_type: str, spoken_text: str = "I agree") -> str:
        if state.room:
            await _safe_publish(state, evt.encode(evt.ConsentRequest(
                consent_type=consent_type,
                prompt=f"Verbal consent for: {consent_type.replace('_', ' ')}",
            )))
            state.step = "consent"
            await _safe_publish(state, evt.encode(evt.StepChange(step="consent")))
        result = await t_consent.capture_consent(state, consent_type, spoken_text)
        return json.dumps(result)

    @fnc.ai_callable(description="Trigger UI to show the PAN upload form. Blocks until customer submits. Returns extracted PAN/name/dob.")
    async def request_pan_upload() -> str:
        if state.room and state.local_pub:
            await _safe_publish(state, evt.encode(evt.PanRequest()))
            state.step = "pan"
            await _safe_publish(state, evt.encode(evt.StepChange(step="pan")))
        result = await t_doc.request_pan_upload(state)
        if state.room:
            state.step = "qa"
            await _safe_publish(state, evt.encode(evt.StepChange(step="qa")))
        return json.dumps(result)

    @fnc.ai_callable(description="Compare PAN photo to live face via ArcFace; also runs age + geo fraud detectors. Returns face match plus any extra fraud signals.")
    async def verify_face() -> str:
        result = await t_face.verify_face(state)
        # Fire age + geo detectors immediately after face check so all 3 v1
        # fraud signals run as a single phase. Failures here are non-fatal.
        precheck = await t_fraud.precheck_age_and_geo(state)
        if not result.get("passed") and state.room:
            await _safe_publish(state, evt.encode(evt.FraudFlag(
                signal="face_mismatch",
                severity=result.get("severity", 4),
                reason=f"ArcFace cosine {result.get('cosine', 0):.2f} < {result.get('threshold', 0.4):.2f}",
            )))
        await _push_signals(state, vision=f"face {result.get('cosine', 0):.2f}")
        # Surface all fraud flags newly added by precheck
        if precheck.get("signals_added", 0) and state.room:
            for s in state.fraud_signals[-precheck["signals_added"]:]:
                await _safe_publish(state, evt.encode(evt.FraudFlag(
                    signal=s.get("signal", ""),
                    severity=int(s.get("severity", 2)),
                    reason=s.get("reason", ""),
                )))
        result["fraud_severity_max"] = state.fraud_severity_max
        return json.dumps(result)

    @fnc.ai_callable(description="Pull mock CIBIL bureau record by PAN. Returns CIBIL, existing loans, DPD.")
    async def check_bureau() -> str:
        if state.room:
            state.step = "verify"
            await _safe_publish(state, evt.encode(evt.StepChange(step="verify")))
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
        # ---- Sanitize args coming back from the LLM ----
        age = _clamp(age, 18, 80, default=30)
        monthly_income = _clamp(monthly_income, 0, 10_000_000, default=50_000)
        requested_amount = _clamp(requested_amount, 0, 20_000_000, default=300_000)
        employment_type = (employment_type or "salaried").lower().strip()
        if employment_type not in {"salaried", "salaried_pvt", "salaried_govt", "self_employed", "other"}:
            employment_type = "other"
        declared_city = (declared_city or "Pune").strip()[:50]
        loan_purpose = (loan_purpose or "other").strip()[:50]

        state.profile.declared_age = age
        state.profile.monthly_income = monthly_income
        state.profile.employment_type = employment_type
        state.profile.loan_purpose = loan_purpose
        state.profile.requested_amount = requested_amount
        state.profile.declared_city = declared_city

        result = await t_offer.evaluate_offer(state)
        await _push_signals(state, risk=result.get("risk_band", "?"))

        if state.room:
            await _safe_publish(state, evt.encode(evt.OfferShow(
                decision=result["decision"],
                offers=result.get("offers", []),
                reason=result.get("reason"),
                next_best_action=result.get("next_best_action"),
                shap_top3=result.get("shap_top3", []),
            )))
            state.step = "offer"
            await _safe_publish(state, evt.encode(evt.StepChange(step="offer")))
        return json.dumps(result)

    @fnc.ai_callable(description="Wait for the customer to select an offer tier (conservative/standard/stretch). Returns the selection.")
    async def wait_for_selection() -> str:
        return json.dumps(await t_offer.wait_for_offer_selection(state))

    @fnc.ai_callable(description="Manually flag a fraud signal you've detected (e.g., answer inconsistency).")
    async def flag_fraud(signal: str, severity: int, reason: str) -> str:
        # Sanitize args
        signal = (signal or "unknown").strip()[:50]
        severity = _clamp(severity, 0, 5, default=2)
        reason = (reason or "").strip()[:500]
        if state.room:
            await _safe_publish(state, evt.encode(evt.FraudFlag(
                signal=signal, severity=severity, reason=reason,
            )))
        return json.dumps(await t_fraud.flag_fraud(state, signal, severity, reason))

    @fnc.ai_callable(description="End the session. outcome must be one of: approved, declined, fraud_block, human_review.")
    async def end_session(outcome: str) -> str:
        result = await t_session.end_session(state, outcome)
        if state.room:
            state.step = "ended"
            await _safe_publish(state, evt.encode(evt.StepChange(step="ended")))
            await _safe_publish(state, evt.encode(evt.SessionEnded(
                outcome=outcome, audit_hash=result["audit_hash"],
            )))
        return json.dumps(result)

    return fnc


async def _push_signals(state: SessionState, **kwargs):
    if not state.room:
        return
    sig = {k: str(v) for k, v in kwargs.items() if v is not None}
    await _safe_publish(state, evt.encode(evt.SignalsUpdate(signals=sig)))


# ----------------------------------------------------------------------
# Data-channel handler (UI -> agent)
# ----------------------------------------------------------------------
def install_data_handler(room: rtc.Room, state: SessionState):
    @room.on("data_received")
    def on_data(*args, **kwargs):  # noqa: ARG001
        """Tolerate two LiveKit signatures and never crash on bad input."""
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
        except Exception as e:
            log.debug("data_received parse failed: %s", e)
            return
        kind = payload.get("type")
        if not isinstance(kind, str):
            return

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
            try:
                state.geo_actual = {
                    "lat": float(payload.get("lat", 0)),
                    "lng": float(payload.get("lng", 0)),
                }
            except (TypeError, ValueError):
                pass


# ----------------------------------------------------------------------
# Entrypoint
# ----------------------------------------------------------------------
async def entrypoint(ctx: JobContext):
    """Called by LiveKit Agents worker for every new room."""
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    log.info("agent.connected room=%s", ctx.room.name)

    state = SessionState(session_id=ctx.room.name, room_name=ctx.room.name)
    state.room = ctx.room  # type: ignore[attr-defined]
    state.local_pub = ctx.room.local_participant  # type: ignore[attr-defined]

    install_data_handler(ctx.room, state)

    participant = await ctx.wait_for_participant()
    log.info("customer.joined identity=%s", participant.identity)

    customer_name = participant.name or "there"
    initial_ctx = llm.ChatContext().append(
        role="system",
        text=SYSTEM_PROMPT
        + f"\n\nThe customer's display name is: {customer_name}. "
        f"Session id: {state.session_id}.",
    )

    fnc = build_function_context(state)

    # ---- Caption stream tee --------------------------------------------------
    # By default, captions only fire on `agent_speech_committed` AFTER the full
    # TTS audio plays — which can be 5+ seconds of silence in the UI. Hooking
    # `before_tts_cb` lets us capture the LLM-produced text the moment it's
    # done generating (typically 1-2s) and emit the caption then, while the
    # TTS still streams audio to the customer's ears.
    #
    # IMPORTANT: livekit-agents calls before_tts_cb SYNCHRONOUSLY and expects
    # `str | AsyncIterable[str]` back — so the callback itself must be a plain
    # function. The agent caption is published WITHIN the teed coroutine via
    # `await`, which preserves event ordering on the data channel: the user's
    # caption (fired by user_speech_committed) lands BEFORE this one because
    # this only runs after the LLM has fully consumed the user's turn.
    async def _emit_drishti_caption(text: str) -> None:
        import time
        clean = (text or "").strip()
        if state.room and clean:
            await _safe_publish(
                state,
                evt.encode(evt.CaptionEvent(
                    speaker="drishti", text=clean, is_final=True,
                    ts_ms=int(time.time() * 1000),
                )),
            )

    def _before_tts(_assistant, source):
        if isinstance(source, str):
            # Static path (assistant.say) — schedule async publish but tag
            # the timestamp at decision time, not emit time, so the UI can
            # sort robustly.
            asyncio.create_task(_emit_drishti_caption(source))
            return source

        async def teed():
            buf: list[str] = []
            async for chunk in source:
                buf.append(chunk)
                yield chunk
            # Awaited inside the teed coroutine — guarantees this runs after
            # the LLM stream completes and BEFORE the next turn's caption.
            await _emit_drishti_caption("".join(buf))
        return teed()

    assistant = VoiceAssistant(
        vad=silero.VAD.load(),
        stt=deepgram.STT(model="nova-3-general", language="en-IN"),
        llm=anthropic.LLM(model="claude-sonnet-4-6"),
        tts=cartesia.TTS(voice=CARTESIA_VOICE_ID, model="sonic-2"),
        chat_ctx=initial_ctx,
        fnc_ctx=fnc,
        allow_interruptions=True,
        before_tts_cb=_before_tts,
        # Default is 1 — too low for our flow, where the LLM legitimately
        # chains tool calls (capture_consent -> request_pan_upload, then
        # request_pan_upload -> verify_face). With depth=1 the second tool
        # is dropped/delayed, which causes the "form doesn't appear" lag.
        max_nested_fnc_calls=5,
    )

    # ---- User caption chronology ----
    # `user_speech_committed` fires AFTER the agent acknowledges the user's
    # turn — which can be 3-8 seconds after they actually stopped speaking.
    # If we stamp at commit-time, the user caption gets a later timestamp
    # than the agent's reply (which fires from before_tts_cb when the LLM
    # finishes generating). Result: chat order looks reversed.
    #
    # We anchor the user caption to the moment they STARTED speaking by
    # stashing the timestamp on `user_started_speaking` and re-using it
    # when the commit event finally fires.
    import time as _time
    user_speech_started_ts = {"ms": 0}

    @assistant.on("user_started_speaking")
    def on_user_started():
        user_speech_started_ts["ms"] = int(_time.time() * 1000)

    @assistant.on("user_speech_committed")
    def on_user_speech(msg):
        if not state.room:
            return
        ts_ms = user_speech_started_ts["ms"] or int(_time.time() * 1000)
        # reset for next turn
        user_speech_started_ts["ms"] = 0
        asyncio.create_task(_safe_publish(
            state,
            evt.encode(evt.CaptionEvent(
                speaker="customer", text=msg.content,
                is_final=True, ts_ms=ts_ms,
            )),
        ))

    # Note: we deliberately DO NOT subscribe to `agent_speech_committed` for
    # captions — that fires after TTS finishes and would just duplicate the
    # caption emitted from `_before_tts` above.

    assistant.start(ctx.room, participant)

    # Greeting is fired via assistant.say() which does flow through
    # before_tts_cb, so the caption will be emitted automatically.
    await assistant.say(
        GREETING_TEMPLATE.format(name=customer_name),
        allow_interruptions=True,
    )
