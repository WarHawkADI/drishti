"use client";

import { create } from "zustand";
import type {
  AgentEvent,
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
  offer: {
    decision: "offer" | "soft_decline" | "human_review" | null;
    offers: OfferTier[];
    reason?: string;
    nextBestAction?: string;
    shapTop3?: { feature: string; impact: number }[];
  };
  selectedTier: "conservative" | "standard" | "stretch" | null;
  fraudFlags: FraudFlag[];
  ended: { outcome: string; auditHash?: string } | null;

  apply: (e: AgentEvent) => void;
  selectTier: (tier: "conservative" | "standard" | "stretch") => void;
  reset: () => void;
};

const initial: Omit<State, "apply" | "reset" | "selectTier"> = {
  step: "greet",
  signals: {},
  captions: [],
  panRequested: false,
  consentRequested: null,
  offer: { decision: null, offers: [] },
  selectedTier: null,
  fraudFlags: [],
  ended: null,
};

export const useCallStore = create<State>((set) => ({
  ...initial,
  reset: () => set({ ...initial }),
  selectTier: (tier) => set({ selectedTier: tier }),
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
        case "offer.show":
          return {
            offer: {
              decision: e.decision,
              offers: e.offers ?? [],
              reason: e.reason,
              nextBestAction: e.next_best_action,
              shapTop3: e.shap_top3,
            },
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
          };
        default:
          return {};
      }
    }),
}));
