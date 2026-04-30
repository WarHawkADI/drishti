"""
Synthetic Indian-flavoured loan applicant data generator.

We synthesize ~10k applicants with realistic distributions for Indian NBFC
underwriting. The default label is `default_in_12m` (1 = bad).

This script is used as a fallback when the user does not have access to a
real Kaggle download. To use the real Kaggle "Loan Approval Prediction"
dataset, drop `loan_approval.csv` into `train/data/` and the trainer will
prefer it.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

RNG = np.random.default_rng(42)


def synth(n: int = 10_000) -> pd.DataFrame:
    age = np.clip(RNG.normal(33, 8, n), 21, 60).astype(int)

    # Income: log-normal centered around 55k
    income = np.clip(RNG.lognormal(mean=10.9, sigma=0.55, size=n), 18000, 800_000).astype(int)

    # CIBIL: bimodal-ish, weighted toward 700-770
    cibil = np.clip(RNG.normal(720, 55, n), 450, 900).astype(int)

    # DTI
    dti = np.clip(RNG.beta(2.2, 5, n) * 1.1, 0.05, 0.95)

    existing_loans = RNG.poisson(0.7, n).astype(int)
    dpd = (RNG.random(n) < 0.08).astype(int) * RNG.integers(1, 4, n)

    employment_choices = ["salaried", "salaried_pvt", "salaried_govt", "self_employed"]
    employment = RNG.choice(employment_choices, n, p=[0.45, 0.20, 0.15, 0.20])

    requested = (income * RNG.uniform(2, 12, n)).astype(int)
    loan_to_income = (requested / 12) / income

    city_tier = RNG.choice([1, 2, 3], n, p=[0.45, 0.35, 0.20])

    # Risk function
    z = (
        -0.012 * (cibil - 650)         # better CIBIL -> lower risk
        + 4.0 * (dti - 0.30)
        + 0.6 * dpd
        + 0.12 * existing_loans
        + 0.4 * (loan_to_income - 0.35)
        - 0.0000020 * (income - 25000)
        + 0.05 * (city_tier - 1)
    )
    p_default = 1 / (1 + np.exp(-z))
    default = (RNG.random(n) < p_default).astype(int)

    df = pd.DataFrame(
        {
            "age": age,
            "monthly_income": income,
            "cibil": cibil,
            "dti": np.round(dti, 3),
            "existing_loans": existing_loans,
            "dpd_30plus_last_12m": dpd,
            "employment_salaried": (employment != "self_employed").astype(int),
            "employment_self_employed": (employment == "self_employed").astype(int),
            "loan_to_income": np.round(loan_to_income, 3),
            "city_tier": city_tier,
            "default_in_12m": default,
        }
    )
    return df


if __name__ == "__main__":
    df = synth(10_000)
    print(df.head())
    print(f"Default rate: {df['default_in_12m'].mean():.2%}")
