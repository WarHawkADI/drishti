/**
 * Typed events flowing over the LiveKit data channel between
 * the Python agent and the Next.js frontend.
 *
 * Direction is annotated as `// agent -> ui` or `// ui -> agent`.
 */

// ---------- agent -> ui ----------
export type StepChangeEvent = {
  type: "step.change";
  step: "greet" | "consent" | "pan" | "qa" | "verify" | "offer" | "ended";
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

export type OfferShowEvent = {
  type: "offer.show";
  decision: "offer" | "soft_decline" | "human_review";
  offers?: OfferTier[];
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
};

// ---------- ui -> agent ----------
export type ConsentGivenEvent = {
  type: "consent.given";
  consent_type: string;
  spoken_text: string;
};

export type PanUploadedEvent = {
  type: "pan.uploaded";
  pan_number: string;
  name: string;
  dob: string;
  photo_data_url: string;
};

export type OfferSelectedEvent = {
  type: "offer.selected";
  tier: "conservative" | "standard" | "stretch";
};

export type GeoReportEvent = {
  type: "geo.report";
  lat: number;
  lng: number;
  city?: string;
};

// ---------- union ----------
export type AgentEvent =
  | StepChangeEvent
  | ConsentRequestEvent
  | PanRequestEvent
  | SignalsUpdateEvent
  | CaptionEvent
  | OfferShowEvent
  | FraudFlagEvent
  | SessionEndedEvent;

export type UiEvent =
  | ConsentGivenEvent
  | PanUploadedEvent
  | OfferSelectedEvent
  | GeoReportEvent;

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
