import clsx from "clsx";
import { useId } from "react";

export type MascotPose = "ciao" | "esulta" | "boh";

const INK = "#1D1A16";
const BALL = "#F26A1B";
const BALL_DARK = "#C9500F";
const CREAM = "#FFF8EA";
const RED = "#E5412D";
const YELLOW = "#FFC531";

/** Guanto bianco da cartone animato anni '30 (dita paffute, polsino). */
function Glove({ x, y, r = 0, flip = false }: { x: number; y: number; r?: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${flip ? -1 : 1} 1)`}>
      <path d="M-9 6 Q-13 -4 -8 -12 Q-4 -18 2 -14 Q6 -20 11 -14 Q16 -9 12 -1 Q15 5 10 10 Q2 15 -6 11 Z" fill={CREAM} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M2 -14 Q1 -8 3 -4 M11 -14 Q9 -8 10 -3" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M-8 9 Q-2 14 6 13 L5 19 Q-3 20 -9 15 Z" fill={CREAM} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
    </g>
  );
}

/** Scarpa alta retrò: tomaia rossa, punta e suola chiare, riga gialla. */
function Shoe({ x, y, flip = false }: { x: number; y: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}>
      <path d="M-8 -16 L6 -16 L8 -2 Q24 -2 26 8 L26 12 L-12 12 L-12 -2 Z" fill={RED} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M8 -2 Q24 -2 26 8 L12 8 Q10 2 8 -2 Z" fill={CREAM} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M-13 12 L27 12 L27 17 Q27 19 25 19 L-11 19 Q-13 19 -13 17 Z" fill={CREAM} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M-4 -11 L5 -11 M-3 -6 L6 -6" stroke={CREAM} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M-11 4 L4 4" stroke={YELLOW} strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

/** Occhio "a torta" dei cartoni anni '30: pupilla nera con lo spicchio bianco. */
function Eye({ x, y, look = 0 }: { x: number; y: number; look?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse rx="10.5" ry="14" fill={CREAM} stroke={INK} strokeWidth="3" />
      <g transform={`translate(${look * 2.5} ${look ? -3 : 2})`}>
        <ellipse rx="5.6" ry="8.5" fill={INK} />
        <path d="M0 -1 L5.6 -6 L3 -8.6 Z" fill={CREAM} />
      </g>
    </g>
  );
}

/**
 * Spicchio, la mascotte del Campetto: una palla a spicchi in stile cartone
 * animato anni '30, con guanti bianchi, braccia e gambe "a tubo di gomma" e
 * scarpe alte rosse. Tre pose: ciao, esulta, boh.
 */
export function Mascot({
  pose = "ciao",
  size = 120,
  className,
  animate = true,
  title,
}: {
  pose?: MascotPose;
  size?: number;
  className?: string;
  animate?: boolean;
  title?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const dots = `dots-${uid}`;
  const clip = `ball-${uid}`;
  const jump = pose === "esulta";

  const armL = pose === "esulta" ? "M44 82 Q26 64 22 40" : pose === "boh" ? "M44 92 Q28 98 18 86" : "M44 96 Q30 108 30 124";
  const armR = pose === "esulta" ? "M116 82 Q134 64 138 40" : pose === "boh" ? "M116 92 Q132 98 142 86" : "M116 84 Q136 70 138 46";
  const gloveL = pose === "esulta" ? { x: 22, y: 34, r: -12, flip: true } : pose === "boh" ? { x: 16, y: 80, r: -70, flip: true } : { x: 30, y: 128, r: 180, flip: false };
  const gloveR = pose === "esulta" ? { x: 138, y: 34, r: 12 } : pose === "boh" ? { x: 144, y: 80, r: 70 } : { x: 138, y: 40, r: 14 };

  return (
    <svg
      viewBox="0 0 160 200"
      width={size}
      height={(size * 200) / 160}
      className={clsx("mascot overflow-visible", animate && `mascot-${pose}`, className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <pattern id={dots} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <circle cx="2.5" cy="2.5" r="1.05" fill={BALL_DARK} />
        </pattern>
        <clipPath id={clip}>
          <circle cx="80" cy="82" r="46" />
        </clipPath>
      </defs>

      <ellipse className="mascot-shadow" cx="80" cy="194" rx="40" ry="5.5" fill={INK} opacity="0.16" />

      <g className="mascot-body">
        <path d={jump ? "M66 124 Q58 146 50 158" : "M68 126 Q66 150 60 170"} fill="none" stroke={INK} strokeWidth="5.5" strokeLinecap="round" />
        <path d={jump ? "M94 124 Q102 146 110 158" : "M92 126 Q94 150 100 170"} fill="none" stroke={INK} strokeWidth="5.5" strokeLinecap="round" />
        <Shoe x={jump ? 44 : 56} y={jump ? 168 : 178} flip />
        <Shoe x={jump ? 116 : 104} y={jump ? 168 : 178} />

        <path className="mascot-arm-l" d={armL} fill="none" stroke={INK} strokeWidth="5.5" strokeLinecap="round" />
        <path className={clsx(pose === "ciao" && "mascot-wave")} d={armR} fill="none" stroke={INK} strokeWidth="5.5" strokeLinecap="round" />
        <g className="mascot-arm-l">
          <Glove {...gloveL} />
        </g>
        <g className={clsx(pose === "ciao" && "mascot-wave")}>
          <Glove {...gloveR} />
        </g>

        <circle cx="80" cy="82" r="46" fill={BALL} />
        <g clipPath={`url(#${clip})`}>
          <path d="M40 60 A60 60 0 0 0 112 130 L140 140 L140 20 Z" fill={`url(#${dots})`} opacity="0.9" />
          <path d="M80 34 V130 M34 82 H126" stroke={INK} strokeWidth="3.2" fill="none" />
          <path d="M48 44 Q70 82 48 120 M112 44 Q90 82 112 120" stroke={INK} strokeWidth="3.2" fill="none" />
        </g>
        <circle cx="80" cy="82" r="46" fill="none" stroke={INK} strokeWidth="4.5" />
        <path d="M52 52 Q60 42 72 40" fill="none" stroke={CREAM} strokeWidth="5" strokeLinecap="round" opacity="0.85" />

        <g className="mascot-eyes">
          <Eye x={68} y={74} look={pose === "boh" ? -1 : 0} />
          <Eye x={94} y={74} look={pose === "boh" ? -1 : 0} />
        </g>
        {pose === "boh" ? (
          <>
            <path d="M58 56 Q66 52 74 57" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
            <path d="M88 55 Q96 50 104 54" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
            <path d="M72 106 Q80 101 90 105" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="M62 98 Q81 120 100 98 Q81 104 62 98 Z" fill={INK} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
            <path d="M72 108 Q81 104 90 108 Q85 114 78 113 Q74 112 72 108 Z" fill={RED} />
            <path d="M60 97 Q58 94 60 92 M102 97 Q104 94 102 92" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
          </>
        )}
      </g>

      {pose === "esulta" && (
        <g className="mascot-confetti" stroke={INK} strokeWidth="2">
          <path d="M14 18 L18 6 L22 18 L34 22 L22 26 L18 38 L14 26 L2 22 Z" fill={YELLOW} />
          <path d="M140 10 L143 2 L146 10 L154 13 L146 16 L143 24 L140 16 L132 13 Z" fill={CREAM} />
          <path d="M150 64 L156 58 M150 72 L158 72 M8 64 L2 58 M8 72 L0 72" strokeLinecap="round" strokeWidth="3" />
        </g>
      )}
      {pose === "boh" && (
        <text x="134" y="34" fontFamily="var(--font-ultra), Georgia, serif" fontSize="28" fill={INK}>
          ?
        </text>
      )}
    </svg>
  );
}

/** Il logo: Spicchio dentro un badge rotondo da poster, con la scritta ad arco. */
export function Logo({ size = 56, text = true, className }: { size?: number; text?: boolean; className?: string }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} role="img" aria-label="Campetto">
      <defs>
        <path id={`top-${uid}`} d="M30 100 A70 70 0 0 1 170 100" />
        <path id={`bot-${uid}`} d="M14 100 A86 86 0 0 0 186 100" />
      </defs>
      <circle cx="100" cy="100" r="96" fill={YELLOW} stroke={INK} strokeWidth="6" />
      {!text && <circle cx="100" cy="100" r="96" fill={YELLOW} />}
      {text && (
        <g fontFamily="var(--font-ultra), Georgia, serif" fill={INK} letterSpacing="3">
          <text fontSize="21" textAnchor="middle">
            <textPath href={`#top-${uid}`} startOffset="50%">
              CAMPETTO
            </textPath>
          </text>
          <text fontSize="12" textAnchor="middle">
            <textPath href={`#bot-${uid}`} startOffset="50%">
              ★ NICHELINO ★
            </textPath>
          </text>
        </g>
      )}
      <clipPath id={`in-${uid}`}>
        <circle cx="100" cy="100" r={text ? 62 : 84} />
      </clipPath>
      <circle cx="100" cy="100" r={text ? 62 : 84} fill="#2D5BE3" />
      <g clipPath={`url(#in-${uid})`}>
        <g transform={text ? "translate(30 30) scale(0.87)" : "translate(8 14) scale(1.15)"}>
          <Mascot pose="ciao" size={160} animate={false} />
        </g>
      </g>
      <circle cx="100" cy="100" r={text ? 62 : 84} fill="none" stroke={INK} strokeWidth="5" />
    </svg>
  );
}
