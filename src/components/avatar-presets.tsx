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

export type Rarity = "base" | "rara" | "epica" | "mitica" | "leggendaria";

const NAVY = "#1D3B66";
const TEAL = "#1597A6";
const BLUE = "#2D5BE3";
const GREEN = "#2E9E5B";
const PURPLE = "#7C4DCC";
const BROWN = "#8A5A2B";
const PINK = "#E2557A";
const STONE = "#9C9488";
const SILVER = "#C9D3E0";

/**
 * I personaggi. I primi sei sono di tutti; gli altri si sbloccano con i badge,
 * a livelli come nei giochi di carte: rari, epici, mitici e leggendari.
 * Tutti originali, ispirati ai ruoli del basket: nessun giocatore vero.
 */
export const AVATAR_PRESETS = [
  { id: "collana", name: "Jack", bg: BLUE, rarity: "base" },
  { id: "occhiali", name: "Kenji", bg: "#FFC531", rarity: "base" },
  { id: "bandana", name: "Fernando", bg: GREEN, rarity: "base" },
  { id: "lungo", name: "Lukas", bg: PURPLE, rarity: "base" },
  { id: "coppola", name: "Giacomo", bg: TEAL, rarity: "base" },
  { id: "muscoli", name: "Kofi", bg: "#E5412D", rarity: "base" },
  // Rari: un badge di bronzo o d'argento, uno per ogni statistica.
  { id: "cecchino", name: "Cecchino", bg: TEAL, rarity: "rara" },
  { id: "regista", name: "Regista", bg: GREEN, rarity: "rara" },
  { id: "muro", name: "Muro", bg: "#E5412D", rarity: "rara" },
  { id: "lampo", name: "Lampo", bg: BLUE, rarity: "rara" },
  { id: "rimbalzo", name: "Ventosa", bg: "#FFC531", rarity: "rara" },
  { id: "jolly", name: "Jolly", bg: PURPLE, rarity: "rara" },
  { id: "bomber", name: "Bomber", bg: "#E5412D", rarity: "rara" },
  { id: "postino", name: "Postino", bg: BLUE, rarity: "rara" },
  { id: "gentiluomo", name: "Gentiluomo", bg: PURPLE, rarity: "rara" },
  { id: "marinaio", name: "Marinaio", bg: TEAL, rarity: "rara" },
  { id: "sceriffo", name: "Sceriffo", bg: "#FFC531", rarity: "rara" },
  { id: "ladro", name: "Ladro", bg: GREEN, rarity: "rara" },
  // Epici: un badge d'oro, oppure due d'argento insieme.
  { id: "volo", name: "Volo", bg: BLUE, rarity: "epica" },
  { id: "gigante", name: "Gigante", bg: PURPLE, rarity: "epica" },
  { id: "mago", name: "Mago", bg: "#1D1A16", rarity: "epica" },
  { id: "fuoco", name: "Fuoco", bg: "#E5412D", rarity: "epica" },
  { id: "ghiaccio", name: "Ghiaccio", bg: TEAL, rarity: "epica" },
  { id: "uragano", name: "Uragano", bg: GREEN, rarity: "epica" },
  { id: "castello", name: "Castello", bg: PURPLE, rarity: "epica" },
  { id: "robot", name: "Robot", bg: TEAL, rarity: "epica" },
  { id: "professore", name: "Professore", bg: "#FFC531", rarity: "epica" },
  { id: "pirata", name: "Pirata", bg: TEAL, rarity: "epica" },
  { id: "samurai", name: "Samurai", bg: "#E5412D", rarity: "epica" },
  { id: "aviatore", name: "Aviatore", bg: BLUE, rarity: "epica" },
  // Mitici: Hall of Fame, o più badge d'oro insieme.
  { id: "faraone", name: "Faraone", bg: TEAL, rarity: "mitica" },
  { id: "vichingo", name: "Vichingo", bg: BLUE, rarity: "mitica" },
  { id: "ninja", name: "Ninja", bg: PURPLE, rarity: "mitica" },
  { id: "drago", name: "Drago", bg: "#E5412D", rarity: "mitica" },
  { id: "centurione", name: "Centurione", bg: "#FFC531", rarity: "mitica" },
  { id: "astronauta", name: "Astronauta", bg: NAVY, rarity: "mitica" },
  { id: "sole", name: "Sole", bg: BLUE, rarity: "mitica" },
  { id: "luchador", name: "Luchador", bg: "#FFC531", rarity: "mitica" },
  { id: "titano", name: "Titano", bg: GREEN, rarity: "mitica" },
  { id: "direttore", name: "Direttore", bg: PINK, rarity: "mitica" },
  // Leggendari: solo due, servono i badge Leggenda.
  { id: "re", name: "Il Re", bg: "#E5412D", rarity: "leggendaria" },
  { id: "leggenda", name: "Leggenda", bg: "#1D1A16", rarity: "leggendaria" },
] as const;

/** La divisa di ogni personaggio a figura intera (head: colore della testa vista da dietro). */
export const KIT: Record<AvatarPresetId, { jersey: string; trim: string; legs?: number; arms?: "big"; head?: string }> = {
  collana: { jersey: CREAM, trim: RED },
  occhiali: { jersey: BLUE, trim: CREAM, head: "#8C4317" },
  bandana: { jersey: YELLOW, trim: INK },
  lungo: { jersey: CREAM, trim: PURPLE, legs: 8 },
  coppola: { jersey: RED, trim: CREAM, legs: -6 },
  muscoli: { jersey: CREAM, trim: RED, arms: "big" },
  cecchino: { jersey: CREAM, trim: TEAL },
  regista: { jersey: BLUE, trim: CREAM },
  muro: { jersey: YELLOW, trim: INK, arms: "big" },
  lampo: { jersey: TEAL, trim: YELLOW, legs: 4 },
  rimbalzo: { jersey: GREEN, trim: CREAM, arms: "big" },
  jolly: { jersey: YELLOW, trim: PURPLE },
  bomber: { jersey: RED, trim: CREAM },
  postino: { jersey: NAVY, trim: YELLOW },
  gentiluomo: { jersey: CREAM, trim: INK },
  marinaio: { jersey: NAVY, trim: CREAM },
  sceriffo: { jersey: CREAM, trim: BROWN },
  ladro: { jersey: PURPLE, trim: CREAM },
  volo: { jersey: CREAM, trim: RED, legs: 4 },
  gigante: { jersey: CREAM, trim: PURPLE, legs: 12 },
  mago: { jersey: PURPLE, trim: YELLOW },
  fuoco: { jersey: RED, trim: YELLOW },
  ghiaccio: { jersey: NAVY, trim: "#9FD3F5", head: "#9FD3F5" },
  uragano: { jersey: GREEN, trim: YELLOW },
  castello: { jersey: PURPLE, trim: "#D8CDB8", arms: "big" },
  robot: { jersey: SILVER, trim: TEAL, head: SILVER },
  professore: { jersey: GREEN, trim: CREAM },
  pirata: { jersey: "#B3261E", trim: CREAM },
  samurai: { jersey: NAVY, trim: RED },
  aviatore: { jersey: BROWN, trim: CREAM },
  faraone: { jersey: "#F2B705", trim: BLUE },
  vichingo: { jersey: NAVY, trim: SILVER, arms: "big" },
  ninja: { jersey: INK, trim: RED, head: INK },
  drago: { jersey: GREEN, trim: YELLOW, head: "#3DAA6A" },
  centurione: { jersey: "#B3261E", trim: GOLD },
  astronauta: { jersey: CREAM, trim: BLUE },
  sole: { jersey: YELLOW, trim: RED },
  luchador: { jersey: PINK, trim: YELLOW, head: PINK },
  titano: { jersey: "#6E675D", trim: CREAM, arms: "big", legs: 2, head: STONE },
  direttore: { jersey: INK, trim: CREAM },
  re: { jersey: "#B3261E", trim: YELLOW },
  leggenda: { jersey: "#F2B705", trim: INK, head: "#F2B705" },
};

/** Una frase breve per ogni personaggio, nella sua scheda. */
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
  lampo: "Il più veloce in contropiede",
  rimbalzo: "Ogni pallone è suo",
  jolly: "Fa un po' di tutto",
  bomber: "Vive per fare canestro",
  postino: "Non salta una partita, con ogni tempo",
  gentiluomo: "Zero falli, tanta classe",
  marinaio: "Tiene la rotta e non perde palla",
  sceriffo: "Nell'uno contro uno spara per primo",
  ladro: "Il pallone sparisce dalle tue mani",
  volo: "Gioca sopra il ferro",
  gigante: "Tocca il cielo",
  mago: "Passaggi di magia",
  fuoco: "Quando si accende non lo ferma nessuno",
  ghiaccio: "Sangue freddo nei finali",
  uragano: "Vince e rivince",
  castello: "In area non entra nessuno",
  robot: "Precisione da macchina",
  professore: "Fa i compiti in due materie",
  pirata: "Non fa prigionieri",
  samurai: "Nel duello non perdona",
  aviatore: "Vola sul ferro per la seconda occasione",
  faraone: "Ha segnato più di una piramide",
  vichingo: "Conquista ogni rimbalzo",
  ninja: "Non lo vedi arrivare",
  drago: "Brucia la retina da tre",
  centurione: "Comanda il campetto",
  astronauta: "Fuori dal mondo",
  sole: "Non tramonta mai",
  luchador: "Sale sul ring e vince il titolo",
  titano: "Una montagna davanti al ferro",
  direttore: "Dirige l'orchestra a colpi di assist",
  re: "Il re del campetto",
  leggenda: "Quasi impossibile da avere",
};

/** Un traguardo: un badge almeno a quel livello (1 bronzo, 2 argento, 3 oro, 4 Hall of Fame, 5 Leggenda). */
export interface BadgeGoal {
  badge: string;
  tier: number;
}
export type CharacterGoal = BadgeGoal | { all: BadgeGoal[] } | { allTier: number; category?: "carriera" | "partita" | "speciali" };

/**
 * Cosa serve per ogni personaggio speciale. Più sale la rarità, più alto il livello
 * del badge; le sfide toccano tutte le statistiche, dai punti ai falli.
 */
export const GOALS: Partial<Record<AvatarPresetId, CharacterGoal>> = {
  // Rari
  cecchino: { badge: "triple", tier: 1 },
  regista: { badge: "assist", tier: 1 },
  muro: { badge: "stoppate", tier: 1 },
  lampo: { badge: "rubate", tier: 1 },
  rimbalzo: { badge: "rimbalzi", tier: 1 },
  jolly: { badge: "tuttofare", tier: 1 },
  bomber: { badge: "punti", tier: 1 },
  postino: { badge: "presenze", tier: 2 },
  gentiluomo: { badge: "fairplay", tier: 2 },
  marinaio: { badge: "pulito", tier: 2 },
  sceriffo: { badge: "uno-contro-uno", tier: 1 },
  ladro: { badge: "partita-rubate", tier: 2 },
  // Epici
  volo: { badge: "partita-punti", tier: 3 },
  gigante: { badge: "partita-rimbalzi", tier: 3 },
  mago: { badge: "partita-assist", tier: 3 },
  fuoco: { badge: "partita-triple", tier: 3 },
  ghiaccio: { badge: "fotofinish", tier: 3 },
  uragano: { all: [{ badge: "serie", tier: 2 }, { badge: "vittorie", tier: 2 }] },
  castello: { badge: "partita-stoppate", tier: 3 },
  robot: { badge: "mira", tier: 3 },
  professore: { badge: "doppia-doppia", tier: 2 },
  pirata: { badge: "cappotto", tier: 3 },
  samurai: { badge: "uno-contro-uno", tier: 3 },
  aviatore: { badge: "rimbalzi-off", tier: 3 },
  // Mitici
  faraone: { badge: "punti", tier: 4 },
  vichingo: { badge: "rimbalzi", tier: 4 },
  ninja: { badge: "rubate", tier: 4 },
  drago: { badge: "triple", tier: 4 },
  centurione: { badge: "mvp-mese", tier: 3 },
  astronauta: { badge: "mvp-partita", tier: 4 },
  sole: { all: [{ badge: "costanza", tier: 3 }, { badge: "apripista", tier: 2 }] },
  luchador: { badge: "campione", tier: 1 },
  titano: { badge: "stoppate", tier: 4 },
  direttore: { badge: "assist", tier: 4 },
  // Leggendari
  re: { allTier: 5, category: "carriera" },
  leggenda: { allTier: 5 },
};

/** Le rarità: nome, colore della cornice e regola in breve. */
export const RARITY: Record<Rarity, { label: string; one: string; ring: string; rule: string }> = {
  base: { label: "Di tutti", one: "Di tutti", ring: "#1D1A16", rule: "Disponibili da subito" },
  rara: { label: "Rari", one: "Raro", ring: GREEN, rule: "Un badge di bronzo o d'argento" },
  epica: { label: "Epici", one: "Epico", ring: PURPLE, rule: "Un badge d'oro o due d'argento" },
  mitica: { label: "Mitici", one: "Mitico", ring: RED, rule: "Badge Hall of Fame o più ori" },
  leggendaria: { label: "Leggendari", one: "Leggendario", ring: YELLOW, rule: "Solo con i badge Leggenda" },
};

export const RARITIES: Rarity[] = ["base", "rara", "epica", "mitica", "leggendaria"];

export type AvatarPresetId = (typeof AVATAR_PRESETS)[number]["id"];

const PREFIX = "preset:";
export const presetUrl = (id: AvatarPresetId) => `${PREFIX}${id}`;
export function presetOf(url: string | null | undefined): AvatarPresetId | null {
  if (!url?.startsWith(PREFIX)) return null;
  const id = url.slice(PREFIX.length);
  return AVATAR_PRESETS.some((p) => p.id === id) ? (id as AvatarPresetId) : null;
}

/** Dove sta la testa di ogni personaggio: serve per disegnarlo di spalle. */
export const HEAD_SHAPE: Record<AvatarPresetId, { cx: number; cy: number; rx: number; ry: number }> = {
  collana: { cx: 50, cy: 48, rx: 27, ry: 27 },
  occhiali: { cx: 50, cy: 48, rx: 27, ry: 27 },
  bandana: { cx: 50, cy: 49, rx: 27, ry: 27 },
  lungo: { cx: 50, cy: 45, rx: 22, ry: 31 },
  coppola: { cx: 50, cy: 56, rx: 31, ry: 23 },
  muscoli: { cx: 50, cy: 44, rx: 25, ry: 25 },
  cecchino: { cx: 50, cy: 48, rx: 26, ry: 26 },
  regista: { cx: 50, cy: 50, rx: 26, ry: 26 },
  muro: { cx: 50, cy: 50, rx: 26, ry: 26 },
  volo: { cx: 50, cy: 50, rx: 25, ry: 25 },
  gigante: { cx: 50, cy: 40, rx: 21, ry: 36 },
  mago: { cx: 50, cy: 54, rx: 25, ry: 25 },
  lampo: { cx: 50, cy: 49, rx: 26, ry: 26 },
  rimbalzo: { cx: 50, cy: 49, rx: 26, ry: 26 },
  jolly: { cx: 50, cy: 50, rx: 26, ry: 26 },
  fuoco: { cx: 50, cy: 52, rx: 25, ry: 25 },
  ghiaccio: { cx: 50, cy: 49, rx: 26, ry: 26 },
  uragano: { cx: 50, cy: 51, rx: 25, ry: 25 },
  bomber: { cx: 50, cy: 53, rx: 25, ry: 25 },
  postino: { cx: 50, cy: 53, rx: 25, ry: 25 },
  gentiluomo: { cx: 50, cy: 55, rx: 25, ry: 25 },
  marinaio: { cx: 50, cy: 52, rx: 26, ry: 26 },
  sceriffo: { cx: 50, cy: 55, rx: 25, ry: 25 },
  ladro: { cx: 50, cy: 52, rx: 26, ry: 26 },
  castello: { cx: 50, cy: 55, rx: 25, ry: 25 },
  robot: { cx: 50, cy: 52, rx: 26, ry: 26 },
  professore: { cx: 50, cy: 54, rx: 25, ry: 25 },
  pirata: { cx: 50, cy: 55, rx: 25, ry: 25 },
  samurai: { cx: 50, cy: 53, rx: 26, ry: 26 },
  aviatore: { cx: 50, cy: 52, rx: 26, ry: 26 },
  faraone: { cx: 50, cy: 53, rx: 25, ry: 25 },
  vichingo: { cx: 50, cy: 52, rx: 26, ry: 26 },
  ninja: { cx: 50, cy: 51, rx: 26, ry: 26 },
  drago: { cx: 50, cy: 52, rx: 26, ry: 26 },
  centurione: { cx: 50, cy: 55, rx: 25, ry: 25 },
  astronauta: { cx: 50, cy: 52, rx: 25, ry: 25 },
  sole: { cx: 50, cy: 50, rx: 26, ry: 26 },
  luchador: { cx: 50, cy: 51, rx: 26, ry: 26 },
  titano: { cx: 50, cy: 51, rx: 28, ry: 27 },
  direttore: { cx: 50, cy: 52, rx: 25, ry: 25 },
  re: { cx: 50, cy: 52, rx: 25, ry: 25 },
  leggenda: { cx: 50, cy: 50, rx: 26, ry: 26 },
};

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
      <path d={rays} fill={rarity === "leggendaria" ? YELLOW : "#FFFFFF"} opacity={rarity === "leggendaria" ? 0.45 : rarity === "mitica" ? 0.3 : rarity === "epica" ? 0.22 : 0.16} />
      {rarity !== "base" && (
        <g fill={rarity === "leggendaria" || rarity === "mitica" ? YELLOW : CREAM} stroke={INK} strokeWidth="1.2" strokeLinejoin="round">
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

/** Più cerchi fusi in una sola forma con un unico contorno (capelli, nuvole). */
function Blob({ circles, fill, sw = 2.4 }: { circles: [number, number, number][]; fill: string; sw?: number }) {
  return (
    <g>
      {circles.map(([x, y, r], i) => (
        <circle key={`o${i}`} cx={x} cy={y} r={r} fill={INK} stroke={INK} strokeWidth={sw * 2} />
      ))}
      {circles.map(([x, y, r], i) => (
        <circle key={`f${i}`} cx={x} cy={y} r={r} fill={fill} />
      ))}
    </g>
  );
}

/** Stellina a cinque punte centrata in (x, y). */
function Star({ x, y, r = 5, fill = YELLOW, sw = 1.2 }: { x: number; y: number; r?: number; fill?: string; sw?: number }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    return `${(x + rr * Math.cos(a)).toFixed(2)},${(y + rr * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
  return <polygon points={pts} fill={fill} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />;
}

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
    case "bomber": {
      // Il realizzatore: afro, fascia rossa e sorriso a tutta faccia.
      const h: Head = { cx: 50, cy: 53, rx: 25, ry: 25, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && <Jersey color={RED} trim={CREAM} />}
          <Blob fill="#3B2416" circles={[[27, 38, 11], [34, 25, 12], [50, 19, 13], [66, 25, 12], [73, 38, 11], [50, 34, 22]]} />
          <Ball h={h} uid={uid} />
          <path d="M25.6 44 Q50 35 74.4 44 L74.8 50.5 Q50 41.5 25.2 50.5 Z" fill={RED} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M25.6 47.2 Q50 38.4 74.4 47.2" fill="none" stroke={CREAM} strokeWidth="1.6" />
          <Eye x={42} y={56} s={0.92} />
          <Eye x={58} y={56} s={0.92} />
          <Grin x={50} y={67} w={0.92} />
        </>
      );
    }
    case "postino": {
      // Il postino anni '30: berretto con la visiera, distintivo e baffoni.
      const h: Head = { cx: 50, cy: 53, rx: 25, ry: 25, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && <Jersey color={NAVY} trim={YELLOW} />}
          <Ball h={h} uid={uid} />
          <path d="M26.5 42 L28.5 25 Q50 17 71.5 25 L73.5 42 Z" fill={NAVY} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
          <path d="M26 37 H74 V43.5 H26 Z" fill="#14294A" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M23.5 43.5 Q50 49 76.5 43.5 Q75 50 50 52.5 Q25 50 23.5 43.5 Z" fill={INK} />
          <circle cx="50" cy="30.5" r="3.8" fill={YELLOW} stroke={INK} strokeWidth="1.5" />
          <path d="M31 28 Q36 25.5 41 25" stroke={CREAM} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.6" />
          <Eye x={42} y={58} s={0.86} />
          <Eye x={58} y={58} s={0.86} />
          <path d="M37 67.5 Q43.5 62.5 50 66 Q56.5 62.5 63 67.5 Q57 71.5 50 68.6 Q43 71.5 37 67.5 Z" fill="#5C3A1E" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M46 72.6 Q50 74.4 54 72.6" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
        </>
      );
    }
    case "gentiluomo": {
      // Fair play: cilindro, monocolo e baffetti arricciati.
      const h: Head = { cx: 50, cy: 55, rx: 25, ry: 25, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && <Jersey color={CREAM} trim={INK} />}
          <Ball h={h} uid={uid} />
          <path d="M33.5 37 L35.5 9 Q50 5 64.5 9 L66.5 37 Z" fill={INK} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M34.4 28.5 L65.6 28.5 L66.2 34.5 L33.8 34.5 Z" fill={RED} />
          <path d="M38.5 12 L37.4 26" stroke={CREAM} strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
          <path d="M21.5 38 Q50 31.5 78.5 38 Q80.5 42 76.5 43 Q50 37 23.5 43 Q19.5 42 21.5 38 Z" fill={INK} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <Eye x={42} y={55} s={0.9} lid ball={h.ball} />
          <Eye x={58} y={55} s={0.9} />
          <circle cx="58" cy="55.5" r="8.4" fill="#FFFFFF" fillOpacity="0.2" stroke={GOLD} strokeWidth="2.4" />
          <path d="M65.5 59 Q70 66 66 74" fill="none" stroke={GOLD} strokeWidth="1.4" strokeDasharray="1.6 1.2" />
          <path d="M39 65.5 Q44.5 62 50 64.6 Q55.5 62 61 65.5 Q64.6 64.6 64.4 61 M39 65.5 Q35.4 64.6 35.6 61" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M45.5 70 Q50 72.2 54.5 70" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
        </>
      );
    }
    case "marinaio": {
      // Non perde mai palla: berretto da marinaio storto e fazzoletto al collo.
      const h: Head = { cx: 50, cy: 52, rx: 26, ry: 26, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && <Jersey color={NAVY} trim={CREAM} />}
          <path d="M41 75 L59 75 L50 87 Z" fill={RED} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <circle cx="50" cy="76.5" r="3" fill={RED} stroke={INK} strokeWidth="1.8" />
          <Ball h={h} uid={uid} />
          <g transform="rotate(-9 50 34)">
            <path d="M31 37 Q31 21 50 21 Q69 21 69 37 Z" fill={CREAM} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M26.5 36.5 Q50 30 73.5 36.5 L72.5 43 Q50 37 27.5 43 Z" fill={CREAM} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M28 39.6 Q50 33.4 72 39.6" fill="none" stroke={BLUE} strokeWidth="1.6" />
          </g>
          <Eye x={42} y={53} />
          <path d="M53 53 Q58 49.4 63 53" fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
          <Grin x={50} y={64} w={0.9} />
          <g fill={h.dark}>
            <circle cx="31" cy="60" r="1.2" />
            <circle cx="34" cy="63" r="1.1" />
            <circle cx="69" cy="60" r="1.2" />
          </g>
        </>
      );
    }
    case "sceriffo": {
      // L'uno contro uno: cappello da cowboy, occhi socchiusi e stella sul petto.
      const h: Head = { cx: 50, cy: 55, rx: 25, ry: 25, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && <Jersey color={CREAM} trim={BROWN} />}
          <Star x={63} y={88} r={5.2} />
          <Ball h={h} uid={uid} />
          <path d="M33 39 Q31.5 22 40.5 19.5 Q50 25 59.5 19.5 Q68.5 22 67 39 Z" fill={BROWN} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M33.4 33.5 Q50 37 66.6 33.5 L67 39 Q50 42.4 33 39 Z" fill={INK} />
          <path d="M12.5 35 Q18 42.5 50 42.5 Q82 42.5 87.5 35 Q90 44.5 76 47.5 Q50 52.5 24 47.5 Q10 44.5 12.5 35 Z" fill={BROWN} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M40 23 Q44 22 46 24" stroke={CREAM} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5" />
          <Eye x={42} y={57} s={0.9} lid ball={h.ball} />
          <Eye x={58} y={57} s={0.9} lid ball={h.ball} />
          <path d="M43 68 Q51 71 58 66.5" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M57 67.4 L66 63" stroke="#D8B26A" strokeWidth="1.8" strokeLinecap="round" />
        </>
      );
    }
    case "ladro": {
      // Le palle rubate: mascherina, berretto a righe e sorriso furbetto.
      const h: Head = { cx: 50, cy: 52, rx: 26, ry: 26, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && <Jersey color={PURPLE} trim={CREAM} />}
          <Ball h={h} uid={uid} />
          <path d="M26 41 Q26 20 50 19 Q74 20 74 41 Z" fill={INK} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M28 33.4 Q50 28.4 72 33.4 M30.5 26.4 Q50 21.6 69.5 26.4" fill="none" stroke={CREAM} strokeWidth="3" />
          <path d="M24.2 40 Q50 33.6 75.8 40 L75.8 46 Q50 39.6 24.2 46 Z" fill={INK} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <circle cx="50" cy="18" r="4.2" fill={CREAM} stroke={INK} strokeWidth="2" />
          <path d="M27 53 Q30 47 40 48 Q46 49 50 52 Q54 49 60 48 Q70 47 73 53 Q72 60 62 60 Q55 59 50 55 Q45 59 38 60 Q28 60 27 53 Z" fill={INK} />
          <Eye x={40} y={54} s={0.72} look={1} />
          <Eye x={60} y={54} s={0.72} look={1} />
          <path d="M42 66 Q52 72 60 64" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M51 68.6 L52 71.4 L54.4 70.2" fill={CREAM} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
        </>
      );
    }
    case "castello": {
      // Le stoppate: una torre con la bandierina, sguardo da guardia.
      const h: Head = { cx: 50, cy: 55, rx: 25, ry: 25, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && <Jersey color={PURPLE} trim="#D8CDB8" wide />}
          <Ball h={h} uid={uid} />
          <path d="M50 18 V5" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <path d="M50 5 L60.5 8.2 L50 11.4 Z" fill={RED} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M28 41 L28 23 L35 23 L35 17 L42 17 L42 23 L46.5 23 L46.5 17 L53.5 17 L53.5 23 L58 23 L58 17 L65 17 L65 23 L72 23 L72 41 Q50 35.5 28 41 Z" fill="#B9AE9C" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M28 30 H72 M38 23 V30 M52 30 V37 M62 23 V30 M44 30 V36.6" stroke={INK} strokeWidth="1.2" opacity="0.45" fill="none" />
          <path d="M30.4 25 L30.4 38" stroke={CREAM} strokeWidth="1.6" strokeLinecap="round" opacity="0.4" />
          <Eye x={42} y={55} s={0.9} />
          <Eye x={58} y={55} s={0.9} />
          <Brows x={50} y={46.4} tilt={-2.4} w={7} />
          <path d="M42 67 H58" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        </>
      );
    }
    case "robot": {
      // La mira: testa d'argento con antenna, visiera e griglia.
      const h: Head = { cx: 50, cy: 52, rx: 26, ry: 26, ball: SILVER, dark: "#8D98A3" };
      return (
        <>
          {P && <Jersey color={SILVER} trim={TEAL} />}
          <rect x="19.5" y="45" width="7" height="13" rx="2.4" fill="#8D98A3" stroke={INK} strokeWidth="2" />
          <rect x="73.5" y="45" width="7" height="13" rx="2.4" fill="#8D98A3" stroke={INK} strokeWidth="2" />
          <Ball h={h} uid={uid} />
          <path d="M50 26.5 V17 M47 21 L53 19 M47 24 L53 22" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <circle cx="50" cy="13" r="4.4" fill={RED} stroke={INK} strokeWidth="1.8" />
          <circle cx="48.6" cy="11.8" r="1.2" fill={CREAM} />
          <rect x="31" y="41.5" width="38" height="17" rx="8.5" fill={NAVY} stroke={INK} strokeWidth="2.4" />
          <circle cx="42" cy="50" r="4.4" fill="#7FE7F0" stroke={INK} strokeWidth="1.4" />
          <circle cx="58" cy="50" r="4.4" fill="#7FE7F0" stroke={INK} strokeWidth="1.4" />
          <circle cx="40.8" cy="48.6" r="1.3" fill={CREAM} />
          <circle cx="56.8" cy="48.6" r="1.3" fill={CREAM} />
          <rect x="40" y="63" width="20" height="8" rx="2.4" fill={CREAM} stroke={INK} strokeWidth="2" />
          <path d="M45 63 V71 M50 63 V71 M55 63 V71" stroke={INK} strokeWidth="1.4" />
          <g fill="#8D98A3" stroke={INK} strokeWidth="1">
            <circle cx="31" cy="36" r="1.4" />
            <circle cx="69" cy="36" r="1.4" />
            <circle cx="33" cy="68" r="1.4" />
            <circle cx="67" cy="68" r="1.4" />
          </g>
        </>
      );
    }
    case "professore": {
      // La doppia doppia: tocco da laureato, occhialini e barba bianca.
      const h: Head = { cx: 50, cy: 54, rx: 25, ry: 25, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && <Jersey color={GREEN} trim={CREAM} />}
          <Ball h={h} uid={uid} />
          <path d="M31.5 34 L31.5 42.6 Q50 36.6 68.5 42.6 L68.5 34 Z" fill={INK} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M16 30 L50 19 L84 30 L50 41 Z" fill={INK} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M22 30.4 L50 21.6 L58 24" stroke={CREAM} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.35" />
          <circle cx="50" cy="30" r="2" fill={YELLOW} stroke={INK} strokeWidth="1" />
          <path d="M50 30 Q70 29 74 43" fill="none" stroke={YELLOW} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M71.6 43 L76.4 43 L75.6 50 L72.4 50 Z" fill={YELLOW} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
          <Eye x={42} y={53} s={0.86} lid ball={h.ball} />
          <Eye x={58} y={53} s={0.86} lid ball={h.ball} />
          <g fill="#FFFFFF" fillOpacity="0.2" stroke={INK} strokeWidth="2">
            <rect x="35" y="53.5" width="13" height="8.4" rx="4" />
            <rect x="52" y="53.5" width="13" height="8.4" rx="4" />
          </g>
          <path d="M48 57.4 H52" stroke={INK} strokeWidth="2" />
          <path d="M35.5 64.5 Q50 86 64.5 64.5 Q58 70.4 50 69.4 Q42 70.4 35.5 64.5 Z" fill={CREAM} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M45.6 65.4 Q50 67.6 54.4 65.4" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
        </>
      );
    }
    case "pirata": {
      // Il cappotto: tricorno, benda, orecchino e un dente d'oro.
      const h: Head = { cx: 50, cy: 55, rx: 25, ry: 25, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && <Jersey color="#B3261E" trim={CREAM} />}
          <Ball h={h} uid={uid} />
          <circle cx="25.4" cy="63" r="3.2" fill="none" stroke={GOLD} strokeWidth="2" />
          <path d="M13 39 Q30 30 50 32.5 Q70 30 87 39 Q81 16 50 12.5 Q19 16 13 39 Z" fill={INK} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M14.6 37.6 Q30 29.4 50 31.6 Q70 29.4 85.4 37.6" fill="none" stroke={YELLOW} strokeWidth="2" />
          <circle cx="50" cy="22.5" r="4.4" fill={CREAM} />
          <rect x="47.2" y="25" width="5.6" height="3.4" rx="1" fill={CREAM} />
          <circle cx="48.3" cy="22.4" r="1.1" fill={INK} />
          <circle cx="51.7" cy="22.4" r="1.1" fill={INK} />
          <path d="M42 30.5 L58 25.5 M42 25.5 L58 30.5" stroke={CREAM} strokeWidth="1.8" strokeLinecap="round" opacity="0.9" />
          <path d="M27 44.5 Q45 49 75.6 63" fill="none" stroke={INK} strokeWidth="2.2" />
          <Eye x={42} y={56} />
          <ellipse cx="58" cy="56" rx="6.6" ry="7.6" fill={INK} />
          <Brows x={50} y={46.6} tilt={1.6} w={6.4} />
          <Grin x={50} y={67} w={0.88} />
          <rect x="51.2" y="67.2" width="3.2" height="3" rx="0.6" fill={YELLOW} stroke={INK} strokeWidth="0.8" />
        </>
      );
    }
    case "samurai": {
      // L'uno contro uno da maestro: codino, fascia col sole rosso e sguardo fermo.
      const h: Head = { cx: 50, cy: 53, rx: 26, ry: 26, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && <Jersey color={NAVY} trim={RED} />}
          <Ball h={h} uid={uid} />
          <path d="M27 36 Q29 25.5 50 24.5 Q71 25.5 73 36 Q50 30 27 36 Z" fill={INK} />
          <path d="M45.6 25.5 Q43 13 50 10 Q57 13 54.4 25.5 Z" fill={INK} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
          <rect x="45.6" y="21" width="8.8" height="3" rx="1.4" fill={CREAM} stroke={INK} strokeWidth="1.2" />
          <path d="M24.6 39 Q50 32 75.4 39 L75.8 45.4 Q50 38.4 24.2 45.4 Z" fill={CREAM} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <circle cx="50" cy="38.6" r="3.2" fill={RED} />
          <path d="M75 40 Q85 36.5 91 41 Q85 43.4 78 43 Z M75.6 43.4 Q83.6 47.4 86.6 54 Q80 50.6 75 45.4 Z" fill={CREAM} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <Eye x={42} y={55} s={0.9} />
          <Eye x={58} y={55} s={0.9} />
          <Brows x={50} y={47} tilt={3} w={7.4} />
          <path d="M43 66.5 Q50 63.8 57 66.5" fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
        </>
      );
    }
    case "aviatore": {
      // I rimbalzi in attacco: cuffia di cuoio, occhialoni sulla fronte e sciarpa al vento.
      const h: Head = { cx: 50, cy: 52, rx: 26, ry: 26, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && <Jersey color={BROWN} trim={CREAM} />}
          <path d="M35 75 Q50 81.4 65 75 L67 80.4 Q50 87.6 33 80.4 Z" fill={CREAM} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M62 79.6 Q77 83 88 74 Q84 85.6 66 85 Z" fill={CREAM} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <Ball h={h} uid={uid} />
          <path d="M24 46 Q21.5 21 50 19.5 Q78.5 21 76 46 Q70 37.6 50 36.4 Q30 37.6 24 46 Z" fill={BROWN} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M23.6 43 Q19 56 25.6 64 Q31 61.6 30.4 50 Z M76.4 43 Q81 56 74.4 64 Q69 61.6 69.6 50 Z" fill={BROWN} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M50 20 V36.4" stroke={INK} strokeWidth="1.2" opacity="0.45" />
          <path d="M24.6 34 Q50 25.6 75.4 34" fill="none" stroke={INK} strokeWidth="3.2" />
          <circle cx="40.6" cy="30.6" r="7.2" fill="#9FD3F5" stroke={INK} strokeWidth="2.4" />
          <circle cx="59.4" cy="30.6" r="7.2" fill="#9FD3F5" stroke={INK} strokeWidth="2.4" />
          <path d="M36.4 28 Q38 25.6 40.6 25.4 M55.2 28 Q56.8 25.6 59.4 25.4" stroke={CREAM} strokeWidth="1.6" strokeLinecap="round" fill="none" />
          <Eye x={42} y={53} s={0.92} />
          <Eye x={58} y={53} s={0.92} />
          <Grin x={50} y={64} w={0.9} />
        </>
      );
    }
    case "faraone": {
      // I punti da Hall of Fame: copricapo a righe d'oro e blu, cobra sulla fronte.
      const h: Head = { cx: 50, cy: 53, rx: 25, ry: 25, ball: "#F26A1B", dark: "#C9500F" };
      const stripes = "M0 6 H12 M0 12 H12 M0 18 H12 M0 24 H12 M0 30 H12";
      return (
        <>
          {P && <Jersey color="#F2B705" trim={BLUE} />}
          <path d="M25 41 Q13 60 17 82 L31 82 Q28 62 31 46 Z" fill={YELLOW} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M75 41 Q87 60 83 82 L69 82 Q72 62 69 46 Z" fill={YELLOW} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d={stripes} transform="translate(18 48)" stroke={BLUE} strokeWidth="2.6" />
          <path d={stripes} transform="translate(70 48)" stroke={BLUE} strokeWidth="2.6" />
          <Ball h={h} uid={uid} />
          <path d="M24 47 Q21.5 19 50 17 Q78.5 19 76 47 Q70 38.6 50 37.6 Q30 38.6 24 47 Z" fill={YELLOW} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M26.4 40 Q50 30.6 73.6 40 M28.6 32.6 Q50 23.6 71.4 32.6 M34.6 25.2 Q50 19.2 65.4 25.2" fill="none" stroke={BLUE} strokeWidth="2.6" />
          <path d="M24.6 45.6 Q50 36.4 75.4 45.6" fill="none" stroke={INK} strokeWidth="2.4" />
          <path d="M50 38 Q46.4 31 50 26 Q53.6 31 50 38 Z" fill={GOLD} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="50" cy="30.6" r="1.2" fill={RED} />
          <Eye x={42} y={54} s={0.9} lid ball={h.ball} />
          <Eye x={58} y={54} s={0.9} lid ball={h.ball} />
          <path d="M36.4 54 L31 55.6 M63.6 54 L69 55.6" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M44 65 Q50 68.4 56 65" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M47 71 L53 71 L52.2 82 L47.8 82 Z" fill={BLUE} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M47.4 75 H52.6 M47.6 78.6 H52.4" stroke={YELLOW} strokeWidth="1.4" />
        </>
      );
    }
    case "vichingo": {
      // I rimbalzi da Hall of Fame: elmo con le corna e barbone intrecciato.
      const h: Head = { cx: 50, cy: 52, rx: 26, ry: 26, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && <Jersey color={NAVY} trim={SILVER} wide />}
          <Ball h={h} uid={uid} />
          <path d="M27.6 38 Q11 35 9 15 Q17 28 31 30.5 Z" fill={CREAM} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M72.4 38 Q89 35 91 15 Q83 28 69 30.5 Z" fill={CREAM} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M25 43 Q25 20 50 19 Q75 20 75 43 Z" fill={SILVER} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
          <path d="M33 26 Q38 22.4 44 21.6" stroke={CREAM} strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M23.6 40.6 Q50 34.6 76.4 40.6 L76.4 47 Q50 41 23.6 47 Z" fill="#8D98A3" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <g fill={CREAM} stroke={INK} strokeWidth="0.8">
            <circle cx="31" cy="42.6" r="1.3" />
            <circle cx="69" cy="42.6" r="1.3" />
          </g>
          <path d="M47.6 44 L52.4 44 L51.6 56 L48.4 56 Z" fill="#8D98A3" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
          <Eye x={40.6} y={54} s={0.84} />
          <Eye x={59.4} y={54} s={0.84} />
          <Brows x={50} y={47.6} gap={9.4} tilt={1.6} w={6.4} />
          <path d="M27 59 Q29 85 50 89 Q71 85 73 59 Q62 67 50 66 Q38 67 27 59 Z" fill="#B5451B" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M35 70 Q37 78 42 82 M65 70 Q63 78 58 82 M50 72 V84" stroke="#8E3413" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          <g fill="#B5451B" stroke={INK} strokeWidth="1.8">
            <ellipse cx="43.4" cy="91" rx="3.2" ry="3.8" />
            <ellipse cx="43" cy="97.4" rx="2.8" ry="3.4" />
            <ellipse cx="56.6" cy="91" rx="3.2" ry="3.8" />
            <ellipse cx="57" cy="97.4" rx="2.8" ry="3.4" />
          </g>
          <path d="M38.6 62.6 Q50 56.4 61.4 62.6 Q56 67.4 50 64.4 Q44 67.4 38.6 62.6 Z" fill="#8E3413" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
        </>
      );
    }
    case "ninja": {
      // Le rubate da Hall of Fame: cappuccio nero, fascia rossa e una stellina.
      const h: Head = { cx: 50, cy: 51, rx: 26, ry: 26, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && <Jersey color={INK} trim={RED} />}
          <ellipse cx="50" cy="51" rx="26" ry="26" fill="#2A251F" stroke={INK} strokeWidth="3" />
          <path d="M31 31 Q38 26 45 25.6 M30 66 Q38 72 46 73" stroke={CREAM} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.18" />
          <path d="M29 46 Q50 39.6 71 46 L71 57.4 Q50 52.4 29 57.4 Z" fill={h.ball} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <Eye x={41.4} y={50.6} s={0.8} look={1} />
          <Eye x={58.6} y={50.6} s={0.8} look={1} />
          <path d="M34.6 44.6 L46.6 46.4 M65.4 44.6 L53.4 46.4" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M23.6 38 Q50 29 76.4 38 L76.6 43.4 Q50 34.4 23.4 43.4 Z" fill={RED} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M75 38.4 Q86 32 94 36.4 Q86 40.6 78 41.6 Z M76 41.6 Q86 46.6 90 54.6 Q82 50.6 76 44.6 Z" fill={RED} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <g transform="translate(84 70) rotate(18)">
            <path d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z" fill={SILVER} stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
            <circle r="1.2" fill={INK} />
          </g>
        </>
      );
    }
    case "drago": {
      // Le triple da Hall of Fame: testa verde con corna, cresta e fumo dalle narici.
      const h: Head = { cx: 50, cy: 52, rx: 26, ry: 26, ball: "#3DAA6A", dark: "#23784A" };
      return (
        <>
          {P && <Jersey color={GREEN} trim={YELLOW} />}
          <path d="M33 33 Q22.6 21 25.6 8 Q31.6 19.6 39.6 27 Z" fill={CREAM} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M67 33 Q77.4 21 74.4 8 Q68.4 19.6 60.4 27 Z" fill={CREAM} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M38.6 30 L43 17.6 L47.6 27 L52 13.6 L56 27 L60.6 17.6 L63.6 30 Z" fill={YELLOW} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <Ball h={h} uid={uid} />
          <g fill="#2A8F56" opacity="0.7">
            <circle cx="33" cy="40" r="2" />
            <circle cx="37" cy="36" r="1.6" />
            <circle cx="67" cy="40" r="2" />
            <circle cx="63" cy="36" r="1.6" />
          </g>
          <Eye x={42} y={50} s={0.9} />
          <Eye x={58} y={50} s={0.9} />
          <Brows x={50} y={41.6} tilt={2.6} w={7} />
          <circle cx="46.4" cy="60" r="1.4" fill={INK} />
          <circle cx="53.6" cy="60" r="1.4" fill={INK} />
          <g fill="#E9E2D6" stroke={INK} strokeWidth="1.2" opacity="0.92">
            <circle cx="34" cy="62" r="3.2" />
            <circle cx="28.6" cy="58" r="2.4" />
            <circle cx="66" cy="62" r="3.2" />
            <circle cx="71.4" cy="58" r="2.4" />
          </g>
          <Grin x={50} y={66} w={0.9} />
          <path d="M43.4 66.2 L45.4 70 L47.4 66.6 Z M52.6 66.6 L54.6 70 L56.6 66.2 Z" fill={CREAM} stroke={INK} strokeWidth="1" strokeLinejoin="round" />
        </>
      );
    }
    case "centurione": {
      // MVP per tre mesi: elmo romano d'oro con la cresta rossa e il mantello.
      const h: Head = { cx: 50, cy: 55, rx: 25, ry: 25, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && <Jersey color="#B3261E" trim={GOLD} />}
          <path d="M23 77 Q50 86 77 77 L81 86 Q50 95 19 86 Z" fill={RED} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <circle cx="27" cy="80.4" r="3.2" fill={GOLD} stroke={INK} strokeWidth="1.6" />
          <Ball h={h} uid={uid} />
          <path d="M21 31 Q23 7 50 5 Q77 7 79 31 Q66 23 50 23 Q34 23 21 31 Z" fill={RED} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M28 25 Q31 15 37 11 M38 22 Q40 13 44 8.6 M50 21.6 V7 M62 22 Q60 13 56 8.6 M72 25 Q69 15 63 11" stroke={INK} strokeWidth="1.2" opacity="0.45" fill="none" />
          <path d="M26 45 Q26 25 50 24 Q74 25 74 45 Z" fill={GOLD} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
          <path d="M33 31 Q38 27 44 26.4" stroke={CREAM} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7" />
          <path d="M23.6 44 Q50 37 76.4 44 L76.4 49.6 Q50 42.6 23.6 49.6 Z" fill="#C18D26" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M24.6 48.6 Q21.6 63 29.6 71 L34 67 Q30 58 31.4 49 Z M75.4 48.6 Q78.4 63 70.4 71 L66 67 Q70 58 68.6 49 Z" fill={GOLD} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <Eye x={42} y={57} s={0.88} />
          <Eye x={58} y={57} s={0.88} />
          <Brows x={50} y={49.6} tilt={-1.4} w={6.4} />
          <path d="M43 67 Q50.6 72 57.6 66" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
        </>
      );
    }
    case "astronauta": {
      // Il migliore in campo: casco di vetro anni '30, antenna e stelle.
      const h: Head = { cx: 50, cy: 52, rx: 25, ry: 25, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && <Jersey color={CREAM} trim={BLUE} />}
          <Star x={11} y={30} r={4} />
          <Star x={90} y={44} r={3.4} />
          {/* Il vetro del casco sta dietro la testa ed è pieno: niente trasparenze sul bordo. */}
          <circle cx="50" cy="50" r="33" fill="#D3ECF9" />
          <Ball h={h} uid={uid} />
          <Eye x={42} y={50} />
          <Eye x={58} y={50} />
          <Grin x={50} y={62} w={0.95} />
          <circle cx="50" cy="50" r="33" fill="none" stroke={INK} strokeWidth="2.8" />
          <path d="M27 36 Q32 25 44 21" stroke={CREAM} strokeWidth="3.4" strokeLinecap="round" fill="none" opacity="0.85" />
          <path d="M29 42 Q30 38.6 31.6 36.4" stroke={CREAM} strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.7" />
          <path d="M66 21 L72 9" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="72.6" cy="7.6" r="3.2" fill={YELLOW} stroke={INK} strokeWidth="1.6" />
          <path d="M21.6 73 Q50 87 78.4 73 L76.6 81 Q50 93 23.4 81 Z" fill={SILVER} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <g fill="#8D98A3" stroke={INK} strokeWidth="1">
            <circle cx="31" cy="80.4" r="1.4" />
            <circle cx="50" cy="85.6" r="1.4" />
            <circle cx="69" cy="80.4" r="1.4" />
          </g>
        </>
      );
    }
    case "sole": {
      // Sempre presente, ogni settimana: raggi d'oro, occhiali tondi e guance rosse.
      const h: Head = { cx: 50, cy: 50, rx: 26, ry: 26, ball: "#F26A1B", dark: "#C9500F" };
      const rays = Array.from({ length: 12 }, (_, i) => {
        const a = (Math.PI / 6) * i - Math.PI / 2;
        const b0 = a - 0.16;
        const b1 = a + 0.16;
        const p = (r: number, t: number) => `${(50 + r * Math.cos(t)).toFixed(2)} ${(50 + r * Math.sin(t)).toFixed(2)}`;
        return `M${p(24, b0)} L${p(i % 2 ? 36 : 40, a)} L${p(24, b1)} Z`;
      }).join(" ");
      return (
        <>
          {P && <Jersey color={YELLOW} trim={RED} />}
          <path d={rays} fill={YELLOW} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <Ball h={h} uid={uid} />
          <g fill={INK}>
            <circle cx="41" cy="48.6" r="7.4" />
            <circle cx="59" cy="48.6" r="7.4" />
          </g>
          <path d="M48 47 Q50 45.4 52 47 M33.6 47 L25.6 44.4 M66.4 47 L74.4 44.4" stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <path d="M37 45.6 Q38.6 43.4 41 43 M55 45.6 Q56.6 43.4 59 43" stroke={CREAM} strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <g fill={RED} opacity="0.4">
            <circle cx="32" cy="59" r="3.4" />
            <circle cx="68" cy="59" r="3.4" />
          </g>
          <Grin x={50} y={61} />
        </>
      );
    }
    case "luchador": {
      // Campione di stagione: maschera da lottatore rosa, stella in fronte.
      const h: Head = { cx: 50, cy: 51, rx: 26, ry: 26, ball: "#F26A1B", dark: "#C9500F" };
      const eyeHole = "M30 47 Q35.6 38.6 46.4 44 Q46.6 55 36.4 56 Q29 54.4 30 47 Z";
      return (
        <>
          {P && <Jersey color={PINK} trim={YELLOW} />}
          <ellipse cx="50" cy="51" rx="26" ry="26" fill={PINK} stroke={INK} strokeWidth="3" />
          <path d="M50 25.4 V40" stroke={YELLOW} strokeWidth="3.4" />
          <path d="M30 32 Q37 29 44 35 M70 32 Q63 29 56 35" stroke={YELLOW} strokeWidth="2.6" strokeLinecap="round" fill="none" />
          <path d={eyeHole} fill={h.ball} stroke={YELLOW} strokeWidth="5" strokeLinejoin="round" />
          <path d={eyeHole} transform="translate(100 0) scale(-1 1)" fill={h.ball} stroke={YELLOW} strokeWidth="5" strokeLinejoin="round" />
          <path d={eyeHole} fill="none" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
          <path d={eyeHole} transform="translate(100 0) scale(-1 1)" fill="none" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
          <Eye x={39} y={49.4} s={0.72} />
          <Eye x={61} y={49.4} s={0.72} />
          <ellipse cx="50" cy="65" rx="9" ry="6.2" fill={h.ball} stroke={YELLOW} strokeWidth="3.4" />
          <path d="M43.4 63.4 Q50 70.4 56.6 63.4 Z" fill={INK} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
          <Star x={50} y={33} r={4.6} />
          <path d="M31 30 Q36 26 41 25.4" stroke={CREAM} strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.5" />
        </>
      );
    }
    case "titano": {
      // Le stoppate da Hall of Fame: testa di pietra con le crepe, occhi che brillano.
      const h: Head = { cx: 50, cy: 51, rx: 28, ry: 27, ball: STONE, dark: "#6E675D" };
      return (
        <>
          {P && <Jersey color="#6E675D" trim={CREAM} wide />}
          <Ball h={h} uid={uid} />
          <path d="M34 30 L38.6 36 L35.4 41.6 M67 64 L62 58.6 L64.6 53.6 M70 34 L66 38" stroke={INK} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M37.6 25.6 Q44 20.6 52.6 23.4 Q48.6 27.6 40 27.4 Z" fill={GREEN} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M26.4 43 Q50 34.4 73.6 43 L73.6 48 Q50 40.4 26.4 48 Z" fill="#6E675D" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <circle cx="41" cy="52.6" r="4.6" fill={YELLOW} stroke={INK} strokeWidth="2" />
          <circle cx="59" cy="52.6" r="4.6" fill={YELLOW} stroke={INK} strokeWidth="2" />
          <circle cx="41" cy="53" r="1.8" fill={INK} />
          <circle cx="59" cy="53" r="1.8" fill={INK} />
          <path d="M40 65 H60" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M44 65 V67.6 M50 65 V68 M56 65 V67.6" stroke={INK} strokeWidth="1.4" />
        </>
      );
    }
    case "direttore": {
      // Gli assist da Hall of Fame: capelli bianchi da maestro, baffoni e papillon.
      const h: Head = { cx: 50, cy: 52, rx: 25, ry: 25, ball: "#F26A1B", dark: "#C9500F" };
      return (
        <>
          {P && <Jersey color={INK} trim={CREAM} />}
          {P && (
            <g>
              <path d="M77 74 L92 42" stroke={INK} strokeWidth="3.6" strokeLinecap="round" />
              <path d="M77 74 L92 42" stroke={CREAM} strokeWidth="1.8" strokeLinecap="round" />
            </g>
          )}
          <Blob fill="#F2EEE6" circles={[[26, 41, 8], [22.6, 52, 7], [26, 61, 6], [74, 41, 8], [77.4, 52, 7], [74, 61, 6], [31, 30, 8], [69, 30, 8]]} />
          <Ball h={h} uid={uid} />
          <path d="M36.6 52 Q41.6 47.6 46.6 52 M53.4 52 Q58.4 47.6 63.4 52" fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
          <path d="M36 45.4 Q41 42.4 46 44 M54 44 Q59 42.4 64 45.4" fill="none" stroke="#F2EEE6" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M37.6 62.6 Q44 57.4 50 60.6 Q56 57.4 62.4 62.6 Q57 67 50 63.8 Q43 67 37.6 62.6 Z" fill="#F2EEE6" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M45.6 68.4 Q50 70.4 54.4 68.4" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M41 75 L50 79.4 L41 83.8 Z M59 75 L50 79.4 L59 83.8 Z" fill={RED} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="50" cy="79.4" r="2.2" fill={RED} stroke={INK} strokeWidth="1.6" />
          <g fill={INK}>
            <path d="M86 22 V12 L92 10.4 V20" stroke={INK} strokeWidth="1.4" fill="none" />
            <ellipse cx="84.6" cy="22.4" rx="2.4" ry="1.8" />
            <ellipse cx="90.6" cy="20.8" rx="2.4" ry="1.8" />
            <path d="M12 32 V23" stroke={INK} strokeWidth="1.4" />
            <ellipse cx="10.6" cy="32.4" rx="2.4" ry="1.8" />
          </g>
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
