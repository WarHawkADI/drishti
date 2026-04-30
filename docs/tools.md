# Agent Tools — full schemas

The orchestrator binds 8 typed tools to Claude Sonnet 4.6. The LLM
selects which tool to invoke based on conversation state. Every tool is
async; long-running tools (PAN upload, offer selection) block on a
session-scoped `asyncio.Future` resolved by UI events.

## 1. `capture_consent`

**Description:** Record a verbal consent checkpoint and append to audit chain.
**Args:** `consent_type` (str), `spoken_text` (str, optional)
**Returns:** `{ok, consent_type, audit_seq, this_hash}`

## 2. `request_pan_upload`

**Description:** Trigger UI to show PAN-upload form. Blocks until customer submits.
**Args:** none
**Returns:** `{ok, pan_masked, name, dob}`

## 3. `verify_face`

**Description:** ArcFace cosine similarity between PAN photo and live frame.
**Args:** none (uses `state.live_face_data_url`)
**Returns:** `{cosine, passed, severity, threshold}`
On `severity >= 4`, automatically pushes a `fraud.flag` event to the UI.

## 4. `check_bureau`

**Description:** Pulls the mock CIBIL record by PAN.
**Args:** none (uses `state.profile.pan_number`)
**Returns:** `{ok, cibil, existing_loans, dpd_30plus_last_12m, segment}`

## 5. `evaluate_offer`

**Description:** Submit profile to risk model + policy engine. Returns the decision and offer tiers.
**Args:** `age, monthly_income, employment_type, loan_purpose, requested_amount, declared_city`
**Returns:**
```json
{
  "decision": "offer" | "soft_decline" | "hard_decline" | "human_review",
  "offers": [{tier, amount, rate_pct, tenure_months, emi, processing_fee, total_cost_of_credit}, ...],
  "reason": "...",
  "next_best_action": "...",
  "matched_cell": "B1",
  "rules_fired": ["min_age", "min_income", ...],
  "risk_score": 0.18,
  "risk_band": "Low",
  "shap_top3": [{feature, impact}, ...]
}
```
After this returns, the orchestrator publishes an `offer.show` event so the UI
renders the offer card.

## 6. `wait_for_selection`

**Description:** Wait for the customer to select a tier. Blocks on `state.offer_future`.
**Args:** none
**Returns:** `{ok, tier}`

## 7. `flag_fraud`

**Description:** Manually flag a fraud signal (e.g., LLM cross-check answer inconsistency).
**Args:** `signal, severity (1-5), reason`
**Returns:** `{ok, severity_max}`

## 8. `end_session`

**Description:** Finalize audit chain, return root hash.
**Args:** `outcome` ∈ {`approved`, `declined`, `fraud_block`, `human_review`}
**Returns:** `{ok, outcome, audit_hash}`

## Hard rules the LLM cannot break

1. No tool exists to **set** an amount, rate, or tenure. The LLM can only **request** an offer from the policy engine.
2. No tool exists to **approve** or **reject**. The policy engine outputs the decision.
3. The LLM **must** call `capture_consent` before capturing any PII.
4. The LLM **must** call `flag_fraud` immediately when it detects an inconsistency.
