/**
 * Typed events flowing over the LiveKit data channel between
 * the Python agent and the Next.js frontend.
 *
 * Direction is annotated as `// agent -> ui` or `// ui -> agent`.
 */

// ---------- agent -> ui ----------
export type StepChangeEvent = {
  type: "step.change";
  step: "greet" | "consent" | "pan" | "qa" | "confirm" | "verify" | "offer" | "ended";
};

export type ConsentRequestEvent = {
  type: "consent.request";
  consent_type: string;
  prompt: string;
};

export type PanRequestEvent = {
  type: "pan.request";
  prompt: string;
};

export type SignalsUpdateEvent = {
  type: "signals.update";
  signals: {
    stt?: string;
    vision?: string;
    geo?: string;
    fraud?: string;
    cibil?: string | number;
    risk?: string | number;
    [k: string]: string | number | undefined;
  };
};

export type CaptionEvent = {
  type: "caption";
  speaker: "drishti" | "customer";
  text: string;
  is_final: boolean;
  /** Server-stamped millis at emit time — UI sorts by this. */
  ts_ms?: number;
};

export type OfferTier = {
  tier: "conservative" | "standard" | "stretch";
  amount: number;
  rate_pct: number;
  tenure_months: number;
  emi: number;
  processing_fee: number;
  total_cost_of_credit: number;
};

export type DecisionType = "offer" | "soft_decline" | "hard_decline" | "human_review";

export type ConfirmedProfile = {
  age: number;
  monthly_income: number;
  employment_type: string;
  loan_purpose: string;
  requested_amount: number;
  declared_city: string;
};

export type ProfileConfirmRequestEvent = {
  type: "profile.confirm.request";
  profile: ConfirmedProfile;
  profile_version: number;
};

export type OfferShowEvent = {
  type: "offer.show";
  decision: DecisionType;
  offers?: OfferTier[];
  offer_version?: number;
  reason?: string;
  next_best_action?: string;
  shap_top3?: { feature: string; impact: number }[];
};

export type FraudFlagEvent = {
  type: "fraud.flag";
  signal: string;
  severity: number;
  reason: string;
};

export type SessionEndedEvent = {
  type: "session.ended";
  outcome: "approved" | "declined" | "fraud_block" | "human_review";
  audit_hash?: string;
  selected_offer?: (OfferTier & { offer_version?: number }) | null;
};

export type UiAckEvent = {
  type: "ui.ack";
  event_id: string;
  ok: boolean;
};

export type StateSnapshotEvent = {
  type: "state.snapshot";
  step: StepChangeEvent["step"];
  offer?: {
    decision?: DecisionType | null;
    offers?: OfferTier[];
    offer_version?: number;
    reason?: string;
    next_best_action?: string;
    shap_top3?: { feature: string; impact: number }[];
  };
  selected_offer?: (OfferTier & { offer_version?: number }) | null;
  ended?: { outcome?: SessionEndedEvent["outcome"]; audit_hash?: string } | null;
};

// ---------- ui -> agent ----------
export type ConsentGivenEvent = {
  type: "consent.given";
  event_id?: string;
  consent_type: string;
  spoken_text: string;
};

export type PanUploadedEvent = {
  type: "pan.uploaded";
  event_id?: string;
  pan_number: string;
  name: string;
  dob: string;
  photo_data_url: string;
  live_photo_data_url: string;
};

export type OfferSelectedEvent = {
  type: "offer.selected";
  event_id?: string;
  tier: "conservative" | "standard" | "stretch";
  offer_version?: number;
};

export type ProfileConfirmedEvent = {
  type: "profile.confirmed";
  event_id?: string;
  profile_version: number;
  accepted: boolean;
};

export type GeoReportEvent = {
  type: "geo.report";
  lat: number;
  lng: number;
  city?: string;
};

export type StateRequestEvent = {
  type: "state.request";
  event_id?: string;
};

// ---------- union ----------
export type AgentEvent =
  | StepChangeEvent
  | ConsentRequestEvent
  | PanRequestEvent
  | ProfileConfirmRequestEvent
  | SignalsUpdateEvent
  | CaptionEvent
  | OfferShowEvent
  | FraudFlagEvent
  | SessionEndedEvent
  | UiAckEvent
  | StateSnapshotEvent;

export type UiEvent =
  | ConsentGivenEvent
  | PanUploadedEvent
  | OfferSelectedEvent
  | ProfileConfirmedEvent
  | GeoReportEvent
  | StateRequestEvent;

// ---------- helpers ----------
export function encodeEvent(e: AgentEvent | UiEvent): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(e));
}

export function decodeEvent(payload: Uint8Array): AgentEvent | UiEvent | null {
  try {
    const text = new TextDecoder().decode(payload);
    return JSON.parse(text);
  } catch {
    return null;
  }
}
