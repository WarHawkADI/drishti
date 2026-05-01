"""Tool: pull mock CIBIL bureau record.

Resilience: if the bureau API is unreachable or returns an error, we surface a
typed error to the LLM and write a tool-failure event to the audit chain so the
session record remains consistent.
"""

from __future__ import annotations

import logging
import os

import httpx

from .. import audit_client
from ..state import SessionState

API_BASE = os.getenv("API_BASE_URL", "http://localhost:8421")
log = logging.getLogger("drishti.tool.bureau")


async def check_bureau(state: SessionState) -> dict:
    pan = state.profile.pan_number
    if not pan:
        await audit_client.append(
            state.session_id, "tool.failed",
            {"tool": "check_bureau", "reason": "pan_missing"},
        )
        return {"ok": False, "reason": "pan_missing"}

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(f"{API_BASE}/bureau/lookup/{pan}")
            r.raise_for_status()
            rec = r.json()
    except httpx.HTTPStatusError as e:
        log.warning("bureau.lookup non-2xx status=%s", e.response.status_code)
        await audit_client.append(
            state.session_id, "tool.failed",
            {"tool": "check_bureau", "reason": "bureau_status",
             "status": e.response.status_code},
        )
        return {"ok": False, "reason": "bureau_unavailable",
                "details": f"status_{e.response.status_code}"}
    except Exception as e:
        log.warning("bureau.lookup failed err=%s", e)
        await audit_client.append(
            state.session_id, "tool.failed",
            {"tool": "check_bureau", "reason": "bureau_network",
             "err": str(e)[:200]},
        )
        return {"ok": False, "reason": "bureau_unavailable",
                "details": "network_error"}

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
