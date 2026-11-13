"use client";

import { useId } from "react";

const INK = "#1D1A16";
const BALL = "#F26A1B";
const BALL_DARK = "#C9500F";
const CREAM = "#FFF8EA";

/**
 * I due presentatori dello Studio Campetto: la stessa testa a pallone dei personaggi
 * dell'app, ma vestiti da studio televisivo (giacca, camicia, cravatta o camicetta, occhiali).
 *
 * Si muovono con poche variabili CSS che il player aggiorna a ogni fotogramma, senza
 * ridisegnare niente: --mouth (0-1, quanto è aperta la bocca), --look (-1 sinistra, 1 destra),
 * --blink (1 aperti, 0 chiusi), --arm (0-1, alza il foglio), --breath (respiro), --nod (cenno).
 */
export function Presenter({ who, className }: { who: "lui" | "lei"; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const lei = who === "lei";
  const jacket = lei ? "#B4234A" : "#1F2C4D";
  const jacketDark = lei ? "#8C1A39" : "#141D36";
  const shirt = lei ? "#FFF3E2" : "#F4F7FF";
  const tie = "#E5412D";

  return (
    <svg
      viewBox="0 0 200 230"
      className={className}
      aria-hidden
      style={{ overflow: "visible" }}
    >
      <defs>
        <pattern id={`dots-${uid}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <circle cx="2.5" cy="2.5" r="1.05" fill={BALL_DARK} />
        </pattern>
        <clipPath id={`ball-${uid}`}>
          <circle cx="100" cy="82" r="50" />
        </clipPath>
      </defs>

      {/* Il busto respira appena: tutto sale e scende di un pelo. */}
      <g className="studio-breath">
        {/* Spalle e giacca. */}
        <path
          d="M28 230 Q30 168 62 150 Q100 136 138 150 Q170 168 172 230 Z"
          fill={jacket}
          stroke={INK}
          strokeWidth="4"
          strokeLinejoin="round"
        />
        {/* Camicia a V. */}
        <path d="M80 142 L100 196 L120 142 Q100 136 80 142 Z" fill={shirt} stroke={INK} strokeWidth="3.2" strokeLinejoin="round" />
        {lei ? (
          <>
            {/* Collana di perle sulla camicetta. */}
            {[0, 1, 2, 3, 4, 5, 6].map((i) => {
              const a = (i / 6) * Math.PI;
              return <circle key={i} cx={100 - Math.cos(a) * 15} cy={150 + Math.sin(a) * 13} r="2.6" fill={CREAM} stroke={INK} strokeWidth="1.2" />;
            })}
          </>
        ) : (
          <>
            {/* Colletto e cravatta. */}
            <path d="M84 141 L96 152 L92 158 Z M116 141 L104 152 L108 158 Z" fill={shirt} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M95 151 L105 151 L103 158 L97 158 Z" fill={tie} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M97 158 L103 158 L108 190 L100 199 L92 190 Z" fill={tie} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M95 172 L106 166 M94 182 L107 176" stroke="#B3261E" strokeWidth="2" />
          </>
        )}
        {/* I revers della giacca. */}
        <path d="M80 142 L74 156 L86 164 L78 176 L100 206 Z" fill={jacketDark} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <path d="M120 142 L126 156 L114 164 L122 176 L100 206 Z" fill={jacketDark} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        {/* Taschino con il fazzoletto. */}
        <path d={lei ? "M132 186 L150 184" : "M128 184 L148 182"} stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
        <path d={lei ? "M135 185 L139 177 L143 184" : "M131 183 L135 175 L139 182"} fill={lei ? "#FFC531" : CREAM} stroke={INK} strokeWidth="2" strokeLinejoin="round" />

        {/* La testa annuisce e si gira verso chi parla. */}
        <g className="studio-head">
          {lei && (
            // Caschetto scuro dietro la testa.
            <path d="M44 92 Q40 30 100 26 Q160 30 156 92 Q158 122 146 130 L132 118 L68 118 L54 130 Q42 122 44 92 Z" fill="#3A2416" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          )}
          <circle cx="100" cy="82" r="50" fill={BALL} />
          <g clipPath={`url(#ball-${uid})`}>
            <path d="M58 58 A62 62 0 0 0 134 132 L160 140 L160 20 Z" fill={`url(#dots-${uid})`} opacity="0.9" />
            <path d="M100 32 V132 M50 82 H150" stroke={INK} strokeWidth="3.2" fill="none" />
            <path d="M66 42 Q88 82 66 122 M134 42 Q112 82 134 122" stroke={INK} strokeWidth="3.2" fill="none" />
          </g>
          <circle cx="100" cy="82" r="50" fill="none" stroke={INK} strokeWidth="4.5" />
          <path d="M70 50 Q78 40 90 38" fill="none" stroke={CREAM} strokeWidth="5" strokeLinecap="round" opacity="0.85" />
          {lei && (
            // Frangetta sopra la palla.
            <path d="M52 66 Q62 28 100 28 Q138 28 148 66 Q128 52 112 56 Q100 44 86 56 Q70 50 52 66 Z" fill="#3A2416" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          )}

          {/* Il viso guarda dove serve: sinistra, destra o in camera. */}
          <g className="studio-face">
            <g className="studio-brows">
              <path d={lei ? "M70 60 Q80 54 90 59" : "M68 60 Q79 53 91 58"} stroke={INK} strokeWidth="3.6" fill="none" strokeLinecap="round" />
              <path d={lei ? "M110 59 Q120 54 130 60" : "M109 58 Q121 53 132 60"} stroke={INK} strokeWidth="3.6" fill="none" strokeLinecap="round" />
            </g>
            {[82, 118].map((x) => (
              <g key={x} transform={`translate(${x} 78)`}>
                <g className="studio-eye">
                  <ellipse rx="10" ry="13" fill={CREAM} stroke={INK} strokeWidth="3" />
                  <g className="studio-pupil">
                    <ellipse rx="5.2" ry="7.8" fill={INK} cy="1.5" />
                    <path d="M0 0 L5 -4.6 L2.6 -7 Z" fill={CREAM} />
                  </g>
                </g>
                {lei && <path d={x < 100 ? "M-9 -10 L-14 -15 M-5 -12.5 L-8 -18" : "M9 -10 L14 -15 M5 -12.5 L8 -18"} stroke={INK} strokeWidth="2.4" strokeLinecap="round" />}
              </g>
            ))}
            {/* Occhiali: neri e squadrati lui, sottili e dorati lei. */}
            {lei ? (
              <g fill="none" stroke="#C8901A" strokeWidth="2.6">
                <circle cx="82" cy="79" r="15" />
                <circle cx="118" cy="79" r="15" />
                <path d="M97 78 Q100 75 103 78" />
              </g>
            ) : (
              <g fill="rgb(255 255 255 / 0.12)" stroke={INK} strokeWidth="4" strokeLinejoin="round">
                <rect x="65" y="65" width="34" height="27" rx="6" />
                <rect x="101" y="65" width="34" height="27" rx="6" />
                <path d="M99 76 L101 76" />
              </g>
            )}
            {/* La bocca: chiusa è un sorriso, aperta si allarga seguendo la voce. */}
            <g transform="translate(100 106)">
              <g className="studio-mouth-open">
                <ellipse rx="11" ry="8" fill="#5A1410" stroke={INK} strokeWidth="2.6" />
                <ellipse cy="4" rx="6" ry="3" fill="#E5412D" />
              </g>
              <path className="studio-mouth-shut" d="M-11 -1 Q0 7 11 -1" fill="none" stroke={lei ? "#C2183B" : INK} strokeWidth="3.4" strokeLinecap="round" />
            </g>
          </g>
          {lei && (
            <>
              <circle cx="49" cy="96" r="3.6" fill={CREAM} stroke={INK} strokeWidth="1.6" />
              <circle cx="151" cy="96" r="3.6" fill={CREAM} stroke={INK} strokeWidth="1.6" />
            </>
          )}
        </g>
      </g>
    </svg>
  );
}

/** Le mani sulla scrivania con i fogli degli appunti; una si alza per leggere (--arm). */
export function Notes({ who }: { who: "lui" | "lei" }) {
  const sleeve = who === "lei" ? "#B4234A" : "#1F2C4D";
  return (
    <svg viewBox="0 0 200 60" aria-hidden style={{ overflow: "visible" }}>
      {/* I fogli fermi sul tavolo. */}
      <g transform="translate(92 22) rotate(-6)">
        <rect width="58" height="34" rx="2" fill="#FFFDF7" stroke={INK} strokeWidth="2.4" />
        <path d="M8 9 H46 M8 16 H50 M8 23 H38" stroke="#9C9488" strokeWidth="2" />
      </g>
      {/* La mano sinistra, ferma. */}
      <path d="M30 60 Q40 34 64 30" stroke={sleeve} strokeWidth="16" fill="none" strokeLinecap="round" />
      <circle cx="68" cy="30" r="9" fill={CREAM} stroke={INK} strokeWidth="2.8" />
      {/* La mano destra che prende e solleva un foglio. */}
      <g className="studio-arm">
        <path d="M170 60 Q160 36 138 30" stroke={sleeve} strokeWidth="16" fill="none" strokeLinecap="round" />
        <g transform="translate(110 4) rotate(8)">
          <rect width="46" height="30" rx="2" fill="#FFFDF7" stroke={INK} strokeWidth="2.4" />
          <path d="M7 8 H38 M7 14 H40 M7 20 H30" stroke="#9C9488" strokeWidth="2" />
        </g>
        <circle cx="134" cy="30" r="9" fill={CREAM} stroke={INK} strokeWidth="2.8" />
      </g>
    </svg>
  );
}
