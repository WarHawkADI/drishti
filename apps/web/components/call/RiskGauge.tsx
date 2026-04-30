"use client";

import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = { value?: string | number; label?: string };

/**
 * Animated half-moon risk gauge. Reads the current risk band from the store
 * (signals.risk = "Low" | "Medium" | "High") OR a numeric 0-1 score if passed.
 */
export default function RiskGauge({ value, label = "Risk" }: Props) {
  const numeric = parseScore(value);
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    if (numeric == null) return;
    let raf = 0;
    const start = animated;
    const target = numeric;
    const t0 = performance.now();
    const dur = 1000;
    function tick(t: number) {
      const k = Math.min(1, (t - t0) / dur);
      setAnimated(start + (target - start) * easeOut(k));
      if (k < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numeric]);

  const display = numeric == null ? null : Math.round(animated * 100);
  const tone = display == null
    ? "text-indigo-300/60"
    : display < 30
    ? "text-emerald-300"
    : display < 60
    ? "text-amber-300"
    : "text-rose-300";

  return (
    <div className="rounded-xl border border-white/10 glass-strong p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-pink-300">
          <Gauge className="h-3 w-3" />
          {label}
        </p>
        {display != null && (
          <span className={cn("text-[10px] font-bold uppercase", tone)}>
            {display < 30 ? "Low" : display < 60 ? "Medium" : "High"}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <ArcSvg value={display ?? 0} />
        <div className="text-right">
          <p className={cn("font-mono text-3xl font-bold tabular-nums", tone)}>
            {display ?? "—"}
          </p>
          <p className="text-[10px] text-indigo-300/70">/ 100</p>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-indigo-300/60">
        LightGBM default-probability · SHAP-explained
      </p>
    </div>
  );
}

function ArcSvg({ value }: { value: number }) {
  const r = 36;
  const C = Math.PI * r; // semicircle length
  const off = C - (value / 100) * C;
  const stroke =
    value < 30 ? "#34d399" : value < 60 ? "#fbbf24" : "#fb7185";
  return (
    <svg viewBox="0 0 96 56" className="h-12 w-20">
      <path
        d={`M 12 48 A ${r} ${r} 0 0 1 84 48`}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d={`M 12 48 A ${r} ${r} 0 0 1 84 48`}
        fill="none"
        stroke={stroke}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={off}
        style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
      />
    </svg>
  );
}

/* ---------- helpers ---------- */
function parseScore(v: string | number | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") {
    if (v <= 1) return v;
    if (v <= 100) return v / 100;
    return null;
  }
  const s = v.toString().toLowerCase().trim();
  if (s === "low") return 0.18;
  if (s === "medium") return 0.45;
  if (s === "high") return 0.78;
  const n = parseFloat(s);
  if (!Number.isNaN(n)) {
    return n <= 1 ? n : n / 100;
  }
  return null;
}

function easeOut(k: number) {
  return 1 - Math.pow(1 - k, 3);
}
