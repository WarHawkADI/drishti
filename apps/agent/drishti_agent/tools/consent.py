"""Tool: capture verbal consent."""

from __future__ import annotations

import asyncio

from .. import audit_client
from ..state import SessionState


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
        try:
            ui_payload = await asyncio.wait_for(fut, timeout=timeout)
            spoken_text = ui_payload.get("spoken_text", "I agree")
        except asyncio.TimeoutError:
            return {"ok": False, "reason": "consent_timeout"}
        finally:
            state.consent_futures.pop(consent_type, None)

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
