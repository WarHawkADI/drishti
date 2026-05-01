"""Risk router: LightGBM default probability + SHAP top-3 + propensity."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from api.core import risk_model

router = APIRouter()


EmploymentType = Literal[
    "salaried", "salaried_pvt", "salaried_govt", "self_employed", "other"
]


class RiskRequest(BaseModel):
    age: int = Field(..., ge=18, le=80)
    monthly_income: int = Field(..., ge=0, le=10_000_000)
    cibil: int = Field(..., ge=300, le=900)
    dti: float = Field(..., ge=0.0, le=2.0)
    employment_type: EmploymentType
    existing_loans: int = Field(0, ge=0, le=20)
    dpd_30plus_last_12m: int = Field(0, ge=0, le=12)
    requested_amount: int = Field(0, ge=0, le=20_000_000)
    city: str = Field("Pune", min_length=1, max_length=50)


@router.post("/score")
def score(req: RiskRequest):
    profile = req.model_dump()
    s = risk_model.score(profile)
    p = risk_model.propensity(profile)
    drivers = risk_model.shap_top3(profile)
    band = "Low" if s < 0.25 else ("Medium" if s < 0.55 else "High")
    return {
        "risk_score": round(s, 4),
        "risk_band": band,
        "propensity": round(p, 4),
        "shap_top3": drivers,
        "fallback": risk_model.get_model().fallback,
    }
