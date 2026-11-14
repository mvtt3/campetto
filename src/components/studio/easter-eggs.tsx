"use client";

import { memo } from "react";

const INK = "#1D1A16";
const CREAM = "#FFFAF0";
const VOLT = "#FFC531";
const BALL = "#F26A1B";

/**
 * Tre piccole sorprese per chi gioca, disegnate come il resto dello studio (contorno inchiostro,
 * colori dell'app) e messe ai margini: non coprono facce, maxischermo, grafiche o sottotitoli.
 * Le coordinate sono quelle dello studio (390×844).
 */

/** L'attaccapanni sulla parete di sinistra, sotto il pannello della data: un cappellino, una felpa e, davanti, la maglia PROLASSO con la montagnetta. */
export const CoatRack = memo(function CoatRack() {
  return (
    <svg className="absolute" style={{ left: 2, top: 284, width: 84, height: 304, overflow: "visible" }} viewBox="0 0 84 304" aria-hidden>
      {/* Base a tre piedi (dietro la scrivania quasi non si vede). */}
      <path d="M42 286 L22 300 M42 286 L62 300 M42 286 L42 302" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      {/* L'asta e il pomello giallo. */}
      <rect x="39.5" y="14" width="5" height="276" rx="2.5" fill={INK} />
      <rect x="40.6" y="18" width="1.4" height="262" rx="0.7" fill={CREAM} opacity="0.35" />
      <circle cx="42" cy="11" r="6.5" fill={VOLT} stroke={INK} strokeWidth="2.6" />
      {/* I due ganci. */}
      <path d="M42 24 Q22 22 17 36" fill="none" stroke={INK} strokeWidth="3.6" strokeLinecap="round" />
      <path d="M42 24 Q62 22 67 36" fill="none" stroke={INK} strokeWidth="3.6" strokeLinecap="round" />
      {/* Il cappellino giallo appeso a sinistra. */}
      <g transform="translate(4 32) rotate(-12 14 10)">
        <path d="M4 14 Q4 2 15 2 Q26 2 26 14 Z" fill={VOLT} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M24 13 Q34 13 35 17 L22 17 Z" fill={VOLT} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
        <circle cx="15" cy="3" r="1.8" fill={INK} />
      </g>
      {/* La felpa arancio dietro, che spunta. */}
      <path d="M58 40 L74 46 L82 66 L76 69 L74 62 L74 96 L50 96 L50 50 Z" fill={BALL} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M56 44 Q63 52 70 45" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      {/* La maglia davanti, sulla gruccia: più grande, con le maniche che cadono, e PROLASSO sul petto. */}
      <path d="M67 36 L67 41 M53 49 L67 41 L81 49" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M51.5 50.5 L42 61.5 Q40.6 64.6 43.6 66.4 L50.6 62.6 Z" fill={CREAM} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M82.5 50.5 L92 61.5 Q93.4 64.6 90.4 66.4 L83.4 62.6 Z" fill={CREAM} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      <path
        d="M58 47 Q67 55 76 47 L84 50 L84 100 Q84 102 82 102 L52 102 Q50 102 50 100 L50 50 Z"
        fill={CREAM}
        stroke={INK}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path d="M59.6 48.6 Q67 54.2 74.4 48.6" fill="none" stroke={INK} strokeWidth="1.2" opacity="0.5" />
      {/* La scritta, grande e scura: si legge anche nell'inquadratura larga. */}
      <text x="67" y="70.5" textAnchor="middle" fontSize="9" fontWeight="900" fill={INK} fontFamily="inherit" textLength="29" lengthAdjust="spacingAndGlyphs">
        PROLASSO
      </text>
      {/* Sotto, il distintivo: una montagnetta innevata davanti al sole. */}
      <g transform="translate(59.8 76.5) scale(0.8)">
        <rect width="18" height="15" rx="4" fill="#2D5BE3" />
        <circle cx="12.5" cy="6" r="3.2" fill={VOLT} />
        <path d="M1.5 15 L7 6 L10 10 L12.5 7.5 L16.5 15 Z" fill={INK} />
        <path d="M5.3 8.8 L7 6 L8.7 8.6 L7.6 9.4 L6.6 8.6 Z" fill={CREAM} />
      </g>
    </svg>
  );
});

/** Il quadretto sulla parete di destra, sotto il pannello del logo: SPICE BOYS col peperoncino. */
export const SpicePlaque = memo(function SpicePlaque() {
  return (
    <div className="absolute" style={{ left: 292, top: 292, transform: "rotate(-3deg)" }} aria-hidden>
      {/* Il chiodo e il filo. */}
      <svg className="absolute left-1/2 top-[-14px] -translate-x-1/2" width="56" height="18" viewBox="0 0 56 18" fill="none">
        <path d="M6 17 L28 3 L50 17" stroke="rgb(255 255 255 / 0.7)" strokeWidth="1.4" />
        <circle cx="28" cy="3" r="2.6" fill={VOLT} stroke={INK} strokeWidth="1.4" />
      </svg>
      <div className="flex items-center gap-1 whitespace-nowrap rounded-[9px] bg-[#FFFAF0] px-[7px] py-[5px] text-[9.5px] font-extrabold leading-none tracking-[0.04em] text-[#1d1a16] shadow-[0_8px_16px_-8px_rgb(10_20_60/0.6)]">
        SPICE BOYS
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path d="M14 6 Q15 2 19 2" stroke="#2E8B3A" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M12.5 5.5 Q17 4 17.5 8 Q17 17 5 22 Q3 22.5 3.5 20.5 Q10 15 11 8 Q11 6 12.5 5.5 Z" fill="#E5412D" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M11.5 6 Q14 4.5 16 6.5" fill="none" stroke="#2E8B3A" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M13.5 9 Q13 12 11 14" stroke="rgb(255 255 255 / 0.6)" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
});

/** Il cartone del latte in fondo a destra sulla scrivania, con la mucca. */
export const MilkCarton = memo(function MilkCarton() {
  return (
    <svg className="absolute" style={{ left: 352, top: 562, width: 24, height: 40, overflow: "visible" }} viewBox="0 0 48 80" aria-hidden>
      <defs>
        <clipPath id="studio-milk-body">
          <rect x="5" y="26" width="38" height="50" rx="3" />
        </clipPath>
      </defs>
      {/* Tetto a capanna e cresta. */}
      <rect x="13" y="2" width="22" height="8" rx="1.5" fill={CREAM} stroke={INK} strokeWidth="2.6" />
      <path d="M5 26 L13 9 L35 9 L43 26 Z" fill="#F3ECDD" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M24 9 L24 26" stroke={INK} strokeWidth="1.6" opacity="0.5" />
      {/* Il corpo con le macchie della mucca. */}
      <rect x="5" y="26" width="38" height="50" rx="3" fill={CREAM} />
      <g clipPath="url(#studio-milk-body)" fill={INK}>
        <path d="M3 30 Q12 27 13 35 Q12 42 3 40 Z" />
        <path d="M38 62 Q46 58 47 68 Q44 76 36 72 Q33 66 38 62 Z" />
        <path d="M6 66 Q11 63 13 68 Q11 73 6 72 Z" />
      </g>
      {/* La mucca: testa bianca, corna gialle, muso rosa. */}
      <g transform="translate(24 47)">
        <path d="M-9 -9 Q-13 -14 -9 -15 M9 -9 Q13 -14 9 -15" stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <ellipse cx="-11" cy="-5" rx="4" ry="2.4" fill={CREAM} stroke={INK} strokeWidth="1.8" transform="rotate(-20 -11 -5)" />
        <ellipse cx="11" cy="-5" rx="4" ry="2.4" fill={CREAM} stroke={INK} strokeWidth="1.8" transform="rotate(20 11 -5)" />
        <path d="M-8 -9 Q0 -13 8 -9 Q10 2 0 6 Q-10 2 -8 -9 Z" fill={CREAM} stroke={INK} strokeWidth="2.2" />
        <path d="M-2 -10.5 Q3 -10 4 -6 Q1 -4 -2 -6 Z" fill={INK} />
        <circle cx="-3.5" cy="-4" r="1.3" fill={INK} />
        <circle cx="3.5" cy="-4" r="1.3" fill={INK} />
        <ellipse cx="0" cy="2.5" rx="6.5" ry="4.2" fill="#F4A7A0" stroke={INK} strokeWidth="1.8" />
        <circle cx="-2.2" cy="2.5" r="1" fill={INK} />
        <circle cx="2.2" cy="2.5" r="1" fill={INK} />
      </g>
      {/* La fascia azzurra con la scritta. */}
      <rect x="5" y="60" width="38" height="9" fill="#2D5BE3" />
      <text x="24" y="67.3" textAnchor="middle" fontSize="7.4" fontWeight="800" fill={CREAM} fontFamily="inherit" letterSpacing="0.6">LATTE</text>
      <rect x="5" y="26" width="38" height="50" rx="3" fill="none" stroke={INK} strokeWidth="2.6" />
    </svg>
  );
});
