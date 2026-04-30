"use client";

import { ShieldAlert } from "lucide-react";
import { useCallStore } from "@/lib/store";

/**
 * Top-banner alert that appears when ANY fraud signal of severity >= 4 fires.
 * Stays visible until session ends.
 */
export default function FraudBanner() {
  const flags = useCallStore((s) => s.fraudFlags);
  const blocking = flags.find((f) => f.severity >= 4);
  if (!blocking) return null;

  return (
    <div
      role="alert"
      className="caption-enter relative overflow-hidden border-b border-rose-500/40 bg-gradient-to-r from-rose-600/30 via-rose-500/20 to-rose-600/30 px-4 py-2.5 text-rose-50 sm:px-6"
    >
      {/* Pulsing accent stripe */}
      <span className="absolute inset-x-0 top-0 h-0.5 animate-pulse bg-rose-400" />

      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <ShieldAlert className="h-5 w-5 shrink-0 text-rose-300" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-rose-300">
            High-severity fraud signal · routing for human review
          </p>
          <p className="truncate text-xs sm:text-sm">
            <strong className="font-mono uppercase">{blocking.signal}</strong>{" "}
            · {blocking.reason}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
          SEV {blocking.severity}
        </span>
      </div>
    </div>
  );
}
