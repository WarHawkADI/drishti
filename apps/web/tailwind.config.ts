import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0B0B2B",
        indigo: {
          DEFAULT: "#1E1B4B",
          deep: "#13102F",
          mid: "#312E81",
          light: "#EEF2FF",
        },
        gold: {
          DEFAULT: "#F5B700",
          dark: "#B8860B",
          light: "#FFF8DC",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "Consolas", "monospace"],
      },
      backgroundImage: {
        "mesh-gold":
          "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(245,183,0,0.15), transparent 70%)",
        "mesh-indigo":
          "radial-gradient(ellipse 60% 50% at 100% 100%, rgba(124,58,237,0.18), transparent 60%)",
      },
      boxShadow: {
        glow: "0 0 60px rgba(245,183,0,0.5)",
        "glow-lg": "0 0 100px rgba(245,183,0,0.4)",
        "glow-indigo": "0 0 40px rgba(67,56,202,0.5)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "ping-slow": {
          "0%": { transform: "scale(1)", opacity: "0.7" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out",
        "shimmer": "shimmer 2.5s linear infinite",
        "ping-slow": "ping-slow 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "pulse": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
