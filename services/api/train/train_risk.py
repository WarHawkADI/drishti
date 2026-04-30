"""
Train the Drishti risk model.

Generates synthetic Indian-flavored loan data (no external dataset required),
trains a LightGBM binary classifier (default vs no-default), exports to ONNX,
and writes a meta JSON containing the StandardScaler params.

Run once:
    cd services/api
    python -m train.train_risk

Outputs:
    api/artifacts/risk_model.onnx
    api/artifacts/risk_meta.json
"""

from __future__ import annotations

import json
import logging
import random
from pathlib import Path

import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier
from onnxmltools import convert_lightgbm
from onnxmltools.convert.common.data_types import FloatTensorType
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("train")

ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "api" / "artifacts"
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

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


def synthesize(n: int = 20_000, seed: int = 42) -> pd.DataFrame:
    """Generate a realistic-ish Indian-loan dataset.

    Default probability is a deterministic function of the features plus
    a small stochastic component, ensuring the trained model captures
    intuitive relationships (low CIBIL, high DTI, recent DPD -> higher default).
    """
    rng = np.random.default_rng(seed)
    age = rng.integers(21, 60, n)
    income = rng.lognormal(mean=10.7, sigma=0.5, size=n).astype(int).clip(15000, 800000)
    cibil = rng.normal(loc=720, scale=70, size=n).clip(450, 900).astype(int)
    existing_loans = rng.choice([0, 1, 2, 3, 4], size=n, p=[0.45, 0.30, 0.15, 0.07, 0.03])
    dpd = rng.choice([0, 1, 2, 3], size=n, p=[0.85, 0.10, 0.04, 0.01])
    emp = rng.choice(
        ["salaried", "self_employed"], size=n, p=[0.7, 0.3]
    )
    requested_amount = (income * rng.uniform(2, 18, n)).astype(int).clip(50000, 2_000_000)
    monthly_emi_existing = (existing_loans * rng.uniform(2500, 8000, n)).astype(int)
    dti = (monthly_emi_existing + (requested_amount / 36) * 0.05) / income
    city_tier = rng.choice([1, 2, 3], size=n, p=[0.45, 0.30, 0.25])
    loan_to_income = (requested_amount / 12) / income

    # Default probability formula (synthetic ground truth)
    p = (
        0.45
        - (cibil - 700) / 250 * 0.4
        + np.minimum(0.4, dti * 0.6)
        + dpd * 0.15
        + (existing_loans >= 3) * 0.12
        - np.minimum(0.15, np.maximum(0, income - 25000) / 800_000 * 0.5)
        + (city_tier == 3) * 0.04
        + (emp == "self_employed") * 0.03
        + rng.normal(0, 0.05, n)
    )
    p = np.clip(p, 0.01, 0.95)
    y = (rng.random(n) < p).astype(int)

    df = pd.DataFrame(
        {
            "age": age,
            "monthly_income": income,
            "cibil": cibil,
            "dti": dti.round(3),
            "existing_loans": existing_loans,
            "dpd_30plus_last_12m": dpd,
            "employment_salaried": (emp == "salaried").astype(int),
            "employment_self_employed": (emp == "self_employed").astype(int),
            "loan_to_income": loan_to_income.round(3),
            "city_tier": city_tier,
            "default": y,
        }
    )
    return df


def main():
    log.info("synthesising 20,000 records...")
    df = synthesize(n=20_000)
    log.info("default rate=%.3f", df["default"].mean())

    X = df[FEATURES].astype(np.float32).values
    y = df["default"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler().fit(X_train)
    X_train_s = scaler.transform(X_train).astype(np.float32)
    X_test_s = scaler.transform(X_test).astype(np.float32)

    log.info("training LightGBM...")
    clf = LGBMClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.05,
        num_leaves=31,
        min_child_samples=40,
        reg_lambda=1.0,
        random_state=42,
    )
    clf.fit(X_train_s, y_train)
    proba = clf.predict_proba(X_test_s)[:, 1]
    auc = roc_auc_score(y_test, proba)
    log.info("test AUC=%.4f", auc)

    # ----- Export ONNX (via onnxmltools, native LightGBM converter) -----
    log.info("converting to ONNX...")
    initial_type = [("input", FloatTensorType([None, len(FEATURES)]))]
    onnx_model = convert_lightgbm(
        clf.booster_, initial_types=initial_type, target_opset=15,
    )
    out_path = ARTIFACT_DIR / "risk_model.onnx"
    out_path.write_bytes(onnx_model.SerializeToString())
    log.info("wrote %s (%d bytes)", out_path, out_path.stat().st_size)

    # ----- Meta -----
    meta = {
        "version": "0.1.0",
        "features": FEATURES,
        "test_auc": round(float(auc), 4),
        "scaler": {
            "mean": scaler.mean_.tolist(),
            "scale": scaler.scale_.tolist(),
        },
    }
    meta_path = ARTIFACT_DIR / "risk_meta.json"
    meta_path.write_text(json.dumps(meta, indent=2))
    log.info("wrote %s", meta_path)
    log.info("done.")


if __name__ == "__main__":
    main()
