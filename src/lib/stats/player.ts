import {
  BOX_KEYS,
  emptyBox,
  winnerOf,
  type Box,
  type Match,
  type MatchPlayer,
} from "../types";

export interface PlayerStats {
  playerId: string;
  games: number;
  wins: number;
  losses: number;
  winPct: number; // 0..1
  /** Games in which this player has a box score. Averages use this as the denominator. */
  statGames: number;
  totals: Box;
  avg: Box;
  reb: number;
  rebAvg: number;
  fgm: number;
  fga: number;
  fgPct: number | null;
  fg3Pct: number | null;
  fg2Pct: number | null;
  efgPct: number | null;
  tsPct: number | null;
  plusMinus: number;
  plusMinusAvg: number;
  eff: number;
  effAvg: number | null;
  astTov: number | null;
  pointsFor: number;
  pointsAgainst: number;
}

/** NBA efficiency: PTS + REB + AST + STL + BLK − missed FG − TOV. */
export function efficiency(b: Box): number {
  const missed = b.fg2a - b.fg2m + (b.fg3a - b.fg3m);
  return b.pts + b.oreb + b.dreb + b.ast + b.stl + b.blk - missed - b.tov;
}

/**
 * Points from the shot breakdown when the 2-point data is there, otherwise the
 * stored points (an import may only give points and threes).
 */
export function normalizeBox(b: Box): Box {
  const fromShots = b.fg2m * 2 + b.fg3m * 3;
  const pts = b.fg2m + b.fg2a > 0 ? fromShots : Math.max(b.pts, fromShots);
  return {
    ...b,
    pts,
    fg2a: Math.max(b.fg2a, b.fg2m),
    fg3a: Math.max(b.fg3a, b.fg3m),
  };
}

/** True when the shot breakdown fully explains the points: only then shooting % are reliable. */
export function shotsComplete(b: Box): boolean {
  return b.fg2a + b.fg3a > 0 && b.fg2m * 2 + b.fg3m * 3 === b.pts;
}

export function ratio(num: number, den: number): number | null {
  return den > 0 ? num / den : null;
}

export function playerLine(
  m: Match,
  playerId: string,
): MatchPlayer | undefined {
  return m.players.find((p) => p.playerId === playerId);
}

export function teamOf(m: Match, playerId: string) {
  return playerLine(m, playerId)?.team ?? null;
}

export function didWin(m: Match, playerId: string): boolean | null {
  const t = teamOf(m, playerId);
  if (!t) return null;
  const w = winnerOf(m);
  if (!w) return null;
  return w === t;
}

export function computePlayerStats(
  playerId: string,
  matches: Match[],
): PlayerStats {
  const totals = emptyBox();
  let games = 0;
  let wins = 0;
  let statGames = 0;
  let plusMinus = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;
  const shots = { fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0, pts: 0 };

  for (const m of matches) {
    const line = playerLine(m, playerId);
    if (!line) continue;
    games++;
    const mine = line.team === "A" ? m.scoreA : m.scoreB;
    const theirs = line.team === "A" ? m.scoreB : m.scoreA;
    pointsFor += mine;
    pointsAgainst += theirs;
    plusMinus += mine - theirs;
    if (mine > theirs) wins++;
    if (line.hasStats) {
      statGames++;
      const b = normalizeBox(line.box);
      for (const k of BOX_KEYS) totals[k] += b[k];
      if (shotsComplete(b)) {
        shots.fg2m += b.fg2m;
        shots.fg2a += b.fg2a;
        shots.fg3m += b.fg3m;
        shots.fg3a += b.fg3a;
        shots.pts += b.pts;
      }
    }
  }

  const avg = emptyBox();
  for (const k of BOX_KEYS) avg[k] = statGames ? totals[k] / statGames : 0;

  const fgm = shots.fg2m + shots.fg3m;
  const fga = shots.fg2a + shots.fg3a;
  const eff = efficiency(totals);
  const reb = totals.oreb + totals.dreb;

  return {
    playerId,
    games,
    wins,
    losses: games - wins,
    winPct: games ? wins / games : 0,
    statGames,
    totals,
    avg,
    reb,
    rebAvg: statGames ? reb / statGames : 0,
    fgm,
    fga,
    fgPct: ratio(fgm, fga),
    fg3Pct: ratio(shots.fg3m, shots.fg3a),
    fg2Pct: ratio(shots.fg2m, shots.fg2a),
    efgPct: ratio(fgm + 0.5 * shots.fg3m, fga),
    // No free throws on the playground: TS% = PTS / (2·FGA)
    tsPct: ratio(shots.pts, 2 * fga),
    plusMinus,
    plusMinusAvg: games ? plusMinus / games : 0,
    eff,
    effAvg: statGames ? eff / statGames : null,
    astTov:
      totals.tov > 0
        ? totals.ast / totals.tov
        : totals.ast > 0
          ? totals.ast
          : null,
    pointsFor,
    pointsAgainst,
  };
}

export function computeAllStats(
  playerIds: string[],
  matches: Match[],
): Map<string, PlayerStats> {
  const map = new Map<string, PlayerStats>();
  for (const id of playerIds) map.set(id, computePlayerStats(id, matches));
  return map;
}

/** Sum of the team's points from box scores, used to sanity-check the final score. */
export function teamBoxPoints(
  m: Pick<Match, "players">,
  team: "A" | "B",
): number | null {
  const lines = m.players.filter((p) => p.team === team);
  if (!lines.length || lines.some((l) => !l.hasStats)) return null;
  return lines.reduce((s, l) => s + normalizeBox(l.box).pts, 0);
}

/** Box score for each player, rebuilt from the actions tagged on the video. */
export function boxesFromEvents(
  events: { playerId: string; kind: import("../types").EventKind }[],
  playerIds: string[],
): Record<string, Box> {
  const out: Record<string, Box> = Object.fromEntries(
    playerIds.map((id) => [id, emptyBox()]),
  );
  for (const e of events) {
    const b = out[e.playerId];
    if (!b) continue;
    switch (e.kind) {
      case "2pt":
        b.fg2m++;
        b.fg2a++;
        b.pts += 2;
        break;
      case "3pt":
        b.fg3m++;
        b.fg3a++;
        b.pts += 3;
        break;
      case "miss2":
        b.fg2a++;
        break;
      case "miss3":
        b.fg3a++;
        break;
      case "oreb":
        b.oreb++;
        break;
      case "dreb":
        b.dreb++;
        break;
      case "ast":
        b.ast++;
        break;
      case "stl":
        b.stl++;
        break;
      case "blk":
        b.blk++;
        break;
      case "tov":
        b.tov++;
        break;
      case "foul":
        b.fouls++;
        break;
    }
  }
  return out;
}

/** Le voci che contano per doppia e tripla doppia (come nell'NBA). */
export const DOUBLE_KEYS = ["pts", "reb", "ast", "stl", "blk"] as const;

/** In quante voci tra punti, rimbalzi, assist, rubate e stoppate è arrivato ad almeno 10. */
export function doubleDigits(b: Box): (typeof DOUBLE_KEYS)[number][] {
  const n = normalizeBox(b);
  const v = {
    pts: n.pts,
    reb: n.oreb + n.dreb,
    ast: n.ast,
    stl: n.stl,
    blk: n.blk,
  };
  return DOUBLE_KEYS.filter((k) => v[k] >= 10);
}

/**
 * Punti difesa a partita: rubate e stoppate valgono 1 (tolgono la palla agli altri),
 * un rimbalzo in difesa mezzo punto (chiude l'azione degli avversari). Così il miglior
 * difensore non è solo chi stoppa, ma anche chi ruba e chi pulisce il tabellone.
 */
export function defenseAvg(s: PlayerStats): number {
  return s.avg.stl + s.avg.blk + 0.5 * s.avg.dreb;
}
