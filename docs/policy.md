# Policy Engine

`services/api/api/core/policy_engine.py` is the only component allowed to
make credit decisions in Drishti. The LLM **cannot** call into this engine
in a way that overrides its rules.

## Files

- `services/api/api/data/rules.yaml` — 8 hard rules
- `services/api/api/data/grid.yaml` — 7-cell offer grid

## The 8 rules

| ID | Check | On fail | Reason |
|---|---|---|---|
| `min_age` | `21 ≤ age ≤ 60` | hard_decline | "Age must be between 21 and 60." |
| `min_income` | `monthly_income ≥ 25,000` | hard_decline | "Minimum monthly income required is ₹25,000." |
| `cibil_threshold` | `cibil ≥ 650` | soft_decline | "Credit score below threshold of 650." |
| `dti_cap` | `dti ≤ 0.50` | soft_decline | "Debt-to-income ratio is too high." |
| `employment_type` | `∈ {salaried, salaried_pvt, salaried_govt, self_employed}` | hard_decline | "Employment type not currently supported." |
| `existing_loans_cap` | `existing_loans ≤ 3` | soft_decline | "More than 3 active loans." |
| `dpd_check` | `dpd_30plus_last_12m == 0` | soft_decline | "Recent missed payments." |
| `fraud_severity` | `fraud_severity_max < 4` | route_to_human | "High-severity fraud signal." |

## Decision priority (worst wins)

```
hard_decline  >  route_to_human  >  soft_decline  >  offer
```

If no rule fails, the engine matches the profile against the offer grid.
First-fit match wins.

## Offer grid (7 cells)

| ID | CIBIL | Income | Employment | Max | Base rate | Tenures |
|---|---|---|---|---|---|---|
| A1 | 780-900 | ≥ 100k | salaried* | ₹15L | 11.5% | 12-60 |
| B1 | 720-780 | 75k-100k | salaried* | ₹8L | 13.5% | 12-48 |
| B2 | 720-780 | 50k-75k | salaried* | ₹5L | 14.0% | 12-36 |
| C1 | 680-720 | ≥ 40k | salaried* | ₹3L | 15.5% | 12-36 |
| D1 | 720-900 | ≥ 80k | self_employed | ₹10L | 13.5% | 12-48 |
| E1 | 680-720 | ≥ 50k | self_employed | ₹4L | 15.0% | 12-36 |
| F1 | 650-680 | ≥ 30k | any | ₹1.5L | 17.0% | 12-24 |

\* salaried, salaried_pvt, salaried_govt all qualify.

## Tier construction

For a matched cell, three tiers are built:

| Tier | Amount | Tenure | Rate |
|---|---|---|---|
| conservative | 50% of max | shortest | base − 0.25% |
| standard | 75% of max | middle | base |
| stretch | 100% of max | longest | base + 0.40% |

The risk model adjusts rate within ±0.5% of base. EMI is computed via the
standard reducing-balance formula. Tiers whose EMI exceeds 40% of monthly
income are dropped (except conservative — which is always offered if the
customer qualifies at all).

## Why YAML, not code

- Auditable by non-engineers (compliance, risk officers)
- Versioned in git → every rule change has a commit author
- Hot-reloadable in production without a code deploy
