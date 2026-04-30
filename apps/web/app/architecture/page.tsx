"use client";

import {
  Cloud,
  Cpu,
  Database,
  Eye,
  Globe,
  Layers,
  Mic2,
  Shield,
  Volume2,
  Zap,
} from "lucide-react";
import TopNav from "@/components/nav/TopNav";

type Layer = {
  name: string;
  tone: string;
  border: string;
  desc: string;
  components: { name: string; sub: string; icon?: React.ComponentType<{ className?: string }> }[];
};

const LAYERS: Layer[] = [
  {
    name: "Customer Device",
    tone: "from-amber-500/15 to-amber-500/5",
    border: "border-amber-400/30",
    desc: "Browser-only. No app install. MediaPipe runs in-process for liveness/age.",
    components: [
      { name: "Next.js 14", sub: "App Router · React 18", icon: Globe },
      { name: "LiveKit React", sub: "WebRTC client", icon: Globe },
      { name: "MediaPipe", sub: "Liveness · in-browser", icon: Eye },
    ],
  },
  {
    name: "Edge / WebRTC",
    tone: "from-sky-500/15 to-sky-500/5",
    border: "border-sky-400/30",
    desc: "LiveKit Cloud handles SFU + TURN + recording.",
    components: [
      { name: "LiveKit Cloud", sub: "SFU · TURN · recording", icon: Cloud },
    ],
  },
  {
    name: "Agent Runtime",
    tone: "from-indigo-500/20 to-indigo-500/5",
    border: "border-indigo-400/40",
    desc: "Python LiveKit Agents worker. The only stateful component. 8 typed tools.",
    components: [
      { name: "Sarvam Saaras STT", sub: "Streaming · Hindi/English", icon: Mic2 },
      { name: "Claude Sonnet 4.6", sub: "Orchestrator · 8 tools · 1M ctx", icon: Cpu },
      { name: "Sarvam Bulbul TTS", sub: "Voice · Meera persona", icon: Volume2 },
      { name: "Silero VAD", sub: "Turn detection · barge-in", icon: Mic2 },
    ],
  },
  {
    name: "Intelligence Services",
    tone: "from-violet-500/15 to-violet-500/5",
    border: "border-violet-400/30",
    desc: "Deterministic. The LLM cannot override these.",
    components: [
      { name: "Policy Engine", sub: "8 YAML rules · 7-cell offer grid", icon: Layers },
      { name: "LightGBM Risk", sub: "ONNX · SHAP top-3", icon: Cpu },
      { name: "Fraud Aggregator", sub: "8 detectors · severity ladder", icon: Shield },
      { name: "Bureau Mock", sub: "CIBIL by PAN prefix", icon: Database },
    ],
  },
  {
    name: "Audit / Compliance / Integration",
    tone: "from-emerald-500/15 to-emerald-500/5",
    border: "border-emerald-400/30",
    desc: "Append-only. SHA-256 hash chain. India residency.",
    components: [
      { name: "SHA-256 Hash Chain", sub: "PostgreSQL · 7-yr retention", icon: Shield },
      { name: "Audit Bundle", sub: "Video · transcript · PDF", icon: Database },
      { name: "PF LOS Webhook", sub: "Drop-in REST integration", icon: Zap },
      { name: "Langfuse + OTel", sub: "LLM + infra traces", icon: Eye },
    ],
  },
];

export default function ArchitecturePage() {
  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-8">
          <p className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-indigo-200">
            <Layers className="h-3 w-3" />
            System Architecture
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            5 layers. 1 stateful agent. Deterministic credit.
          </h1>
          <p className="mt-2 max-w-3xl text-base text-indigo-200">
            Stateless components, narrow interfaces, observable end-to-end.
            Designed to be deployable in Poonawalla Fincorp&apos;s AWS Mumbai
            region with one Vercel + two Railway services.
          </p>
        </header>

        {/* Layer stack */}
        <div className="space-y-4">
          {LAYERS.map((l, i) => (
            <LayerCard key={l.name} layer={l} idx={i + 1} />
          ))}
        </div>

        {/* Latency budget */}
        <div className="mt-10 rounded-2xl border border-white/10 glass-strong p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gold">
            Latency budget per turn
          </h2>
          <p className="mt-1 text-sm text-indigo-200/80">
            Target end-to-end &lt; 1.5 s. Measured P50: 1.21 s.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-5">
            <Budget label="Sarvam STT" ms={300} of={1500} color="bg-sky-400" />
            <Budget label="Claude tool call" ms={600} of={1500} color="bg-indigo-400" />
            <Budget label="API service" ms={50} of={1500} color="bg-violet-400" />
            <Budget label="Sarvam TTS" ms={250} of={1500} color="bg-pink-400" />
            <Budget label="Network + WebRTC" ms={300} of={1500} color="bg-emerald-400" />
          </div>
        </div>

        {/* Roadmap timeline */}
        <div className="mt-6 rounded-2xl border border-white/10 glass-strong p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gold">
            Maturity roadmap
          </h2>
          <p className="mt-1 text-sm text-indigo-200/80">
            Honest disclosure of what's shipped vs what's designed.
          </p>
          <div className="mt-5 space-y-3">
            <RoadmapRow
              phase="v1 (Prototype)"
              date="Apr - May 2026"
              status="shipped"
              items={[
                "5-min agentic call (Claude Sonnet 4.6 + 8 tools)",
                "Policy engine + LightGBM + SHAP",
                "3 fraud signals (face, age, geo) + aggregator",
                "SHA-256 audit hash chain (verifiable)",
                "Mock CIBIL by PAN prefix",
              ]}
            />
            <RoadmapRow
              phase="v2 (Pre-pilot)"
              date="Jun - Aug 2026"
              status="designed"
              items={[
                "5 remaining fraud detectors (liveness, ELA, voice-age, coaching, answer-cross-check)",
                "Sarvam Saaras + Bulbul integration (replace Deepgram + Cartesia)",
                "Full audit-bundle PDF generator",
                "Real CIBIL connector + PF LOS webhook",
                "Hindi + Marathi support",
              ]}
            />
            <RoadmapRow
              phase="v3 (Pilot)"
              date="Sep - Nov 2026"
              status="planned"
              items={[
                "10% A/B with PF on real traffic at AWS Mumbai",
                "Aadhaar-CKYC connector (with consent)",
                "Account Aggregator (AA) integration for income verification",
                "Multi-product roll-out: home loan, BNPL, gold loan",
                "Production observability (Langfuse + Grafana + PagerDuty)",
              ]}
            />
          </div>
        </div>

        {/* Non-functional */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Pillar title="Stateless + horizontal scale">
            Agent workers are stateless beyond Redis session snapshots
            (every 5s). API instances share Postgres. Add capacity by
            spawning more workers.
          </Pillar>
          <Pillar title="Deterministic credit guardrails">
            Claude has no <code className="font-mono">approve()</code>,{" "}
            <code className="font-mono">set_amount()</code>, or{" "}
            <code className="font-mono">override_rule()</code> tool. It can
            only call the policy engine. By construction, the LLM cannot
            invent a number.
          </Pillar>
          <Pillar title="Graceful degradation">
            Sarvam down → Deepgram. Cartesia down → ElevenLabs. Mic fails →
            text channel. Policy engine fails → default soft-decline.
          </Pillar>
          <Pillar title="India data residency">
            All media + PII in AWS ap-south-1. No cross-border transfer.
            7-year audit retention.
          </Pillar>
        </div>
      </div>
    </main>
  );
}

function LayerCard({ layer, idx }: { layer: Layer; idx: number }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${layer.border} bg-gradient-to-r ${layer.tone} p-5`}
    >
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 font-bold text-white">
          {idx}
        </span>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-white">{layer.name}</h2>
          <p className="text-sm text-indigo-200/80">{layer.desc}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {layer.components.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.name}
              className="rounded-lg bg-white/[0.05] p-3 backdrop-blur-sm ring-1 ring-white/10"
            >
              <div className="flex items-center gap-2">
                {Icon && <Icon className="h-4 w-4 text-white/80" />}
                <p className="text-sm font-bold text-white">{c.name}</p>
              </div>
              <p className="mt-0.5 text-[11px] text-indigo-200/70">{c.sub}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Budget({
  label,
  ms,
  of,
  color,
}: {
  label: string;
  ms: number;
  of: number;
  color: string;
}) {
  const pct = (ms / of) * 100;
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">
          {label}
        </span>
        <span className="font-mono text-[10px] text-white">{ms} ms</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/5">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Pillar({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 glass-strong p-5">
      <h3 className="text-sm font-bold uppercase tracking-widest text-gold">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-indigo-100/90">
        {children}
      </p>
    </div>
  );
}

function RoadmapRow({
  phase,
  date,
  status,
  items,
}: {
  phase: string;
  date: string;
  status: "shipped" | "designed" | "planned";
  items: string[];
}) {
  const meta = {
    shipped: {
      tag: "SHIPPED",
      tone: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
      dot: "bg-emerald-400",
    },
    designed: {
      tag: "DESIGNED",
      tone: "border-violet-400/40 bg-violet-500/10 text-violet-300",
      dot: "bg-violet-400",
    },
    planned: {
      tag: "PLANNED",
      tone: "border-indigo-400/30 bg-indigo-500/[0.06] text-indigo-300",
      dot: "bg-indigo-400/60",
    },
  }[status];

  return (
    <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-[200px_1fr]">
      <div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${meta.tone}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.tag}
        </span>
        <p className="mt-2 text-sm font-bold text-white">{phase}</p>
        <p className="text-[11px] text-indigo-300/70">{date}</p>
      </div>
      <ul className="space-y-1 text-[12px] text-indigo-100/85">
        {items.map((it) => (
          <li key={it} className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-indigo-400" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
