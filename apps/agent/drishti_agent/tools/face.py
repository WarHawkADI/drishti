"""Tool: face match (PAN photo vs live frame)."""

from __future__ import annotations

import os

import httpx

from .. import audit_client
from ..state import SessionState

API_BASE = os.getenv("API_BASE_URL", "http://localhost:8421")


async def verify_face(state: SessionState) -> dict:
    """Compare the PAN photo against the latest live frame via the fraud service.

    For prototype, the 'live frame' isn't extracted from the video stream — we
    use the deterministic fallback in /fraud/face-match keyed off the PAN
    prefix (so demo scenarios are reproducible).
    """
    pan = state.profile.pan_number
    pan_photo = state.live_face_data_url  # In v1, PAN upload is the only image we have

    payload = {
        "pan_photo_data_url": pan_photo,
        "live_photo_data_url": pan_photo,  # placeholder until we wire frame extraction
        "pan_number": pan,
        "threshold": 0.4,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(f"{API_BASE}/fraud/face-match", json=payload)
        r.raise_for_status()
        result = r.json()

    severity = 4 if not result["passed"] else 0
    if severity > 0:
        state.fraud_signals.append(
            {
                "signal": "face_mismatch",
                "severity": severity,
                "reason": f"ArcFace cosine {result['cosine']:.2f} below threshold {result['threshold']}",
                "evidence": {"cosine": result["cosine"]},
            }
        )
        state.fraud_severity_max = max(state.fraud_severity_max, severity)

    await audit_client.append(
        state.session_id,
        "face.verified",
        {
            "cosine": result["cosine"],
            "passed": result["passed"],
            "backend": result.get("backend"),
        },
    )

    return {
        "cosine": result["cosine"],
        "passed": result["passed"],
        "severity": severity,
        "threshold": result["threshold"],
    }
