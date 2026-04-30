"""Risk router: LightGBM default probability + SHAP top-3 + propensity."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from api.core import risk_model

router = APIRouter()


class RiskRequest(BaseModel):
    age: int
    monthly_income: int
    cibil: int
    dti: float
    employment_type: str
    existing_loans: int = 0
    dpd_30plus_last_12m: int = 0
    requested_amount: int = 0
    city: str = "Pune"


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
