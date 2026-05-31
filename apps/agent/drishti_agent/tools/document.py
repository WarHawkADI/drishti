"""Tool: request PAN upload from the UI and wait for it."""

from __future__ import annotations

import asyncio
import re
from datetime import date, datetime

from .. import audit_client
from ..state import SessionState

PAN_REGEX = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")


def _age_from_dob(dob: str) -> int:
    try:
        d = datetime.strptime(dob, "%Y-%m-%d").date()
    except ValueError:
        return 0
    today = date.today()
    age = today.year - d.year
    if (today.month, today.day) < (d.month, d.day):
        age -= 1
    return age


async def request_pan_upload(
    state: SessionState,
    timeout: float = 180.0,
) -> dict:
    """Trigger UI to show the PAN-upload form and wait for the user to submit.

    Returns the submitted PAN payload or a timeout error.
    """
    loop = asyncio.get_event_loop()
    state.pan_future = loop.create_future()
    if state.pending_pan_payload is not None:
        state.pan_future.set_result(state.pending_pan_payload)
        state.pending_pan_payload = None
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
    state.profile.pan_age = _age_from_dob(payload.get("dob", ""))
    state.pan_photo_data_url = payload.get("photo_data_url") or ""
    state.live_face_data_url = payload.get("live_photo_data_url") or ""

    # Audit
    await audit_client.append(
        state.session_id,
        "document.captured",
        {
            "doc_type": "pan",
            "pan_masked": pan[:4] + "****" + pan[-1],
            "name": payload.get("name", ""),
            "dob": payload.get("dob", ""),
            "pan_age": state.profile.pan_age,
            "pan_photo_supplied": bool(state.pan_photo_data_url),
            "live_photo_supplied": bool(state.live_face_data_url),
        },
    )
    return {
        "ok": True,
        "pan_masked": pan[:4] + "****" + pan[-1],
        "name": payload.get("name", ""),
        "dob": payload.get("dob", ""),
    }
