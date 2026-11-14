"use client";

import { memo, type CSSProperties, type RefObject } from "react";

const INK = "#1D1A16";
const CREAM = "#FFFAF0";
const VOLT = "#FFC531";
const COURT = "#2D5BE3";

/** Quanto è grande il microfono nello studio (punti dello studio 390×844). */
export const MIC_W = 36;
export const MIC_H = 68;

/**
 * Il microfono da scrivania dello Studio Campetto, disegnato come il resto dello studio (contorno
 * inchiostro, colori dell'app): base tonda, collo flessibile, la bandierina blu campo con il
 * pallone giallo (come i cubi dei microfoni in tv) e la testa nera con l'anello giallo, inclinata
 * verso la bocca di chi parla. `tilt` in gradi: positivo verso destra.
 */
export const DeskMic = memo(function DeskMic({ tilt, style, className, boxRef }: { tilt: number; style?: CSSProperties; className?: string; boxRef?: RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={boxRef} className={className} style={{ position: "absolute", width: MIC_W, height: MIC_H, transformOrigin: "50% 100%", ...style }} aria-hidden>
      <svg viewBox="0 0 40 76" width={MIC_W} height={MIC_H} style={{ overflow: "visible" }}>
        {/* L'ombra sul tavolo e la base. */}
        <ellipse cx="20" cy="75" rx="17" ry="2.6" fill={INK} opacity="0.18" />
        <rect x="5" y="67" width="30" height="8" rx="4" fill={INK} />
        <rect x="9" y="68.6" width="14" height="1.8" rx="0.9" fill={CREAM} opacity="0.35" />
        {/* Il collo flessibile, con gli anelli. */}
        <path d="M20 68 C20 58 24 52 23 41" fill="none" stroke={INK} strokeWidth="4.2" strokeLinecap="round" />
        <path d="M18.4 62 h3.4 M18.9 57 h3.6 M20.4 52 h3.4" stroke="#57514A" strokeWidth="1.1" strokeLinecap="round" />
        <g transform={`rotate(${tilt} 23 41)`}>
          {/* La testa: nera con la griglia a puntini e l'anello giallo. */}
          <rect x="14" y="1" width="18" height="27" rx="9" fill={INK} />
          {[5.5, 9.5, 13.5].map((y) =>
            [18.5, 23, 27.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.05" fill="#6B645B" />),
          )}
          <path d="M16.6 6 Q16 11 16.6 16" stroke={CREAM} strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.45" />
          <rect x="14" y="18.5" width="18" height="3.8" fill={VOLT} />
          {/* La bandierina blu campo con il pallone dell'app. */}
          <rect x="11.5" y="25" width="23" height="17" rx="5" fill={COURT} stroke={INK} strokeWidth="2.4" />
          <rect x="14" y="27.2" width="8" height="1.8" rx="0.9" fill={CREAM} opacity="0.35" />
          <circle cx="23" cy="33.5" r="5.2" fill={VOLT} stroke={INK} strokeWidth="1.6" />
          <path d="M17.8 33.5 H28.2 M23 28.3 Q20.4 33.5 23 38.7 M23 28.3 Q25.6 33.5 23 38.7" stroke={INK} strokeWidth="1.15" fill="none" />
        </g>
      </svg>
    </div>
  );
});
