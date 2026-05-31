"use client";

import { create } from "zustand";
import type {
  AgentEvent,
  ConfirmedProfile,
  DecisionType,
  OfferTier,
  StepChangeEvent,
} from "./events";

type Step = StepChangeEvent["step"];

type Caption = { speaker: "drishti" | "customer"; text: string; ts: number };

type Signals = {
  stt?: string;
  vision?: string;
  geo?: string;
  fraud?: string;
  cibil?: string | number;
  risk?: string | number;
};

type FraudFlag = { signal: string; severity: number; reason: string; ts: number };

type State = {
  step: Step;
  signals: Signals;
  captions: Caption[];
  panRequested: boolean;
  consentRequested: { consent_type: string; prompt: string } | null;
  profileConfirm: { profile: ConfirmedProfile; profileVersion: number } | null;
  offer: {
    decision: DecisionType | null;
    offers: OfferTier[];
    offerVersion?: number;
    reason?: string;
    nextBestAction?: string;
    shapTop3?: { feature: string; impact: number }[];
  };
  selectedTier: "conservative" | "standard" | "stretch" | null;
  selectedOffer: (OfferTier & { offer_version?: number }) | null;
  fraudFlags: FraudFlag[];
  pendingAcks: Record<string, { type: string; ts: number }>;
  failedAcks: Record<string, { type: string; ts: number }>;
  ended: { outcome: string; auditHash?: string } | null;

  apply: (e: AgentEvent) => void;
  selectTier: (tier: "conservative" | "standard" | "stretch") => void;
  trackAck: (eventId: string, type: string) => void;
  failAck: (eventId: string) => void;
  reset: () => void;
};

const initial: Omit<State, "apply" | "reset" | "selectTier" | "trackAck" | "failAck"> = {
  step: "greet",
  signals: {},
  captions: [],
  panRequested: false,
  consentRequested: null,
  profileConfirm: null,
  offer: { decision: null, offers: [] },
  selectedTier: null,
  selectedOffer: null,
  fraudFlags: [],
  pendingAcks: {},
  failedAcks: {},
  ended: null,
};

export const useCallStore = create<State>((set) => ({
  ...initial,
  reset: () => set({ ...initial }),
  selectTier: (tier) => set({ selectedTier: tier }),
  trackAck: (eventId, type) =>
    set((state) => ({
      pendingAcks: { ...state.pendingAcks, [eventId]: { type, ts: Date.now() } },
      failedAcks: Object.fromEntries(
        Object.entries(state.failedAcks).filter(([k]) => k !== eventId),
      ),
    })),
  failAck: (eventId) =>
    set((state) => {
      const pending = state.pendingAcks[eventId];
      if (!pending) return {};
      const { [eventId]: _removed, ...rest } = state.pendingAcks;
      return {
        pendingAcks: rest,
        failedAcks: {
          ...state.failedAcks,
          [eventId]: { type: pending.type, ts: Date.now() },
        },
      };
    }),
  apply: (e) =>
    set((state) => {
      switch (e.type) {
        case "step.change":
          return { step: e.step };
        case "signals.update":
          return { signals: { ...state.signals, ...e.signals } };
        case "caption": {
          if (!e.is_final) return {};
          // Use the agent's emit-time stamp when present (it's a wall-clock
          // millis from the agent process). Falls back to local now for
          // backward compat. We sort by this so reliable-data shuffling
          // doesn't show captions out of order.
          const ts =
            typeof e.ts_ms === "number" && e.ts_ms > 0 ? e.ts_ms : Date.now();
          // Dedup: same speaker + same text within 2s = duplicate (React
          // strict-mode double subscribe + LiveKit reliable redelivery).
          const dup = state.captions.find(
            (c) =>
              c.speaker === e.speaker &&
              c.text === e.text &&
              Math.abs(c.ts - ts) < 2000,
          );
          if (dup) return {};
          const next = [
            ...state.captions.slice(-30),
            { speaker: e.speaker, text: e.text, ts },
          ];
          // Defensive sort — wire-arrival order can shuffle slightly.
          next.sort((a, b) => a.ts - b.ts);
          return { captions: next };
        }
        case "pan.request":
          return { panRequested: true };
        case "consent.request":
          return {
            consentRequested: {
              consent_type: e.consent_type,
              prompt: e.prompt,
            },
          };
        case "profile.confirm.request":
          return {
            step: "confirm",
            profileConfirm: {
              profile: e.profile,
              profileVersion: e.profile_version,
            },
          };
        case "offer.show":
          return {
            offer: {
              decision: e.decision,
              offers: e.offers ?? [],
              offerVersion: e.offer_version,
              reason: e.reason,
              nextBestAction: e.next_best_action,
              shapTop3: e.shap_top3,
            },
            selectedTier: null,
            selectedOffer: null,
            profileConfirm: null,
          };
        case "fraud.flag":
          return {
            fraudFlags: [
              ...state.fraudFlags,
              {
                signal: e.signal,
                severity: e.severity,
                reason: e.reason,
                ts: Date.now(),
              },
            ],
          };
        case "session.ended":
          return {
            ended: { outcome: e.outcome, auditHash: e.audit_hash },
            selectedOffer: e.selected_offer ?? state.selectedOffer,
          };
        case "ui.ack": {
          const { [e.event_id]: _removed, ...rest } = state.pendingAcks;
          const { [e.event_id]: _failed, ...failedRest } = state.failedAcks;
          return { pendingAcks: rest, failedAcks: failedRest };
        }
        case "state.snapshot":
          return {
            step: e.step ?? state.step,
            offer: e.offer
              ? {
                  decision: e.offer.decision ?? null,
                  offers: e.offer.offers ?? [],
                  offerVersion: e.offer.offer_version,
                  reason: e.offer.reason,
                  nextBestAction: e.offer.next_best_action,
                  shapTop3: e.offer.shap_top3,
                }
              : state.offer,
            selectedOffer: e.selected_offer ?? state.selectedOffer,
            selectedTier: e.selected_offer?.tier ?? state.selectedTier,
            ended: e.ended?.outcome
              ? { outcome: e.ended.outcome, auditHash: e.ended.audit_hash }
              : state.ended,
          };
        default:
          return {};
      }
    }),
}));
