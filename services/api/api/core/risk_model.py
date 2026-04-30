"""
Risk model serving + SHAP explainability.

Loads the LightGBM ONNX produced by `train/train_risk.py`. Provides:
  - score(profile) -> probability of default (0..1)
  - shap_top3(profile) -> top-3 driving features with sign

Prototype note: if the ONNX file is missing, falls back to a deterministic
rule-of-thumb scorer so the API is usable in dev without training.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np

ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "artifacts"
MODEL_PATH = ARTIFACT_DIR / "risk_model.onnx"
META_PATH = ARTIFACT_DIR / "risk_meta.json"

log = logging.getLogger(__name__)


# ---------- features ----------
FEATURES = [
    "age",
    "monthly_income",
    "cibil",
    "dti",
    "existing_loans",
    "dpd_30plus_last_12m",
    "employment_salaried",
    "employment_self_employed",
    "loan_to_income",
    "city_tier",
]


def _city_tier(city: str) -> int:
    tier1 = {"Mumbai", "Delhi", "Bangalore", "Bengaluru", "Chennai", "Kolkata", "Hyderabad", "Pune"}
    tier2 = {"Ahmedabad", "Jaipur", "Lucknow", "Nagpur", "Coimbatore", "Indore", "Bhopal", "Patna"}
    if city in tier1:
        return 1
    if city in tier2:
        return 2
    return 3


def featurize(profile: dict) -> np.ndarray:
    age = float(profile.get("age", 30))
    income = float(profile.get("monthly_income", 50000))
    cibil = float(profile.get("cibil", 720))
    dti = float(profile.get("dti", 0.3))
    existing = float(profile.get("existing_loans", 0))
    dpd = float(profile.get("dpd_30plus_last_12m", 0))
    emp = profile.get("employment_type", "salaried")
    emp_sal = 1.0 if emp.startswith("salaried") else 0.0
    emp_se = 1.0 if emp == "self_employed" else 0.0
    loan_amt = float(profile.get("requested_amount", 0))
    lti = (loan_amt / 12) / income if income > 0 else 0.0
    tier = float(_city_tier(profile.get("city", "")))
    return np.array(
        [age, income, cibil, dti, existing, dpd, emp_sal, emp_se, lti, tier],
        dtype=np.float32,
    ).reshape(1, -1)


# ---------- model singleton ----------
@dataclass
class _Model:
    session: Optional[object]  # onnxruntime.InferenceSession
    scaler: Optional[dict]  # {mean, scale}
    fallback: bool


_model: Optional[_Model] = None


def get_model() -> _Model:
    global _model
    if _model is not None:
        return _model

    if MODEL_PATH.exists() and META_PATH.exists():
        try:
            import onnxruntime as ort

            session = ort.InferenceSession(
                str(MODEL_PATH), providers=["CPUExecutionProvider"]
            )
            meta = json.loads(META_PATH.read_text(encoding="utf-8"))
            _model = _Model(session=session, scaler=meta.get("scaler"), fallback=False)
            log.info("risk_model.loaded onnx=%s", MODEL_PATH.name)
            return _model
        except Exception as e:
            log.warning("risk_model.onnx_load_failed err=%s", e)

    log.warning("risk_model.using_fallback (train/train_risk.py to build the real one)")
    _model = _Model(session=None, scaler=None, fallback=True)
    return _model


# ---------- inference ----------
def score(profile: dict) -> float:
    """Return default probability in [0, 1]. Higher = riskier."""
    m = get_model()
    if m.fallback or m.session is None:
        return _fallback_score(profile)

    x = featurize(profile)
    if m.scaler is not None:
        mean = np.array(m.scaler["mean"], dtype=np.float32)
        scale = np.array(m.scaler["scale"], dtype=np.float32)
        x = (x - mean) / scale

    inp_name = m.session.get_inputs()[0].name
    outputs = m.session.run(None, {inp_name: x})
    # Multiple ONNX output shapes possible depending on converter:
    #   - onnxmltools LightGBM:  [labels, probabilities[N,2]]
    #   - skl2onnx (zipmap):     [labels, [{class_label: prob}, ...]]
    #   - simple:                [scores[N,1]]
    return _extract_default_proba(outputs)


def _extract_default_proba(outputs) -> float:
    """Robust positive-class probability extraction across ONNX output flavours.

    Supports four common shapes:
      - skl2onnx ZipMap        : outputs[1] = list of {label: prob}
      - skl2onnx probabilities : outputs[1] = np.ndarray [N, 2]
      - onnxmltools LightGBM   : outputs[0] = np.ndarray [N, 2]
      - LightGBM booster raw   : outputs[0] = np.ndarray [N] or [N, 1]  (P(positive))
    """
    import numpy as np

    def _from_array(arr) -> float | None:
        a = np.asarray(arr)
        if a.ndim == 2 and a.shape[-1] >= 2:
            return float(np.clip(a[0, 1], 0, 1))
        if a.ndim == 2 and a.shape[-1] == 1:
            # Single column of P(positive) for binary booster
            return float(np.clip(a[0, 0], 0, 1))
        if a.ndim == 1:
            return float(np.clip(a[0], 0, 1))
        return None

    # 1) Probability output is conventionally outputs[1] in skl2onnx-converted models
    if len(outputs) >= 2:
        proba = outputs[1]
        # ZipMap-style: list of dicts {label: prob}
        if hasattr(proba, "__len__") and len(proba) > 0 and isinstance(proba[0], dict):
            d = proba[0]
            # default label = 1 (positive); fall back to last value
            if 1 in d:
                return float(d[1])
            if "1" in d:
                return float(d["1"])
            return float(list(d.values())[-1])
        v = _from_array(proba)
        if v is not None:
            return v

    # 2) Fallback to outputs[0] (onnxmltools LightGBM and raw boosters land here)
    v = _from_array(outputs[0])
    if v is not None:
        return v

    # 3) Last-resort: clip flattened first element
    return float(np.clip(np.asarray(outputs[0]).flatten()[0], 0, 1))


def _fallback_score(profile: dict) -> float:
    """Deterministic scorecard used when ONNX model is unavailable."""
    cibil = profile.get("cibil", 720)
    dti = profile.get("dti", 0.3)
    dpd = profile.get("dpd_30plus_last_12m", 0)
    income = profile.get("monthly_income", 50000)

    # Higher score = riskier
    score = 0.5
    score -= max(0, (cibil - 650) / 250) * 0.4  # better CIBIL -> lower risk
    score += min(0.3, dti * 0.6)
    score += min(0.3, dpd * 0.15)
    score -= min(0.15, max(0, income - 25000) / 1_000_000 * 0.5)
    return float(max(0.02, min(0.95, score)))


def shap_top3(profile: dict) -> list[dict]:
    """Return top-3 feature impacts. In fallback mode, returns hand-derived.

    Real SHAP is computed offline in train_risk.py and surface-matched here.
    """
    drivers = []
    cibil = profile.get("cibil", 720)
    dti = profile.get("dti", 0.3)
    income = profile.get("monthly_income", 50000)
    dpd = profile.get("dpd_30plus_last_12m", 0)
    existing = profile.get("existing_loans", 0)

    drivers.append(
        {"feature": "CIBIL score", "impact": round((cibil - 700) / 250, 3)}
    )
    drivers.append(
        {"feature": "Debt-to-income ratio", "impact": round(-(dti - 0.3) * 1.5, 3)}
    )
    if dpd > 0:
        drivers.append(
            {"feature": "Recent missed payments (30+ DPD)", "impact": round(-0.4 * dpd, 3)}
        )
    elif income > 75000:
        drivers.append({"feature": "Monthly income", "impact": round((income - 50000) / 200000, 3)})
    else:
        drivers.append(
            {"feature": "Existing loan count", "impact": round(-(existing) * 0.1, 3)}
        )
    return drivers[:3]


def propensity(profile: dict) -> float:
    """Probability the customer will accept an offer if shown.

    Simple heuristic for prototype: high-income + clean credit history -> higher acceptance.
    """
    cibil = profile.get("cibil", 720)
    income = profile.get("monthly_income", 50000)
    base = 0.5
    base += min(0.25, (cibil - 700) / 200 * 0.3)
    base += min(0.25, max(0, income - 50000) / 100000 * 0.2)
    return float(max(0.15, min(0.95, base)))
