"use client";

type Size = "sm" | "md" | "lg";

const SIZE: Record<Size, { w: number; h: number }> = {
  sm: { w: 32, h: 19 },
  md: { w: 48, h: 28 },
  lg: { w: 80, h: 48 },
};

export default function EyeMark({
  size = "md",
  className = "",
}: {
  size?: Size;
  className?: string;
}) {
  const dims = SIZE[size];
  return (
    <svg
      viewBox="0 0 40 24"
      width={dims.w}
      height={dims.h}
      className={className}
      aria-label="Drishti eye mark"
    >
      <defs>
        <radialGradient id="iris" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#FFE574" />
          <stop offset="60%" stopColor="#F5B700" />
          <stop offset="100%" stopColor="#B8860B" />
        </radialGradient>
      </defs>
      <ellipse
        cx="20"
        cy="12"
        rx="18"
        ry="10"
        fill="#0B0B2B"
        stroke="#F5B700"
        strokeWidth="1.4"
      />
      <circle cx="20" cy="12" r="5.5" fill="url(#iris)" />
      <circle cx="20" cy="12" r="2.2" fill="#0B0B2B" />
      <circle cx="21.5" cy="10.5" r="0.9" fill="#fff" opacity="0.9" />
    </svg>
  );
}
