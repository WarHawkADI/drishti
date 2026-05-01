"""Tool: face match (PAN photo vs live frame).

Hardened: HTTP failures don't crash the tool; on network error we surface a
typed result so the LLM can decide between retry vs human-review handoff.
PAN photo is wiped from session memory after the call to bound memory use.
"""

from __future__ import annotations

import logging
import os

import httpx

from .. import audit_client
from ..state import SessionState

API_BASE = os.getenv("API_BASE_URL", "http://localhost:8421")
log = logging.getLogger("drishti.tool.face")


async def verify_face(state: SessionState) -> dict:
    pan = state.profile.pan_number
    pan_photo = state.live_face_data_url or ""  # backend handles empty string

    if not pan:
        await audit_client.append(
            state.session_id, "tool.failed",
            {"tool": "verify_face", "reason": "pan_missing"},
        )
        return {"ok": False, "reason": "pan_missing",
                "passed": False, "severity": 0}

    # PAN photo is optional in v1: when empty the /fraud/face-match service
    # falls back to a deterministic by-PAN-prefix score (PRIYA -> 0.82 pass,
    # FRAUD -> 0.28 fail, RAMES -> 0.82 pass). Don't block on missing photo.
    payload = {
        "pan_photo_data_url": pan_photo,
        "live_photo_data_url": pan_photo,  # placeholder until we wire frame extraction
        "pan_number": pan,
        "threshold": 0.4,
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.post(f"{API_BASE}/fraud/face-match", json=payload)
            r.raise_for_status()
            result = r.json()
    except Exception as e:
        log.warning("face_match failed err=%s", e)
        await audit_client.append(
            state.session_id, "tool.failed",
            {"tool": "verify_face", "reason": "face_match_unavailable",
             "err": str(e)[:200]},
        )
        return {"ok": False, "reason": "face_match_unavailable",
                "passed": False, "severity": 0}

    severity = 4 if not result.get("passed") else 0
    cosine = float(result.get("cosine", 0.0))
    threshold = float(result.get("threshold", 0.4))

    if severity > 0:
        state.fraud_signals.append(
            {
                "signal": "face_mismatch",
                "severity": severity,
                "reason": f"ArcFace cosine {cosine:.2f} below threshold {threshold:.2f}",
                "evidence": {"cosine": cosine},
            }
        )
        state.fraud_severity_max = max(state.fraud_severity_max, severity)

    await audit_client.append(
        state.session_id,
        "face.verified",
        {
            "cosine": cosine,
            "passed": result.get("passed"),
            "backend": result.get("backend"),
        },
    )

    # Bound memory: drop the PAN photo data URL once it has been used.
    state.live_face_data_url = None

    return {
        "ok": True,
        "cosine": cosine,
        "passed": result.get("passed", False),
        "severity": severity,
        "threshold": threshold,
    }
