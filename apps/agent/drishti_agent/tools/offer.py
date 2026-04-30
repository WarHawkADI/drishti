"""
Tool: evaluate_offer.

Combines risk scoring + policy evaluation in one call. Returns a structured
decision the LLM can narrate. Updates SessionState with the result.
"""

from __future__ import annotations

import asyncio
import os

import httpx

from .. import audit_client
from ..state import SessionState

API_BASE = os.getenv("API_BASE_URL", "http://localhost:8421")


def _estimate_emi(principal: float, rate_pct: float = 14.0, tenure_months: int = 36) -> float:
    """Standard reducing-balance EMI estimate. Used for DTI projection."""
    r = rate_pct / 100 / 12
    n = tenure_months
    if r == 0 or n == 0:
        return principal / max(n, 1)
    return principal * r * (1 + r) ** n / ((1 + r) ** n - 1)


def _build_profile(state: SessionState) -> dict:
    p = state.profile
    bureau = state.bureau or {}
    requested = p.requested_amount or 300_000
    cibil = bureau.get("cibil", 720)
    income = max(p.monthly_income or 50_000, 1)

    # Existing obligations: prefer bureau-supplied EMI if present, else estimate
    # by # of active loans * a typical retail-loan EMI.
    existing_emi = bureau.get("existing_emi") or bureau.get("existing_loans", 0) * 8_500
    # Projected EMI for the requested loan (worst-case base rate)
    projected_emi = _estimate_emi(requested, rate_pct=14.0, tenure_months=36)
    # DTI = (existing + projected) / income, clamped to [0, 0.99]
    dti = round(min((existing_emi + projected_emi) / income, 0.99), 3)

    return {
        "age": p.declared_age or 30,
        "monthly_income": income,
        "cibil": cibil,
        "dti": dti,
        "employment_type": p.employment_type or "salaried",
        "existing_loans": bureau.get("existing_loans", 0),
        "dpd_30plus_last_12m": bureau.get("dpd_30plus_last_12m", 0),
        "requested_amount": requested,
        "requested_tenure": 36,
        "city": p.declared_city or "Pune",
    }


async def evaluate_offer(state: SessionState) -> dict:
    profile = _build_profile(state)

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Risk
        risk_r = await client.post(f"{API_BASE}/risk/score", json=profile)
        risk_r.raise_for_status()
        risk = risk_r.json()
        state.risk_score = risk["risk_score"]
        state.risk_band = risk["risk_band"]
        state.propensity = risk["propensity"]
        state.shap_top3 = risk.get("shap_top3", [])

        # Policy
        policy_payload = {
            "profile": profile,
            "risk": {
                "risk_score": risk["risk_score"],
                "propensity": risk["propensity"],
                "fraud_severity_max": state.fraud_severity_max,
                "shap_top3": risk.get("shap_top3", []),
            },
        }
        pol_r = await client.post(f"{API_BASE}/policy/evaluate", json=policy_payload)
        pol_r.raise_for_status()
        decision = pol_r.json()

    state.decision = decision["decision"]

    await audit_client.append(
        state.session_id,
        "decision.computed",
        {
            "decision": decision["decision"],
            "rules_fired": decision.get("rules_fired", []),
            "matched_cell": decision.get("matched_cell"),
            "risk_score": risk["risk_score"],
            "risk_band": risk["risk_band"],
        },
    )

    return {
        "decision": decision["decision"],
        "offers": decision.get("offers", []),
        "reason": decision.get("reason"),
        "next_best_action": decision.get("next_best_action"),
        "matched_cell": decision.get("matched_cell"),
        "rules_fired": decision.get("rules_fired", []),
        "risk_score": risk["risk_score"],
        "risk_band": risk["risk_band"],
        "shap_top3": risk.get("shap_top3", []),
    }


async def wait_for_offer_selection(state: SessionState, timeout: float = 120.0) -> dict:
    """Wait for the customer to select a tier on the UI."""
    loop = asyncio.get_event_loop()
    state.offer_future = loop.create_future()
    try:
        sel = await asyncio.wait_for(state.offer_future, timeout=timeout)
    except asyncio.TimeoutError:
        return {"ok": False, "reason": "offer_selection_timeout"}
    finally:
        state.offer_future = None

    state.selected_tier = sel.get("tier")
    await audit_client.append(
        state.session_id,
        "offer.selected",
        {"tier": state.selected_tier},
    )
    return {"ok": True, "tier": state.selected_tier}
