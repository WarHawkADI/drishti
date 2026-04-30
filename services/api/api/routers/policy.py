"""Policy router: evaluates a profile + risk against the rule book + offer grid."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from api.core.policy_engine import Decision, Profile, RiskInput, get_engine

router = APIRouter()


class ProfileIn(BaseModel):
    age: int = Field(..., ge=18, le=80)
    monthly_income: int = Field(..., ge=0)
    cibil: int = Field(..., ge=300, le=900)
    dti: float = Field(..., ge=0.0, le=2.0)
    employment_type: str
    existing_loans: int = 0
    dpd_30plus_last_12m: int = 0
    requested_amount: int = 0
    requested_tenure: int = 36
    city: str = "Pune"


class RiskIn(BaseModel):
    risk_score: float = Field(0.0, ge=0.0, le=1.0)
    propensity: float = Field(0.5, ge=0.0, le=1.0)
    fraud_severity_max: int = Field(0, ge=0, le=5)
    shap_top3: list[dict] = []


class EvaluateRequest(BaseModel):
    profile: ProfileIn
    risk: RiskIn = Field(default_factory=RiskIn)


@router.post("/evaluate")
def evaluate(req: EvaluateRequest) -> dict:
    engine = get_engine()
    profile = Profile(**req.profile.model_dump())
    risk = RiskInput(**req.risk.model_dump())
    decision: Decision = engine.evaluate(profile, risk)
    return decision.to_dict()


@router.get("/rules")
def list_rules():
    """Return the loaded rulebook for transparency."""
    engine = get_engine()
    return engine._rules  # noqa: SLF001


@router.get("/grid")
def list_grid():
    engine = get_engine()
    return engine._grid  # noqa: SLF001
