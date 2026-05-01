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
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.post(f"{API_BASE}/fraud/aggregate", json=payload)
            r.raise_for_status()
            verdict = r.json()
    except Exception:
        return {"ok": False, "reason": "geo_service_unavailable"}

    if verdict.get("severity_max", 0) > 0:
        for s in verdict["signals"]:
            state.fraud_signals.append(s)
        state.fraud_severity_max = max(state.fraud_severity_max, verdict["severity_max"])
    return verdict


# ----------------------------------------------------------------------
# Demo-grade pre-check: fires age_mismatch + geo_mismatch the way the deck
# claims (3 v1-active detectors). For real ArcFace + InsightFace + IP geo we
# would call vendor SDKs here; for the prototype we pattern-match on the PAN
# prefix to make the three demo scenarios deterministic.
# ----------------------------------------------------------------------
async def precheck_age_and_geo(state: SessionState) -> dict:
    """Run age_mismatch + geo_mismatch detectors after PAN is captured.

    Mocked via PAN prefix so the demo scenarios are deterministic:
      FRAUD prefix -> declared_age=25 vs cv_age=42, declared Bangalore vs IP Delhi
      PRIYA / RAMES / others -> no age or geo signals.
    Real implementation would feed live frames to InsightFace and the actual
    browser geolocation into the haversine calculator.
    """
    pan = (state.profile.pan_number or "").upper()

    declared_age = state.profile.declared_age or 0
    cv_age = None
    declared_lat = state.profile.declared_lat
    declared_lng = state.profile.declared_lng
    actual_lat = None
    actual_lng = None
    if state.geo_actual:
        actual_lat = state.geo_actual.get("lat")
        actual_lng = state.geo_actual.get("lng")

    # Demo-grade pattern match for FRAUD prefix.
    if pan.startswith("FRAUD"):
        # Declared 25 (typical fraud age claim) vs CV-detected 42 -> SEV 2.
        if declared_age == 0:
            declared_age = 25
        cv_age = 42.0
        # Bangalore declared vs Delhi IP -> haversine ~1900 km -> SEV 2.
        # IMPORTANT: only fill defaults when the field is truly unset. Using
        # `x or default` would also match valid lat=0 (equator), so use
        # `is None` explicitly. We also never overwrite a customer-declared
        # value — only paint demo coords on top of None.
        if declared_lat is None:
            declared_lat = 12.97
        if declared_lng is None:
            declared_lng = 77.59
        if actual_lat is None:
            actual_lat = 28.61
        if actual_lng is None:
            actual_lng = 77.20

    # Nothing to score on this branch -> exit cleanly.
    if cv_age is None and (actual_lat is None or declared_lat is None):
        return {"ok": True, "signals_added": 0}

    payload: dict = {}
    if cv_age is not None and declared_age:
        payload["declared_age"] = declared_age
        payload["cv_age"] = cv_age
    if all(v is not None for v in (declared_lat, declared_lng, actual_lat, actual_lng)):
        payload["declared_lat"] = declared_lat
        payload["declared_lng"] = declared_lng
        payload["actual_lat"] = actual_lat
        payload["actual_lng"] = actual_lng
    if not payload:
        return {"ok": True, "signals_added": 0}

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.post(f"{API_BASE}/fraud/aggregate", json=payload)
            r.raise_for_status()
            verdict = r.json()
    except Exception:
        return {"ok": False, "reason": "fraud_aggregate_unavailable"}

    added = 0
    for s in verdict.get("signals", []):
        # Skip face_mismatch — already handled by verify_face explicitly.
        if s.get("signal") == "face_mismatch":
            continue
        state.fraud_signals.append(s)
        sev = int(s.get("severity", 0))
        state.fraud_severity_max = max(state.fraud_severity_max, sev)
        await audit_client.append(
            state.session_id,
            "fraud.flagged",
            {
                "signal": s.get("signal"),
                "severity": sev,
                "reason": s.get("reason", ""),
                "source": "auto_precheck",
            },
        )
        added += 1

    return {"ok": True, "signals_added": added,
            "severity_max": verdict.get("severity_max", 0)}
