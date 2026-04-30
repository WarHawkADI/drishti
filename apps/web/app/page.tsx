"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Clock,
  Languages,
  Mic2,
  Zap,
  Lock,
  Activity,
  Layers,
  FileSearch,
} from "lucide-react";
import EyeMark from "@/components/brand/EyeMark";
import TopNav from "@/components/nav/TopNav";

function generateSessionId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `drs_${ts}${rand}`;
}

export default function LandingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [starting, setStarting] = useState(false);

  function start() {
    if (!name.trim()) return;
    setStarting(true);
    const id = generateSessionId();
    router.push(`/session/${id}?name=${encodeURIComponent(name.trim())}`);
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <TopNav />

      {/* Top meta */}
      <div className="border-b border-white/5 bg-white/[0.02] px-4 py-1.5 text-[10px] font-bold tracking-wider text-indigo-200/80 sm:px-6 sm:text-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <span className="hidden sm:inline">
            TENZORX 2026 · POONAWALLA FINCORP · PROBLEM STATEMENT #3
          </span>
          <span className="sm:hidden">TENZORX 2026 · PS#3</span>
          <span className="inline-flex items-center gap-1.5 text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Live demo · Brief Round
          </span>
        </div>
      </div>

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 pt-12 pb-12">
        {/* Brand mark */}
        <div className="mb-10 flex items-center gap-3 animate-[fade-up_0.5s_ease-out]">
          <EyeMark size="md" />
          <div>
            <p className="text-sm font-bold tracking-widest text-gold">DRISHTI</p>
            <p className="text-xs text-indigo-200">The Agentic AI Loan Officer</p>
          </div>
        </div>

        {/* Hero */}
        <div className="grid gap-12 md:grid-cols-2 md:items-center md:gap-20">
          <div className="animate-[fade-up_0.7s_ease-out]">
            {/* Eyebrow */}
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-violet-200">
              <Sparkles className="h-3 w-3" />
              Agentic AI · Built for NBFCs
            </p>

            <h1 className="font-sans text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-7xl md:text-[5.5rem]">
              Drishti.
            </h1>
            <p className="mt-3 text-xl font-bold leading-snug text-gold sm:text-3xl">
              Sees. Understands.
              <br />
              Decides. In 5 minutes.
            </p>
            <p className="mt-6 max-w-md text-base leading-relaxed text-indigo-200">
              A video-native AI loan officer. Five minutes in your browser
              ends with a personalized offer, signed and audited end-to-end.
              No forms. No app. No waiting.
            </p>

            {/* Start form */}
            <div className="mt-10 max-w-md">
              <label
                htmlFor="customer-name"
                className="block text-xs font-bold uppercase tracking-wider text-indigo-200"
              >
                Your name
              </label>
              <div className="mt-2 flex overflow-hidden rounded-xl bg-white/[0.06] ring-1 ring-white/15 transition focus-within:ring-2 focus-within:ring-gold">
                <input
                  id="customer-name"
                  className="flex-1 bg-transparent px-4 py-3.5 text-base text-white placeholder:text-indigo-300/60 focus:outline-none"
                  placeholder="e.g., Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && start()}
                  aria-label="Your name"
                />
                <button
                  type="button"
                  disabled={!name.trim() || starting}
                  onClick={start}
                  className="group flex items-center gap-2 bg-gold px-5 py-3 font-bold text-ink transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {starting ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-ink/40 border-t-ink" />
                      Starting…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      Start Loan Call
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </span>
                  )}
                </button>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-indigo-300/80">
                <Lock className="h-3 w-3" />
                Camera and microphone required. Encrypted end-to-end. No app
                install.
              </p>
            </div>

            {/* Hero metric strip */}
            <div className="mt-8 grid max-w-md grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric value="5 min" label="To offer" tone="text-gold" />
              <Metric value="Rs 21" label="Per call" tone="text-emerald-300" />
              <Metric value="8" label="Fraud signals" tone="text-rose-300" />
              <Metric value="140Cr" label="₹ / year" tone="text-violet-300" />
            </div>

            {/* Trust strip */}
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] uppercase tracking-widest text-indigo-300/70">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                RBI DLG 2022
              </span>
              <span className="flex items-center gap-1.5">
                <Mic2 className="h-3.5 w-3.5 text-sky-400" />
                Sarvam Voice
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-gold" />
                Claude Sonnet 4.6
              </span>
            </div>
          </div>

          {/* Right side - feature cards in glass grid */}
          <div className="grid grid-cols-2 gap-4 animate-[fade-up_0.9s_ease-out]">
            <FeatureCard
              icon={<Clock className="h-5 w-5" />}
              title="5-min flow"
              body="Greet → verify → Q&A → score → offer → sign."
              accent="text-gold"
            />
            <FeatureCard
              icon={<ShieldCheck className="h-5 w-5" />}
              title="RBI-native"
              body="DLG 2022 mapped. Hash-chained audit per session."
              accent="text-emerald-400"
            />
            <FeatureCard
              icon={<Languages className="h-5 w-5" />}
              title="Indian voice"
              body="Hindi / English with code-switch. Persona: Meera."
              accent="text-sky-400"
            />
            <FeatureCard
              icon={<Sparkles className="h-5 w-5" />}
              title="Agentic"
              body="Claude Sonnet 4.6 with 8 typed tools."
              accent="text-violet-400"
            />

            {/* Bottom-spanning card - guardrail quote */}
            <div className="col-span-2 mt-2 overflow-hidden rounded-xl glass-strong p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gold">
                The Orchestrating Principle
              </p>
              <p className="mt-2 text-base font-bold italic leading-snug text-white">
                &ldquo;The LLM talks. The policy engine decides.&rdquo;
              </p>
              <p className="mt-2 text-xs text-indigo-300/80">
                Drishti&apos;s AI can never approve a loan, invent a number, or
                override a rule. That&apos;s exactly why this is deployable.
              </p>
            </div>
          </div>
        </div>

        {/* One-click demo scenarios — zero-friction judge experience */}
        <section className="mt-16 animate-[fade-up_0.9s_ease-out]">
          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-300">
            One-click demos · all 3 scripted paths
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Try a scenario without typing anything.
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <DemoCard
              variant="happy"
              persona="Priya Sharma"
              tagline="Happy path · 3-tier offer"
              cibil={782}
              tone="border-emerald-400/40 bg-emerald-500/[0.06]"
              dot="bg-emerald-400"
              accent="text-emerald-300"
              onStart={(name) => router.push(`/session/${generateSessionId()}?name=${encodeURIComponent(name)}&demo=happy`)}
            />
            <DemoCard
              variant="fraud"
              persona="Imposter (stolen PAN)"
              tagline="Fraud catch in 90 sec"
              cibil={712}
              tone="border-rose-400/40 bg-rose-500/[0.06]"
              dot="bg-rose-400"
              accent="text-rose-300"
              onStart={(name) => router.push(`/session/${generateSessionId()}?name=${encodeURIComponent(name)}&demo=fraud`)}
            />
            <DemoCard
              variant="decline"
              persona="Ramesh Kumar"
              tagline="Soft decline · NBA"
              cibil={638}
              tone="border-amber-400/40 bg-amber-500/[0.06]"
              dot="bg-amber-400"
              accent="text-amber-300"
              onStart={(name) => router.push(`/session/${generateSessionId()}?name=${encodeURIComponent(name)}&demo=decline`)}
            />
          </div>
        </section>

        {/* Today vs Drishti comparison */}
        <section className="mt-16 animate-[fade-up_1.0s_ease-out]">
          <p className="text-[11px] font-bold uppercase tracking-widest text-rose-300">
            The shift
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Today's NBFC funnel vs Drishti.
          </h2>
          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 glass-strong">
            {/* Header — hidden on tiny phones, shown on sm+ */}
            <div className="hidden grid-cols-3 border-b border-white/10 text-[10px] font-bold uppercase tracking-widest text-indigo-300/70 sm:grid">
              <div className="px-4 py-3">Metric</div>
              <div className="px-4 py-3 text-rose-300">Today</div>
              <div className="px-4 py-3 text-emerald-300">With Drishti</div>
            </div>
            {[
              ["Cost per origination", "Rs 800–1,200", "Rs ~41"],
              ["Time to offer", "2–3 days", "5 minutes"],
              ["Funnel drop-off", "65%", "35%"],
              ["Fraud detection", "70% post-hoc", "90% real-time"],
              ["Ops FTE / 10k loans", "40", "4"],
            ].map(([k, today, drishti]) => (
              <div
                key={k}
                className="border-b border-white/5 last:border-b-0 sm:grid sm:grid-cols-3"
              >
                <div className="px-4 pt-3 text-[10px] font-bold uppercase tracking-widest text-indigo-300/70 sm:text-sm sm:font-normal sm:normal-case sm:tracking-normal sm:text-indigo-200 sm:py-3">
                  {k}
                </div>
                <div className="flex justify-between px-4 pb-2 pt-1 text-sm sm:block sm:py-3">
                  <span className="text-[10px] uppercase text-rose-300/60 sm:hidden">
                    Today
                  </span>
                  <span className="font-mono text-rose-200/90">{today}</span>
                </div>
                <div className="flex justify-between border-t border-white/5 px-4 py-2 text-sm sm:block sm:border-t-0 sm:py-3">
                  <span className="text-[10px] uppercase text-emerald-300/60 sm:hidden">
                    Drishti
                  </span>
                  <span className="font-mono font-bold text-emerald-300">
                    {drishti}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works - 5-step compressed */}
        <section className="mt-16 animate-[fade-up_1.05s_ease-out]">
          <p className="text-[11px] font-bold uppercase tracking-widest text-violet-300">
            How it works
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Five steps. Five minutes.
          </h2>
          <ol className="mt-6 grid gap-3 md:grid-cols-5">
            {[
              { n: 1, t: "Greet + consent", b: "Verbal consent captured + hashed." },
              { n: 2, t: "PAN + face match", b: "OCR + ArcFace cosine in <1s." },
              { n: 3, t: "Adaptive Q&A", b: "Claude probes for missing context." },
              { n: 4, t: "CIBIL + risk", b: "LightGBM + SHAP top-3 drivers." },
              { n: 5, t: "Offer + e-sign", b: "3-tier offer · audit emitted." },
            ].map((s) => (
              <li
                key={s.n}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gold text-sm font-bold text-ink">
                  {s.n}
                </span>
                <p className="mt-3 text-sm font-bold text-white">{s.t}</p>
                <p className="mt-1 text-[12px] text-indigo-200/80">{s.b}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Self-explore strip — judges land here, want to see depth */}
        <section className="mt-16 animate-[fade-up_1.1s_ease-out]">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gold">
            For judges · self-explore
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Inspect every claim. Live, no auth.
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ExploreLink
              href="/ops"
              icon={<Activity className="h-4 w-4" />}
              tone="text-violet-300 border-violet-400/30"
              title="Operations Console"
              body="Live volume, latency, fraud catches, cost — what the on-call NBFC engineer sees at 3pm."
            />
            <ExploreLink
              href="/architecture"
              icon={<Layers className="h-4 w-4" />}
              tone="text-indigo-300 border-indigo-400/30"
              title="System Architecture"
              body="5 layers, deterministic credit guardrails, &lt; 1.5 s latency budget."
            />
            <ExploreLink
              href="/compliance"
              icon={<ShieldCheck className="h-4 w-4" />}
              tone="text-emerald-300 border-emerald-400/30"
              title="Compliance"
              body="RBI DLG 2022 · 9/9 mapped. DPDP 2023 controls. India residency."
            />
            <ExploreLink
              href="/audit"
              icon={<FileSearch className="h-4 w-4" />}
              tone="text-gold border-gold/30"
              title="Audit Explorer"
              body="Look up any session id; we re-walk the SHA-256 chain and prove tamper-free."
            />
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-auto pt-16 text-xs text-indigo-300">
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
            <span>
              <strong className="text-white">IIITDards</strong> · Aditya Rai +
              Alabhya Jha · IIIT Delhi
            </span>
            <Link
              href="https://github.com/WarHawkADI/drishti"
              className="text-gold transition hover:text-yellow-300 hover:underline"
            >
              github.com/WarHawkADI/drishti
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  body,
  accent = "text-gold",
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  accent?: string;
}) {
  return (
    <div className="group rounded-xl glass p-4 transition hover:bg-white/[0.06] hover:ring-white/20">
      <div className={`flex items-center gap-2 ${accent}`}>
        {icon}
        <span className="text-sm font-bold uppercase tracking-wider">
          {title}
        </span>
      </div>
      <p className="mt-2 text-sm leading-snug text-indigo-200/90">{body}</p>
    </div>
  );
}

function Metric({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: string;
}) {
  return (
    <div className="rounded-lg bg-white/[0.04] p-2 text-center ring-1 ring-white/5">
      <p className={`font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-300/70">
        {label}
      </p>
    </div>
  );
}

function DemoCard({
  variant,
  persona,
  tagline,
  cibil,
  tone,
  dot,
  accent,
  onStart,
}: {
  variant: "happy" | "fraud" | "decline";
  persona: string;
  tagline: string;
  cibil: number;
  tone: string;
  dot: string;
  accent: string;
  onStart: (name: string) => void;
}) {
  const presetName: Record<typeof variant, string> = {
    happy: "Priya",
    fraud: "Imposter",
    decline: "Ramesh",
  };
  return (
    <div className={`rounded-2xl border ${tone} p-5 transition hover:scale-[1.01]`}>
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${accent}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${dot} animate-pulse`} />
          Scenario {variant === "happy" ? "A" : variant === "fraud" ? "B" : "C"}
        </span>
        <span className="font-mono text-[10px] text-indigo-300/70">
          CIBIL {cibil}
        </span>
      </div>
      <h3 className="mt-3 text-lg font-bold text-white">{persona}</h3>
      <p className="text-sm text-indigo-200/80">{tagline}</p>
      <button
        type="button"
        onClick={() => onStart(presetName[variant])}
        className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-white/20"
      >
        Start this scenario
        <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}

function ExploreLink({
  href,
  icon,
  title,
  body,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  tone: string;
}) {
  return (
    <Link
      href={href}
      className={`group block rounded-xl border ${tone} bg-white/[0.03] p-4 transition hover:bg-white/[0.07]`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-bold uppercase tracking-widest">
          {title}
        </span>
      </div>
      <p
        className="mt-2 text-sm text-indigo-100/80"
        dangerouslySetInnerHTML={{ __html: body }}
      />
      <p className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-indigo-200 transition group-hover:text-white">
        Open
        <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
      </p>
    </Link>
  );
}
