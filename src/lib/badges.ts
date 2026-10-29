import { periodRange, seasonKey, seasonOf, sortChrono } from "./periods";
import { normalizeBox, teamOf } from "./stats/player";
import { comebackSize } from "./stats/records";
import { winnerOf, type Match } from "./types";
import type { MonthAward, SeasonAward } from "./stats/awards";

export const TIER_NAMES = ["Bloccato", "Bronzo", "Argento", "Oro", "Hall of Fame", "Leggenda"] as const;
export type Tier = 0 | 1 | 2 | 3 | 4 | 5;

export type BadgeCategory = "carriera" | "partita" | "speciali";

export type BadgeIcon =
  | "points"
  | "assist"
  | "rebound"
  | "steal"
  | "block"
  | "three"
  | "win"
  | "streak"
  | "presence"
  | "hot"
  | "vision"
  | "paint"
  | "clean"
  | "allround"
  | "crown"
  | "trophy"
  | "comeback"
  | "duel"
  | "calendar"
  | "shutout"
  | "clutch"
  | "opener"
  | "sniper";

export interface BadgeDef {
  key: string;
  name: string;
  /** What is measured, used as "72 / 100 {unit}". */
  unit: string;
  description: string;
  category: BadgeCategory;
  icon: BadgeIcon;
  thresholds: [number, number, number, number, number];
  /** Single-game badges track the best performance, not a running total. */
  mode: "total" | "best";
}

const CAREER = [25, 50, 100, 250, 500] as [number, number, number, number, number];

export const BADGES: BadgeDef[] = [
  // Carriera
  { key: "punti", name: "Realizzatore", unit: "punti", description: "Punti segnati in carriera", category: "carriera", icon: "points", thresholds: [250, 500, 1000, 2500, 5000], mode: "total" },
  { key: "assist", name: "Regista", unit: "assist", description: "Assist in carriera", category: "carriera", icon: "assist", thresholds: CAREER, mode: "total" },
  { key: "rimbalzi", name: "Rimbalzista", unit: "rimbalzi", description: "Rimbalzi in carriera", category: "carriera", icon: "rebound", thresholds: CAREER, mode: "total" },
  { key: "rubate", name: "Mani rapide", unit: "palle rubate", description: "Palle rubate in carriera", category: "carriera", icon: "steal", thresholds: CAREER, mode: "total" },
  { key: "stoppate", name: "Muro", unit: "stoppate", description: "Stoppate in carriera", category: "carriera", icon: "block", thresholds: CAREER, mode: "total" },
  { key: "triple", name: "Dalla distanza", unit: "triple", description: "Tiri da tre segnati in carriera", category: "carriera", icon: "three", thresholds: CAREER, mode: "total" },
  { key: "vittorie", name: "Vincente", unit: "vittorie", description: "Partite vinte in carriera", category: "carriera", icon: "win", thresholds: CAREER, mode: "total" },
  { key: "serie", name: "Inarrestabile", unit: "vittorie di fila", description: "Vittorie consecutive", category: "carriera", icon: "streak", thresholds: [3, 5, 10, 15, 20], mode: "best" },
  { key: "presenze", name: "Sempre presente", unit: "partite", description: "Partite giocate", category: "carriera", icon: "presence", thresholds: [10, 25, 50, 100, 200], mode: "total" },
  // Partita singola
  { key: "partita-punti", name: "Serata perfetta", unit: "punti", description: "Punti in una sola partita", category: "partita", icon: "hot", thresholds: [8, 10, 12, 15, 21], mode: "best" },
  { key: "partita-assist", name: "Visione di gioco", unit: "assist", description: "Assist in una sola partita", category: "partita", icon: "vision", thresholds: [3, 4, 5, 7, 10], mode: "best" },
  { key: "partita-rimbalzi", name: "Padrone dell'area", unit: "rimbalzi", description: "Rimbalzi in una sola partita", category: "partita", icon: "paint", thresholds: [5, 7, 10, 12, 15], mode: "best" },
  { key: "partita-triple", name: "Mano calda", unit: "triple", description: "Triple in una sola partita", category: "partita", icon: "sniper", thresholds: [2, 3, 4, 5, 7], mode: "best" },
  { key: "pulito", name: "Zero sbavature", unit: "partite", description: "Partite con tabellino e nessuna palla persa", category: "partita", icon: "clean", thresholds: [1, 5, 10, 25, 50], mode: "total" },
  { key: "tuttofare", name: "Tuttofare", unit: "partite", description: "Partite con almeno 5 punti, 3 rimbalzi e 3 assist", category: "partita", icon: "allround", thresholds: [1, 3, 5, 10, 20], mode: "total" },
  // Speciali
  { key: "mvp-mese", name: "MVP del mese", unit: "mesi", description: "Mesi chiusi da MVP", category: "speciali", icon: "crown", thresholds: [1, 2, 3, 5, 10], mode: "total" },
  { key: "campione", name: "Campione di stagione", unit: "stagioni", description: "Stagioni vinte", category: "speciali", icon: "trophy", thresholds: [1, 2, 3, 4, 6], mode: "total" },
  { key: "rimonta", name: "Rimonta", unit: "vittorie", description: "Vittorie da sotto di almeno 5 punti (dal video)", category: "speciali", icon: "comeback", thresholds: [1, 2, 3, 5, 10], mode: "total" },
  { key: "uno-contro-uno", name: "Re dell'1 contro 1", unit: "vittorie in 1v1", description: "Vittorie nell'1 contro 1", category: "speciali", icon: "duel", thresholds: [3, 5, 10, 25, 50], mode: "total" },
  { key: "costanza", name: "Settimana dopo settimana", unit: "mesi", description: "Mesi in cui hai giocato ogni settimana", category: "speciali", icon: "calendar", thresholds: [1, 2, 3, 6, 12], mode: "total" },
  { key: "cappotto", name: "Cappotto", unit: "vittorie", description: "Vittorie lasciando gli avversari a 5 punti o meno", category: "speciali", icon: "shutout", thresholds: [1, 2, 3, 5, 10], mode: "total" },
  { key: "fotofinish", name: "Al fotofinish", unit: "vittorie", description: "Vittorie con 2 punti di scarto o meno", category: "speciali", icon: "clutch", thresholds: [1, 3, 5, 10, 20], mode: "total" },
  { key: "apripista", name: "Apripista", unit: "stagioni", description: "Presente alla prima partita della stagione", category: "speciali", icon: "opener", thresholds: [1, 2, 3, 4, 6], mode: "total" },
];

export const BADGE_BY_KEY = new Map(BADGES.map((b) => [b.key, b]));

export interface BadgeUnlock {
  key: string;
  tier: Tier;
  date: string;
  matchId: string | null;
}

export interface BadgeState {
  def: BadgeDef;
  value: number;
  tier: Tier;
  /** Next threshold to reach, null at Leggenda. */
  next: number | null;
  /** Previous threshold (0 when locked), useful for progress bars. */
  prev: number;
  unlockedAt: string | null;
}

export function tierFor(def: BadgeDef, value: number): Tier {
  let t = 0;
  for (const th of def.thresholds) if (value >= th) t++;
  return t as Tier;
}

function weeksOfMonth(year: number, month: number): Set<string> {
  const weeks = new Set<string>();
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    weeks.add(weekKey(d));
    d.setDate(d.getDate() + 1);
  }
  return weeks;
}

function weekKey(d: Date): string {
  // Monday-based week, identified by the date of its Monday.
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
}

export interface BadgeContext {
  months: MonthAward[];
  seasons: SeasonAward[];
  now?: Date;
}

/**
 * Replays the match history in order and returns, for each badge, the current
 * value, tier and every tier unlock with its date. Pure and idempotent: the same
 * history always yields the same result.
 */
export function computeBadges(
  playerId: string,
  matches: Match[],
  ctx: BadgeContext,
): { states: BadgeState[]; unlocks: BadgeUnlock[] } {
  const values = new Map<string, number>(BADGES.map((b) => [b.key, 0]));
  const tiers = new Map<string, Tier>(BADGES.map((b) => [b.key, 0]));
  const unlocks: BadgeUnlock[] = [];
  const bump = (key: string, value: number, mode: "total" | "best", date: string, matchId: string | null) => {
    const def = BADGE_BY_KEY.get(key)!;
    const cur = values.get(key)!;
    const next = mode === "total" ? cur + value : Math.max(cur, value);
    values.set(key, next);
    const t = tierFor(def, next);
    const old = tiers.get(key)!;
    if (t > old) {
      for (let k = old + 1; k <= t; k++) unlocks.push({ key, tier: k as Tier, date, matchId });
      tiers.set(key, t);
    }
  };

  const chrono = sortChrono(matches);
  const seasonFirst = new Map<string, string>(); // season key -> first match id
  for (const m of chrono) {
    const s = seasonOf(m.playedAt);
    const k = seasonKey(s.year, s.quarter);
    if (!seasonFirst.has(k)) seasonFirst.set(k, m.id);
  }

  let streak = 0;
  for (const m of chrono) {
    const team = teamOf(m, playerId);
    if (!team) continue;
    const line = m.players.find((p) => p.playerId === playerId)!;
    const won = winnerOf(m) === team;
    const mine = team === "A" ? m.scoreA : m.scoreB;
    const theirs = team === "A" ? m.scoreB : m.scoreA;
    const d = m.playedAt;

    bump("presenze", 1, "total", d, m.id);
    if (won) {
      bump("vittorie", 1, "total", d, m.id);
      streak++;
      if (m.format === "1v1") bump("uno-contro-uno", 1, "total", d, m.id);
      if (theirs <= 5) bump("cappotto", 1, "total", d, m.id);
      if (mine - theirs <= 2) bump("fotofinish", 1, "total", d, m.id);
      if (comebackSize(m) >= 5) bump("rimonta", 1, "total", d, m.id);
    } else {
      streak = 0;
    }
    bump("serie", streak, "best", d, m.id);

    const s = seasonOf(m.playedAt);
    if (seasonFirst.get(seasonKey(s.year, s.quarter)) === m.id) bump("apripista", 1, "total", d, m.id);

    if (line.hasStats) {
      const b = normalizeBox(line.box);
      const reb = b.oreb + b.dreb;
      bump("punti", b.pts, "total", d, m.id);
      bump("assist", b.ast, "total", d, m.id);
      bump("rimbalzi", reb, "total", d, m.id);
      bump("rubate", b.stl, "total", d, m.id);
      bump("stoppate", b.blk, "total", d, m.id);
      bump("triple", b.fg3m, "total", d, m.id);
      bump("partita-punti", b.pts, "best", d, m.id);
      bump("partita-assist", b.ast, "best", d, m.id);
      bump("partita-rimbalzi", reb, "best", d, m.id);
      bump("partita-triple", b.fg3m, "best", d, m.id);
      if (b.tov === 0) bump("pulito", 1, "total", d, m.id);
      if (b.pts >= 5 && reb >= 3 && b.ast >= 3) bump("tuttofare", 1, "total", d, m.id);
    }
  }

  // Month- and season-based specials, unlocked when the period closes.
  const closedMonths = ctx.months.filter((mo) => mo.closed).sort((a, b) => a.year - b.year || a.month - b.month);
  for (const mo of closedMonths) {
    const end = periodRange({ kind: "month", year: mo.year, month: mo.month })!.end;
    const date = new Date(end.getTime() - 1000).toISOString();
    if (mo.mvp?.playerId === playerId) bump("mvp-mese", 1, "total", date, null);
    const weeks = weeksOfMonth(mo.year, mo.month);
    const played = new Set(
      chrono
        .filter((m) => {
          const dt = new Date(m.playedAt);
          return dt.getFullYear() === mo.year && dt.getMonth() === mo.month && teamOf(m, playerId);
        })
        .map((m) => weekKey(new Date(m.playedAt))),
    );
    if (played.size > 0 && [...weeks].every((w) => played.has(w))) bump("costanza", 1, "total", date, null);
  }
  const closedSeasons = ctx.seasons.filter((s) => s.closed).sort((a, b) => a.year - b.year || a.quarter - b.quarter);
  for (const s of closedSeasons) {
    if (s.ranking[0]?.playerId !== playerId) continue;
    const end = periodRange({ kind: "season", year: s.year, quarter: s.quarter })!.end;
    bump("campione", 1, "total", new Date(end.getTime() - 1000).toISOString(), null);
  }

  unlocks.sort((a, b) => a.date.localeCompare(b.date));
  const states: BadgeState[] = BADGES.map((def) => {
    const value = values.get(def.key)!;
    const tier = tierFor(def, value);
    const last = [...unlocks].reverse().find((u) => u.key === def.key);
    return {
      def,
      value,
      tier,
      next: tier < 5 ? (def.thresholds as readonly number[])[tier] : null,
      prev: tier > 0 ? def.thresholds[tier - 1] : 0,
      unlockedAt: last?.date ?? null,
    };
  });
  return { states, unlocks };
}

/** Badges shown in the showcase: the chosen ones if unlocked, else the best three. */
export function showcaseBadges(states: BadgeState[], chosen: string[]): BadgeState[] {
  const unlocked = states.filter((s) => s.tier > 0);
  const picked = chosen
    .map((k) => unlocked.find((s) => s.def.key === k))
    .filter((s): s is BadgeState => Boolean(s));
  if (picked.length >= 3) return picked.slice(0, 3);
  const rest = unlocked
    .filter((s) => !picked.includes(s))
    .sort((a, b) => b.tier - a.tier || (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? ""));
  return [...picked, ...rest].slice(0, 3);
}

const SINGULAR: Record<string, string> = {
  partite: "partita",
  vittorie: "vittoria",
  mesi: "mese",
  stagioni: "stagione",
  punti: "punto",
  rimbalzi: "rimbalzo",
  "palle rubate": "palla rubata",
  stoppate: "stoppata",
  triple: "tripla",
  "vittorie di fila": "vittoria di fila",
  "vittorie in 1v1": "vittoria in 1v1",
};

/** "1 partita", "3 partite". */
export function unitFor(def: Pick<BadgeDef, "unit">, n: number): string {
  return n === 1 ? (SINGULAR[def.unit] ?? def.unit) : def.unit;
}
