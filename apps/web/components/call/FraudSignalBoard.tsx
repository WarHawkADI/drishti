"use client";

import { useCallStore } from "@/lib/store";
import { ShieldCheck, AlertTriangle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

const ALL_SIGNALS = [
  { id: "face_mismatch",        label: "Face match",            sev: 4, status: "live" as const },
  { id: "age_mismatch",         label: "CV age",                sev: 2, status: "live" as const },
  { id: "geo_mismatch",         label: "Geo location",          sev: 2, status: "live" as const },
  { id: "liveness_failure",     label: "Liveness challenge",    sev: 5, status: "designed" as const },
  { id: "document_tamper",      label: "Document tamper (ELA)", sev: 4, status: "designed" as const },
  { id: "voice_age_mismatch",   label: "Voice age",             sev: 2, status: "designed" as const },
  { id: "answer_inconsistency", label: "Answer cross-check",    sev: 3, status: "live" as const },
  { id: "coaching_detection",   label: "Coaching (>1 voice)",   sev: 3, status: "designed" as const },
];

export default function FraudSignalBoard() {
  const flags = useCallStore((s) => s.fraudFlags);
  const fired = new Map(flags.map((f) => [f.signal, f]));

  return (
    <div className="rounded-xl border border-white/10 glass-strong p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-300">
          <ShieldCheck className="h-3 w-3" />
          8 Fraud Detectors
        </p>
        <span className="text-[10px] text-indigo-300/70">
          {flags.length} fired
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-1.5">
        {ALL_SIGNALS.map((s) => {
          const f = fired.get(s.id);
          const triggered = !!f;
          return (
            <li
              key={s.id}
              title={
                triggered
                  ? `Severity ${f!.severity}: ${f!.reason}`
                  : s.status === "live"
                  ? "Active in v1"
                  : "Designed · roadmap to v2"
              }
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] transition",
                triggered
                  ? f!.severity >= 4
                    ? "bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/40"
                    : "bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/30"
                  : s.status === "live"
                  ? "bg-emerald-500/[0.06] text-emerald-300/80"
                  : "bg-white/[0.03] text-indigo-300/40",
              )}
            >
              {triggered ? (
                <AlertTriangle className="h-3 w-3 shrink-0" />
              ) : (
                <Circle
                  className={cn(
                    "h-2.5 w-2.5 shrink-0",
                    s.status === "live" ? "fill-emerald-400/60 text-emerald-400/60" : "text-white/15",
                  )}
                />
              )}
              <span className="truncate">{s.label}</span>
              {triggered && (
                <span className="ml-auto rounded bg-white/10 px-1 font-bold">
                  {f!.severity}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-[10px] text-indigo-300/60">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/60" />
          v1 active
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
          v2 designed
        </span>
      </div>
    </div>
  );
}
