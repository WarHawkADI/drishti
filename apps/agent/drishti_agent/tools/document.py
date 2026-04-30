"""Tool: request PAN upload from the UI and wait for it."""

from __future__ import annotations

import asyncio
import re

from .. import audit_client
from ..state import SessionState

PAN_REGEX = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")


async def request_pan_upload(
    state: SessionState,
    timeout: float = 180.0,
) -> dict:
    """Trigger UI to show the PAN-upload form and wait for the user to submit.

    Returns the submitted PAN payload or a timeout error.
    """
    loop = asyncio.get_event_loop()
    state.pan_future = loop.create_future()
    try:
        payload = await asyncio.wait_for(state.pan_future, timeout=timeout)
    except asyncio.TimeoutError:
        return {"ok": False, "reason": "pan_upload_timeout"}
    finally:
        state.pan_future = None

    pan = (payload.get("pan_number") or "").upper().strip()
    if not PAN_REGEX.match(pan):
        return {"ok": False, "reason": "invalid_pan_format", "received": pan}

    # Update profile
    state.profile.pan_number = pan
    state.profile.name = payload.get("name", state.profile.name)
    state.live_face_data_url = payload.get("photo_data_url")  # actually PAN photo

    # Audit
    await audit_client.append(
        state.session_id,
        "document.captured",
        {
            "doc_type": "pan",
            "pan_masked": pan[:4] + "****" + pan[-1],
            "name": payload.get("name", ""),
            "dob": payload.get("dob", ""),
        },
    )
    return {
        "ok": True,
        "pan_masked": pan[:4] + "****" + pan[-1],
        "name": payload.get("name", ""),
        "dob": payload.get("dob", ""),
    }
