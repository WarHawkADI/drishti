# Scenario B — Fraud Catch

**Persona:** An impersonator using a stolen PAN.

## Setup
- Open http://localhost:3421
- Enter name: `Imposter`
- Click **Start Loan Call**

## Script

| Time | Drishti says | Customer answers |
|---|---|---|
| 0:00 | "Hi Imposter, I'm Drishti from Poonawalla Fincorp..." | "Yes" |
| 0:20 | Consent prompt | "I agree" |
| 0:40 | "Please upload a clear photo of your PAN card." | *(Upload any image, type PAN `FRAUD1234A`)* |
| 1:00 | *(verify_face returns cosine 0.28 — fail)* | |
| 1:00 | *Drishti detects mismatch, flags fraud_signal severity 4* | |
| 1:10 | "I need to verify a few details. Our team will reach out shortly." | |
| 1:20 | *Session ends; routed to human review with full evidence in audit chain* | |

## Expected outcome
- `decision: "human_review"` (or `fraud_block`)
- 1 fraud signal: `face_mismatch` severity 4
- Drishti politely declines; no offer ever shown
- Audit chain has the fraud event with cosine evidence

## Visible signals on screen
- Right panel: **Fraud Alerts (1)** with severity-4 red badge
- Live signals: `vision: face 0.28`
- Captions: Drishti's polite end-of-call line
