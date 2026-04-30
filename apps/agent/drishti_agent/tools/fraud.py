"""Tool: fraud signal aggregation + flagging."""

from __future__ import annotations

import os

import httpx

from .. import audit_client
from ..state import SessionState

API_BASE = os.getenv("API_BASE_URL", "http://localhost:8421")


async def flag_fraud(
    state: SessionState,
    signal: str,
    severity: int,
    reason: str,
    evidence: dict | None = None,
) -> dict:
    """LLM-callable: register a fraud signal it has detected via answer cross-check."""
    state.fraud_signals.append(
        {
            "signal": signal,
            "severity": severity,
            "reason": reason,
            "evidence": evidence or {},
        }
    )
    state.fraud_severity_max = max(state.fraud_severity_max, severity)

    await audit_client.append(
        state.session_id,
        "fraud.flagged",
        {"signal": signal, "severity": severity, "reason": reason},
    )
    return {"ok": True, "severity_max": state.fraud_severity_max}


async def run_geo_check(state: SessionState) -> dict:
    """If we have both declared and actual coordinates, check distance."""
    if (
        state.profile.declared_lat is None
        or state.geo_actual is None
    ):
        return {"ok": False, "reason": "missing_geo_inputs"}

    payload = {
        "declared_lat": state.profile.declared_lat,
        "declared_lng": state.profile.declared_lng,
        "actual_lat": state.geo_actual["lat"],
        "actual_lng": state.geo_actual["lng"],
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(f"{API_BASE}/fraud/aggregate", json=payload)
        r.raise_for_status()
        verdict = r.json()
    if verdict.get("severity_max", 0) > 0:
        for s in verdict["signals"]:
            state.fraud_signals.append(s)
        state.fraud_severity_max = max(state.fraud_severity_max, verdict["severity_max"])
    return verdict
