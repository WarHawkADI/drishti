"use client";

import { useEffect, useState } from "react";

/**
 * Lightweight celebration confetti - pure CSS particles, no external dep.
 * Fires for ~4 seconds then unmounts itself.
 */
export default function Confetti() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 4500);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;

  // Generate 40 particles with deterministic but varied positions
  const particles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: (i * 17 + 7) % 100,
    delay: (i * 73) % 1500,
    duration: 1800 + ((i * 37) % 1400),
    color: ["#F5B700", "#FFE574", "#7C3AED", "#10B981", "#F59E0B"][i % 5],
    size: 6 + ((i * 13) % 8),
  }));

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
      aria-hidden
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute top-[-20px] block opacity-0"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.id % 3 === 0 ? "9999px" : "1px",
            animation: `confetti-fall ${p.duration}ms ${p.delay}ms cubic-bezier(0.4, 0.0, 0.2, 1) forwards`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-30px) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  );
}
