import {
  filterMatches,
  isPeriodOver,
  monthsWithMatches,
  periodRange,
  seasonsWithMatches,
  shiftMonth,
  type FormatFilter,
  type Period,
} from "../periods";
import type { Match } from "../types";
import { computeElo, eloDelta, type EloResult } from "./elo";
import { computePlayerStats, type PlayerStats } from "./player";

export const MVP_MIN_GAMES = 3;
/** Per entrare in una classifica "a partita" serve almeno questa quota delle partite di chi ha giocato di più. */
export const PRESENCE_SHARE = 0.4;

/** Partite minime nel periodo: almeno `abs`, e almeno il 40% di quelle del più presente. */
export function minGamesFor(maxGames: number, abs: number): number {
  return Math.max(abs, Math.ceil(maxGames * PRESENCE_SHARE));
}

export interface MvpEntry {
  playerId: string;
  score: number; // 0..1
  games: number;
  winPct: number;
  effAvg: number | null;
  plusMinusAvg: number;
  eloDelta: number;
}

function normalizer(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (v: number) => (max === min ? 0.5 : (v - min) / (max - min));
}

/**
 * MVP del periodo: vincere conta, ma conta di più come giochi. Chi segna e produce tanto in
 * una squadra che perde non deve finire dietro a chi vince senza incidere.
 * 45% statistiche (metà punti a partita, metà valutazione: rimbalzi, assist, rubate e
 * stoppate meno tiri sbagliati e palle perse), 30% vittorie, 15% presenza,
 * 10% impatto (+/− medio: di quanto vince la tua squadra quando ci sei).
 * Per entrare servono almeno 3 partite e almeno il 40% delle partite di chi ha giocato di più:
 * chi viene due volte con una bella media non scavalca chi c'è sempre.
 * Senza tabellini nel periodo: 50% vittorie, 25% presenza, 25% ELO.
 */
export function mvpRanking(
  playerIds: string[],
  matches: Match[],
  period: Period,
  format: FormatFilter = "all",
  opts: { minGames?: number; elo?: EloResult } = {},
): MvpEntry[] {
  const minGames = opts.minGames ?? MVP_MIN_GAMES;
  const scoped = filterMatches(matches, { period, format });
  const elo = opts.elo ?? computeElo(matches, playerIds);
  const range = periodRange(period);

  const all = playerIds.map((id) => ({
    id,
    s: computePlayerStats(id, scoped),
  }));
  const maxGames = Math.max(0, ...all.map((r) => r.s.games));
  const need = opts.minGames ?? minGamesFor(maxGames, minGames);
  const rows = all
    .filter((r) => r.s.games >= need)
    .map((r) => ({
      playerId: r.id,
      games: r.s.games,
      winPct: r.s.winPct,
      effAvg: r.s.effAvg,
      ptsAvg: r.s.statGames ? r.s.avg.pts : null,
      plusMinusAvg: r.s.plusMinusAvg,
      eloDelta: eloDelta(elo, r.id, range?.start, range?.end),
    }));
  if (!rows.length) return [];

  const nWin = normalizer(rows.map((r) => r.winPct));
  const effs = rows
    .filter((r) => r.effAvg !== null)
    .map((r) => r.effAvg as number);
  const nEff = effs.length ? normalizer(effs) : null;
  const pts = rows
    .filter((r) => r.ptsAvg !== null)
    .map((r) => r.ptsAvg as number);
  const nPts = pts.length ? normalizer(pts) : null;
  const nImpact = normalizer(rows.map((r) => r.plusMinusAvg));

  return rows
    .map((r) => {
      const w = nWin(r.winPct);
      const i = nImpact(r.plusMinusAvg);
      const p = r.games / maxGames;
      const score =
        nEff && r.effAvg !== null
          ? 0.3 * w +
            0.1 * i +
            0.45 *
              (0.5 * nEff(r.effAvg) +
                0.5 * (nPts && r.ptsAvg !== null ? nPts(r.ptsAvg) : 0)) +
            0.15 * p
          : 0.5 * w + 0.3 * i + 0.2 * p;
      return { ...r, score };
    })
    .sort(
      (a, b) => b.score - a.score || b.winPct - a.winPct || b.games - a.games,
    );
}

export function mvpOf(
  playerIds: string[],
  matches: Match[],
  period: Period,
  format: FormatFilter = "all",
  elo?: EloResult,
): MvpEntry | null {
  return mvpRanking(playerIds, matches, period, format, { elo })[0] ?? null;
}

/**
 * The MVP "in charge" (gold frame): MVP of the current month, or of the previous
 * month when the current one doesn't have enough games yet.
 */
export function currentMvp(
  playerIds: string[],
  matches: Match[],
  now: Date = new Date(),
  elo?: EloResult,
): { entry: MvpEntry; period: Period } | null {
  const e = elo ?? computeElo(matches, playerIds);
  for (let back = 0; back <= 1; back++) {
    const { year, month } = shiftMonth(
      now.getFullYear(),
      now.getMonth(),
      -back,
    );
    const period: Period = { kind: "month", year, month };
    const top = mvpOf(playerIds, matches, period, "all", e);
    if (top) return { entry: top, period };
  }
  return null;
}

export type KingCategory = "punti" | "assist" | "rimbalzi" | "difesa" | "tiro3";

export interface KingEntry {
  category: KingCategory;
  playerId: string;
  value: number;
  label: string;
}

export const KING_LABELS: Record<KingCategory, string> = {
  punti: "Miglior realizzatore",
  assist: "Miglior assistman",
  rimbalzi: "Miglior rimbalzista",
  difesa: "Miglior difensore",
  tiro3: "Miglior tiratore da tre",
};

/** Category kings: per-game averages, minimum 2 games with stats (3PT: min 5 attempts). */
export function categoryKings(
  playerIds: string[],
  matches: Match[],
  period: Period,
): KingEntry[] {
  const scoped = filterMatches(matches, { period });
  const stats = playerIds
    .map((id) => computePlayerStats(id, scoped))
    .filter((s) => s.statGames >= 2);
  const out: KingEntry[] = [];
  const pick = (
    category: KingCategory,
    value: (s: PlayerStats) => number | null,
    fmt: (v: number) => string,
  ) => {
    let best: { s: PlayerStats; v: number } | null = null;
    for (const s of stats) {
      const v = value(s);
      if (v === null || v <= 0) continue;
      if (!best || v > best.v) best = { s, v };
    }
    if (best)
      out.push({
        category,
        playerId: best.s.playerId,
        value: best.v,
        label: fmt(best.v),
      });
  };
  pick(
    "punti",
    (s) => s.avg.pts,
    (v) => `${v.toFixed(1)} punti a partita`,
  );
  pick(
    "assist",
    (s) => s.avg.ast,
    (v) => `${v.toFixed(1)} assist a partita`,
  );
  pick(
    "rimbalzi",
    (s) => s.rebAvg,
    (v) => `${v.toFixed(1)} rimbalzi a partita`,
  );
  pick(
    "difesa",
    (s) => s.avg.stl + s.avg.blk,
    (v) => `${v.toFixed(1)} rubate + stoppate`,
  );
  pick(
    "tiro3",
    (s) => (s.totals.fg3a >= 5 ? s.fg3Pct : null),
    (v) => `${Math.round(v * 100)}% da tre`,
  );
  return out;
}

export interface MonthAward {
  year: number;
  month: number;
  mvp: MvpEntry | null;
  kings: KingEntry[];
  closed: boolean;
}

export function monthlyHistory(
  playerIds: string[],
  matches: Match[],
  now = new Date(),
): MonthAward[] {
  const elo = computeElo(matches, playerIds);
  return monthsWithMatches(matches)
    .map(({ year, month }) => {
      const period: Period = { kind: "month", year, month };
      return {
        year,
        month,
        mvp: mvpOf(playerIds, matches, period, "all", elo),
        kings: categoryKings(playerIds, matches, period),
        closed: isPeriodOver(period, now),
      };
    })
    .reverse();
}

export interface SeasonAward {
  year: number;
  quarter: number;
  ranking: MvpEntry[];
  closed: boolean;
}

export function seasonHistory(
  playerIds: string[],
  matches: Match[],
  now = new Date(),
): SeasonAward[] {
  const elo = computeElo(matches, playerIds);
  return seasonsWithMatches(matches)
    .map(({ year, quarter }) => {
      const period: Period = { kind: "season", year, quarter };
      return {
        year,
        quarter,
        ranking: mvpRanking(playerIds, matches, period, "all", { elo }),
        closed: isPeriodOver(period, now),
      };
    })
    .reverse();
}

/** Closed seasons won by the player: their permanent trophies. */
export function trophiesOf(
  playerId: string,
  seasons: SeasonAward[],
): SeasonAward[] {
  return seasons.filter((s) => s.closed && s.ranking[0]?.playerId === playerId);
}

/** Closed months won by the player. */
export function mvpMonthsOf(
  playerId: string,
  months: MonthAward[],
): MonthAward[] {
  return months.filter((m) => m.closed && m.mvp?.playerId === playerId);
}
