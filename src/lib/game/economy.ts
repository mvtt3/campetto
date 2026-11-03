import type { Contract, GameState, Level, Offer, Skill } from "./types";

/** Un generatore casuale ripetibile: nei test e nelle simulazioni dà sempre gli stessi numeri. */
export type Rng = () => number;

export function seeded(seed: string | number): Rng {
  let a = typeof seed === "number" ? seed >>> 0 : hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length) % xs.length];

export interface LevelInfo {
  name: string;
  short: string;
  format: string;
  /** Giocatori per squadra in campo. */
  size: 3 | 5;
  matches: number;
  salary: [number, number];
  win: number;
  tax: number;
  /** Quanto valgono premi e prezzi rispetto al Campetto. */
  mult: number;
  /** Per salire: voto medio e fama ("or": basta una delle due). */
  up: { rating: number; fame: number; or: boolean } | null;
  next: Level | null;
}

export const LEVELS: Record<Level, LevelInfo> = {
  campetto: {
    name: "Campetto",
    short: "Campetto",
    format: "3 contro 3, ai 21",
    size: 3,
    matches: 10,
    salary: [50, 300],
    win: 50,
    tax: 0,
    mult: 1,
    up: { rating: 7, fame: 20, or: true },
    next: "b",
  },
  b: {
    name: "Serie B",
    short: "Serie B",
    format: "5 contro 5",
    size: 5,
    matches: 20,
    salary: [1000, 3000],
    win: 500,
    tax: 0.2,
    mult: 5,
    up: { rating: 7, fame: 40, or: false },
    next: "a",
  },
  a: {
    name: "Serie A",
    short: "Serie A",
    format: "5 contro 5",
    size: 5,
    matches: 20,
    salary: [10000, 40000],
    win: 5000,
    tax: 0.35,
    mult: 50,
    up: null,
    next: null,
  },
};

export const LEVEL_ORDER: Level[] = ["campetto", "b", "a"];

/** Le squadre: nomi inventati, nessuna squadra vera. */
export const TEAMS: Record<Level, string[]> = {
  campetto: [
    "Spicchi del Parchetto",
    "Tombini di Nichelino",
    "Cortile Sud",
    "Quelli del Muretto",
    "Ferro Arrugginito",
    "Retina Rotta",
    "I Senza Canotta",
    "Panchina Fredda",
    "Asfalto Caldo",
    "Gli Zii del Sabato",
    "Rimbalzo Facile",
  ],
  b: [
    "Nichelino Spicchi",
    "Torino Tombini",
    "Bologna Mortadelle",
    "Napoli Sfogliatelle",
    "Roma Supplì",
    "Milano Apericena",
    "Genova Pesto Forte",
    "Bari Orecchiette",
    "Firenze Lampredotto",
    "Venezia Gondolieri Stanchi",
    "Palermo Arancini",
    "Verona Pandori",
  ],
  a: [
    "Milano Panettoni",
    "Bologna Tortellini",
    "Venezia Laguna",
    "Sassari Seadas",
    "Brescia Tondini",
    "Trento Strudel",
    "Varese Prealpi",
    "Treviso Radicchio",
    "Pesaro Piadine",
    "Reggio Erbazzone",
    "Cantù Mobilieri",
    "Napoli Babà",
  ],
};

/** La Lega americana: si vede in fondo alla scala della carriera, arriverà più avanti. */
export const LEGA_TEAMS = [
  "Los Angeles Laghetti",
  "Chicago Torelli",
  "Boston Seltz",
  "Miami Calura",
  "Golden State Guerrieri della Domenica",
  "Brooklyn Retine",
  "Denver Pepite d'Argento",
  "Phoenix Brustolini",
  "New York Coltellini",
  "Dallas Stalloni Stanchi",
  "Milwaukee Cerbiattoni",
  "Philadelphia Settantasei Euro",
];

export const START_CONTRACT: Contract = {
  team: "Spicchi del Parchetto",
  level: "campetto",
  salary: 80,
};

export const fmtEuro = (n: number) =>
  `${Math.round(n).toLocaleString("it-IT")} €`;

/** "1,2 mila €", "35 mila €", "1,5 mln €": per i numeri grossi nei bottoni. */
export function shortEuro(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000)
    return `${(n / 1_000_000).toLocaleString("it-IT", { maximumFractionDigits: 1 })} mln €`;
  if (a >= 10_000)
    return `${Math.round(n / 1000).toLocaleString("it-IT")} mila €`;
  return fmtEuro(n);
}

export function weeklyGross(c: Contract): number {
  return c.salary + (c.sponsor ?? 0);
}

export function weeklyNet(c: Contract): number {
  return Math.round(weeklyGross(c) * (1 - LEVELS[c.level].tax));
}

/** Prezzo di una cosa che costa `base` al Campetto, al livello di adesso. */
export const scaled = (s: Pick<GameState, "contract">, base: number) =>
  Math.round(base * LEVELS[s.contract.level].mult);

/** Il giorno della settimana di gioco: 0 lunedì … 6 domenica. */
export const dow = (day: number) => (day - 1) % 7;
export const week = (day: number) => Math.floor((day - 1) / 7) + 1;
export const DAY_NAMES = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

/** Il calendario di una stagione: mercoledì e sabato, a partire dal lunedì `start`. */
export function schedule(level: Level, start: number, own: string, seed: string) {
  const rng = seeded(seed);
  const pool = TEAMS[level].filter((t) => t !== own);
  // Un giro di tutte le avversarie in ordine casuale, poi si ricomincia.
  const order = [...pool].sort(() => rng() - 0.5);
  const n = LEVELS[level].matches;
  return Array.from({ length: n }, (_, i) => ({
    day: start + Math.floor(i / 2) * 7 + (i % 2 ? 5 : 2),
    opponent: order[i % order.length],
    home: i % 2 === 0,
  }));
}

/** Quanto è forte una squadra avversaria (sempre la stessa per nome): da 0,85 a 1,15. */
export function teamStrength(team: string): number {
  return 0.85 + (hash(team) % 1000) / 1000 * 0.3;
}

export interface SeasonSummary {
  played: number;
  wins: number;
  avg: number;
  pts: number;
  promoted: boolean;
}

export function seasonSummary(s: GameState): SeasonSummary {
  const done = s.season.matches.filter((m) => m.result);
  const rated = done.filter((m) => !m.result!.simulated || true);
  const avg = rated.length
    ? rated.reduce((a, m) => a + m.result!.rating, 0) / rated.length
    : 0;
  const up = LEVELS[s.contract.level].up;
  const promoted = !!up && (up.or
    ? avg >= up.rating || s.fame >= up.fame
    : avg >= up.rating && s.fame >= up.fame);
  return {
    played: done.length,
    wins: done.filter((m) => m.result!.us > m.result!.them).length,
    avg: Math.round(avg * 10) / 10,
    pts: done.reduce((a, m) => a + m.result!.pts, 0),
    promoted,
  };
}

/** Le offerte di fine stagione: il rinnovo, un'altra squadra e, se te la sei meritata, la promozione. */
export function makeOffers(s: GameState, rng: Rng): Offer[] {
  const sum = seasonSummary(s);
  const lv = s.contract.level;
  const agent = s.perks.agent ? 1.2 : 1;
  const worth = clamp(((sum.avg - 5) / 4) * 0.6 + (s.fame / 100) * 0.4, 0, 1);
  const salaryAt = (level: Level, w: number) => {
    const [lo, hi] = LEVELS[level].salary;
    const raw = (lo + (hi - lo) * clamp(w, 0, 1)) * agent;
    const step = level === "campetto" ? 5 : level === "b" ? 50 : 500;
    return Math.round(raw / step) * step;
  };
  const offers: Offer[] = [];
  const renewal = Math.max(
    LEVELS[lv].salary[0],
    Math.round(
      s.contract.salary *
        (sum.avg >= 7 ? 1.25 : sum.avg >= 6 ? 1.1 : 0.95) *
        (s.perks.agent ? 1.1 : 1),
    ),
  );
  offers.push({
    id: `r${s.season.n}`,
    team: s.contract.team,
    level: lv,
    salary: Math.min(LEVELS[lv].salary[1] * agent, renewal),
    note:
      sum.avg >= 7
        ? "Ti vogliono tenere a tutti i costi."
        : sum.avg >= 6
          ? "Rinnoviamo, ma ci aspettiamo di più."
          : "Ultima possibilità, dicono.",
    promotion: false,
  });
  const others = TEAMS[lv].filter((t) => t !== s.contract.team);
  offers.push({
    id: `o${s.season.n}`,
    team: pick(rng, others),
    level: lv,
    salary: salaryAt(lv, worth * 0.9 + rng() * 0.1),
    note: "Una squadra nuova, gente nuova.",
    promotion: false,
  });
  const next = LEVELS[lv].next;
  if (sum.promoted && next) {
    const teams = [...TEAMS[next]].sort(() => rng() - 0.5).slice(0, 2);
    teams.forEach((team, i) =>
      offers.push({
        id: `p${s.season.n}-${i}`,
        team,
        level: next,
        salary: salaryAt(next, worth * 0.5 + (i ? 0 : 0.1)),
        note: i ? "Ti seguono da un po'." : "Ti vogliono subito, è la promozione!",
        promotion: true,
      }),
    );
  }
  return offers;
}

/** L'esperienza che serve per il prossimo punto in un'abilità: più sei forte, più è lunga. */
export const xpNeed = (skill: number) => Math.round(8 + skill / 4);

export function addXp(s: GameState, skill: Skill, amount: number): GameState {
  let v = s.skills[skill];
  let xp = s.xp[skill] + amount;
  while (v < 99 && xp >= xpNeed(v)) {
    xp -= xpNeed(v);
    v += 1;
  }
  return {
    ...s,
    skills: { ...s.skills, [skill]: v },
    xp: { ...s.xp, [skill]: v >= 99 ? 0 : xp },
  };
}

/** Il voto complessivo del giocatore (come nelle figurine). */
export const overall = (s: Pick<GameState, "skills">) =>
  Math.round(
    (s.skills.tiro + s.skills.passaggio + s.skills.difesa + s.skills.fisico) / 4,
  );

// ———————————————————— Gettoni delle sfide ————————————————————

export const TOKENS_MAX = 5;
export const TOKEN_MS = 2 * 60 * 60 * 1000;

/** I gettoni che si sono ricaricati da soli (uno ogni 2 ore). */
export function refillTokens(s: GameState, now: number): GameState {
  if (s.tokens >= TOKENS_MAX) {
    return s.tokensAt === new Date(now).toISOString()
      ? s
      : { ...s, tokensAt: new Date(now).toISOString() };
  }
  const since = now - Date.parse(s.tokensAt);
  const n = Math.floor(since / TOKEN_MS);
  if (n <= 0) return s;
  const tokens = Math.min(TOKENS_MAX, s.tokens + n);
  return {
    ...s,
    tokens,
    tokensAt:
      tokens >= TOKENS_MAX
        ? new Date(now).toISOString()
        : new Date(Date.parse(s.tokensAt) + n * TOKEN_MS).toISOString(),
  };
}

/** Quanto manca al prossimo gettone, in millisecondi (null se sono pieni). */
export function nextTokenIn(s: GameState, now: number): number | null {
  if (s.tokens >= TOKENS_MAX) return null;
  return Math.max(0, Date.parse(s.tokensAt) + TOKEN_MS - now);
}

export function addToken(s: GameState, now: number): GameState {
  const r = refillTokens(s, now);
  if (r.tokens >= TOKENS_MAX) return r;
  const tokens = r.tokens + 1;
  return {
    ...r,
    tokens,
    tokensAt: tokens >= TOKENS_MAX ? new Date(now).toISOString() : r.tokensAt,
  };
}

export function spendToken(s: GameState, now: number): GameState | null {
  const r = refillTokens(s, now);
  if (r.tokens <= 0) return null;
  // Se erano pieni, il conto alla rovescia del prossimo parte adesso.
  return {
    ...r,
    tokens: r.tokens - 1,
    tokensAt: r.tokens >= TOKENS_MAX ? new Date(now).toISOString() : r.tokensAt,
  };
}

// ———————————————————— Premio giornaliero ————————————————————

/** Il giorno di oggi in Italia: "2026-11-03". Il premio giornaliero cambia a mezzanotte. */
export function romeDay(now: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}

export function prevDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export type DailyPrize =
  | { kind: "money"; base: number }
  | { kind: "energy" }
  | { kind: "item" }
  | { kind: "training" }
  | { kind: "rare" };

/** I 7 giorni di fila: chi salta un giorno ricomincia dal primo. */
export const DAILY: DailyPrize[] = [
  { kind: "money", base: 200 },
  { kind: "energy" },
  { kind: "money", base: 500 },
  { kind: "item" },
  { kind: "money", base: 1000 },
  { kind: "training" },
  { kind: "rare" },
];

/** Il giorno del calendario che tocca oggi (1–7) e se è già stato preso. */
export function dailyStatus(s: GameState, today: string): { step: number; claimed: boolean } {
  if (s.daily.last === today) return { step: s.daily.streak, claimed: true };
  const cont = s.daily.last === prevDay(today) && s.daily.streak < 7;
  return { step: cont ? s.daily.streak + 1 : 1, claimed: false };
}

/** Premio per il primo di una classifica a mezzanotte (al Campetto; poi sale col livello). */
export const KING_PRIZE = 1000;
/** Bonus per ogni partita vera giocata nel gruppo. */
export const REAL_MATCH_BONUS = 500;
