import type { AgentEvent, UiEvent } from "@/lib/events";

const profileConfirm: AgentEvent = {
  type: "profile.confirm.request",
  profile: {
    age: 30,
    monthly_income: 80000,
    employment_type: "salaried",
    loan_purpose: "other",
    requested_amount: 300000,
    declared_city: "Pune",
  },
  profile_version: 1,
};

const hardDecline: AgentEvent = {
  type: "offer.show",
  decision: "hard_decline",
  offers: [],
  offer_version: 2,
  reason: "Employment type not currently supported.",
};

const endedWithSnapshot: AgentEvent = {
  type: "session.ended",
  outcome: "approved",
  audit_hash: "abc",
  selected_offer: {
    tier: "standard",
    amount: 300000,
    rate_pct: 14,
    tenure_months: 24,
    emi: 14400,
    processing_fee: 3000,
    total_cost_of_credit: 45600,
    offer_version: 2,
  },
};

const panUpload: UiEvent = {
  type: "pan.uploaded",
  event_id: "evt_1",
  pan_number: "PRIYA1234A",
  name: "Priya Sharma",
  dob: "1996-03-15",
  photo_data_url: "data:image/png;base64,AA==",
  live_photo_data_url: "data:image/jpeg;base64,AA==",
};

const offerSelect: UiEvent = {
  type: "offer.selected",
  event_id: "evt_2",
  tier: "standard",
  offer_version: 2,
};

void [profileConfirm, hardDecline, endedWithSnapshot, panUpload, offerSelect];
