import { sortChrono } from "../periods";
import { TEAM_SIZE, type Match } from "../types";

export const ELO_START = 1000;
export const ELO_K = 32;

export interface EloPoint {
  matchId: string;
  date: string;
  before: number;
  after: number;
}

export interface EloResult {
  ratings: Map<string, number>;
  history: Map<string, EloPoint[]>;
}

export function expectedScore(ra: number, rb: number): number {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

/**
 * Margin multiplier: a 21-20 win moves ratings less than a 21-5 win.
 * ln(margin+1)/ln(11) clamped to [0.6, 1.4], so a 10-point margin is neutral.
 */
export function marginMultiplier(margin: number): number {
  const m = Math.log(Math.abs(margin) + 1) / Math.log(11);
  return Math.min(1.4, Math.max(0.6, m));
}

/**
 * K is full in 1v1; in team games the team's swing is spread over its players
 * (each gets K/√teamSize), so a single 4v4 win does not count like a 1v1.
 */
export function playerK(teamSize: number): number {
  return ELO_K / Math.sqrt(Math.max(1, teamSize));
}

function avg(ids: string[], ratings: Map<string, number>): number {
  if (!ids.length) return ELO_START;
  return ids.reduce((s, id) => s + (ratings.get(id) ?? ELO_START), 0) / ids.length;
}

export function computeElo(matches: Match[], playerIds: string[] = []): EloResult {
  const ratings = new Map<string, number>();
  const history = new Map<string, EloPoint[]>();
  for (const id of playerIds) {
    ratings.set(id, ELO_START);
    history.set(id, []);
  }

  for (const m of sortChrono(matches)) {
    if (m.scoreA === m.scoreB) continue;
    const a = m.players.filter((p) => p.team === "A").map((p) => p.playerId);
    const b = m.players.filter((p) => p.team === "B").map((p) => p.playerId);
    if (!a.length || !b.length) continue;
    const ra = avg(a, ratings);
    const rb = avg(b, ratings);
    const ea = expectedScore(ra, rb);
    const sa = m.scoreA > m.scoreB ? 1 : 0;
    const mult = marginMultiplier(m.scoreA - m.scoreB);
    const size = TEAM_SIZE[m.format] ?? Math.max(a.length, b.length);
    const k = playerK(size) * mult;
    const deltaA = k * (sa - ea);

    for (const [ids, delta] of [
      [a, deltaA],
      [b, -deltaA],
    ] as const) {
      // Con i cambi si gioca a turno: ognuno sta in campo meno, e prende la sua parte.
      const share = Math.min(1, size / ids.length);
      for (const id of ids) {
        const before = ratings.get(id) ?? ELO_START;
        const after = before + delta * share;
        ratings.set(id, after);
        if (!history.has(id)) history.set(id, []);
        history.get(id)!.push({ matchId: m.id, date: m.playedAt, before, after });
      }
    }
  }
  return { ratings, history };
}

export function eloOf(r: EloResult, id: string): number {
  return Math.round(r.ratings.get(id) ?? ELO_START);
}

/** Sum of rating changes for matches inside [start, end). */
export function eloDelta(r: EloResult, id: string, start?: Date, end?: Date): number {
  const pts = r.history.get(id) ?? [];
  return pts
    .filter((p) => {
      const t = new Date(p.date).getTime();
      return (!start || t >= start.getTime()) && (!end || t < end.getTime());
    })
    .reduce((s, p) => s + (p.after - p.before), 0);
}

export function winProbability(teamA: string[], teamB: string[], ratings: Map<string, number>): number {
  return expectedScore(avg(teamA, ratings), avg(teamB, ratings));
}

/** Ratings at the end of each month (for the trend chart). */
export function eloByMonth(r: EloResult, id: string): { key: string; value: number }[] {
  const out = new Map<string, number>();
  for (const p of r.history.get(id) ?? []) {
    const d = new Date(p.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.set(key, p.after);
  }
  return [...out.entries()].map(([key, value]) => ({ key, value: Math.round(value) }));
}
