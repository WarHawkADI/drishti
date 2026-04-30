"""Tool: pull mock CIBIL bureau record."""

from __future__ import annotations

import os

import httpx

from .. import audit_client
from ..state import SessionState

API_BASE = os.getenv("API_BASE_URL", "http://localhost:8421")


async def check_bureau(state: SessionState) -> dict:
    pan = state.profile.pan_number
    if not pan:
        return {"ok": False, "reason": "pan_missing"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(f"{API_BASE}/bureau/lookup/{pan}")
        r.raise_for_status()
        rec = r.json()

    state.bureau = rec
    await audit_client.append(
        state.session_id,
        "bureau.pulled",
        {
            "pan_masked": pan[:4] + "****" + pan[-1],
            "cibil": rec["cibil"],
            "existing_loans": rec["existing_loans"],
            "dpd": rec["dpd_30plus_last_12m"],
        },
    )
    return {
        "ok": True,
        "cibil": rec["cibil"],
        "existing_loans": rec["existing_loans"],
        "dpd_30plus_last_12m": rec["dpd_30plus_last_12m"],
        "segment": rec.get("segment", ""),
    }
