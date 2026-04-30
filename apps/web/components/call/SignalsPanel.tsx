"use client";

import { useCallStore } from "@/lib/store";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Mic,
  Eye,
  MapPin,
  Shield,
  Activity,
  Gauge,
} from "lucide-react";

const ITEMS = [
  {
    key: "stt",
    label: "STT",
    icon: Mic,
    accent: "text-sky-400",
    tip: "Speech-to-text · Deepgram Nova-3 streaming",
  },
  {
    key: "vision",
    label: "VISION",
    icon: Eye,
    accent: "text-violet-400",
    tip: "Computer vision · MediaPipe liveness + InsightFace age",
  },
  {
    key: "geo",
    label: "GEO",
    icon: MapPin,
    accent: "text-emerald-400",
    tip: "Geo-location · declared vs IP-derived",
  },
  {
    key: "fraud",
    label: "FRAUD",
    icon: Shield,
    accent: "text-amber-400",
    tip: "Aggregate fraud severity from 8 detectors",
  },
  {
    key: "cibil",
    label: "CIBIL",
    icon: Activity,
    accent: "text-indigo-300",
    tip: "Credit score pulled from bureau",
  },
  {
    key: "risk",
    label: "RISK",
    icon: Gauge,
    accent: "text-pink-300",
    tip: "Default risk band · LightGBM + SHAP",
  },
] as const;

export default function SignalsPanel() {
  const signals = useCallStore((s) => s.signals);
  const fraudFlags = useCallStore((s) => s.fraudFlags);

  return (
    <div className="space-y-4">
      {/* Live signals */}
      <div className="rounded-xl glass-strong p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-violet-300">
            Live Signals
          </h3>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-violet-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
            Real-time
          </span>
        </div>
        <ul className="space-y-1.5">
          {ITEMS.map(({ key, label, icon: Icon, accent, tip }) => {
            const v = signals[key as keyof typeof signals];
            const ok = v !== undefined && v !== null && v !== "";
            return (
              <li
                key={key}
                title={tip}
                className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 transition ${
                  ok ? "bg-white/[0.04]" : "bg-transparent"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon
                    className={`h-3.5 w-3.5 ${ok ? accent : "text-white/30"}`}
                  />
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider ${
                      ok ? "text-white" : "text-white/40"
                    }`}
                  >
                    {label}
                  </span>
                </span>
                <span
                  className={`font-mono text-[11px] ${
                    ok ? "text-violet-100" : "text-white/25"
                  }`}
                >
                  {ok ? String(v) : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Fraud flags */}
      {fraudFlags.length > 0 && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 caption-enter">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-400" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-rose-300">
              Fraud Signals · {fraudFlags.length}
            </h3>
          </div>
          <ul className="space-y-2">
            {fraudFlags.map((f, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-md bg-rose-950/40 px-2 py-2 text-xs"
              >
                <AlertTriangle
                  className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                    f.severity >= 4 ? "text-rose-400" : "text-amber-400"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white">{f.signal}</p>
                  <p className="text-rose-200/90 leading-snug">{f.reason}</p>
                </div>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    f.severity >= 4
                      ? "bg-rose-500 text-white"
                      : "bg-amber-500 text-ink"
                  }`}
                >
                  SEV {f.severity}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Compliance hint */}
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-3 text-[11px] leading-relaxed text-emerald-100">
        <div className="mb-1 flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          <span className="font-bold uppercase tracking-widest text-emerald-300">
            Compliance
          </span>
        </div>
        Audit chain active · India residency · RBI DLG 2022 mapped.
      </div>
    </div>
  );
}
