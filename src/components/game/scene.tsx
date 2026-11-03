"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

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

/** Tabellone e canestro visti da davanti, in alto nella scena. */
export function Hoop({ className, swish }: { className?: string; swish?: boolean }) {
  return (
    <svg viewBox="0 0 160 120" className={clsx("w-[150px]", className)} aria-hidden>
      <rect x="18" y="6" width="124" height="74" rx="6" fill="#FFF8EA" stroke="#1D1A16" strokeWidth="3" />
      <rect x="56" y="34" width="48" height="34" fill="none" stroke="#E5412D" strokeWidth="3" />
      <rect x="76" y="80" width="8" height="10" fill="#1D1A16" />
      {/* retina */}
      <path
        d="M52 92 L60 116 L100 116 L108 92 M60 116 L66 92 M100 116 L94 92 M70 116 L74 92 M90 116 L86 92 M80 116 V92 M56 102 H104 M58 109 H102"
        fill="none"
        stroke="#FFF8EA"
        strokeWidth="2"
        className={swish ? "hoop-net-swish" : undefined}
      />
      <ellipse cx="80" cy="92" rx="30" ry="6" fill="none" stroke="#1D1A16" strokeWidth="6" />
      <ellipse cx="80" cy="92" rx="30" ry="6" fill="none" stroke="#F26A1B" strokeWidth="3.2" />
    </svg>
  );
}

/** Il campo blu a retino con le linee color crema: lo sfondo di partite e sfide. */
export function CourtScene({
  children,
  className,
  night = false,
}: {
  children: ReactNode;
  className?: string;
  night?: boolean;
}) {
  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-[26px] border-[2.5px] border-edge",
        night ? "bg-[#1f2a52]" : "bg-court",
        className,
      )}
      style={{
        backgroundImage: "radial-gradient(rgb(0 0 0 / 0.17) 1.1px, transparent 1.5px)",
        backgroundSize: "7px 7px",
        boxShadow: "var(--shadow-pop)",
      }}
    >
      <svg viewBox="0 0 300 400" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <g fill="none" stroke="rgb(255 250 240 / 0.3)" strokeWidth="3">
          <rect x="95" y="0" width="110" height="170" />
          <circle cx="150" cy="170" r="55" />
          <path d="M20 0 V110 Q150 330 280 110 V0" />
          <path d="M0 398 H300" />
        </g>
      </svg>
      {children}
    </div>
  );
}

/** Un compagno o un avversario visto dall'alto: un dischetto col numero. */
export function Dot({
  n,
  tone,
  size = 52,
  label,
}: {
  n: number | string;
  tone: "us" | "them";
  size?: number;
  label?: string;
}) {
  return (
    <span
      className={clsx(
        "num grid place-items-center rounded-full border-[2.5px] border-edge",
        tone === "us" ? "bg-volt text-volt-ink" : "bg-danger text-white",
      )}
      style={{ width: size, height: size, fontSize: size * 0.42, boxShadow: "2px 2px 0 var(--edge)" }}
      aria-label={label}
    >
      {n}
    </span>
  );
}
