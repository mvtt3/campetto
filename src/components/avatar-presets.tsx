import { useId, type ReactNode } from "react";

/**
 * Sei "figurine" pronte da usare come foto profilo: personaggi a palla nello
 * stile di Spicchio (cartone animato anni '30, poster con raggiera), ognuno con
 * una forma e un accessorio diversi. Disegni originali.
 */

const INK = "#1D1A16";
const CREAM = "#FFF8EA";
const RED = "#E5412D";
const YELLOW = "#FFC531";
const GOLD = "#E8A80C";

export const AVATAR_PRESETS = [
  { id: "collana", name: "Oro", bg: "#2D5BE3" },
  { id: "occhiali", name: "Prof", bg: "#FFC531" },
  { id: "bandana", name: "Bandana", bg: "#2E9E5B" },
  { id: "lungo", name: "Pivot", bg: "#7C4DCC" },
  { id: "coppola", name: "Tappo", bg: "#1597A6" },
  { id: "muscoli", name: "Muscolo", bg: "#E5412D" },
] as const;

export type AvatarPresetId = (typeof AVATAR_PRESETS)[number]["id"];

const PREFIX = "preset:";
export const presetUrl = (id: AvatarPresetId) => `${PREFIX}${id}`;
export function presetOf(url: string | null | undefined): AvatarPresetId | null {
  if (!url?.startsWith(PREFIX)) return null;
  const id = url.slice(PREFIX.length);
  return AVATAR_PRESETS.some((p) => p.id === id) ? (id as AvatarPresetId) : null;
}

interface Head {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  ball: string;
  dark: string;
}

/** Raggiera da poster dietro al personaggio. */
function Sunburst({ bg }: { bg: string }) {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a0 = ((i * 30 - 6) * Math.PI) / 180;
    const a1 = ((i * 30 + 6) * Math.PI) / 180;
    return `M50 56 L${50 + 90 * Math.cos(a0)} ${56 + 90 * Math.sin(a0)} L${50 + 90 * Math.cos(a1)} ${56 + 90 * Math.sin(a1)} Z`;
  }).join(" ");
  return (
    <>
      <rect width="100" height="100" fill={bg} />
      <path d={rays} fill="#FFFFFF" opacity="0.16" />
    </>
  );
}

/** Spalle con la canotta. */
function Jersey({ color, trim, wide = false }: { color: string; trim: string; wide?: boolean }) {
  const d = wide ? "M2 104 Q4 80 26 76 L74 76 Q96 80 98 104 Z" : "M12 104 Q14 84 32 80 L68 80 Q86 84 88 104 Z";
  return (
    <g>
      <path d={d} fill={color} stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
      <path d={wide ? "M38 77 Q50 92 62 77" : "M38 80 Q50 93 62 80"} fill="none" stroke={trim} strokeWidth="3.4" strokeLinecap="round" />
    </g>
  );
}

function Ball({ h, uid }: { h: Head; uid: string }) {
  const { cx, cy, rx, ry } = h;
  const k = 0.7;
  const yk = Math.sqrt(1 - k * k);
  return (
    <g>
      <defs>
        <pattern id={`d${uid}`} width="3.6" height="3.6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <circle cx="1.8" cy="1.8" r="0.75" fill={h.dark} />
        </pattern>
        <clipPath id={`c${uid}`}>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
        </clipPath>
      </defs>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={h.ball} />
      <g clipPath={`url(#c${uid})`}>
        <path
          d={`M${cx - rx * 0.9} ${cy - ry * 0.45} A${rx * 1.3} ${ry * 1.3} 0 0 0 ${cx + rx * 0.7} ${cy + ry * 1.05} L${cx + rx * 1.4} ${cy + ry * 1.2} L${cx + rx * 1.4} ${cy - ry * 1.4} Z`}
          fill={`url(#d${uid})`}
          opacity="0.9"
        />
        <path
          d={`M${cx} ${cy - ry} V${cy + ry} M${cx - rx} ${cy} H${cx + rx} M${cx - rx * k} ${cy - ry * yk} Q${cx - rx * 0.25} ${cy} ${cx - rx * k} ${cy + ry * yk} M${cx + rx * k} ${cy - ry * yk} Q${cx + rx * 0.25} ${cy} ${cx + rx * k} ${cy + ry * yk}`}
          stroke={INK}
          strokeWidth="2"
          fill="none"
          opacity="0.8"
        />
      </g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={INK} strokeWidth="3" />
      <path
        d={`M${cx - rx * 0.62} ${cy - ry * 0.55} Q${cx - rx * 0.4} ${cy - ry * 0.82} ${cx - rx * 0.1} ${cy - ry * 0.86}`}
        fill="none"
        stroke={CREAM}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.85"
      />
    </g>
  );
}

/** Occhio "a torta"; lid = palpebra calata (sguardo tranquillo). */
function Eye({ x, y, s = 1, lid = false, look = 0, ball }: { x: number; y: number; s?: number; lid?: boolean; look?: number; ball?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse rx="5.6" ry="7.4" fill={CREAM} stroke={INK} strokeWidth="2" />
      <g transform={`translate(${look * 1.4} ${lid ? 2.2 : 1})`}>
        <ellipse rx="3" ry="4.5" fill={INK} />
        <path d="M0 -0.6 L3 -3.2 L1.6 -4.6 Z" fill={CREAM} />
      </g>
      {lid && ball && <path d="M-6.6 -1 A6 7.6 0 0 1 6.6 -1 L6.6 -9 L-6.6 -9 Z" fill={ball} stroke={INK} strokeWidth="2" strokeLinejoin="round" />}
      {lid && <path d="M-5.8 -1 L5.8 -1" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />}
    </g>
  );
}

function Grin({ x, y, w = 1 }: { x: number; y: number; w?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${w} 1)`}>
      <path d="M-11 0 Q0 13 11 0 Q0 3.5 -11 0 Z" fill={INK} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M-5.5 5.6 Q0 3.4 5.5 5.6 Q3 8.6 0 8.4 Q-3.6 8.2 -5.5 5.6 Z" fill={RED} />
      <path d="M-12 -0.6 Q-13 -2.4 -11.6 -3.6 M12 -0.6 Q13 -2.4 11.6 -3.6" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
    </g>
  );
}

const Brows = ({ x, y, gap = 8, tilt = 0, w = 6 }: { x: number; y: number; gap?: number; tilt?: number; w?: number }) => (
  <path
    d={`M${x - gap - w / 2} ${y - tilt} L${x - gap + w / 2} ${y + tilt} M${x + gap - w / 2} ${y + tilt} L${x + gap + w / 2} ${y - tilt}`}
    stroke={INK}
    strokeWidth="2.6"
    strokeLinecap="round"
  />
);

function Figure({ id, uid }: { id: AvatarPresetId; uid: string }) {
  switch (id) {
    case "collana": {
      // Il classico: sorrisone e catena d'oro con la stella.
      const h: Head = { cx: 50, cy: 48, rx: 27, ry: 27, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          <Jersey color={CREAM} trim={RED} />
          <Ball h={h} uid={uid} />
          <Eye x={42} y={44} />
          <Eye x={58} y={44} />
          <Grin x={50} y={58} />
          <path d="M33 73 Q50 88 67 73" fill="none" stroke={INK} strokeWidth="5.4" strokeLinecap="round" />
          <path d="M33 73 Q50 88 67 73" fill="none" stroke={GOLD} strokeWidth="2.8" strokeDasharray="2.6 1.4" />
          <path d="M50 79.5 L52.2 84.6 L57.6 85 L53.4 88.4 L54.8 93.6 L50 90.7 L45.2 93.6 L46.6 88.4 L42.4 85 L47.8 84.6 Z" fill={YELLOW} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
        </>
      );
    }
    case "occhiali": {
      // Palla scura, occhiali tondi da professore, mezzo sorriso furbo.
      const h: Head = { cx: 50, cy: 48, rx: 27, ry: 27, ball: "#8C4317", dark: "#5C2A0C" };
      return (
        <>
          <Jersey color="#2D5BE3" trim={CREAM} />
          <Ball h={h} uid={uid} />
          <Eye x={41} y={45} s={0.92} look={1} />
          <Eye x={59} y={45} s={0.92} look={1} />
          <g fill="none" stroke={INK} strokeWidth="3">
            <circle cx="41" cy="45" r="9" fill="#FFFFFF" fillOpacity="0.18" />
            <circle cx="59" cy="45" r="9" fill="#FFFFFF" fillOpacity="0.18" />
            <path d="M48.6 43 Q50 41 51.4 43 M32 43 L24 40 M68 43 L76 40" strokeLinecap="round" />
          </g>
          <path d="M35.5 41 Q37 38 40 37.4 M53.5 41 Q55 38 58 37.4" stroke={CREAM} strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <path d="M42 61 Q51 66 60 59" fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
          <path d="M59 56.6 Q61.6 58 60.4 61" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
        </>
      );
    }
    case "bandana": {
      // Bandana rossa a pois annodata di lato, sguardo deciso.
      const h: Head = { cx: 50, cy: 49, rx: 27, ry: 27, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          <Jersey color={YELLOW} trim={INK} />
          <Ball h={h} uid={uid} />
          <path d="M23.4 40 Q24 20 50 21.6 Q76 20 76.6 40 Q50 31 23.4 40 Z" fill={RED} stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
          <g fill={CREAM}>
            <circle cx="36" cy="30" r="1.7" />
            <circle cx="47" cy="26" r="1.7" />
            <circle cx="58" cy="27" r="1.7" />
            <circle cx="68" cy="32" r="1.7" />
            <circle cx="52" cy="33" r="1.4" />
            <circle cx="41" cy="35" r="1.4" />
          </g>
          <path d="M74 36 Q84 30 88 36 Q84 40 78 39 Z M75 39 Q83 44 84 52 Q78 49 73 42 Z" fill={RED} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <circle cx="75.4" cy="37.6" r="3" fill={RED} stroke={INK} strokeWidth="2.2" />
          <Eye x={42} y={48} />
          <Eye x={58} y={48} />
          <Brows x={50} y={39.4} tilt={1.8} />
          <path d="M40 61 Q50 69 60 61 Z" fill={CREAM} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M45 61.6 V64.4 M50 62 V66 M55 61.6 V64.4" stroke={INK} strokeWidth="1.4" />
        </>
      );
    }
    case "lungo": {
      // Il più alto: palla allungata, fascia sulla fronte, sguardo tranquillo.
      const h: Head = { cx: 50, cy: 45, rx: 22, ry: 31, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          <Jersey color={CREAM} trim="#7C4DCC" />
          <Ball h={h} uid={uid} />
          <path d="M28.6 31 Q50 24 71.4 31 L72 38.6 Q50 31.6 28 38.6 Z" fill={CREAM} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
          <path d="M28.4 35 Q50 28 71.6 35" fill="none" stroke={RED} strokeWidth="2.2" />
          <Eye x={43} y={47} lid ball={h.ball} />
          <Eye x={57} y={47} lid ball={h.ball} />
          <path d="M44 62 Q51 66 58 61" fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
        </>
      );
    }
    case "coppola": {
      // Il più basso: palla schiacciata, coppola anni '30, lentiggini e risata.
      const h: Head = { cx: 50, cy: 56, rx: 31, ry: 23, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          <Jersey color={RED} trim={CREAM} wide />
          <Ball h={h} uid={uid} />
          <path d="M22.6 47 Q22 28 50 27 Q78 28 77.4 47 Q50 40 22.6 47 Z" fill="#8A6A4A" stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
          <path d="M30 38 Q50 30 70 38 M36 31 Q50 28 64 31" fill="none" stroke={INK} strokeWidth="1.5" opacity="0.55" />
          <path d="M20 47 Q50 37 80 47 Q84 50 79 52 Q50 45 21 52 Q16 50 20 47 Z" fill="#6E5236" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
          <circle cx="50" cy="27.6" r="2.4" fill="#6E5236" stroke={INK} strokeWidth="1.8" />
          <Eye x={42} y={55} s={0.88} />
          <Eye x={58} y={55} s={0.88} />
          <g fill={h.dark}>
            <circle cx="31" cy="62" r="1.2" />
            <circle cx="34.5" cy="64.6" r="1.2" />
            <circle cx="30" cy="66" r="1.1" />
            <circle cx="69" cy="62" r="1.2" />
            <circle cx="65.5" cy="64.6" r="1.2" />
            <circle cx="70" cy="66" r="1.1" />
          </g>
          <Grin x={50} y={65} w={0.92} />
        </>
      );
    }
    case "muscoli": {
      // Il più muscoloso: spalle larghe, canotta, baffi a manubrio.
      const h: Head = { cx: 50, cy: 44, rx: 25, ry: 25, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          <path d="M-2 104 Q-2 78 18 72 Q30 68 38 72 L62 72 Q70 68 82 72 Q102 78 102 104 Z" fill={h.ball} stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
          <path d="M12 86 Q18 76 28 78 M88 86 Q82 76 72 78" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M28 104 L30 76 L38 74 Q50 88 62 74 L70 76 L72 104 Z" fill={CREAM} stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
          <path d="M37 76 Q50 90 63 76" fill="none" stroke={RED} strokeWidth="3" />
          <Ball h={h} uid={uid} />
          <Eye x={42} y={41} s={0.9} />
          <Eye x={58} y={41} s={0.9} />
          <Brows x={50} y={32.6} tilt={2} w={7} />
          <path d="M50 53 Q42 50 36 54 Q31 57 32 52 Q30 56 35 58 Q43 59 50 55 Q57 59 65 58 Q70 56 68 52 Q69 57 64 54 Q58 50 50 53 Z" fill={INK} />
          <path d="M44 61.6 Q50 63.6 56 61.6" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
        </>
      );
    }
  }
}

export function PresetAvatar({ id, title }: { id: AvatarPresetId; title?: string }): ReactNode {
  const uid = useId().replace(/:/g, "");
  const p = AVATAR_PRESETS.find((x) => x.id === id)!;
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <Sunburst bg={p.bg} />
      <g transform="translate(50 58) scale(1.16) translate(-50 -58)">
        <Figure id={id} uid={uid} />
      </g>
    </svg>
  );
}
