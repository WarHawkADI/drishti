# Scenario C — Soft Decline + Next-Best-Action

**Persona:** Ramesh, 45, self-employed shopkeeper in Bhopal, CIBIL 638.

## Setup
- Open http://localhost:3421
- Enter name: `Ramesh`
- Click **Start Loan Call**

## Script

| Time | Drishti says | Customer answers |
|---|---|---|
| 0:00 | "Hi Ramesh, I'm Drishti..." | "Yes" |
| 0:20 | Consent prompt | "I agree" |
| 0:40 | PAN upload prompt | *(Upload any image, type PAN `RAMES1234A`)* |
| 1:30 | "Are you salaried or self-employed?" | "Self-employed" |
| 1:45 | "Monthly income?" | "Fifty-five thousand" |
| 2:00 | "Loan purpose?" | "Inventory expansion" |
| 2:15 | "How much would you like to borrow?" | "Three lakhs" |
| 2:30 | "Which city?" | "Bhopal" |
| 2:45 | *check_bureau returns CIBIL 638* | |
| 3:00 | *evaluate_offer returns soft_decline* | |
| 3:15 | "Ramesh, I'm sorry — your credit score is 638, which is below our threshold of 650 right now. If you can pay down ₹40,000 on your credit card over the next 90 days, your score typically improves to 680+. Our team will reach back to you in three months." | |
| 3:45 | "Thank you for your time. The audit record is on its way to you." | |

## Expected outcome
- `decision: "soft_decline"`
- Reason: "Credit score is below the required threshold of 650."
- NBA: "Pay down high-utilization credit cards. CIBIL typically improves to 680+ within 90 days. We will reach out then."
- End screen shows the NBA in an amber callout

## Why this scenario matters
- Demonstrates **empathetic decline narration** (RBI fair-practices code)
- Shows **next-best-action** is a structured field, not LLM-generated fluff
- Customer leaves the call with a concrete plan, not just rejection
