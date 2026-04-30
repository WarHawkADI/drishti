# Scenario A — Happy Path

**Persona:** Priya, 28, software engineer in Pune, salaried 5 years at TCS.

## Setup
- Open http://localhost:3421
- Enter name: `Priya`
- Click **Start Loan Call**

## Script

| Time | Drishti says (approx.) | Customer answers |
|---|---|---|
| 0:00 | "Hi Priya, I'm Drishti from Poonawalla Fincorp. Ready to begin?" | "Yes." |
| 0:20 | "I need verbal consent to process your data. Do you agree?" | "I agree." |
| 0:40 | "Please upload a clear photo of your PAN card." | *(Upload any image, type PAN `PRIYA1234A`, name `Priya Sharma`, any DOB)* |
| 1:30 | "Verified. Are you salaried or self-employed?" | "Salaried." |
| 1:45 | "What's your monthly take-home income?" | "Ninety-five thousand." |
| 2:00 | "What's the loan for?" | "Home renovation." |
| 2:15 | "How much would you like to borrow?" | "Six lakhs." |
| 2:30 | "Which city are you in?" | "Pune." |
| 2:45 | *(Drishti runs check_bureau, evaluate_offer)* | |
| 3:30 | "Based on a CIBIL of 782, here are three options. The middle one — six lakhs at 13.5% over forty-eight months — has an EMI of around sixteen thousand three hundred. Pick the tier you'd like." | *(Click STANDARD)* |
| 4:00 | "Confirmed. Your audit bundle has been emitted." | |

## Expected outcome
- `decision: "offer"`
- 3 offer tiers visible
- Audit hash visible on end screen
- Total time: ~4-5 minutes
