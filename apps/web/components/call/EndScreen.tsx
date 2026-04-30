"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ShieldX,
  AlertOctagon,
  UserCheck,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";
import { formatINR, cn } from "@/lib/utils";
import type { OfferTier } from "@/lib/events";
import EyeMark from "@/components/brand/EyeMark";

type Props = {
  ended: { outcome: string; auditHash?: string };
  offer: {
    decision: "offer" | "soft_decline" | "human_review" | null;
    offers: OfferTier[];
    reason?: string;
    nextBestAction?: string;
  };
  selectedTier?: "conservative" | "standard" | "stretch" | null;
  onLeave: () => void;
};

const OUTCOMES: Record<
  string,
  {
    icon: React.ReactNode;
    title: string;
    sub: string;
    color: string;
    badge: string;
  }
> = {
  approved: {
    icon: <CheckCircle2 className="h-12 w-12 text-emerald-400" />,
    title: "Approved",
    sub: "Your audit bundle has been emitted to Poonawalla Fincorp.",
    color: "border-emerald-400/40 bg-emerald-500/10",
    badge: "bg-emerald-500/20 text-emerald-200",
  },
  declined: {
    icon: <AlertOctagon className="h-12 w-12 text-amber-400" />,
    title: "Currently Not Eligible",
    sub: "We've prepared a next-best-action you can take.",
    color: "border-amber-400/40 bg-amber-500/10",
    badge: "bg-amber-500/20 text-amber-200",
  },
  fraud_block: {
    icon: <ShieldX className="h-12 w-12 text-rose-400" />,
    title: "Verification Required",
    sub: "Our team will reach out to verify a few details.",
    color: "border-rose-400/40 bg-rose-500/10",
    badge: "bg-rose-500/20 text-rose-200",
  },
  human_review: {
    icon: <UserCheck className="h-12 w-12 text-violet-400" />,
    title: "Routed to a Human Reviewer",
    sub: "A loan officer will follow up shortly.",
    color: "border-violet-400/40 bg-violet-500/10",
    badge: "bg-violet-500/20 text-violet-200",
  },
};

export default function EndScreen({
  ended,
  offer,
  selectedTier,
  onLeave,
}: Props) {
  const meta = OUTCOMES[ended.outcome] || OUTCOMES.declined;
  const chosen =
    (selectedTier && offer.offers.find((o) => o.tier === selectedTier)) ||
    offer.offers[1] ||
    offer.offers[0];

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-4 py-8 sm:py-12">
      <div className="w-full max-w-2xl caption-enter">
        {/* Brand mark + small badge */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <EyeMark size="sm" />
            <span className="text-[11px] font-bold tracking-widest text-gold">
              DRISHTI · SESSION COMPLETE
            </span>
          </div>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest",
              meta.badge,
            )}
          >
            {ended.outcome.replace("_", " ")}
          </span>
        </div>

        {/* Hero card */}
        <div className={`rounded-2xl border ${meta.color} p-5 text-center sm:p-8`}>
          <div className="flex justify-center">{meta.icon}</div>
          <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
            {meta.title}
          </h1>
          <p className="mt-2 text-base text-indigo-200">{meta.sub}</p>

          {/* Approved offer summary */}
          {ended.outcome === "approved" && chosen && (
            <div className="mx-auto mt-6 max-w-md rounded-xl border border-white/10 bg-white/[0.04] p-5 text-left">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gold">
                <Sparkles className="h-3.5 w-3.5" />
                Your Offer · {chosen.tier.toUpperCase()}
              </p>
              <p className="mt-2 text-3xl font-bold text-white sm:text-4xl">
                ₹ {formatINR(chosen.amount)}
              </p>
              <p className="text-sm text-indigo-200">
                {chosen.rate_pct}% · {chosen.tenure_months} months · EMI ₹{" "}
                {formatINR(chosen.emi)}
              </p>
              <div className="mt-3 flex items-center justify-between text-xs text-indigo-300/80">
                <span>Processing fee</span>
                <span className="font-mono text-white">
                  ₹ {formatINR(chosen.processing_fee)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-indigo-300/80">
                <span>Total cost of credit</span>
                <span className="font-mono text-white">
                  ₹ {formatINR(chosen.total_cost_of_credit)}
                </span>
              </div>
            </div>
          )}

          {/* Soft decline NBA */}
          {ended.outcome === "declined" && offer.nextBestAction && (
            <div className="mx-auto mt-6 max-w-md rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-left">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
                Next Best Action
              </p>
              <p className="mt-2 text-sm text-amber-100">
                {offer.nextBestAction}
              </p>
              {offer.reason && (
                <p className="mt-3 border-t border-amber-300/20 pt-3 text-[11px] italic text-amber-200/80">
                  Why: {offer.reason}
                </p>
              )}
            </div>
          )}

          {/* Audit hash with copy button */}
          {ended.auditHash && <AuditHashRow hash={ended.auditHash} />}
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onLeave}
            className="rounded-lg bg-white/10 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/20"
          >
            Return to Drishti
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] text-indigo-300/60">
          Team IIITDards · Poonawalla Fincorp · Problem Statement #3
        </p>
      </div>
    </main>
  );
}

function AuditHashRow({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4 text-left">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
          Audit hash · SHA-256 chain root
        </p>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy audit hash"
          className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-200 transition hover:bg-white/20"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
      </div>
      <p className="mt-2 break-all font-mono text-[11px] leading-relaxed text-emerald-300">
        {hash}
      </p>
      <p className="mt-2 text-[10px] text-indigo-300/60">
        This is the cryptographic root of your session&apos;s audit chain. Stored
        at AWS Mumbai with 7-year retention. Verifiable via{" "}
        <code className="font-mono text-indigo-200/80">
          /audit/{"<session_id>"}/verify
        </code>
        .
      </p>
    </div>
  );
}
