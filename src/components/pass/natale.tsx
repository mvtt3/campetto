"use client";

/*
 * Le decorazioni della season di Natale: lucine, pupazzo di neve, neve sui bordi, fiocchi
 * sui regali e il cappello sul tabellone. Tutto disegnato qui (niente immagini da scaricare)
 * e animato solo con trasformazioni e trasparenza, così anche i telefoni lenti restano fluidi.
 * Con un'altra season basta non mostrarle.
 */

import clsx from "clsx";
import type { CSSProperties } from "react";

const INK = "#1d1a16";
const RED = "#e5483b";
const CREAM = "#fffaf0";
const BULBS = ["#ffc531", "#e5483b", "#3fae6a", "#f26a1b", "#fffaf0"];

/**
 * Le lucine appese in alto, a festoni. Il filo è un disegno fermo; le lampadine sono
 * pezzetti di pagina che si accendono e si spengono a turno (solo trasparenza).
 */
export function Lucine({ className, festoni = 3, perFestone = 4 }: { className?: string; festoni?: number; perFestone?: number }) {
  const top = 3;
  const ctrl = 24; // il punto più basso del festone sta a top/2 + ctrl/2 ≈ 13.5
  const wire = Array.from({ length: festoni }, (_, i) => {
    const x0 = (100 / festoni) * i;
    const x1 = (100 / festoni) * (i + 1);
    return `M${x0} ${top}Q${(x0 + x1) / 2} ${ctrl} ${x1} ${top}`;
  }).join("");
  const bulbs: { x: number; y: number }[] = [];
  for (let i = 0; i < festoni; i++) {
    const x0 = (100 / festoni) * i;
    const w = 100 / festoni;
    for (let k = 0; k < perFestone; k++) {
      const t = (k + 0.5) / perFestone;
      bulbs.push({ x: x0 + t * w, y: (1 - t) ** 2 * top + 2 * (1 - t) * t * ctrl + t ** 2 * top });
    }
  }
  return (
    <span className={clsx("pointer-events-none block h-[30px]", className)} aria-hidden>
      <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        <path d={wire} fill="none" stroke="#173a7a" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      </svg>
      {bulbs.map((b, i) => (
        <span
          key={i}
          className="lucina"
          style={
            {
              left: `${b.x}%`,
              top: b.y,
              "--c": BULBS[i % BULBS.length],
              animationDelay: `${(i * 0.37) % 2.2}s`,
              animationDuration: `${1.8 + (i % 3) * 0.5}s`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}

/** Il pupazzo di neve col cappello di Babbo Natale, la sciarpa gialla e un pallone. */
export function Pupazzo({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 72 86" className={clsx("pupazzo", className)} style={style} aria-hidden>
      <defs>
        <radialGradient id="pz-neve" cx="38%" cy="30%" r="75%">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.65" stopColor="#f4f8fd" />
          <stop offset="1" stopColor="#cfdcf0" />
        </radialGradient>
        <radialGradient id="pz-palla" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#ff9a52" />
          <stop offset="1" stopColor="#d9530d" />
        </radialGradient>
      </defs>
      {/* il mucchio di neve su cui sta */}
      <ellipse cx="34" cy="82" rx="31" ry="5.5" fill="#fff" />
      {/* braccia di rametto */}
      <path d="M19 57 7 47M11 50.5 8.5 45M50 56l8-8" fill="none" stroke="#6b4a2b" strokeWidth={2.6} strokeLinecap="round" />
      {/* corpo e testa */}
      <circle cx="34" cy="62" r="18.5" fill="url(#pz-neve)" stroke={INK} strokeWidth={2.4} />
      <circle cx="34" cy="32" r="13.5" fill="url(#pz-neve)" stroke={INK} strokeWidth={2.4} />
      <circle cx="34" cy="56" r="1.9" fill={INK} />
      <circle cx="34" cy="65" r="1.9" fill={INK} />
      {/* faccia */}
      <circle cx="29.5" cy="30" r="1.8" fill={INK} />
      <circle cx="38.5" cy="30" r="1.8" fill={INK} />
      <path d="M34 33.4 45 35.4 34 36.8Z" fill="#f26a1b" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M28.5 39.2q5.5 3.2 11 0" fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" strokeDasharray="0.1 2.6" />
      {/* sciarpa */}
      <path d="M21 42.5q13 6 26 0v4.5q-13 6-26 0Z" fill="#ffc531" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M38.5 47.5 42 60l-5.5.8-1.6-12.2Z" fill="#ffc531" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M37.6 52.5l4-.6M38.4 56.5l4-.6" stroke="#f26a1b" strokeWidth={1.6} />
      {/* cappello di Babbo Natale */}
      <path d="M23 22c2-10 11-15.5 21-14.5 5 .5 8.5 3.5 9.5 7-4-.6-7 .8-7.8 4.5L45 21Z" fill={RED} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <rect x="20.5" y="18.5" width="27" height="6.5" rx="3.25" fill={CREAM} stroke={INK} strokeWidth={2} />
      <circle cx="54" cy="15.5" r="3.8" fill={CREAM} stroke={INK} strokeWidth={1.8} />
      {/* il pallone in mano */}
      <g>
        <circle cx="61" cy="44" r="7" fill="url(#pz-palla)" stroke={INK} strokeWidth={1.8} />
        <path d="M54 44h14M61 37v14M56 39.3q3.6 4.7 0 9.4M66 39.3q-3.6 4.7 0 9.4" fill="none" stroke={INK} strokeWidth={1.1} />
      </g>
    </svg>
  );
}

/** Il fiocco rosso dei regali, per i premi speciali. */
export function Fiocco({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 23" className={className} aria-hidden>
      <path d="M14.6 12.5 10 21.8l3.6-1.4 2 2.1.6-10ZM17.4 12.5l4.6 9.3-3.6-1.4-2 2.1-.6-10Z" fill="#c9372c" stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M16 11.5C10 2.5 1.8 3.2 2.8 9.4 3.8 14.6 11 14.2 16 11.5ZM16 11.5c6-9 14.2-8.3 13.2-2.1-1 5.2-8.2 4.8-13.2 2.1Z" fill={RED} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M6 8.3q3.5-2 7 1.6M26 8.3q-3.5-2-7 1.6" fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth={1.2} strokeLinecap="round" />
      <rect x="13.4" y="8.6" width="5.2" height="5.8" rx="2" fill={RED} stroke={INK} strokeWidth={1.5} />
    </svg>
  );
}

/** Il cappello di Babbo Natale appoggiato sull'angolo del tabellone. */
export function CappelloBabbo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 26" className={className} aria-hidden>
      <path d="M3.5 19.5C5.5 9 13.5 3 21.5 4c4 .5 6.6 3 7.2 6.2-3.6-.5-6.2 1-6.8 4.2L21.6 18Z" fill={RED} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      <rect x="1.2" y="16.6" width="23" height="6.4" rx="3.2" fill={CREAM} stroke={INK} strokeWidth={1.8} />
      <circle cx="28.4" cy="11" r="3.2" fill={CREAM} stroke={INK} strokeWidth={1.6} />
    </svg>
  );
}
