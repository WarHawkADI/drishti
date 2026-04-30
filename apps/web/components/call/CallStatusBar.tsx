"use client";

import { useEffect, useState } from "react";
import { useConnectionState } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { ExternalLink, FileSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import EyeMark from "@/components/brand/EyeMark";

type Props = {
  sessionId: string;
  customerName: string;
};

const CONN_LABEL: Record<ConnectionState, { label: string; tone: string }> = {
  [ConnectionState.Disconnected]:
    { label: "Disconnected", tone: "bg-rose-500/20 text-rose-300 border-rose-400/30" },
  [ConnectionState.Connecting]:
    { label: "Connecting…", tone: "bg-amber-500/20 text-amber-300 border-amber-400/30" },
  [ConnectionState.Connected]:
    { label: "Live", tone: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40" },
  [ConnectionState.Reconnecting]:
    { label: "Reconnecting…", tone: "bg-amber-500/20 text-amber-300 border-amber-400/30" },
  [ConnectionState.SignalReconnecting]:
    { label: "Reconnecting…", tone: "bg-amber-500/20 text-amber-300 border-amber-400/30" },
};

export default function CallStatusBar({ sessionId, customerName }: Props) {
  const conn = useConnectionState();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (conn !== ConnectionState.Connected) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [conn]);

  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  const meta = CONN_LABEL[conn] || CONN_LABEL[ConnectionState.Connecting];

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
      {/* Brand + session */}
      <div className="flex items-center gap-3">
        <EyeMark size="sm" />
        <div className="leading-tight">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gold">
            DRISHTI · MEERA
          </p>
          <p className="text-[11px] text-indigo-300/80">
            Session{" "}
            <a
              href={`/audit/${sessionId}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open audit chain in a new tab"
              className="inline-flex items-center gap-0.5 font-mono text-emerald-300 hover:text-emerald-200 hover:underline"
            >
              {sessionId.slice(-6)}
              <ExternalLink className="h-2.5 w-2.5" />
            </a>{" "}
            · {customerName}
          </p>
        </div>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/audit/${sessionId}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Inspect this call's SHA-256 audit chain"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300 transition hover:border-emerald-400/60 hover:text-emerald-200"
        >
          <FileSearch className="h-3 w-3" />
          View audit
        </a>

        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest",
            meta.tone,
          )}
        >
          {conn === ConnectionState.Connected && (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          )}
          {meta.label}
        </span>

        <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-rose-300">
          <span className="rec-dot" />
          REC {m}:{s}
        </span>
      </div>
    </header>
  );
}
