import type { EloResult } from "./elo";
import { eloDelta } from "./elo";
import type { PlayerStats } from "./player";

export type StatKey =
  | "vittorie"
  | "winPct"
  | "partite"
  | "punti"
  | "assist"
  | "rimbalzi"
  | "rubate"
  | "stoppate"
  | "triple"
  | "tre"
  | "campo"
  | "valutazione"
  | "plusminus"
  | "elo";

export interface StatDef {
  key: StatKey;
  label: string;
  short: string;
  /** Returns null when the player doesn't qualify (minimum games/attempts). */
  value: (s: PlayerStats, ctx: { elo: EloResult; start?: Date; end?: Date; allTime: boolean }) => number | null;
  format: (v: number) => string;
  note?: string;
}

const avg = (v: number) => v.toFixed(1);
const pctFmt = (v: number) => `${Math.round(v * 100)}%`;
const signedFmt = (v: number) => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1).replace("-", "−"));

export const STATS: StatDef[] = [
  { key: "vittorie", label: "Vittorie", short: "Vittorie", value: (s) => (s.games ? s.wins : null), format: String },
  { key: "winPct", label: "% vittorie", short: "% vitt.", value: (s) => (s.games >= 3 ? s.winPct : null), format: pctFmt, note: "Minimo 3 partite" },
  { key: "partite", label: "Partite giocate", short: "Partite", value: (s) => (s.games ? s.games : null), format: String },
  { key: "punti", label: "Punti a partita", short: "Punti", value: (s) => (s.statGames >= 2 ? s.avg.pts : null), format: avg, note: "Minimo 2 partite con tabellino" },
  { key: "assist", label: "Assist a partita", short: "Assist", value: (s) => (s.statGames >= 2 ? s.avg.ast : null), format: avg, note: "Minimo 2 partite con tabellino" },
  { key: "rimbalzi", label: "Rimbalzi a partita", short: "Rimbalzi", value: (s) => (s.statGames >= 2 ? s.rebAvg : null), format: avg, note: "Minimo 2 partite con tabellino" },
  { key: "rubate", label: "Rubate a partita", short: "Rubate", value: (s) => (s.statGames >= 2 ? s.avg.stl : null), format: avg, note: "Minimo 2 partite con tabellino" },
  { key: "stoppate", label: "Stoppate a partita", short: "Stoppate", value: (s) => (s.statGames >= 2 ? s.avg.blk : null), format: avg, note: "Minimo 2 partite con tabellino" },
  { key: "triple", label: "Triple segnate", short: "Triple", value: (s) => (s.totals.fg3m ? s.totals.fg3m : null), format: String },
  { key: "tre", label: "% da tre", short: "% da 3", value: (s) => (s.fg3Pct !== null && s.totals.fg3a >= 5 ? s.fg3Pct : null), format: pctFmt, note: "Minimo 5 tiri da tre" },
  { key: "campo", label: "% dal campo", short: "% campo", value: (s) => (s.fgPct !== null && s.fga >= 10 ? s.fgPct : null), format: pctFmt, note: "Minimo 10 tiri" },
  { key: "valutazione", label: "Valutazione media", short: "Valutaz.", value: (s) => (s.statGames >= 2 && s.effAvg !== null ? s.effAvg : null), format: avg, note: "Punti + rimbalzi + assist + rubate + stoppate − tiri sbagliati − perse" },
  { key: "plusminus", label: "Plus/minus medio", short: "+/−", value: (s) => (s.games >= 3 ? s.plusMinusAvg : null), format: signedFmt, note: "Differenza punti della squadra quando giochi, minimo 3 partite" },
  {
    key: "elo",
    label: "ELO",
    short: "ELO",
    value: (s, c) => {
      if (!s.games) return null;
      if (c.allTime) return Math.round(c.elo.ratings.get(s.playerId) ?? 1000);
      return eloDelta(c.elo, s.playerId, c.start, c.end);
    },
    format: (v) => String(Math.round(v)),
    note: "Nel periodo: variazione del punteggio",
  },
];

export const STAT_BY_KEY = new Map(STATS.map((s) => [s.key, s]));

export interface LeaderRow {
  playerId: string;
  value: number;
  rank: number;
}

export function leaderboard(
  stat: StatDef,
  stats: PlayerStats[],
  ctx: { elo: EloResult; start?: Date; end?: Date; allTime: boolean },
): LeaderRow[] {
  const rows = stats
    .map((s) => ({ playerId: s.playerId, value: stat.value(s, ctx) }))
    .filter((r): r is { playerId: string; value: number } => r.value !== null)
    .sort((a, b) => b.value - a.value);
  let rank = 0;
  let prev: number | null = null;
  return rows.map((r, i) => {
    if (prev === null || r.value !== prev) rank = i + 1;
    prev = r.value;
    return { ...r, rank };
  });
}
