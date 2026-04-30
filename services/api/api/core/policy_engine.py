"""
Drishti policy engine.

Loads YAML rule + offer-grid files, evaluates a (profile, risk) tuple,
and returns one of:
    decision = "offer" | "soft_decline" | "hard_decline" | "route_to_human"

The LLM does NOT decide. The LLM only narrates what this engine returned.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import yaml

DATA_DIR = Path(__file__).resolve().parents[1] / "data"


@dataclass
class Profile:
    age: int
    monthly_income: int
    cibil: int
    dti: float
    employment_type: str
    existing_loans: int = 0
    dpd_30plus_last_12m: int = 0
    requested_amount: int = 0
    requested_tenure: int = 36
    city: str = "Pune"


@dataclass
class RiskInput:
    risk_score: float = 0.0  # 0..1, higher = riskier
    propensity: float = 0.5
    fraud_severity_max: int = 0
    shap_top3: list[dict] = field(default_factory=list)


@dataclass
class OfferTier:
    tier: str
    amount: int
    rate_pct: float
    tenure_months: int
    emi: int
    processing_fee: int
    total_cost_of_credit: int

    def to_dict(self) -> dict:
        return self.__dict__


@dataclass
class Decision:
    decision: str
    rules_fired: list[str] = field(default_factory=list)
    rules_failed: list[dict] = field(default_factory=list)
    offers: list[OfferTier] = field(default_factory=list)
    reason: Optional[str] = None
    next_best_action: Optional[str] = None
    matched_cell: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "decision": self.decision,
            "rules_fired": self.rules_fired,
            "rules_failed": self.rules_failed,
            "offers": [o.to_dict() for o in self.offers],
            "reason": self.reason,
            "next_best_action": self.next_best_action,
            "matched_cell": self.matched_cell,
        }


def _load_yaml(name: str) -> dict:
    return yaml.safe_load((DATA_DIR / name).read_text(encoding="utf-8"))


def _in_range(value: float, lo, hi) -> bool:
    if lo is not None and value < lo:
        return False
    if hi is not None and value >= hi:
        return False
    return True


def _eval_rule(expr: str, profile: Profile, risk: RiskInput) -> bool:
    safe_globals = {"__builtins__": {}}
    safe_locals = {"profile": profile, "risk": risk}
    return bool(eval(expr, safe_globals, safe_locals))  # noqa: S307


def _emi(p: int, rate_pct: float, n: int) -> int:
    """Standard reducing-balance EMI formula. p: principal, rate annual %, n months."""
    r = rate_pct / 100 / 12
    if r == 0:
        return int(p / n)
    emi_amt = p * r * (1 + r) ** n / ((1 + r) ** n - 1)
    return int(round(emi_amt))


class PolicyEngine:
    def __init__(self):
        self._rules = _load_yaml("rules.yaml")
        self._grid = _load_yaml("grid.yaml")

    # ---------- public API ----------
    def evaluate(self, profile: Profile, risk: RiskInput) -> Decision:
        # 1. Run hard rules first
        rules_fired: list[str] = []
        rules_failed: list[dict] = []
        for rule in self._rules["rules"]:
            try:
                ok = _eval_rule(rule["check"], profile, risk)
            except Exception:
                ok = False
            if ok:
                rules_fired.append(rule["id"])
            else:
                rules_failed.append(
                    {
                        "id": rule["id"],
                        "on_fail": rule["on_fail"],
                        "reason": rule["reason"],
                        "next_best_action": rule.get("next_best_action", ""),
                    }
                )

        # 2. Decide based on first failure (priority: hard > human > soft)
        if rules_failed:
            for severity in ("hard_decline", "route_to_human", "soft_decline"):
                first = next(
                    (r for r in rules_failed if r["on_fail"] == severity), None
                )
                if first:
                    return Decision(
                        decision=severity,
                        rules_fired=rules_fired,
                        rules_failed=rules_failed,
                        reason=first["reason"],
                        next_best_action=first.get("next_best_action") or None,
                    )

        # 3. All rules passed - find an offer cell
        cell = self._find_cell(profile)
        if cell is None:
            return Decision(
                decision="soft_decline",
                rules_fired=rules_fired,
                reason="No matching offer band for your profile.",
                next_best_action="Reapply once your CIBIL crosses 720.",
            )

        # 4. Build 3 tiers from the matched cell
        offers = self._build_offers(cell, profile, risk)

        return Decision(
            decision="offer",
            rules_fired=rules_fired,
            rules_failed=rules_failed,
            offers=offers,
            matched_cell=cell["id"],
        )

    # ---------- internals ----------
    def _find_cell(self, profile: Profile) -> Optional[dict]:
        for cell in self._grid["cells"]:
            m = cell["match"]
            if not _in_range(profile.cibil, *m["cibil"]):
                continue
            if not _in_range(profile.monthly_income, *m["monthly_income"]):
                continue
            if profile.employment_type not in m["employment_type"]:
                continue
            return cell
        return None

    def _build_offers(
        self, cell: dict, profile: Profile, risk: RiskInput
    ) -> list[OfferTier]:
        max_amount = int(cell["offer"]["max_amount"])
        base_rate = float(cell["offer"]["base_rate_pct"])
        tenures = cell["offer"]["tenure_months"]
        # Risk-adjusted rate: higher risk_score nudges rate up by up to +0.5%
        rate = base_rate + (risk.risk_score - 0.5) * 1.0
        rate = max(base_rate - 0.5, min(base_rate + 1.0, rate))
        rate = round(rate, 2)

        # Tier amounts: conservative 50%, standard 75%, stretch 100%
        # Constrained by requested if smaller and DTI cap
        affordable_emi = profile.monthly_income * 0.4
        # Pick tenure middle
        mid_tenure = tenures[len(tenures) // 2]
        long_tenure = tenures[-1]
        short_tenure = tenures[0]

        amounts = {
            "conservative": min(int(max_amount * 0.5), profile.requested_amount or max_amount),
            "standard": min(int(max_amount * 0.75), profile.requested_amount or max_amount),
            "stretch": min(max_amount, profile.requested_amount or max_amount),
        }
        tenure_map = {
            "conservative": short_tenure,
            "standard": mid_tenure,
            "stretch": long_tenure,
        }
        rate_map = {
            "conservative": round(rate - 0.25, 2),
            "standard": rate,
            "stretch": round(rate + 0.4, 2),
        }

        out: list[OfferTier] = []
        for tier in ("conservative", "standard", "stretch"):
            amt = amounts[tier]
            n = tenure_map[tier]
            r = rate_map[tier]
            emi = _emi(amt, r, n)
            # If EMI exceeds affordable, skip this tier for safety
            if emi > affordable_emi and tier != "conservative":
                continue
            pf = int(amt * 0.01)
            cost = emi * n - amt
            out.append(
                OfferTier(
                    tier=tier,
                    amount=amt,
                    rate_pct=r,
                    tenure_months=n,
                    emi=emi,
                    processing_fee=pf,
                    total_cost_of_credit=cost,
                )
            )
        return out


# ---------- singleton ----------
_engine: Optional[PolicyEngine] = None


def get_engine() -> PolicyEngine:
    global _engine
    if _engine is None:
        _engine = PolicyEngine()
    return _engine
