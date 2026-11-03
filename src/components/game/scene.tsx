"use client";

/** Il pallone disegnato (lo stesso dell'app). */
export function Ball({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={className} aria-hidden>
      <circle cx="20" cy="20" r="17.5" fill="#F26A1B" stroke="#1D1A16" strokeWidth="2.6" />
      <path
        d="M20 2.5 V37.5 M2.5 20 H37.5 M8 7.5 Q15 20 8 32.5 M32 7.5 Q25 20 32 32.5"
        fill="none"
        stroke="#1D1A16"
        strokeWidth="1.8"
      />
      <path d="M9.5 11 Q12 7.5 16.5 6.5" fill="none" stroke="#FFF8EA" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}
