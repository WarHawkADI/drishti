"""Policy router: evaluates a profile + risk against the rule book + offer grid."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from api.core.policy_engine import Decision, Profile, RiskInput, get_engine

router = APIRouter()


EmploymentType = Literal[
    "salaried", "salaried_pvt", "salaried_govt", "self_employed", "other"
]


class ProfileIn(BaseModel):
    age: int = Field(..., ge=18, le=80)
    monthly_income: int = Field(..., ge=0, le=10_000_000)
    cibil: int = Field(..., ge=300, le=900)
    dti: float = Field(..., ge=0.0, le=2.0)
    employment_type: EmploymentType
    existing_loans: int = Field(0, ge=0, le=20)
    dpd_30plus_last_12m: int = Field(0, ge=0, le=12)
    requested_amount: int = Field(0, ge=0, le=20_000_000)
    requested_tenure: int = Field(36, ge=6, le=120)
    city: str = Field("Pune", min_length=1, max_length=50)


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
