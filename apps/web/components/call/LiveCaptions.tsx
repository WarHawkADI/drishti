"use client";

import { useEffect, useRef, useState } from "react";
import { History } from "lucide-react";
import { useCallStore } from "@/lib/store";

export default function LiveCaptions() {
  const captions = useCallStore((s) => s.captions);
  const step = useCallStore((s) => s.step);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? captions : captions.slice(-3);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({
      top: scroller.current.scrollHeight,
      behavior: "smooth",
    });
  }, [captions.length, showAll]);

  /* Empty state: shows while we wait for the first transcript */
  if (captions.length === 0) {
    return (
      <div className="mt-6 w-full max-w-2xl">
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/20">
            <span className="h-2 w-2 animate-pulse rounded-full bg-gold" />
          </span>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gold">
              {step === "greet" ? "Drishti is greeting you" : "Listening…"}
            </p>
            <div className="mt-1 h-3 w-2/3 rounded shimmer-bg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 w-full max-w-2xl">
      {captions.length > 3 && (
        <div className="mb-2 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-200 transition hover:bg-white/10"
            aria-pressed={showAll ? "true" : "false"}
          >
            <History className="h-3 w-3" />
            {showAll ? `Show last 3` : `Full history (${captions.length})`}
          </button>
        </div>
      )}
      <div
        ref={scroller}
        className={`space-y-2 overflow-y-auto pr-1 ${
          showAll ? "max-h-72" : "max-h-44"
        }`}
        aria-live="polite"
        aria-atomic="false"
      >
        {visible.map((c, i) => {
          const isDrishti = c.speaker === "drishti";
          return (
            <div
              key={c.ts}
              className={`caption-enter rounded-xl px-4 py-3 text-sm leading-snug ${
                isDrishti
                  ? "border-l-4 border-gold/80 bg-white/[0.06] text-white"
                  : "border-l-4 border-indigo-400/70 bg-indigo-500/10 text-indigo-50"
              } ${!showAll && i === visible.length - 1 ? "" : "opacity-80"}`}
            >
              <span
                className={`mb-1 block text-[10px] font-bold uppercase tracking-widest ${
                  isDrishti ? "text-gold" : "text-indigo-300"
                }`}
              >
                {isDrishti ? "DRISHTI · MEERA" : "YOU"}
              </span>
              <span>{c.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
