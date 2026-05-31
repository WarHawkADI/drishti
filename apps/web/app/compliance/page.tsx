"use client";

import {
  CheckCircle2,
  ShieldCheck,
  Lock,
  FileText,
  Eye,
  Globe,
  AlertTriangle,
} from "lucide-react";
import TopNav from "@/components/nav/TopNav";

const RBI_DLG = [
  {
    req: "Transparency in loan terms",
    impl: "Offer card shows amount, rate, tenure, processing fee, total cost of credit. Accepted terms are stored as an immutable audit snapshot.",
  },
  {
    req: "Cooling-off / look-up period",
    impl: "Customer can withdraw within the regulator-mandated period; the withdrawal flow is wired to the audit chain.",
  },
  {
    req: "No unsolicited credit limit increase",
    impl: "Offer grid is policy-bounded. The LLM cannot upsell beyond the matched cell.",
  },
  {
    req: "Verifiable consent",
    impl: "Six verbal consent checkpoints, each STT-captured, timestamped, and hashed into the SHA-256 chain.",
  },
  {
    req: "Data storage in India",
    impl: "AWS ap-south-1 (Mumbai). No cross-border transfer. SQLite local in dev.",
  },
  {
    req: "Grievance redressal",
    impl: "Audit lookup includes the session id, hash-chain verification, and decision history for review.",
  },
  {
    req: "Fair-practices code",
    impl: "Polite-decline narratives with structured next-best-action. Captions always on. No dark patterns.",
  },
  {
    req: "Audit trail",
    impl: "Append-only SHA-256 chain in SQLite for the prototype. Consent, document, fraud, decision, and selected-offer events are verifiable.",
  },
  {
    req: "Explainability of decisions",
    impl: "SHAP top-3 drivers + LLM-generated natural-language rationale included in every decision record.",
  },
];

const DPDP = [
  {
    title: "Purpose specification",
    sub: "Explicit at consent capture time",
    detail: "Each consent_type names the specific processing purpose. Stored in audit chain.",
  },
  {
    title: "Data minimisation",
    sub: "Only what policy + risk need",
    detail: "Profile is built progressively from conversation. No fields are collected speculatively.",
  },
  {
    title: "Right to erasure",
    sub: "Crypto-shredding at scale",
    detail: "Per-customer key rotation; data is encrypted at rest, key deletion = effective erasure.",
  },
  {
    title: "Data Principal rights",
    sub: "Self-serve dashboard (post-MVP)",
    detail: "Download or delete personal data; review history of decisions made about you.",
  },
];

export default function CompliancePage() {
  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-8">
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-200">
            <ShieldCheck className="h-3 w-3" />
            Compliance
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            An audit trail a regulator would bless.
          </h1>
          <p className="mt-2 max-w-3xl text-base text-indigo-200">
            Drishti is engineered to meet RBI&apos;s Digital Lending Guidelines
            2022 and the DPDP Act 2023. Verbal consent × 6. India residency.
            Tamper-evident by construction.
          </p>
        </header>

        {/* RBI DLG checklist */}
        <section className="mb-10">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
            <FileText className="h-5 w-5 text-emerald-400" />
            RBI DLG 2022 · 9/9 mapped
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {RBI_DLG.map((r) => (
              <div
                key={r.req}
                className="flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.05] p-4"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-sm font-bold text-white">{r.req}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-indigo-100/80">
                    {r.impl}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* DPDP */}
        <section className="mb-10">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
            <Lock className="h-5 w-5 text-violet-400" />
            DPDP Act 2023 · key controls
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {DPDP.map((d) => (
              <div
                key={d.title}
                className="rounded-xl border border-violet-400/20 bg-violet-500/[0.05] p-4"
              >
                <p className="text-sm font-bold text-white">{d.title}</p>
                <p className="mt-1 text-[11px] uppercase tracking-widest text-violet-300">
                  {d.sub}
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-indigo-100/80">
                  {d.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Hash chain */}
        <section className="mb-10">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
            <ShieldCheck className="h-5 w-5 text-gold" />
            Tamper-evident hash chain
          </h2>
          <div className="rounded-2xl border border-white/10 glass-strong p-6">
            <p className="text-sm leading-relaxed text-indigo-100/90">
              Every event (consent, document capture, tool call, decision) is
              an append-only row. Each carries the SHA-256 hash of the previous
              row plus its own payload. The final row&apos;s hash is the{" "}
              <strong className="text-gold">session root hash</strong> —
              shown to the customer at end-of-call and retained in the audit log.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-lg bg-black/40 p-4 font-mono text-[11px] leading-relaxed text-emerald-300">
{`entry_n = {
  ts:    "2026-04-30T14:22:01.347Z",
  event: "tool_call",
  data:  {tool: "check_bureau", args: {...}, result: {...}},
  prev:  sha256(entry_{n-1}),
  hash:  sha256(prev || data || ts)
}`}
            </pre>
            <a
              href="/audit"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-gold px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-ink transition hover:bg-yellow-400"
            >
              Open Audit Explorer →
            </a>
          </div>
        </section>

        {/* Audit bundle */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
            <Eye className="h-5 w-5 text-indigo-300" />
            What ships in every audit bundle
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: "Session events", sub: "Consent · PAN · fraud · decision" },
              { name: "Diarized transcript", sub: "JSON · timestamped" },
              { name: "Decision payload", sub: "Rules · risk · selected offer" },
              { name: "Consent ledger × 6", sub: "JSON in chain" },
              { name: "Fraud signal report", sub: "Evidence frames" },
              { name: "Hash chain root", sub: "SHA-256 hex" },
            ].map((b) => (
              <div
                key={b.name}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
              >
                <p className="text-sm font-bold text-white">{b.name}</p>
                <p className="mt-1 text-[11px] text-indigo-300/80">{b.sub}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-12 rounded-xl border border-amber-400/30 bg-amber-500/5 p-4 text-xs text-amber-100">
          <AlertTriangle className="mb-1 inline h-4 w-4 text-amber-400" />
          <strong className="ml-1 uppercase tracking-widest">
            Honest disclosure:
          </strong>{" "}
          The full audit-bundle PDF generator is post-MVP. The prototype emits a
          sample JSON. The hash chain itself is fully implemented and verifiable
          via <code className="font-mono">/audit/&lt;session&gt;/verify</code>.
        </footer>
      </div>
    </main>
  );
}
