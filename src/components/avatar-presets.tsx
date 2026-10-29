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

export type Rarity = "base" | "rara" | "epica" | "leggendaria";

/**
 * Le figurine. Le prime sei sono di tutti; le altre si sbloccano con i badge
 * (personaggi originali ispirati ai ruoli del basket, nessun giocatore vero).
 */
export const AVATAR_PRESETS = [
  { id: "collana", name: "Jack", bg: "#2D5BE3", rarity: "base" },
  { id: "occhiali", name: "Kenji", bg: "#FFC531", rarity: "base" },
  { id: "bandana", name: "Fernando", bg: "#2E9E5B", rarity: "base" },
  { id: "lungo", name: "Lukas", bg: "#7C4DCC", rarity: "base" },
  { id: "coppola", name: "Giacomo", bg: "#1597A6", rarity: "base" },
  { id: "muscoli", name: "Kofi", bg: "#E5412D", rarity: "base" },
  { id: "cecchino", name: "Cecchino", bg: "#1597A6", rarity: "rara" },
  { id: "regista", name: "Regista", bg: "#2E9E5B", rarity: "rara" },
  { id: "muro", name: "Muro", bg: "#E5412D", rarity: "rara" },
  { id: "lampo", name: "Lampo", bg: "#2D5BE3", rarity: "rara" },
  { id: "rimbalzo", name: "Ventosa", bg: "#FFC531", rarity: "rara" },
  { id: "jolly", name: "Jolly", bg: "#7C4DCC", rarity: "rara" },
  { id: "volo", name: "Volo", bg: "#2D5BE3", rarity: "epica" },
  { id: "gigante", name: "Gigante", bg: "#7C4DCC", rarity: "epica" },
  { id: "mago", name: "Mago", bg: "#1D1A16", rarity: "epica" },
  { id: "fuoco", name: "Fuoco", bg: "#E5412D", rarity: "epica" },
  { id: "ghiaccio", name: "Ghiaccio", bg: "#1597A6", rarity: "epica" },
  { id: "uragano", name: "Uragano", bg: "#2E9E5B", rarity: "epica" },
  { id: "re", name: "Il Re", bg: "#E5412D", rarity: "leggendaria" },
  { id: "leggenda", name: "Leggenda", bg: "#1D1A16", rarity: "leggendaria" },
] as const;

/** La divisa di ogni personaggio a figura intera (stessi colori della figurina). */
export const KIT: Record<AvatarPresetId, { jersey: string; trim: string; legs?: number; arms?: "big"; head?: string }> = {
  collana: { jersey: CREAM, trim: RED },
  occhiali: { jersey: "#2D5BE3", trim: CREAM, head: "#8C4317" },
  bandana: { jersey: YELLOW, trim: INK },
  lungo: { jersey: CREAM, trim: "#7C4DCC", legs: 8 },
  coppola: { jersey: RED, trim: CREAM, legs: -6 },
  muscoli: { jersey: CREAM, trim: RED, arms: "big" },
  cecchino: { jersey: CREAM, trim: "#1597A6" },
  regista: { jersey: "#2D5BE3", trim: CREAM },
  muro: { jersey: YELLOW, trim: INK, arms: "big" },
  volo: { jersey: CREAM, trim: RED, legs: 4 },
  gigante: { jersey: CREAM, trim: "#7C4DCC", legs: 12 },
  mago: { jersey: "#7C4DCC", trim: YELLOW },
  lampo: { jersey: "#1597A6", trim: YELLOW, legs: 4 },
  rimbalzo: { jersey: "#2E9E5B", trim: CREAM, arms: "big" },
  jolly: { jersey: YELLOW, trim: "#7C4DCC" },
  fuoco: { jersey: RED, trim: YELLOW },
  ghiaccio: { jersey: "#1D3B66", trim: "#9FD3F5", head: "#9FD3F5" },
  uragano: { jersey: "#2E9E5B", trim: YELLOW },
  re: { jersey: "#B3261E", trim: YELLOW },
  leggenda: { jersey: "#F2B705", trim: INK, head: "#F2B705" },
};

/** Una frase breve per ogni personaggio, mostrata solo nel proprio profilo. */
export const CHARACTER_TAGLINE: Record<AvatarPresetId, string> = {
  collana: "Sempre col sorriso",
  occhiali: "Studia ogni difesa",
  bandana: "Grinta da vendere",
  lungo: "Arriva dove gli altri no",
  coppola: "Piccolo ma velenoso",
  muscoli: "Nessuno lo sposta",
  cecchino: "Da tre non sbaglia",
  regista: "Vede passaggi invisibili",
  muro: "Qui non si passa",
  volo: "Gioca sopra il ferro",
  gigante: "Tocca il cielo",
  mago: "Passaggi di magia",
  lampo: "Il più veloce in contropiede",
  rimbalzo: "Ogni pallone è suo",
  jolly: "Fa un po' di tutto",
  fuoco: "Quando si accende non lo ferma nessuno",
  ghiaccio: "Sangue freddo nei finali",
  uragano: "Vince e rivince",
  re: "Il re del campetto",
  leggenda: "Quasi impossibile da avere",
};

/**
 * Cosa serve per sbloccare ogni personaggio speciale: un badge al livello indicato
 * (1 bronzo, 2 argento, 3 oro), oppure per la Leggenda tutti i badge d'oro.
 */
export const GOALS: Partial<Record<AvatarPresetId, { badge: string; tier: number } | { allTier: number }>> = {
  cecchino: { badge: "triple", tier: 1 },
  regista: { badge: "assist", tier: 1 },
  muro: { badge: "stoppate", tier: 1 },
  lampo: { badge: "rubate", tier: 1 },
  rimbalzo: { badge: "rimbalzi", tier: 1 },
  jolly: { badge: "tuttofare", tier: 1 },
  volo: { badge: "partita-punti", tier: 2 },
  gigante: { badge: "partita-rimbalzi", tier: 2 },
  mago: { badge: "partita-assist", tier: 2 },
  fuoco: { badge: "serie", tier: 2 },
  ghiaccio: { badge: "fotofinish", tier: 2 },
  uragano: { badge: "vittorie", tier: 2 },
  re: { badge: "mvp-mese", tier: 3 },
  leggenda: { allTier: 3 },
};

/** Come si sbloccano: quanti badge servono e di che livello (1 bronzo, 2 argento, 3 oro, 4 Hall of Fame). */
export const RARITY: Record<Rarity, { label: string; one: string; minTier: number; count: number; rule: string; ring: string }> = {
  base: { label: "Di tutti", one: "Di tutti", minTier: 0, count: 0, rule: "", ring: "#1D1A16" },
  rara: { label: "Rari", one: "Raro", minTier: 1, count: 3, rule: "3 badge qualsiasi", ring: "#C9D3E0" },
  epica: { label: "Epici", one: "Epico", minTier: 2, count: 3, rule: "3 badge d'argento", ring: "#B48CFF" },
  leggendaria: { label: "Leggendari", one: "Leggendario", minTier: 3, count: 3, rule: "3 badge d'oro", ring: "#FFC531" },
};

/** Quanti badge hai al livello richiesto, e se la rarità è sbloccata. */
export function rarityProgress(rarity: Rarity, badgeTiers: number[]): { have: number; need: number; unlocked: boolean } {
  const r = RARITY[rarity];
  const have = r.count ? badgeTiers.filter((t) => t >= r.minTier).length : 0;
  return { have: Math.min(have, r.count), need: r.count, unlocked: have >= r.count };
}

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
function Sunburst({ bg, rarity = "base" }: { bg: string; rarity?: Rarity }) {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a0 = ((i * 30 - 6) * Math.PI) / 180;
    const a1 = ((i * 30 + 6) * Math.PI) / 180;
    return `M50 56 L${50 + 90 * Math.cos(a0)} ${56 + 90 * Math.sin(a0)} L${50 + 90 * Math.cos(a1)} ${56 + 90 * Math.sin(a1)} Z`;
  }).join(" ");
  return (
    <>
      <rect width="100" height="100" fill={bg} />
      <path d={rays} fill={rarity === "leggendaria" ? YELLOW : "#FFFFFF"} opacity={rarity === "leggendaria" ? 0.45 : rarity === "epica" ? 0.22 : 0.16} />
      {rarity !== "base" && (
        <g fill={rarity === "leggendaria" ? YELLOW : CREAM} stroke={INK} strokeWidth="1.2" strokeLinejoin="round">
          <path d="M14 18 L15.6 22 L20 22.4 L16.6 25.2 L17.8 29.4 L14 27 L10.2 29.4 L11.4 25.2 L8 22.4 L12.4 22 Z" />
          {rarity !== "rara" && <path d="M86 14 L87.2 17 L90.4 17.3 L88 19.4 L88.8 22.6 L86 20.8 L83.2 22.6 L84 19.4 L81.6 17.3 L84.8 17 Z" />}
        </g>
      )}
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

export function Figure({ id, uid, bust = true }: { id: AvatarPresetId; uid: string; bust?: boolean }) {
  // bust=false: solo testa e accessori, per il personaggio a figura intera.
  const P = bust;
  switch (id) {
    case "collana": {
      // Il classico: sorrisone e catena d'oro con la stella.
      const h: Head = { cx: 50, cy: 48, rx: 27, ry: 27, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && <Jersey color={CREAM} trim={RED} />}
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
          {P && <Jersey color="#2D5BE3" trim={CREAM} />}
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
          {P && <Jersey color={YELLOW} trim={INK} />}
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
          {P && <Jersey color={CREAM} trim="#7C4DCC" />}
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
          {P && <Jersey color={RED} trim={CREAM} wide />}
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
          {P && (
            <>
              <path d="M-2 104 Q-2 78 18 72 Q30 68 38 72 L62 72 Q70 68 82 72 Q102 78 102 104 Z" fill={h.ball} stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
              <path d="M12 86 Q18 76 28 78 M88 86 Q82 76 72 78" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
              <path d="M28 104 L30 76 L38 74 Q50 88 62 74 L70 76 L72 104 Z" fill={CREAM} stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
              <path d="M37 76 Q50 90 63 76" fill="none" stroke={RED} strokeWidth="3" />
            </>
          )}
          <Ball h={h} uid={uid} />
          <Eye x={42} y={41} s={0.9} />
          <Eye x={58} y={41} s={0.9} />
          <Brows x={50} y={32.6} tilt={2} w={7} />
          <path d="M50 53 Q42 50 36 54 Q31 57 32 52 Q30 56 35 58 Q43 59 50 55 Q57 59 65 58 Q70 56 68 52 Q69 57 64 54 Q58 50 50 53 Z" fill={INK} />
          <path d="M44 61.6 Q50 63.6 56 61.6" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
        </>
      );
    }
    case "cecchino": {
      // Il tiratore: fascia, occhio che prende la mira, la retina sullo sfondo.
      const h: Head = { cx: 50, cy: 48, rx: 26, ry: 26, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && (
            <g fill="none" stroke={CREAM} strokeWidth="1.6" opacity="0.55">
              <circle cx="82" cy="30" r="9" />
              <path d="M73 30 L91 30 M82 21 L82 39" />
            </g>
          )}
          {P && <Jersey color={CREAM} trim="#1597A6" />}
          {P && (
            <text x="50" y="94" textAnchor="middle" fontFamily="var(--font-ultra), Georgia, serif" fontSize="10" fill="#1597A6">
              3
            </text>
          )}
          <Ball h={h} uid={uid} />
          <path d="M24.6 37 Q50 26 75.4 37 L76 43 Q50 33 24 43 Z" fill={YELLOW} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <Eye x={42} y={49} lid ball={h.ball} />
          <Eye x={58} y={48} />
          <path d="M43 62 Q51 65 59 60" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
        </>
      );
    }
    case "regista": {
      // Il playmaker: cappellino con visiera e fischietto al collo.
      const h: Head = { cx: 50, cy: 50, rx: 26, ry: 26, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && <Jersey color="#2D5BE3" trim={CREAM} />}
          <path d="M38 79 Q46 86 52 84" fill="none" stroke={INK} strokeWidth="1.8" />
          <rect x="50" y="81" width="9" height="6" rx="2" fill="#C9D3E0" stroke={INK} strokeWidth="1.8" />
          <Ball h={h} uid={uid} />
          <path d="M25.5 42 Q26 24 50 23.5 Q74 24 74.5 42 Q50 35 25.5 42 Z" fill={CREAM} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
          <path d="M50 23.5 V38" stroke={INK} strokeWidth="1.4" opacity="0.6" />
          <path d="M22 43 Q36 34 56 38 Q46 46 22 46 Z" fill="#2D5BE3" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <Eye x={43} y={52} s={0.92} look={-1} />
          <Eye x={59} y={52} s={0.92} look={-1} />
          <Grin x={51} y={63} w={0.85} />
        </>
      );
    }
    case "muro": {
      // Il difensore: muro di mattoni dietro, guanto alzato, faccia seria.
      const h: Head = { cx: 50, cy: 50, rx: 26, ry: 26, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && (
            <g stroke={INK} strokeWidth="1.2" opacity="0.35" fill="none">
              {[18, 30, 42, 54, 66].map((y, i) => (
                <path key={y} d={`M-5 ${y} H105 ${Array.from({ length: 6 }, (_, k) => `M${k * 20 + (i % 2 ? 10 : 0)} ${y} V${y + 12}`).join(" ")}`} />
              ))}
            </g>
          )}
          {P && <Jersey color={YELLOW} trim={INK} wide />}
          <Ball h={h} uid={uid} />
          {P && (
            <g transform="translate(83 46) rotate(12)">
              <path d="M-8 8 Q-11 -3 -7 -12 Q-3 -17 1 -13 Q4 -19 8 -14 Q12 -10 10 -2 Q12 4 8 9 Q1 13 -5 11 Z" fill={CREAM} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
              <path d="M1 -13 Q0 -8 2 -4 M8 -14 Q6 -8 7 -3" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
            </g>
          )}
          <Eye x={42} y={49} s={0.9} />
          <Eye x={58} y={49} s={0.9} />
          <Brows x={50} y={40} tilt={-2.2} w={7} />
          <path d="M42 62 H58" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        </>
      );
    }
    case "volo": {
      // Lo schiacciatore: ali ai lati, sorriso a tutta faccia.
      const h: Head = { cx: 50, cy: 50, rx: 25, ry: 25, ball: "#F26A1B", dark: "#C9500F" };
      const wing = "M0 0 Q-10 -14 -24 -12 Q-18 -8 -22 -4 Q-14 -3 -18 2 Q-10 2 -12 7 Q-4 5 0 4 Z";
      return (
        <>
          {P && <Jersey color={CREAM} trim={RED} />}
          <g fill={CREAM} stroke={INK} strokeWidth="2.2" strokeLinejoin="round">
            <path d={wing} transform="translate(27 48)" />
            <path d={wing} transform="translate(73 48) scale(-1 1)" />
          </g>
          <Ball h={h} uid={uid} />
          <Eye x={42} y={47} />
          <Eye x={58} y={47} />
          <Grin x={50} y={59} w={1.05} />
        </>
      );
    }
    case "gigante": {
      // Il più alto di tutti: testa lunghissima che esce dal cartellino, fascia al polso.
      const h: Head = { cx: 50, cy: 40, rx: 21, ry: 36, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && <Jersey color={CREAM} trim="#7C4DCC" />}
          <Ball h={h} uid={uid} />
          <Eye x={43} y={44} lid ball={h.ball} />
          <Eye x={57} y={44} lid ball={h.ball} />
          <path d="M45 60 Q50 63 56 59" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M33 16 L36 11 M67 16 L64 11 M50 8 V2" stroke={CREAM} strokeWidth="2.4" strokeLinecap="round" />
        </>
      );
    }
    case "mago": {
      // Il passatore magico: cappello a punta con le stelle e scintille.
      const h: Head = { cx: 50, cy: 54, rx: 25, ry: 25, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && <Jersey color="#7C4DCC" trim={YELLOW} />}
          <Ball h={h} uid={uid} />
          <path d="M26 41 Q50 33 74 41 L56 8 Q53 3 50 6 Z" fill="#2D5BE3" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
          <path d="M20 42 Q50 31 80 42 Q82 46 78 47 Q50 38 22 47 Q18 46 20 42 Z" fill="#2D5BE3" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <g fill={YELLOW}>
            <path d="M49 20 L50.6 23.4 L54 24 L51.4 26.2 L52.2 29.6 L49 27.8 L45.8 29.6 L46.6 26.2 L44 24 L47.4 23.4 Z" />
            <circle cx="60" cy="33" r="1.6" />
            <circle cx="40" cy="35" r="1.3" />
          </g>
          <Eye x={42} y={55} s={0.9} look={1} />
          <Eye x={58} y={55} s={0.9} look={1} />
          <path d="M42 66 Q50 72 58 66" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M84 60 L86 56 L88 60 L92 62 L88 64 L86 68 L84 64 L80 62 Z" fill={YELLOW} stroke={INK} strokeWidth="1.2" />
        </>
      );
    }
    case "lampo": {
      // Il più veloce: fascia con il fulmine e scie di velocità dietro.
      const h: Head = { cx: 50, cy: 49, rx: 26, ry: 26, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && (
            <g stroke={CREAM} strokeWidth="2.2" strokeLinecap="round" opacity="0.6">
              <path d="M4 40 H18 M2 50 H16 M6 60 H19" />
            </g>
          )}
          {P && <Jersey color="#1597A6" trim={YELLOW} />}
          <Ball h={h} uid={uid} />
          <path d="M24.4 38 Q50 27 75.6 38 L76 44.6 Q50 34 24 44.6 Z" fill="#1D3B66" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M52 30.5 L46 38.6 L50.4 38.6 L47 44 L55 35.6 L50.8 35.6 L53.6 30.5 Z" fill={YELLOW} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
          <Eye x={42} y={50} look={1} />
          <Eye x={58} y={50} look={1} />
          <Grin x={51} y={62} w={0.9} />
        </>
      );
    }
    case "rimbalzo": {
      // Il rimbalzista: occhialoni da gioco con l'elastico e il paradenti.
      const h: Head = { cx: 50, cy: 49, rx: 26, ry: 26, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && <Jersey color="#2E9E5B" trim={CREAM} wide />}
          <Ball h={h} uid={uid} />
          <path d="M24.2 46 Q50 41 75.8 46" fill="none" stroke={INK} strokeWidth="3.4" />
          <Eye x={42} y={47} s={0.9} />
          <Eye x={58} y={47} s={0.9} />
          <g fill="#FFFFFF" fillOpacity="0.22" stroke={INK} strokeWidth="2.6">
            <rect x="32" y="38.5" width="17" height="15" rx="6" />
            <rect x="51" y="38.5" width="17" height="15" rx="6" />
          </g>
          <path d="M49 45 H51" stroke={INK} strokeWidth="2.4" />
          <path d="M35 42 Q37 40 40 40" stroke={CREAM} strokeWidth="1.6" strokeLinecap="round" fill="none" />
          <path d="M40 60 Q50 68 60 60 Z" fill="#7FD1A4" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M44 61.6 V64 M50 62 V65.6 M56 61.6 V64" stroke={INK} strokeWidth="1.2" opacity="0.6" />
        </>
      );
    }
    case "jolly": {
      // Il tuttofare: cappellino al contrario, occhiolino e lingua fuori.
      const h: Head = { cx: 50, cy: 50, rx: 26, ry: 26, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && <Jersey color={YELLOW} trim="#7C4DCC" />}
          <Ball h={h} uid={uid} />
          <path d="M26 41 Q27 24 50 23.6 Q73 24 74 41 Q50 34 26 41 Z" fill="#7C4DCC" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
          <path d="M28 41.5 Q20 41 14.6 44.6 Q20 47.4 30 45 Z" fill="#7C4DCC" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <circle cx="50" cy="24.2" r="2.2" fill={YELLOW} stroke={INK} strokeWidth="1.4" />
          <Eye x={42} y={50} />
          <path d="M53 50 Q58 46.4 63 50" fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
          <path d="M41 61 Q51 70 61 61 Q51 64 41 61 Z" fill={INK} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M51 64.4 Q55 64 56 68 Q53.6 71 51 69 Z" fill={RED} stroke={INK} strokeWidth="1.4" />
        </>
      );
    }
    case "fuoco": {
      // In fiamme: capelli di fuoco e sguardo deciso.
      const h: Head = { cx: 50, cy: 52, rx: 25, ry: 25, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && <Jersey color={RED} trim={YELLOW} />}
          <path d="M28 40 Q22 24 32 14 Q32 24 38 26 Q36 12 47 4 Q46 18 53 20 Q56 8 66 6 Q62 18 68 24 Q76 20 76 12 Q82 26 72 40 Z" fill={RED} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M34 38 Q32 28 38 22 Q40 30 44 31 Q44 22 50 16 Q51 26 56 28 Q60 20 64 18 Q63 28 66 32 Q66 38 62 40 Z" fill={YELLOW} />
          <Ball h={h} uid={uid} />
          <Eye x={42} y={52} s={0.92} />
          <Eye x={58} y={52} s={0.92} />
          <Brows x={50} y={43} tilt={2.4} w={7} />
          <Grin x={50} y={64} w={0.9} />
        </>
      );
    }
    case "ghiaccio": {
      // Sangue freddo: palla color ghiaccio, occhiali scuri e un cristallo di neve.
      const h: Head = { cx: 50, cy: 49, rx: 26, ry: 26, ball: "#9FD3F5", dark: "#5E9CC9" };
      return (
        <>
          {P && <Jersey color="#1D3B66" trim="#9FD3F5" />}
          <Ball h={h} uid={uid} />
          <path d="M30 44 Q40 41 49 44 L48 51 Q40 55 32 51 Z M51 44 Q60 41 70 44 L68 51 Q60 55 52 51 Z" fill={INK} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M49 45 H51 M30 45 L24 42 M70 45 L76 42" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M34 46 L38 45 M54 46 L58 45" stroke={CREAM} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M42 63 Q51 66 60 61" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
          <g stroke={CREAM} strokeWidth="1.8" strokeLinecap="round">
            <path d="M82 22 V36 M75.6 25.5 L88.4 32.5 M75.6 32.5 L88.4 25.5" />
          </g>
        </>
      );
    }
    case "uragano": {
      // Vince e rivince: ciuffo a vortice e folate di vento.
      const h: Head = { cx: 50, cy: 51, rx: 25, ry: 25, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && (
            <g fill="none" stroke={CREAM} strokeWidth="2" strokeLinecap="round" opacity="0.6">
              <path d="M6 34 Q14 30 18 36 M4 64 Q12 60 16 66 M84 62 Q92 58 96 64" />
            </g>
          )}
          {P && <Jersey color="#2E9E5B" trim={YELLOW} />}
          <Ball h={h} uid={uid} />
          <path d="M34 30 Q40 16 54 14 Q70 14 70 26 Q70 34 60 34 Q52 34 52 27 Q52 22 58 22 Q62 23 62 26" fill="none" stroke={INK} strokeWidth="4.6" strokeLinecap="round" />
          <path d="M34 30 Q40 16 54 14 Q70 14 70 26 Q70 34 60 34 Q52 34 52 27 Q52 22 58 22 Q62 23 62 26" fill="none" stroke="#2E9E5B" strokeWidth="2" strokeLinecap="round" />
          <Eye x={42} y={51} s={0.92} look={-1} />
          <Eye x={58} y={51} s={0.92} look={-1} />
          <path d="M42 62 Q50 70 58 62" fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
        </>
      );
    }
    case "re": {
      // Il Re del campetto: corona d'oro e mantello rosso con l'ermellino.
      const h: Head = { cx: 50, cy: 52, rx: 25, ry: 25, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && <path d="M8 104 Q10 80 30 76 L70 76 Q90 80 92 104 Z" fill="#B3261E" stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />}
          <path d="M26 78 Q50 90 74 78 L72 84 Q50 96 28 84 Z" fill={CREAM} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <g fill={INK}>
            <circle cx="38" cy="85" r="1.1" />
            <circle cx="50" cy="89" r="1.1" />
            <circle cx="62" cy="85" r="1.1" />
          </g>
          <Ball h={h} uid={uid} />
          <path d="M30 34 L34 16 L42 27 L50 12 L58 27 L66 16 L70 34 Q50 28 30 34 Z" fill={YELLOW} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
          <g fill={RED} stroke={INK} strokeWidth="1.2">
            <circle cx="50" cy="26" r="2.4" />
            <circle cx="38.5" cy="29" r="1.8" />
            <circle cx="61.5" cy="29" r="1.8" />
          </g>
          <Eye x={42} y={51} s={0.92} lid ball={h.ball} />
          <Eye x={58} y={51} s={0.92} lid ball={h.ball} />
          <path d="M42 63 Q51 69 60 62" fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
        </>
      );
    }
    case "leggenda": {
      // La Leggenda: palla d'oro, corona d'alloro e stelle tutto intorno.
      const h: Head = { cx: 50, cy: 50, rx: 26, ry: 26, ball: "#F2B705", dark: "#B98500" };
      const leaf = (x: number, y: number, rot: number, k: number) => (
        <ellipse key={k} cx={x} cy={y} rx="4.2" ry="2.1" transform={`rotate(${rot} ${x} ${y})`} fill="#2E9E5B" stroke={INK} strokeWidth="1.3" />
      );
      return (
        <>
          {P && <Jersey color={CREAM} trim={YELLOW} />}
          <Ball h={h} uid={uid} />
          <g>
            {[0, 1, 2, 3, 4].map((i) => leaf(30 + i * 3.4, 38 - i * 4.6, -50 + i * 12, i))}
            {[0, 1, 2, 3, 4].map((i) => leaf(70 - i * 3.4, 38 - i * 4.6, 50 - i * 12, 10 + i))}
          </g>
          <Eye x={42} y={48} />
          <Eye x={58} y={48} />
          <Grin x={50} y={60} />
          <g fill={YELLOW} stroke={INK} strokeWidth="1.2">
            <path d="M84 52 L85.6 56 L90 56.4 L86.6 59.2 L87.8 63.4 L84 61 L80.2 63.4 L81.4 59.2 L78 56.4 L82.4 56 Z" />
            <path d="M16 56 L17.2 59 L20.4 59.3 L18 61.4 L18.8 64.6 L16 62.8 L13.2 64.6 L14 61.4 L11.6 59.3 L14.8 59 Z" />
          </g>
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
      <Sunburst bg={p.bg} rarity={p.rarity} />
      <g transform="translate(50 58) scale(1.16) translate(-50 -58)">
        <Figure id={id} uid={uid} />
      </g>
    </svg>
  );
}
