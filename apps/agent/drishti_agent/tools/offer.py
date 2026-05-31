"""
Tool: evaluate_offer.

Combines risk scoring + policy evaluation in one call. Returns a structured
decision the LLM can narrate. Updates SessionState with the result.

Hardened: HTTP failures on either /risk/score or /policy/evaluate produce a
typed `human_review` recommendation rather than crashing the tool — the LLM
is instructed in the prompt to politely route to a human and end the session.
"""

from __future__ import annotations

import logging
import os
from copy import deepcopy

import httpx

from .. import audit_client
from ..state import SessionState

API_BASE = os.getenv("API_BASE_URL", "http://localhost:8421")
log = logging.getLogger("drishti.tool.offer")


REQUIRED_PROFILE_FIELDS = (
    "age",
    "monthly_income",
    "employment_type",
    "loan_purpose",
    "requested_amount",
    "declared_city",
)


def _estimate_emi(principal: float, rate_pct: float = 14.0, tenure_months: int = 36) -> float:
    """Standard reducing-balance EMI estimate. Used for DTI projection."""
    r = rate_pct / 100 / 12
    n = tenure_months
    if r == 0 or n == 0:
        return principal / max(n, 1)
    return principal * r * (1 + r) ** n / ((1 + r) ** n - 1)


def _build_profile(state: SessionState) -> dict:
    p = state.profile
    if not state.bureau:
        raise RuntimeError("bureau_required")
    bureau = state.bureau
    requested = p.requested_amount
    if requested <= 0:
        raise RuntimeError("requested_amount_required")
    cibil = bureau["cibil"]
    if p.declared_age <= 0:
        raise RuntimeError("age_required")
    if p.monthly_income <= 0:
        raise RuntimeError("monthly_income_required")
    if not p.employment_type:
        raise RuntimeError("employment_type_required")
    if not p.declared_city:
        raise RuntimeError("declared_city_required")
    income = p.monthly_income

    existing_emi = bureau.get("existing_emi") or bureau.get("existing_loans", 0) * 8_500
    projected_emi = _estimate_emi(requested, rate_pct=14.0, tenure_months=36)
    dti = round(min((existing_emi + projected_emi) / income, 0.99), 3)

    return {
        "age": p.declared_age,
        "monthly_income": income,
        "cibil": cibil,
        "dti": dti,
        "employment_type": p.employment_type,
        "existing_loans": bureau.get("existing_loans", 0),
        "dpd_30plus_last_12m": bureau.get("dpd_30plus_last_12m", 0),
        "requested_amount": requested,
        "requested_tenure": 36,
        "city": p.declared_city,
    }


def _profile_payload(state: SessionState) -> dict:
    p = state.profile
    return {
        "age": p.declared_age,
        "monthly_income": p.monthly_income,
        "employment_type": p.employment_type,
        "loan_purpose": p.loan_purpose,
        "requested_amount": p.requested_amount,
        "declared_city": p.declared_city,
    }


def _profile_ready(profile: dict) -> bool:
    return all(profile.get(k) for k in REQUIRED_PROFILE_FIELDS)


def profile_confirmation_status(state: SessionState) -> dict:
    profile = _profile_payload(state)
    if not _profile_ready(profile):
        return {
            "ok": False,
            "reason": "profile_incomplete",
            "profile": profile,
        }
    if state.confirmed_profile_snapshot != profile:
        return {
            "ok": False,
            "reason": "profile_confirmation_required",
            "profile": profile,
        }
    return {"ok": True, "profile": profile}


async def evaluate_offer(state: SessionState) -> dict:
    confirmed = profile_confirmation_status(state)
    if not confirmed["ok"]:
        await audit_client.append(
            state.session_id,
            "tool.failed",
            {
                "tool": "evaluate_offer",
                "reason": confirmed["reason"],
                "profile": confirmed.get("profile", {}),
            },
        )
        return {
            "decision": "human_review",
            "offers": [],
            "reason": "Application details were not confirmed by the customer.",
            "next_best_action": "Confirm income, employment, loan amount, purpose, and city before scoring.",
            "matched_cell": None,
            "rules_fired": [],
            "risk_score": None,
            "risk_band": None,
            "shap_top3": [],
            "ok": False,
            "error": confirmed["reason"],
        }

    try:
        profile = _build_profile(state)
    except Exception as e:
        await audit_client.append(
            state.session_id,
            "tool.failed",
            {"tool": "evaluate_offer", "reason": str(e)[:100]},
        )
        return {
            "decision": "human_review",
            "offers": [],
            "reason": "We could not verify the credit bureau details for this application.",
            "next_best_action": "A human colleague will review your application and reach you within 24 hours.",
            "matched_cell": None,
            "rules_fired": [],
            "risk_score": None,
            "risk_band": None,
            "shap_top3": [],
            "ok": False,
            "error": str(e)[:100],
        }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            risk_r = await client.post(f"{API_BASE}/risk/score", json=profile)
            risk_r.raise_for_status()
            risk = risk_r.json()
            state.risk_score = risk["risk_score"]
            state.risk_band = risk["risk_band"]
            state.propensity = risk["propensity"]
            state.shap_top3 = risk.get("shap_top3", [])

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
    except Exception as e:
        log.warning("evaluate_offer pipeline failed err=%s", e)
        await audit_client.append(
            state.session_id,
            "tool.failed",
            {"tool": "evaluate_offer", "reason": "policy_or_risk_unavailable",
             "err": str(e)[:200]},
        )
        # Surface a clean human_review recommendation; the prompt tells the LLM
        # to politely route to a human and end the session on tool failure.
        return {
            "decision": "human_review",
            "offers": [],
            "reason": "We are experiencing a temporary technical issue.",
            "next_best_action":
                "A human colleague will review your application and reach you within 24 hours.",
            "matched_cell": None,
            "rules_fired": [],
            "risk_score": None,
            "risk_band": None,
            "shap_top3": [],
            "ok": False,
        }

    state.decision = decision["decision"]
    state.current_offers = decision.get("offers", [])
    state.offer_version += 1
    state.selected_tier = None
    state.selected_offer_snapshot = None

    await audit_client.append(
        state.session_id,
        "decision.computed",
        {
            "decision": decision["decision"],
            "profile": {
                **profile,
                "pan_masked": (
                    state.profile.pan_number[:4] + "****" + state.profile.pan_number[-1]
                    if state.profile.pan_number
                    else ""
                ),
            },
            "risk": {
                "risk_score": risk["risk_score"],
                "risk_band": risk["risk_band"],
                "propensity": risk["propensity"],
                "fraud_severity_max": state.fraud_severity_max,
                "shap_top3": risk.get("shap_top3", []),
            },
            "rules_fired": decision.get("rules_fired", []),
            "rules_failed": decision.get("rules_failed", []),
            "matched_cell": decision.get("matched_cell"),
            "offers": deepcopy(state.current_offers),
            "offer_version": state.offer_version,
        },
    )

    return {
        "decision": decision["decision"],
        "offers": decision.get("offers", []),
        "offer_version": state.offer_version,
        "reason": decision.get("reason"),
        "next_best_action": decision.get("next_best_action"),
        "matched_cell": decision.get("matched_cell"),
        "rules_fired": decision.get("rules_fired", []),
        "risk_score": risk["risk_score"],
        "risk_band": risk["risk_band"],
        "shap_top3": risk.get("shap_top3", []),
        "ok": True,
    }


async def wait_for_offer_selection(state: SessionState, timeout: float = 120.0) -> dict:
    """Wait for the customer to select a tier on the UI."""
    import asyncio
    if state.decision != "offer" or not state.current_offers:
        return {"ok": False, "reason": "no_active_offer"}
    loop = asyncio.get_event_loop()
    state.offer_future = loop.create_future()
    if state.pending_offer_payload is not None:
        pending_version = state.pending_offer_payload.get("offer_version")
        if pending_version in (None, state.offer_version):
            state.offer_future.set_result(state.pending_offer_payload)
        state.pending_offer_payload = None
    try:
        sel = await asyncio.wait_for(state.offer_future, timeout=timeout)
    except asyncio.TimeoutError:
        await audit_client.append(
            state.session_id,
            "offer.selection_timeout",
            {"timeout_seconds": timeout},
        )
        return {"ok": False, "reason": "offer_selection_timeout"}
    finally:
        state.offer_future = None

    tier = sel.get("tier")
    if sel.get("offer_version") not in (None, state.offer_version):
        await audit_client.append(
            state.session_id,
            "tool.failed",
            {
                "tool": "wait_for_offer_selection",
                "reason": "stale_offer_version",
                "received": sel.get("offer_version"),
                "current": state.offer_version,
            },
        )
        return {"ok": False, "reason": "stale_offer_version"}
    offer = next((o for o in state.current_offers if o.get("tier") == tier), None)
    if offer is None:
        await audit_client.append(
            state.session_id,
            "tool.failed",
            {"tool": "wait_for_offer_selection", "reason": "invalid_tier", "tier": tier},
        )
        return {"ok": False, "reason": "invalid_tier"}

    state.selected_tier = tier
    state.selected_offer_snapshot = {
        **deepcopy(offer),
        "offer_version": state.offer_version,
    }
    await audit_client.append(
        state.session_id,
        "offer.selected",
        {"tier": state.selected_tier, "offer": state.selected_offer_snapshot},
    )
    return {"ok": True, "tier": state.selected_tier, "offer": state.selected_offer_snapshot}
