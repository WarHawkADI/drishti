"use client";

import { motion } from "framer-motion";

type Props = {
  active: boolean;       // pulse when AI is speaking
  thinking?: boolean;    // shimmer when AI is reasoning between turns
  size?: number;
};

/**
 * Drishti voice orb. Concentric circles with gold center, radial bloom,
 * and audio-reactive scale. Has three states:
 *   - idle      (subtle breathing)
 *   - active    (full pulse + ripple rings)
 *   - thinking  (slow rotating gradient halo)
 */
export default function VoiceOrb({ active, thinking, size = 240 }: Props) {
  const s = size;
  const pulseRings = [1.0, 1.25, 1.55];

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: s, height: s }}
      aria-label={
        active ? "Drishti is speaking" : thinking ? "Drishti is thinking" : "Voice orb"
      }
    >
      {/* Outer ambient bloom (always visible, intensifies on activity) */}
      <div
        className={`absolute rounded-full transition-opacity duration-500 ${
          active ? "opacity-100" : "opacity-60"
        }`}
        style={{
          width: s * 1.6,
          height: s * 1.6,
          background:
            "radial-gradient(circle, rgba(245,183,0,0.28) 0%, rgba(124,58,237,0.18) 40%, transparent 70%)",
          filter: "blur(20px)",
        }}
      />

      {/* Thinking halo (rotating sweep) */}
      {thinking && !active && (
        <motion.div
          className="absolute rounded-full"
          style={{
            width: s * 1.1,
            height: s * 1.1,
            background:
              "conic-gradient(from 0deg, transparent 0%, rgba(245,183,0,0.5) 25%, transparent 50%)",
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
        />
      )}

      {/* Outer pulse rings - only when actively speaking */}
      {active &&
        pulseRings.map((scale, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-gold/50"
            style={{ width: s, height: s }}
            initial={{ scale: 0.9, opacity: 0.7 }}
            animate={{ scale, opacity: 0 }}
            transition={{
              duration: 2.4,
              repeat: Infinity,
              delay: i * 0.5,
              ease: "easeOut",
            }}
          />
        ))}

      {/* Static outer ring */}
      <div
        className="absolute rounded-full ring-1 ring-white/15"
        style={{
          width: s,
          height: s,
          background:
            "radial-gradient(circle at 50% 30%, rgba(49,46,129,0.85), rgba(11,11,43,0.95))",
        }}
      />

      {/* Mid ring (breathes) */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: s * 0.72,
          height: s * 0.72,
          background:
            "radial-gradient(circle at 40% 30%, #4338CA, #1E1B4B)",
          boxShadow: "inset 0 0 30px rgba(245,183,0,0.25)",
        }}
        animate={
          active
            ? { scale: [1, 1.06, 1] }
            : thinking
              ? { scale: [1, 1.02, 1] }
              : { scale: [1, 1.015, 1] }
        }
        transition={{
          duration: active ? 1.0 : 2.4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Gold core (pulses with speech) */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: s * 0.42,
          height: s * 0.42,
          background:
            "radial-gradient(circle at 35% 30%, #FFE574 0%, #F5B700 50%, #B8860B 100%)",
          boxShadow:
            "0 0 50px rgba(245,183,0,0.65), inset 0 0 20px rgba(255,229,116,0.5)",
        }}
        animate={
          active
            ? { scale: [1, 1.12, 1] }
            : { scale: [1, 1.04, 1] }
        }
        transition={{
          duration: active ? 0.6 : 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Inner white highlight (specular) */}
      <motion.div
        className="absolute rounded-full bg-white"
        style={{
          width: s * 0.14,
          height: s * 0.14,
          boxShadow: "0 0 12px rgba(255,255,255,0.85)",
        }}
        animate={active ? { opacity: [0.9, 1, 0.9] } : { opacity: 0.85 }}
        transition={{ duration: 0.8, repeat: Infinity }}
      />
    </div>
  );
}
