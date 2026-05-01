"use client";

import { CheckCircle2, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { cn, formatINR } from "@/lib/utils";
import type { OfferTier } from "@/lib/events";
import { useCallStore } from "@/lib/store";

type Props = {
  offer: {
    decision: "offer" | "soft_decline" | "human_review" | null;
    offers: OfferTier[];
    shapTop3?: { feature: string; impact: number }[];
  };
  onSelect: (tier: OfferTier["tier"]) => void;
};

const TIER_META: Record<
  OfferTier["tier"],
  { label: string; ring: string; bg: string; text: string; pill: string }
> = {
  conservative: {
    label: "Conservative",
    ring: "border-sky-400/60",
    bg: "bg-sky-500/10",
    text: "text-sky-300",
    pill: "bg-sky-500/20 text-sky-200",
  },
  standard: {
    label: "Recommended",
    ring: "border-emerald-400",
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
    pill: "bg-emerald-500/30 text-emerald-100",
  },
  stretch: {
    label: "Stretch",
    ring: "border-amber-400/60",
    bg: "bg-amber-500/10",
    text: "text-amber-300",
    pill: "bg-amber-500/20 text-amber-200",
  },
};

export default function OfferCard({ offer, onSelect }: Props) {
  // Read selection from the global store so it persists across re-renders
  // (otherwise a fraud-flag update or re-mount would visually un-select).
  const selected = useCallStore((s) => s.selectedTier);

  return (
    <div className="space-y-3 caption-enter">
      {/* Header */}
      <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/[0.07] p-4">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-emerald-300">
          <Sparkles className="h-3.5 w-3.5" />
          Personalised Offer
        </p>
        <h3 className="mt-1 text-base font-bold text-white">
          Three options for your profile · pick one
        </h3>
      </div>

      {/* Tier buttons */}
      {offer.offers.map((o) => {
        const meta = TIER_META[o.tier];
        const isSel = selected === o.tier;
        return (
          <button
            key={o.tier}
            type="button"
            onClick={() => onSelect(o.tier)}
            aria-pressed={isSel ? "true" : "false"}
            className={cn(
              "group relative block w-full overflow-hidden rounded-xl border-2 p-4 text-left transition-all duration-300",
              meta.ring,
              meta.bg,
              "hover:scale-[1.015] hover:shadow-[0_8px_30px_rgba(0,0,0,0.25)]",
              o.tier === "standard" && "ring-2 ring-emerald-400/40",
              isSel && "ring-4 ring-gold/70 scale-[1.015]",
            )}
          >
            {/* Top accent bar — fills on selection */}
            <span
              className={cn(
                "absolute left-0 top-0 h-1 w-full origin-left scale-x-0 bg-gold transition-transform duration-500",
                isSel && "scale-x-100",
              )}
            />

            <div className="flex items-start justify-between">
              <div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest",
                    meta.pill,
                  )}
                >
                  {meta.label}
                </span>
                <p className="mt-2 text-2xl font-bold text-white">
                  ₹ {formatINR(o.amount)}
                </p>
                <p className="mt-0.5 text-[11px] text-white/60">
                  Total cost ₹ {formatINR(o.total_cost_of_credit)}
                </p>
              </div>
              <CheckCircle2
                className={cn(
                  "h-6 w-6 transition-all duration-300",
                  isSel
                    ? "scale-100 text-gold opacity-100"
                    : "scale-75 text-white/20 opacity-0 group-hover:opacity-50",
                )}
              />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <p className="text-white/50">Rate</p>
                <p className="font-bold text-white">{o.rate_pct}%</p>
              </div>
              <div>
                <p className="text-white/50">Tenure</p>
                <p className="font-bold text-white">{o.tenure_months} mo</p>
              </div>
              <div>
                <p className="text-white/50">EMI</p>
                <p className="font-bold text-white">
                  ₹ {formatINR(o.emi)}
                </p>
              </div>
            </div>
          </button>
        );
      })}

      {/* SHAP drivers */}
      {offer.shapTop3 && offer.shapTop3.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
            Top approval drivers
          </p>
          <ul className="mt-2 space-y-1.5">
            {offer.shapTop3.map((d) => {
              const positive = d.impact > 0;
              return (
                <li
                  key={d.feature}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="flex items-center gap-1.5 text-indigo-100">
                    {positive ? (
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5 text-amber-400" />
                    )}
                    {d.feature}
                  </span>
                  <span
                    className={cn(
                      "font-mono",
                      positive ? "text-emerald-400" : "text-amber-400",
                    )}
                  >
                    {positive ? "+" : ""}
                    {d.impact.toFixed(2)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
