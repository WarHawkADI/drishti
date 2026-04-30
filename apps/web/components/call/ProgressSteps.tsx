"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "greet",   label: "Greet" },
  { id: "consent", label: "Consent" },
  { id: "pan",     label: "Verify" },
  { id: "qa",      label: "Q&A" },
  { id: "verify",  label: "Score" },
  { id: "offer",   label: "Offer" },
  { id: "ended",   label: "Done" },
] as const;

const ORDER: Record<string, number> = Object.fromEntries(
  STEPS.map((s, i) => [s.id, i]),
);

export default function ProgressSteps({ step }: { step: string }) {
  const currentIndex = ORDER[step] ?? 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={STEPS.length - 1}
      aria-valuenow={currentIndex}
      aria-label="Loan call progress"
      className="flex w-full items-center"
    >
      {STEPS.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div
            key={s.id}
            className="flex flex-1 items-center last:flex-initial"
          >
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-all",
                  done && "border-emerald-400 bg-emerald-400 text-ink",
                  active &&
                    "border-gold bg-gold text-ink shadow-[0_0_20px_rgba(245,183,0,0.55)]",
                  !done && !active && "border-white/15 bg-white/[0.04] text-indigo-300/60",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  "mt-1.5 text-[9px] font-bold uppercase tracking-widest transition",
                  active && "text-gold",
                  done && "text-emerald-300/80",
                  !done && !active && "text-indigo-300/50",
                )}
              >
                {s.label}
              </span>
            </div>

            {i < STEPS.length - 1 && (
              <div className="mx-1 h-0.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn(
                    "h-full transition-all duration-700",
                    done ? "w-full bg-emerald-400" : "w-0 bg-gold",
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
