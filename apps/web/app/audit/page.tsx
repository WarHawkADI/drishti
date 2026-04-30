"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Link2, ShieldCheck } from "lucide-react";
import TopNav from "@/components/nav/TopNav";

export default function AuditLanding() {
  const router = useRouter();
  const [sid, setSid] = useState("");

  const sample = ["drs_demo_a", "drs_demo_b", "drs_demo_c"];

  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-200">
          <ShieldCheck className="h-3 w-3" />
          Audit Chain Explorer
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Audit Trail Verifier.
        </h1>
        <p className="mt-2 text-base text-indigo-200">
          Every Drishti session writes an append-only SHA-256 chain of events.
          Look any session up by id; we re-walk the chain and prove tamper-free.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (sid.trim()) router.push(`/audit/${encodeURIComponent(sid.trim())}`);
          }}
          className="mt-8"
        >
          <label
            htmlFor="sid"
            className="mb-2 block text-xs font-bold uppercase tracking-widest text-indigo-200"
          >
            Session id
          </label>
          <div className="flex overflow-hidden rounded-xl bg-white/[0.06] ring-1 ring-white/15 transition focus-within:ring-2 focus-within:ring-gold">
            <input
              id="sid"
              value={sid}
              onChange={(e) => setSid(e.target.value)}
              placeholder="drs_xxxxx"
              className="flex-1 bg-transparent px-4 py-3 font-mono text-sm text-white placeholder:text-indigo-300/60 focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 bg-gold px-5 py-3 font-bold text-ink transition hover:bg-yellow-400"
            >
              Verify chain
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>

        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-300/80">
            Try a recent session
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {sample.map((s) => (
              <a
                key={s}
                href={`/audit/${s}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-3 py-1.5 font-mono text-xs text-emerald-300 hover:bg-white/10"
              >
                <Link2 className="h-3 w-3" />
                {s}
              </a>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-indigo-300/60">
            Or paste a session id from a recent call (visible at the end of any
            Drishti call as the audit hash).
          </p>
        </div>

        <div className="mt-8 rounded-xl border border-white/10 glass-strong p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gold">
            How the chain works
          </h2>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-4 font-mono text-[11px] leading-relaxed text-emerald-300">
{`entry_n = {
  ts:    "2026-04-30T14:22:01.347Z",
  event: "tool_call",
  data:  {tool: "check_bureau", args: {...}, result: {...}},
  prev:  sha256(entry_{n-1}),
  hash:  sha256(prev || data || ts)
}`}
          </pre>
          <p className="mt-3 text-[11px] text-indigo-300/70">
            Tampering with any historical entry breaks the chain from that point
            forward and is detectable by a simple re-hash.
          </p>
        </div>
      </div>
    </main>
  );
}
