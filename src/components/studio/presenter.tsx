"use client";

import { memo, useId } from "react";

const INK = "#1D1A16";
const BALL = "#F26A1B";
const BALL_DARK = "#C9500F";
const CREAM = "#FFF8EA";

/**
 * I due presentatori dello Studio Campetto: la stessa testa a pallone dei personaggi dell'app.
 * Paul (lui): felpa grigio grafite col cappuccio e i lacci, cappellino nero girato all'indietro
 * (visiera piatta che esce da dietro), niente occhiali. Silvia Dema (lei): caschetto ramato con
 * la frangia, occhiali sottili dorati, tunica
 * indiana (kurta) verde petrolio con il collo alla coreana e i ricami dorati.
 *
 * Si muovono con poche variabili CSS che il player aggiorna a ogni fotogramma, senza
 * ridisegnare niente: --mouth (0-1, quanto è aperta la bocca), --look (-1 sinistra, 1 destra),
 * --blink (1 aperti, 0 chiusi), --arm (0-1, alza il foglio), --breath (respiro), --nod (cenno).
 */
const HOODIE = "#4B5263";
const HOODIE_DARK = "#363C4A";
const KURTA = "#167A6C";
const KURTA_DARK = "#0F5A50";
const GOLD = "#E3B23C";
const HAIR = "#A8462A";
const CAP = "#141414";

export const Presenter = memo(function Presenter({ who, className }: { who: "lui" | "lei"; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const lei = who === "lei";

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
        {lei ? (
          <>
            {/* La tunica (kurta): collo alla coreana, abbottonatura e ricami dorati. */}
            <path d="M28 230 Q30 168 62 150 Q100 138 138 150 Q170 168 172 230 Z" fill={KURTA} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
            <path d="M62 150 Q66 190 58 230 M138 150 Q134 190 142 230" stroke={KURTA_DARK} strokeWidth="3" fill="none" opacity="0.7" />
            <path d="M80 143 Q100 152 120 143 L118 150 Q100 159 82 150 Z" fill={GOLD} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
            <rect x="95.5" y="152" width="9" height="46" rx="3" fill={GOLD} stroke={INK} strokeWidth="2.2" />
            {[160, 172, 184].map((y) => (
              <circle key={y} cx="100" cy={y} r="2" fill={KURTA_DARK} />
            ))}
            {/* Il ricamo a puntini lungo lo scollo. */}
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
              const a = 0.15 + (i / 7) * (Math.PI - 0.3);
              return <circle key={i} cx={100 - Math.cos(a) * 30} cy={152 + Math.sin(a) * 9} r="1.7" fill={GOLD} />;
            })}
          </>
        ) : (
          <>
            {/* La felpa col cappuccio dietro il collo e i lacci. */}
            <path d="M28 230 Q30 168 62 150 Q100 136 138 150 Q170 168 172 230 Z" fill={HOODIE} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
            <path d="M66 150 Q70 132 100 130 Q130 132 134 150 Q118 160 100 160 Q82 160 66 150 Z" fill={HOODIE_DARK} stroke={INK} strokeWidth="3.4" strokeLinejoin="round" />
            <path d="M74 150 Q100 166 126 150" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
            <path d="M90 158 Q89 176 92 190 M110 158 Q111 176 108 190" stroke={CREAM} strokeWidth="3" fill="none" strokeLinecap="round" />
            <rect x="89" y="188" width="6" height="8" rx="2" fill={INK} />
            <rect x="105" y="188" width="6" height="8" rx="2" fill={INK} />
            <path d="M54 172 Q56 200 52 230 M146 172 Q144 200 148 230" stroke={HOODIE_DARK} strokeWidth="3" fill="none" opacity="0.8" />
          </>
        )}

        {/* La testa annuisce e si gira verso chi parla. */}
        <g className="studio-head">
          {lei && (
            // Il caschetto ramato dietro la testa (come quello di prima).
            <path d="M44 92 Q40 30 100 26 Q160 30 156 92 Q158 122 146 130 L132 118 L68 118 L54 130 Q42 122 44 92 Z" fill={HAIR} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          )}
          {!lei && (
            // La visiera piatta del cappellino girato: esce da dietro la testa, dritta.
            <g>
              <path d="M112 50 L178 38 Q186 37 186 44 L186 47 Q186 52 179 53 L114 62 Z" fill={CAP} stroke={INK} strokeWidth="3.4" strokeLinejoin="round" />
              <path d="M150 49.5 L182 44.5" stroke="#3E3E3E" strokeWidth="2.4" strokeLinecap="round" />
            </g>
          )}
          <circle cx="100" cy="82" r="50" fill={BALL} />
          <g clipPath={`url(#ball-${uid})`}>
            <path d="M58 58 A62 62 0 0 0 134 132 L160 140 L160 20 Z" fill={`url(#dots-${uid})`} opacity="0.9" />
            <path d="M100 32 V132 M50 82 H150" stroke={INK} strokeWidth="3.2" fill="none" />
            <path d="M66 42 Q88 82 66 122 M134 42 Q112 82 134 122" stroke={INK} strokeWidth="3.2" fill="none" />
          </g>
          <circle cx="100" cy="82" r="50" fill="none" stroke={INK} strokeWidth="4.5" />
          {lei ? (
            // La frangia, come prima, ramata.
            <path d="M52 66 Q62 28 100 28 Q138 28 148 66 Q128 52 112 56 Q100 44 86 56 Q70 50 52 66 Z" fill={HAIR} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          ) : (
            <>
              {/* La calotta del cappellino nero: sei spicchi con le cuciture e il bottone in cima;
                  davanti, girata, l'apertura con la fibbia. */}
              <path d="M50 62 Q49 20 100 18 Q151 20 150 62 Q100 40 50 62 Z" fill={CAP} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
              <path d="M100 19 Q82 26 74 50 M100 19 Q118 26 126 50 M100 19 L100 41" fill="none" stroke="#3A3A3A" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M84 50 Q100 30 116 50 Z" fill={BALL} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
              <path d="M84 45 H116" stroke="#2B2B2B" strokeWidth="3.4" />
              <rect x="96" y="42" width="8" height="6" rx="1.5" fill="#9AA0A8" stroke={INK} strokeWidth="1.4" />
              <circle cx="100" cy="18.5" r="3.2" fill={CAP} stroke={INK} strokeWidth="2" />
              <path d="M60 36 Q76 25 94 23" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
            </>
          )}

          {/* Il viso guarda dove serve: sinistra, destra o in camera. */}
          <g className="studio-face">
            <g className="studio-brows">
              <path d={lei ? "M70 60 Q80 54 90 59" : "M69 61 Q79 55 90 59"} stroke={INK} strokeWidth="3.6" fill="none" strokeLinecap="round" />
              <path d={lei ? "M110 59 Q120 54 130 60" : "M110 59 Q121 55 131 61"} stroke={INK} strokeWidth="3.6" fill="none" strokeLinecap="round" />
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
            {/* Gli occhiali sottili e dorati: solo lei. */}
            {lei && (
              <g fill="none" stroke="#C8901A" strokeWidth="2.6">
                <circle cx="82" cy="79" r="15" />
                <circle cx="118" cy="79" r="15" />
                <path d="M97 78 Q100 75 103 78" />
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
              <circle cx="49" cy="96" r="3.6" fill={GOLD} stroke={INK} strokeWidth="1.6" />
              <circle cx="151" cy="96" r="3.6" fill={GOLD} stroke={INK} strokeWidth="1.6" />
            </>
          )}
        </g>
      </g>
    </svg>
  );
});

/** Le mani sulla scrivania con i fogli degli appunti; una si alza per leggere (--arm). */
export const Notes = memo(function Notes({ who }: { who: "lui" | "lei" }) {
  const sleeve = who === "lei" ? KURTA : HOODIE;
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
});
