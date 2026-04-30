"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  IndianRupee,
  Mic2,
  Server,
  ShieldAlert,
  TrendingUp,
  Users,
  Wifi,
} from "lucide-react";
import TopNav from "@/components/nav/TopNav";
import { cn } from "@/lib/utils";

/**
 * Drishti Operations Console — what the on-call NBFC ops team would see.
 *
 * For the prototype this is mocked with realistic-looking metrics that
 * tick over time (using stable seeded jitter so the page feels live).
 * In production this surface would pull from Prometheus + Langfuse.
 */
export default function OpsPage() {
  return (
    <main className="min-h-screen">
      <TopNav />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <header className="mb-8">
          <p className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-violet-200">
            <Activity className="h-3 w-3" />
            Operations Console · Live
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Drishti Operations.
          </h1>
          <p className="mt-2 max-w-2xl text-base text-indigo-200">
            The view a Poonawalla Fincorp ops engineer would see at 3pm on a
            Tuesday. Volume, latency, fraud catches, cost, and SLA — all live.
          </p>
        </header>

        {/* Top KPI strip */}
        <KpiRow />

        {/* A/B test header */}
        <ABTestCard />

        {/* Two-column body */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <FunnelCard />
            <LatencyCard />
            <FraudCard />
          </div>
          <div className="space-y-6">
            <ActiveSessionsCard />
            <CostCard />
            <ProvidersCard />
          </div>
        </div>

        <footer className="mt-12 text-center text-[11px] text-indigo-300/60">
          Mocked for the brief-round prototype. Production surface would
          integrate Prometheus, Grafana, and Langfuse.
        </footer>
      </div>
    </main>
  );
}

/* ----------- Hooks ----------- */
function useTick(intervalMs = 2000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return tick;
}

/* ----------- KPI strip ----------- */
function KpiRow() {
  const tick = useTick(2000);

  // Stable-ish jitter using the tick
  const concurrent = 27 + (tick % 7);
  const today = 12_843 + tick * 3;
  const avgTat = (4 + ((tick * 0.07) % 0.6)).toFixed(1); // 4.x min
  const turn = (1.1 + ((tick * 0.03) % 0.4)).toFixed(2); // ~1.3 s
  const approvalRate = 64.5 + ((tick * 0.01) % 1.5);
  const fraudCatch = 89 + ((tick * 0.04) % 4);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Kpi
        icon={<Users className="h-4 w-4" />}
        label="Concurrent sessions"
        value={String(concurrent)}
        tone="indigo"
      />
      <Kpi
        icon={<TrendingUp className="h-4 w-4" />}
        label="Today's volume"
        value={today.toLocaleString("en-IN")}
        tone="emerald"
      />
      <Kpi
        icon={<Clock className="h-4 w-4" />}
        label="Avg TAT"
        value={`${avgTat} min`}
        tone="sky"
      />
      <Kpi
        icon={<Wifi className="h-4 w-4" />}
        label="Avg turn latency"
        value={`${turn} s`}
        tone="violet"
      />
      <Kpi
        icon={<CheckCircle2 className="h-4 w-4" />}
        label="Approval rate"
        value={`${approvalRate.toFixed(1)}%`}
        tone="emerald"
      />
      <Kpi
        icon={<ShieldAlert className="h-4 w-4" />}
        label="Fraud catch rate"
        value={`${fraudCatch.toFixed(1)}%`}
        tone="rose"
      />
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "indigo" | "emerald" | "sky" | "violet" | "rose" | "amber";
}) {
  const tones: Record<string, string> = {
    indigo: "text-indigo-300 border-indigo-400/30 bg-indigo-500/5",
    emerald: "text-emerald-300 border-emerald-400/30 bg-emerald-500/5",
    sky: "text-sky-300 border-sky-400/30 bg-sky-500/5",
    violet: "text-violet-300 border-violet-400/30 bg-violet-500/5",
    rose: "text-rose-300 border-rose-400/30 bg-rose-500/5",
    amber: "text-amber-300 border-amber-400/30 bg-amber-500/5",
  };
  return (
    <div className={cn("rounded-xl border p-3", tones[tone])}>
      <div className="flex items-center justify-between">
        {icon}
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current opacity-60" />
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-white">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest opacity-80">
        {label}
      </p>
    </div>
  );
}

/* ----------- A/B test ----------- */
function ABTestCard() {
  // Mocked but realistic numbers - what a 30-day rollout would look like
  return (
    <div className="mt-6 rounded-2xl border border-gold/40 bg-gradient-to-r from-gold/[0.08] via-amber-500/[0.04] to-transparent p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gold">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
            A/B Test · Day 22 of 30
          </p>
          <h2 className="mt-2 text-xl font-bold text-white">
            10% traffic on Drishti · 90% on legacy form
          </h2>
          <p className="mt-1 text-[12px] text-indigo-300/80">
            Started 09 Apr 2026 · sample size <span className="text-white">12,843</span>{" "}
            sessions on Drishti vs <span className="text-white">115,587</span> control
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">
            Statistical confidence
          </p>
          <p className="font-mono text-2xl font-bold text-emerald-300">99.7%</p>
        </div>
      </div>

      {/* Outcome diff bars */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <ABRow label="Approval rate"  control="34.5%" treatment="65.8%" delta="+31.3 pp" up />
        <ABRow label="Time to offer"  control="2.1 d"  treatment="4.8 m"  delta="-99.8%"  down />
        <ABRow label="Cost / loan"    control="₹987"  treatment="₹41"    delta="-95.8%"  down />
      </div>

      <p className="mt-4 text-[11px] italic text-indigo-200/70">
        Decision rule: ramp to 50% on day 30 if drop-off improvement
        ≥ 25 pp <em>and</em> fraud-loss not worse than control. Both
        thresholds met by day 14.
      </p>
    </div>
  );
}

function ABRow({
  label,
  control,
  treatment,
  delta,
  up,
  down,
}: {
  label: string;
  control: string;
  treatment: string;
  delta: string;
  up?: boolean;
  down?: boolean;
}) {
  return (
    <div className="rounded-lg bg-white/[0.04] p-3 ring-1 ring-white/5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300/70">
        {label}
      </p>
      <div className="mt-2 flex items-end gap-2">
        <div>
          <p className="text-[10px] uppercase text-rose-300/70">Control</p>
          <p className="font-mono text-sm text-rose-200">{control}</p>
        </div>
        <span className="mb-0.5 text-indigo-300/40">→</span>
        <div>
          <p className="text-[10px] uppercase text-emerald-300/70">Drishti</p>
          <p className="font-mono text-sm font-bold text-emerald-300">
            {treatment}
          </p>
        </div>
        <span
          className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-bold ${
            up || !down
              ? "bg-emerald-500/20 text-emerald-300"
              : "bg-emerald-500/20 text-emerald-300"
          }`}
        >
          {delta}
        </span>
      </div>
    </div>
  );
}

/* ----------- Funnel ----------- */
function FunnelCard() {
  const stages = [
    { label: "Link clicked", pct: 100, count: 12843, color: "bg-indigo-500" },
    { label: "Joined call", pct: 92, count: 11816, color: "bg-indigo-500" },
    { label: "Consent captured", pct: 88, count: 11302, color: "bg-violet-500" },
    { label: "PAN verified", pct: 78, count: 10018, color: "bg-violet-500" },
    { label: "Bureau pulled", pct: 76, count: 9760, color: "bg-sky-500" },
    { label: "Offer presented", pct: 71, count: 9119, color: "bg-emerald-500" },
    { label: "e-Signed", pct: 66, count: 8476, color: "bg-emerald-500" },
  ];
  return (
    <Card title="Today's Funnel" hint="Drop-off ~34% — vs ~65% before Drishti">
      <div className="space-y-2.5">
        {stages.map((s, i) => (
          <div key={s.label}>
            {/* Label row — always visible */}
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate text-indigo-200">{s.label}</span>
              <div className="flex items-center gap-2 font-mono tabular-nums text-indigo-300/80">
                <span>{s.count.toLocaleString("en-IN")}</span>
                {i > 0 && (
                  <span className="text-rose-300">
                    ↓ {(stages[i - 1].pct - s.pct).toFixed(0)}pp
                  </span>
                )}
              </div>
            </div>
            {/* Bar */}
            <div className="relative mt-1 h-5 overflow-hidden rounded-md bg-white/5">
              <div
                className={cn("h-full transition-all duration-1000", s.color)}
                style={{ width: `${s.pct}%` }}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white">
                {s.pct}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ----------- Latency sparkline ----------- */
function LatencyCard() {
  const tick = useTick(1500);
  const points = Array.from(
    { length: 32 },
    (_, i) =>
      1.1 + Math.sin((i + tick) * 0.4) * 0.18 + (((i * 13) % 7) / 80),
  );
  const max = Math.max(...points);
  const min = Math.min(...points);
  return (
    <Card
      title="Turn Latency"
      hint="Target < 1.5 s · STT 0.3s + LLM 0.6s + TTS 0.25s + net 0.3s"
    >
      <div className="flex h-24 items-end gap-0.5">
        {points.map((p, i) => {
          const h = ((p - 0.8) / 1.0) * 100;
          return (
            <div
              key={i}
              className="flex-1 rounded-t bg-gradient-to-t from-violet-500/20 via-violet-500/60 to-violet-300"
              style={{ height: `${Math.max(8, h)}%` }}
              title={`${p.toFixed(2)} s`}
            />
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
        <Stat label="P50" value={`${((min + max) / 2).toFixed(2)}s`} />
        <Stat label="P95" value={`${(max + 0.1).toFixed(2)}s`} />
        <Stat label="Sessions/min" value="~ 18" />
      </div>
    </Card>
  );
}

/* ----------- Fraud ----------- */
function FraudCard() {
  const data = [
    { signal: "Face mismatch",      count: 23, sev: 4 },
    { signal: "Liveness failure",   count: 11, sev: 5 },
    { signal: "Document tamper",    count:  6, sev: 4 },
    { signal: "Age mismatch",       count: 41, sev: 2 },
    { signal: "Geo mismatch",       count: 28, sev: 2 },
    { signal: "Voice-age mismatch", count: 14, sev: 2 },
    { signal: "Answer inconsistency", count: 32, sev: 3 },
    { signal: "Coaching detection", count:  7, sev: 3 },
  ];
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <Card
      title="Fraud Signals · Last 24h"
      hint={`${total} signals fired · 89.4% real-time catch rate`}
    >
      <div className="space-y-2">
        {data.map((d) => {
          const tone =
            d.sev >= 4
              ? "from-rose-600 to-rose-400"
              : d.sev === 3
                ? "from-amber-600 to-amber-400"
                : "from-violet-600 to-violet-400";
          return (
            <div key={d.signal}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-indigo-200">{d.signal}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono tabular-nums text-white">
                    {d.count}
                  </span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-bold",
                      d.sev >= 4
                        ? "bg-rose-500/20 text-rose-300"
                        : d.sev === 3
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-violet-500/20 text-violet-300",
                    )}
                  >
                    SEV {d.sev}
                  </span>
                </span>
              </div>
              <div className="relative mt-1 h-3 overflow-hidden rounded bg-white/5">
                <div
                  className={cn("h-full bg-gradient-to-r", tone)}
                  style={{ width: `${(d.count / 50) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ----------- Active sessions ----------- */
function ActiveSessionsCard() {
  const tick = useTick(2200);
  const sessions = [
    { id: "drs_8x9k", city: "Pune",       step: "Q&A",       dur: "02:14" },
    { id: "drs_4q2j", city: "Mumbai",     step: "Verify",    dur: "03:01" },
    { id: "drs_n7t1", city: "Bangalore",  step: "Offer",     dur: "04:22" },
    { id: "drs_z3wq", city: "Delhi",      step: "Consent",   dur: "00:38" },
    { id: "drs_p9bf", city: "Hyderabad",  step: "PAN",       dur: "01:05" },
  ];
  return (
    <Card title="Active sessions" hint={`${27 + (tick % 5)} live now`}>
      <ul className="space-y-1.5">
        {sessions.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-xs"
          >
            <div>
              <p className="font-mono text-emerald-300">{s.id}</p>
              <p className="text-[10px] text-indigo-300/70">{s.city}</p>
            </div>
            <div className="text-right">
              <p className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold">
                {s.step}
              </p>
              <p className="mt-1 font-mono text-[10px] text-indigo-200">
                {s.dur}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ----------- Cost ----------- */
function CostCard() {
  return (
    <Card title="Unit Economics" hint="Per-session · live">
      <div className="rounded-lg bg-white/[0.03] p-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">
          Total · this session
        </p>
        <p className="mt-1 flex items-baseline gap-1 text-3xl font-bold tabular-nums text-white">
          <IndianRupee className="h-5 w-5 text-emerald-300" />
          21
        </p>
        <p className="text-[10px] text-indigo-300/70">
          vs ~₹1,000 today · -98%
        </p>
      </div>
      <ul className="mt-3 space-y-1.5 text-xs">
        <CostRow label="Sarvam STT" value="₹1.50" />
        <CostRow label="Sarvam TTS" value="₹1.20" />
        <CostRow label="Claude Sonnet 4.6" value="₹12.00" />
        <CostRow label="Claude Haiku" value="₹2.00" />
        <CostRow label="Vision OCR" value="₹0.25" />
        <CostRow label="LiveKit" value="₹0.50" />
        <CostRow label="Compute + storage" value="₹3.30" />
      </ul>
      <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-200">
        Annualised at 10L originations → <strong>₹140 Cr impact</strong>
      </div>
    </Card>
  );
}

function CostRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-indigo-200/80">{label}</span>
      <span className="font-mono tabular-nums text-white">{value}</span>
    </li>
  );
}

/* ----------- Providers ----------- */
function ProvidersCard() {
  const providers = [
    { name: "LiveKit Cloud", status: "ok", latency: "112 ms", icon: Server },
    { name: "Anthropic API", status: "ok", latency: "624 ms", icon: Server },
    { name: "Deepgram STT", status: "ok", latency: "287 ms", icon: Mic2 },
    { name: "Cartesia TTS", status: "ok", latency: "248 ms", icon: Mic2 },
    { name: "FastAPI BE", status: "ok", latency: "31 ms", icon: Server },
    { name: "Postgres / S3 Mum", status: "ok", latency: "18 ms", icon: Server },
  ];
  return (
    <Card title="Provider health" hint="All systems operational">
      <ul className="space-y-1.5">
        {providers.map((p) => {
          const Icon = p.icon;
          return (
            <li
              key={p.name}
              className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-xs"
            >
              <span className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-indigo-300" />
                <span className="text-white">{p.name}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-indigo-200">
                  {p.latency}
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ----------- Generic Card + Stat ----------- */
function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 glass-strong p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-widest text-white">
          {title}
        </h2>
        {hint && (
          <span className="text-[10px] text-indigo-300/70">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/5 px-2 py-1.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300/70">
        {label}
      </p>
      <p className="font-mono text-sm tabular-nums text-white">{value}</p>
    </div>
  );
}
