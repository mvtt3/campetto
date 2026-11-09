import { sortChrono } from "../periods";
import { winnerOf, type Match } from "../types";
import { teamOf } from "./player";

export interface TeammateLine {
  playerId: string;
  games: number;
  wins: number;
  winPct: number;
  /** Assists I gave to this teammate (from video events). */
  assistsTo: number;
  /** Assists this teammate gave to me. */
  assistsFrom: number;
}

export function chemistry(playerId: string, matches: Match[]): TeammateLine[] {
  const map = new Map<string, TeammateLine>();
  for (const m of matches) {
    const t = teamOf(m, playerId);
    if (!t) continue;
    const won = winnerOf(m) === t;
    for (const p of m.players) {
      if (p.playerId === playerId || p.team !== t) continue;
      const line =
        map.get(p.playerId) ??
        ({
          playerId: p.playerId,
          games: 0,
          wins: 0,
          winPct: 0,
          assistsTo: 0,
          assistsFrom: 0,
        } as TeammateLine);
      line.games++;
      if (won) line.wins++;
      map.set(p.playerId, line);
    }
    for (const e of m.events) {
      if (e.kind !== "ast" || !e.targetPlayerId) continue;
      if (e.playerId === playerId && map.has(e.targetPlayerId))
        map.get(e.targetPlayerId)!.assistsTo++;
      if (e.targetPlayerId === playerId && map.has(e.playerId))
        map.get(e.playerId)!.assistsFrom++;
    }
  }
  const out = [...map.values()];
  for (const l of out) l.winPct = l.games ? l.wins / l.games : 0;
  return out.sort((a, b) => b.winPct - a.winPct || b.games - a.games);
}

export interface PairLine {
  a: string;
  b: string;
  games: number;
  wins: number;
  winPct: number;
}

/** Best duo of the group: highest win% together, with a minimum number of games. */
export function bestPairs(matches: Match[], minGames = 3): PairLine[] {
  const map = new Map<string, PairLine>();
  for (const m of matches) {
    const w = winnerOf(m);
    for (const team of ["A", "B"] as const) {
      const ids = m.players
        .filter((p) => p.team === team)
        .map((p) => p.playerId)
        .sort();
      for (let i = 0; i < ids.length; i++)
        for (let j = i + 1; j < ids.length; j++) {
          const key = `${ids[i]}|${ids[j]}`;
          const l = map.get(key) ?? {
            a: ids[i],
            b: ids[j],
            games: 0,
            wins: 0,
            winPct: 0,
          };
          l.games++;
          if (w === team) l.wins++;
          map.set(key, l);
        }
    }
  }
  const out = [...map.values()].filter((l) => l.games >= minGames);
  for (const l of out) l.winPct = l.wins / l.games;
  return out.sort((x, y) => y.winPct - x.winPct || y.games - x.games);
}

export interface HeadToHead {
  games: number;
  winsA: number;
  winsB: number;
  lastMatchId: string | null;
}

/** Record of `a` vs `b` when they played on opposite teams. */
export function headToHead(a: string, b: string, matches: Match[]): HeadToHead {
  let games = 0;
  let winsA = 0;
  let winsB = 0;
  let last: Match | null = null;
  for (const m of matches) {
    const ta = teamOf(m, a);
    const tb = teamOf(m, b);
    if (!ta || !tb || ta === tb) continue;
    games++;
    const w = winnerOf(m);
    if (w === ta) winsA++;
    else if (w === tb) winsB++;
    if (!last || m.playedAt > last.playedAt) last = m;
  }
  return { games, winsA, winsB, lastMatchId: last?.id ?? null };
}

export interface Rivalry {
  a: string;
  b: string;
  games: number;
  winsA: number;
  winsB: number;
}

/** Most frequent opposite-team pairings: the group's derbies. */
export function rivalries(matches: Match[], minGames = 3): Rivalry[] {
  const map = new Map<string, Rivalry>();
  for (const m of matches) {
    const w = winnerOf(m);
    const A = m.players.filter((p) => p.team === "A").map((p) => p.playerId);
    const B = m.players.filter((p) => p.team === "B").map((p) => p.playerId);
    for (const x of A)
      for (const y of B) {
        const [a, b] = x < y ? [x, y] : [y, x];
        const key = `${a}|${b}`;
        const r = map.get(key) ?? { a, b, games: 0, winsA: 0, winsB: 0 };
        r.games++;
        const aTeam = A.includes(a) ? "A" : "B";
        if (w === aTeam) r.winsA++;
        else if (w) r.winsB++;
        map.set(key, r);
      }
  }
  return [...map.values()]
    .filter((r) => r.games >= minGames)
    .sort(
      (x, y) =>
        y.games - x.games ||
        Math.abs(x.winsA - x.winsB) - Math.abs(y.winsA - y.winsB),
    );
}

export interface StreakInfo {
  current: number; // positive = wins in a row, negative = losses in a row
  bestWin: number;
}

export function streaks(playerId: string, matches: Match[]): StreakInfo {
  let current = 0;
  let bestWin = 0;
  for (const m of sortChrono(matches)) {
    const t = teamOf(m, playerId);
    if (!t) continue;
    const w = winnerOf(m);
    if (!w) continue;
    if (w === t) current = current > 0 ? current + 1 : 1;
    else current = current < 0 ? current - 1 : -1;
    bestWin = Math.max(bestWin, current);
  }
  return { current, bestWin };
}

/** Last N results for a player, newest first. */
export function form(playerId: string, matches: Match[], n = 5): ("V" | "S")[] {
  return sortChrono(matches)
    .filter((m) => teamOf(m, playerId))
    .slice(-n)
    .reverse()
    .map((m) => (winnerOf(m) === teamOf(m, playerId) ? "V" : "S"));
}

export interface TeamRecord {
  /** I giocatori della squadra, in ordine stabile (cambi compresi). */
  ids: string[];
  /** Chi entrava come cambio. */
  subs: string[];
  games: number;
  wins: number;
  losses: number;
  winPct: number;
  lastPlayed: string;
}

/** Quante partite servono insieme per entrare nella classifica delle squadre. */
export const TEAM_MIN_GAMES = 2;

/**
 * Il record delle squadre: gli stessi giocatori, insieme, in un formato (2 contro 2,
 * 3 contro 3…). Conta solo vinte e perse. Prima chi ha più vittorie che sconfitte,
 * a pari saldo la percentuale migliore, poi chi ha giocato di più.
 */
export function teamRecords(
  matches: Match[],
  format: Match["format"],
  minGames = TEAM_MIN_GAMES,
): TeamRecord[] {
  const map = new Map<string, TeamRecord>();
  for (const m of matches) {
    if (m.format !== format) continue;
    const w = winnerOf(m);
    if (!w) continue;
    for (const team of ["A", "B"] as const) {
      const line = m.players.filter((p) => p.team === team);
      // Con i cambi è un'altra squadra: conta chi c'era, titolari prima.
      const ids = [...line]
        .sort(
          (x, y) =>
            Number(!!x.sub) - Number(!!y.sub) ||
            x.playerId.localeCompare(y.playerId),
        )
        .map((p) => p.playerId);
      if (!ids.length) continue;
      const subs = line.filter((p) => p.sub).map((p) => p.playerId);
      const key =
        [...ids].sort().join("|") +
        (subs.length ? `|cambi:${[...subs].sort().join(",")}` : "");
      const r = map.get(key) ?? {
        ids,
        subs,
        games: 0,
        wins: 0,
        losses: 0,
        winPct: 0,
        lastPlayed: m.playedAt,
      };
      r.games++;
      if (w === team) r.wins++;
      else r.losses++;
      if (m.playedAt > r.lastPlayed) r.lastPlayed = m.playedAt;
      map.set(key, r);
    }
  }
  const out = [...map.values()].filter((r) => r.games >= minGames);
  for (const r of out) r.winPct = r.wins / r.games;
  return out.sort(
    (x, y) =>
      y.wins - y.losses - (x.wins - x.losses) ||
      y.winPct - x.winPct ||
      y.games - x.games ||
      y.lastPlayed.localeCompare(x.lastPlayed),
  );
}
