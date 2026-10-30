import { minGamesFor } from "./awards";
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
  /**
   * Classifiche "a partita": per entrare servono abbastanza partite (con tabellino se
   * "statGames"), almeno `min` e almeno il 40% di quelle del più presente.
   */
  qualify?: { by: "games" | "statGames"; min: number };
  /**
   * Per le percentuali con un minimo di tiri: il valore anche sotto il minimo, così chi ha
   * tirato poco compare lo stesso (dopo gli altri) invece di sparire.
   */
  loose?: (s: PlayerStats) => { value: number; note: string } | null;
}

const avg = (v: number) => v.toFixed(1);
const pctFmt = (v: number) => `${Math.round(v * 100)}%`;
const signedFmt = (v: number) => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1).replace("-", "−"));

export const STATS: StatDef[] = [
  { key: "vittorie", label: "Vittorie", short: "Vittorie", value: (s) => (s.games ? s.wins : null), format: String },
  { key: "winPct", label: "% vittorie", short: "% vitt.", value: (s) => (s.games ? s.winPct : null), format: pctFmt, qualify: { by: "games", min: 3 } },
  { key: "partite", label: "Partite giocate", short: "Partite", value: (s) => (s.games ? s.games : null), format: String },
  { key: "punti", label: "Punti a partita", short: "Punti", value: (s) => (s.statGames ? s.avg.pts : null), format: avg, qualify: { by: "statGames", min: 2 } },
  { key: "assist", label: "Assist a partita", short: "Assist", value: (s) => (s.statGames ? s.avg.ast : null), format: avg, qualify: { by: "statGames", min: 2 } },
  { key: "rimbalzi", label: "Rimbalzi a partita", short: "Rimbalzi", value: (s) => (s.statGames ? s.rebAvg : null), format: avg, qualify: { by: "statGames", min: 2 } },
  { key: "rubate", label: "Rubate a partita", short: "Rubate", value: (s) => (s.statGames ? s.avg.stl : null), format: avg, qualify: { by: "statGames", min: 2 } },
  { key: "stoppate", label: "Stoppate a partita", short: "Stoppate", value: (s) => (s.statGames ? s.avg.blk : null), format: avg, qualify: { by: "statGames", min: 2 } },
  { key: "triple", label: "Triple segnate", short: "Triple", value: (s) => (s.statGames ? s.totals.fg3m : null), format: String },
  {
    key: "tre",
    label: "% da tre",
    short: "% da 3",
    value: (s) => (s.fg3Pct !== null && s.totals.fg3a >= 5 ? s.fg3Pct : null),
    format: pctFmt,
    note: "Servono almeno 5 tiri da tre",
    qualify: { by: "statGames", min: 2 },
    loose: (s) =>
      s.statGames && s.totals.fg3a < 5
        ? { value: s.totals.fg3a ? s.totals.fg3m / s.totals.fg3a : 0, note: s.totals.fg3a ? `solo ${s.totals.fg3a} ${s.totals.fg3a === 1 ? "tiro" : "tiri"} da tre` : "nessun tiro da tre" }
        : null,
  },
  {
    key: "campo",
    label: "% dal campo",
    short: "% campo",
    value: (s) => (s.fgPct !== null && s.fga >= 10 ? s.fgPct : null),
    format: pctFmt,
    note: "Servono almeno 10 tiri",
    qualify: { by: "statGames", min: 2 },
    loose: (s) => (s.statGames && s.fga < 10 ? { value: s.fga ? (s.fgPct ?? 0) : 0, note: s.fga ? `solo ${s.fga} ${s.fga === 1 ? "tiro" : "tiri"}` : "nessun tiro" } : null),
  },
  { key: "valutazione", label: "Valutazione media", short: "Valutaz.", value: (s) => (s.statGames && s.effAvg !== null ? s.effAvg : null), format: avg, note: "Punti, rimbalzi, assist, rubate e stoppate, meno tiri sbagliati e palle perse", qualify: { by: "statGames", min: 2 } },
  { key: "plusminus", label: "Plus/minus medio", short: "+/−", value: (s) => (s.games ? s.plusMinusAvg : null), format: signedFmt, note: "Differenza punti della squadra quando giochi", qualify: { by: "games", min: 3 } },
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
    note: "Nel mese o nella stagione conta quanto è salito o sceso",
  },
];

export const STAT_BY_KEY = new Map(STATS.map((s) => [s.key, s]));

export interface LeaderRow {
  playerId: string;
  value: number;
  rank: number;
}

export interface PendingRow {
  playerId: string;
  value: number;
  /** Partite che mancano per entrare in classifica. */
  missing: number;
}

export interface LooseRow {
  playerId: string;
  value: number;
  note: string;
}

export interface Leaderboard {
  rows: LeaderRow[];
  /** Hanno giocato ma non hanno ancora i tiri minimi: si mostrano dopo gli altri. */
  loose: LooseRow[];
  /** Chi ha giocato troppo poco per una classifica "a partita". */
  pending: PendingRow[];
  /** Partite minime richieste (null se la classifica conta i totali). */
  minGames: number | null;
}

export function leaderboard(
  stat: StatDef,
  stats: PlayerStats[],
  ctx: { elo: EloResult; start?: Date; end?: Date; allTime: boolean },
): Leaderboard {
  const valued = stats
    .map((s) => ({ s, value: stat.value(s, ctx) }))
    .filter((r): r is { s: PlayerStats; value: number } => r.value !== null);
  const q = stat.qualify;
  const games = (s: PlayerStats) => (q?.by === "statGames" ? s.statGames : s.games);
  const minGames = q ? minGamesFor(Math.max(0, ...stats.map(games)), q.min) : null;
  const ok = valued.filter((r) => minGames === null || games(r.s) >= minGames).sort((a, b) => b.value - a.value);
  const pending =
    minGames === null
      ? []
      : valued
          .filter((r) => games(r.s) < minGames)
          .sort((a, b) => games(b.s) - games(a.s) || b.value - a.value)
          .map((r) => ({ playerId: r.s.playerId, value: r.value, missing: minGames - games(r.s) }));
  let rank = 0;
  let prev: number | null = null;
  const rows = ok.map((r, i) => {
    if (prev === null || r.value !== prev) rank = i + 1;
    prev = r.value;
    return { playerId: r.s.playerId, value: r.value, rank };
  });
  const inRows = new Set(rows.map((r) => r.playerId));
  const inPending = new Set(pending.map((r) => r.playerId));
  const loose = stat.loose
    ? stats
        .filter((s) => !inRows.has(s.playerId) && !inPending.has(s.playerId))
        .map((s) => ({ playerId: s.playerId, l: stat.loose!(s) }))
        .filter((r): r is { playerId: string; l: { value: number; note: string } } => r.l !== null)
        .sort((a, b) => b.l.value - a.l.value)
        .map((r) => ({ playerId: r.playerId, value: r.l.value, note: r.l.note }))
    : [];
  return { rows, loose, pending, minGames };
}
