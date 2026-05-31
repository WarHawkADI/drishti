"""Tool: capture verbal consent."""

from __future__ import annotations

import asyncio

from .. import audit_client
from ..state import SessionState

AFFIRMATIVE_TOKENS = ("agree", "consent", "yes", "yeah", "yep", "ok", "okay")


def _is_explicit_affirmative(text: str) -> bool:
    lowered = f" {text.lower().strip()} "
    if any(neg in lowered for neg in (" no ", " not ", " don't ", "do not", "refuse")):
        return False
    return any(tok in lowered for tok in AFFIRMATIVE_TOKENS)


async def capture_consent(
    state: SessionState,
    consent_type: str,
    spoken_text: str | None = None,
    timeout: float = 60.0,
) -> dict:
    """Record a verbal consent checkpoint and append it to the audit chain.

    The orchestrator typically calls this AFTER asking the customer "do you
    agree?" and hearing them say "yes". The spoken_text is captured by STT
    and passed in. The UI surfaces a confirm button as a backup; if pressed,
    the resolved future skips the wait below.
    """
    if spoken_text is None:
        # Wait for UI consent.given event (set by orchestrator's data handler)
        loop = asyncio.get_event_loop()
        fut = loop.create_future()
        state.consent_futures[consent_type] = fut
        pending = state.pending_consent_payloads.pop(consent_type, None)
        if pending is not None:
            fut.set_result(pending)
        try:
            ui_payload = await asyncio.wait_for(fut, timeout=timeout)
            spoken_text = ui_payload.get("spoken_text", "I agree")
        except asyncio.TimeoutError:
            return {"ok": False, "reason": "consent_timeout"}
        finally:
            state.consent_futures.pop(consent_type, None)
    if not _is_explicit_affirmative(spoken_text):
        await audit_client.append(
            state.session_id,
            "tool.failed",
            {
                "tool": "capture_consent",
                "reason": "explicit_affirmative_missing",
                "consent_type": consent_type,
            },
        )
        return {"ok": False, "reason": "explicit_affirmative_missing"}

    entry = await audit_client.append(
        state.session_id,
        "consent.captured",
        {
            "consent_type": consent_type,
            "spoken_text": spoken_text,
            "language": "en-IN",
        },
    )
    return {
        "ok": True,
        "consent_type": consent_type,
        "audit_seq": entry.get("seq"),
        "this_hash": entry.get("this_hash"),
    }
