"use client";

/**
 * Slim badge strip showing the AI providers powering the current call.
 * Drives home the "Indian-first" message via Sarvam.
 */
export default function TechStackBar() {
  const items = [
    { name: "Sarvam AI",       sub: "Voice · India",    color: "border-saffron text-saffron" },
    { name: "Claude Sonnet 4.6", sub: "Orchestrator",   color: "border-violet-400 text-violet-300" },
    { name: "LiveKit",         sub: "WebRTC",           color: "border-sky-400 text-sky-300" },
    { name: "LightGBM + SHAP", sub: "Risk + Explain",   color: "border-emerald-400 text-emerald-300" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 glass-strong p-3">
      <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300/80">
        Powered by:
      </span>
      {items.map((i) => (
        <span
          key={i.name}
          className={`rounded-md border bg-white/[0.04] px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${i.color}`}
          style={
            i.color.includes("saffron")
              ? { borderColor: "#FF9933", color: "#FF9933" }
              : undefined
          }
        >
          {i.name}
          <span className="ml-1 opacity-70">· {i.sub}</span>
        </span>
      ))}
    </div>
  );
}
