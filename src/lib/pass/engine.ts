import type { Match } from "../types";
import {
  ITEM_BY_ID,
  LEVELS,
  PASS_LEVELS,
  POINTS_PER_LEVEL,
  POINTS_PER_MATCH,
  SEASON,
  SPICCHI_PER_EXTRA_LEVEL,
  SPICCHI_PER_MATCH,
  STARTER,
  type MatchCtx,
  type Season,
} from "./catalog";
import type { PassState } from "./store";

/** Come hai passato un livello: con la sfida (quale delle due) o con i punti. */
export interface LevelUp {
  level: number;
  via: "sfida" | "punti";
  /** 0 = la prima sfida, 1 = la seconda. */
  alt?: 0 | 1;
  matchId: string;
  day: string;
}

export interface PassMatch {
  match: Match;
  ctx: MatchCtx;
  day: string;
  points: number;
  boosted: boolean;
}

export interface PassProgress {
  season: Season;
  /** Livelli completati (0-30). */
  level: number;
  /** Punti verso il prossimo livello (0-39). */
  bar: number;
  ups: LevelUp[];
  matches: PassMatch[];
  /** Livelli fatti dopo il 30 (diventano Spicchi). */
  extra: number;
  spicchi: number;
  /** Da dove arrivano gli Spicchi, per la scheda informativa. */
  spicchiFrom: { partite: number; pass: number; extra: number; bonus: number; spent: number };
  /** Livelli raggiunti ma non ancora riscattati. */
  toClaim: number[];
  owned: Set<string>;
  daysLeft: number;
  /** Le giornate della season (dalla più recente), con quello che è successo nel pass. */
  giornate: { day: string; matches: PassMatch[]; ups: LevelUp[]; points: number }[];
}

export const dayOf = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function ctxOf(m: Match, playerId: string): MatchCtx | null {
  const line = m.players.find((p) => p.playerId === playerId);
  if (!line) return null;
  const b = line.box;
  const mine = line.team === "A" ? m.scoreA : m.scoreB;
  const theirs = line.team === "A" ? m.scoreB : m.scoreA;
  return {
    stats: line.hasStats,
    pts: b.pts,
    ast: b.ast,
    reb: b.oreb + b.dreb,
    oreb: b.oreb,
    stl: b.stl,
    blk: b.blk,
    tov: b.tov,
    fgm: b.fg2m + b.fg3m,
    fga: b.fg2a + b.fg3a,
    fg3m: b.fg3m,
    fg3a: b.fg3a,
    won: mine > theirs,
    margin: Math.abs(mine - theirs),
    teamPts: mine,
  };
}

/**
 * Il pass si ricalcola sempre dalle partite, in ordine di tempo: ogni partita vale 15 punti
 * (30 col boost), può chiudere al massimo una sfida, e ogni 40 punti si sale di livello.
 * I punti in più passano al livello dopo.
 */
export function computePass(
  playerId: string,
  all: Match[],
  st: PassState,
  now = new Date(),
  season: Season = SEASON,
): PassProgress {
  const from = Date.parse(season.start);
  const to = Date.parse(season.end);
  const mine = all
    .filter((m) => {
      const t = Date.parse(m.playedAt);
      return t >= from && t < to && m.players.some((p) => p.playerId === playerId);
    })
    .sort((a, b) => Date.parse(a.playedAt) - Date.parse(b.playedAt));

  // I boost: ognuno vale per tutta la prima giornata giocata dopo che l'hai acceso.
  const boostedDays = new Set<string>();
  const acts = [...st.boostActivations].sort();
  for (const a of acts) {
    const first = mine.find((m) => Date.parse(m.playedAt) >= Date.parse(a));
    if (first) boostedDays.add(dayOf(first.playedAt));
  }

  let level = 0;
  let bar = 0;
  let extra = 0;
  const ups: LevelUp[] = [];
  const matches: PassMatch[] = [];
  for (const m of mine) {
    const ctx = ctxOf(m, playerId);
    if (!ctx) continue;
    const day = dayOf(m.playedAt);
    const boosted = boostedDays.has(day);
    const points = POINTS_PER_MATCH * (boosted ? 2 : 1);
    matches.push({ match: m, ctx, day, points, boosted });
    bar += points;
    if (level < LEVELS) {
      const lv = PASS_LEVELS[level];
      const alt = lv.sfide.findIndex((s) => (!s.needsStats || ctx.stats) && s.test(ctx));
      if (alt >= 0) {
        level++;
        ups.push({ level, via: "sfida", alt: alt as 0 | 1, matchId: m.id, day });
      }
    }
    while (bar >= POINTS_PER_LEVEL) {
      bar -= POINTS_PER_LEVEL;
      if (level < LEVELS) {
        level++;
        ups.push({ level, via: "punti", matchId: m.id, day });
      } else extra++;
    }
  }

  const claimed = new Set(st.claimed);
  const passSpicchi = PASS_LEVELS.filter((l) => claimed.has(l.n) && l.reward.kind === "spicchi").reduce(
    (s, l) => s + (l.reward.kind === "spicchi" ? l.reward.amount : 0),
    0,
  );
  const fromMatches = matches.length * SPICCHI_PER_MATCH;
  const fromExtra = extra * SPICCHI_PER_EXTRA_LEVEL;
  const spicchi = fromMatches + passSpicchi + fromExtra + st.bonus - st.spent;

  const owned = new Set<string>([...STARTER, ...st.owned]);
  for (const l of PASS_LEVELS)
    if (claimed.has(l.n) && l.reward.kind === "item" && ITEM_BY_ID.has(l.reward.id)) owned.add(l.reward.id);

  const toClaim = PASS_LEVELS.filter((l) => l.n <= level && !claimed.has(l.n)).map((l) => l.n);

  const byDay = new Map<string, { day: string; matches: PassMatch[]; ups: LevelUp[]; points: number }>();
  for (const pm of matches) {
    const g = byDay.get(pm.day) ?? { day: pm.day, matches: [], ups: [], points: 0 };
    g.matches.push(pm);
    g.points += pm.points;
    byDay.set(pm.day, g);
  }
  for (const u of ups) byDay.get(u.day)?.ups.push(u);

  return {
    season,
    level,
    bar: level >= LEVELS ? 0 : bar,
    ups,
    matches,
    extra,
    spicchi,
    spicchiFrom: { partite: fromMatches, pass: passSpicchi, extra: fromExtra, bonus: st.bonus, spent: st.spent },
    toClaim,
    owned,
    daysLeft: Math.max(0, Math.ceil((to - now.getTime()) / 86_400_000)),
    giornate: [...byDay.values()].sort((a, b) => (a.day < b.day ? 1 : -1)),
  };
}

/** Un numero a caso ma ripetibile (per la bancarella del giorno e le sorprese). */
export function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
