"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import TopNav from "@/components/nav/TopNav";
import {
  fetchAudit,
  verifyAudit,
  type AuditEntry,
  type VerifyResult,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export default function AuditExplorer() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [headHash, setHeadHash] = useState<string | null>(null);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [audit, v] = await Promise.all([
          fetchAudit(sessionId),
          verifyAudit(sessionId).catch(() => null),
        ]);
        if (cancelled) return;
        setEntries(audit.entries || []);
        setHeadHash(audit.head_hash);
        setVerify(v);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load audit");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <main className="min-h-screen">
      <TopNav />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-300">
            Audit Chain · Session
          </p>
          <h1 className="mt-1 break-all font-mono text-2xl font-bold text-white">
            {sessionId}
          </h1>

          {loading ? (
            <p className="mt-2 text-sm text-indigo-200">Loading chain…</p>
          ) : error ? (
            <ErrorBanner err={error} />
          ) : (
            <VerifyBadge verify={verify} count={entries.length} />
          )}
        </header>

        {!loading && !error && (
          <div className="grid gap-6 md:grid-cols-[1fr_300px]">
            <ChainList entries={entries} />
            <Sidebar
              headHash={headHash}
              count={entries.length}
              verify={verify}
            />
          </div>
        )}
      </div>
    </main>
  );
}

/* ----------- Verify badge ----------- */
function VerifyBadge({
  verify,
  count,
}: {
  verify: VerifyResult | null;
  count: number;
}) {
  if (!verify) return null;
  const ok = verify.ok;
  return (
    <div
      className={cn(
        "mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-widest",
        ok
          ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/40"
          : "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/40",
      )}
    >
      {ok ? (
        <>
          <CheckCircle2 className="h-3.5 w-3.5" />
          Chain valid · {count} entries · re-hashed
        </>
      ) : (
        <>
          <XCircle className="h-3.5 w-3.5" />
          Chain broken at #{verify.broken_at} · {verify.reason}
        </>
      )}
    </div>
  );
}

/* ----------- Error ----------- */
function ErrorBanner({ err }: { err: string }) {
  return (
    <div className="mt-4 rounded-xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-100">
      <p className="font-bold">Audit not available</p>
      <p className="mt-1 text-[12px]">{err}</p>
      <p className="mt-2 text-[11px] text-rose-200/80">
        Make sure the API service is running at{" "}
        <code className="font-mono">{process.env.NEXT_PUBLIC_API_BASE_URL}</code>{" "}
        and that this session has actually run.
      </p>
    </div>
  );
}

/* ----------- Chain list ----------- */
function ChainList({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-indigo-200">
        No audit entries for this session yet. Sessions write events as they
        progress (consent, document, decisions, etc.).
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {entries.map((e, i) => (
        <ChainRow key={e.seq} entry={e} index={i} />
      ))}
    </div>
  );
}

function ChainRow({ entry, index }: { entry: AuditEntry; index: number }) {
  const [open, setOpen] = useState(index < 3);
  return (
    <article className="rounded-xl border border-white/10 glass-strong">
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        {/* Bead */}
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gold/30" />
          <div className="relative h-3 w-3 rounded-full bg-gold shadow-[0_0_12px_#F5B700]" />
        </div>
        {/* Meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gold">
              #{entry.seq}
            </span>
            <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-indigo-200">
              {entry.event}
            </span>
            <span className="text-[10px] text-indigo-300/60">
              {new Date(entry.ts).toLocaleTimeString("en-IN", { hour12: false })}
            </span>
          </div>
          <p className="mt-1 truncate font-mono text-[10px] text-emerald-300">
            {entry.this_hash.slice(0, 16)}…{entry.this_hash.slice(-8)}
          </p>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-indigo-300" />
        ) : (
          <ChevronRight className="h-4 w-4 text-indigo-300" />
        )}
      </button>

      {open && (
        <div className="border-t border-white/10 p-4 text-xs">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Previous hash">
              <code className="break-all font-mono text-[10px] text-indigo-200">
                {entry.prev_hash || "GENESIS"}
              </code>
            </Field>
            <Field label="This hash">
              <code className="break-all font-mono text-[10px] text-emerald-300">
                {entry.this_hash}
              </code>
            </Field>
          </div>
          <Field label="Data" className="mt-3">
            <pre className="overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-[10px] leading-relaxed text-indigo-100">
              {JSON.stringify(entry.data, null, 2)}
            </pre>
          </Field>
        </div>
      )}
    </article>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-indigo-300/70">
        {label}
      </p>
      {children}
    </div>
  );
}

/* ----------- Sidebar ----------- */
function Sidebar({
  headHash,
  count,
  verify,
}: {
  headHash: string | null;
  count: number;
  verify: VerifyResult | null;
}) {
  return (
    <aside className="space-y-4">
      <div className="rounded-xl border border-white/10 glass-strong p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gold">
          Chain root hash
        </p>
        {headHash ? <CopyHash hash={headHash} /> : <p className="mt-2 text-sm text-indigo-300/60">—</p>}
      </div>

      <div className="rounded-xl border border-white/10 glass-strong p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
          Stats
        </p>
        <ul className="mt-2 space-y-1.5 text-xs">
          <li className="flex justify-between">
            <span className="text-indigo-200/80">Entries</span>
            <span className="font-mono text-white">{count}</span>
          </li>
          <li className="flex justify-between">
            <span className="text-indigo-200/80">Verifier</span>
            <span
              className={cn(
                "font-mono",
                verify?.ok ? "text-emerald-300" : "text-rose-300",
              )}
            >
              {verify?.ok ? "OK" : "FAIL"}
            </span>
          </li>
        </ul>
      </div>

      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] p-4 text-xs">
        <ShieldCheck className="mb-2 h-4 w-4 text-emerald-400" />
        <p className="font-bold uppercase tracking-widest text-emerald-300">
          What this proves
        </p>
        <p className="mt-2 leading-relaxed text-emerald-100/90">
          Each entry's <code>this_hash</code> covers the previous hash + its own
          data. Re-hashing every row reproduces the chain. A single tampered
          field anywhere breaks it.
        </p>
      </div>
    </aside>
  );
}

function CopyHash({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="mt-2 break-all font-mono text-[11px] leading-relaxed text-emerald-300">
        {hash}
      </p>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(hash);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {}
        }}
        className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-200 hover:bg-white/20"
      >
        {copied ? (
          <>
            <Check className="h-3 w-3 text-emerald-400" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" />
            Copy hash
          </>
        )}
      </button>
    </div>
  );
}
