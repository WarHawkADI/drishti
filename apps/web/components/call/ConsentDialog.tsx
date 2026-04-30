"use client";

import { ShieldCheck, Lock, Mic } from "lucide-react";
import { useState } from "react";

type Props = {
  prompt: string;
  consentType: string;
  onAccept: (spoken: string) => void;
};

/**
 * Consent dialog. The agent prompts the customer for verbal consent;
 * the dialog is a visual confirmation. The actual record in the audit chain
 * is from STT-captured spoken_text.
 */
export default function ConsentDialog({ prompt, consentType, onAccept }: Props) {
  const [accepted, setAccepted] = useState(false);
  if (accepted) return null;

  return (
    <div
      className="mt-6 w-full max-w-2xl rounded-xl border border-emerald-400/50 bg-emerald-500/10 p-5 caption-enter"
      role="dialog"
      aria-labelledby="consent-title"
    >
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-emerald-300" />
        <h3
          id="consent-title"
          className="text-sm font-bold uppercase tracking-widest text-emerald-300"
        >
          Verbal Consent · {consentType.replace(/_/g, " ")}
        </h3>
      </div>
      <p className="mb-3 text-sm leading-relaxed text-emerald-50">{prompt}</p>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-emerald-200/80">
        <span className="inline-flex items-center gap-1">
          <Mic className="h-3 w-3" />
          Speak &ldquo;<strong>I agree</strong>&rdquo;
        </span>
        <span className="text-emerald-400/40">·</span>
        <span className="inline-flex items-center gap-1">
          <Lock className="h-3 w-3" />
          Timestamped &amp; hashed into the audit chain
        </span>
      </div>

      <button
        type="button"
        onClick={() => {
          setAccepted(true);
          onAccept("I agree");
        }}
        className="min-h-[48px] w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
      >
        I agree (visual confirmation)
      </button>
    </div>
  );
}
