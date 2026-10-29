import { monthKey, monthOf, sortChrono } from "../periods";
import { winnerOf, type BoxKey, type Match, type Team } from "../types";
import { normalizeBox, teamOf } from "./player";

/** Running score from video events, in order. */
export function scoreTimeline(m: Match): { a: number; b: number }[] {
  const teamOfPlayer = new Map(m.players.map((p) => [p.playerId, p.team]));
  let a = 0;
  let b = 0;
  const out: { a: number; b: number }[] = [];
  for (const e of [...m.events].sort((x, y) => x.seq - y.seq)) {
    const pts = e.kind === "2pt" ? 2 : e.kind === "3pt" ? 3 : 0;
    if (!pts) continue;
    if (teamOfPlayer.get(e.playerId) === "A") a += pts;
    else b += pts;
    out.push({ a, b });
  }
  return out;
}

/** Largest deficit the winning team came back from (0 when unknown or never behind). */
export function comebackSize(m: Match): number {
  const w = winnerOf(m);
  if (!w) return 0;
  let worst = 0;
  for (const s of scoreTimeline(m)) {
    const diff = w === "A" ? s.b - s.a : s.a - s.b;
    worst = Math.max(worst, diff);
  }
  return worst;
}

export interface GroupRecord {
  key: string;
  label: string;
  value: number;
  display: string;
  playerIds: string[];
  matchId: string | null;
  date: string | null;
}

const SINGLE_GAME: { key: BoxKey | "reb"; label: string; unit: string }[] = [
  { key: "pts", label: "Più punti in una partita", unit: "punti" },
  { key: "ast", label: "Più assist in una partita", unit: "assist" },
  { key: "reb", label: "Più rimbalzi in una partita", unit: "rimbalzi" },
  { key: "fg3m", label: "Più triple in una partita", unit: "triple" },
  { key: "stl", label: "Più rubate in una partita", unit: "rubate" },
  { key: "blk", label: "Più stoppate in una partita", unit: "stoppate" },
];

export function groupRecords(matches: Match[]): GroupRecord[] {
  const out: GroupRecord[] = [];
  const chrono = sortChrono(matches);

  for (const def of SINGLE_GAME) {
    let best: GroupRecord | null = null;
    for (const m of chrono) {
      for (const p of m.players) {
        if (!p.hasStats) continue;
        const b = normalizeBox(p.box);
        const v = def.key === "reb" ? b.oreb + b.dreb : b[def.key];
        if (v <= 0) continue;
        // Ties keep the first to reach it: the record holder is who set it.
        if (!best || v > best.value)
          best = {
            key: def.key,
            label: def.label,
            value: v,
            display: `${v} ${def.unit}`,
            playerIds: [p.playerId],
            matchId: m.id,
            date: m.playedAt,
          };
      }
    }
    if (best) out.push(best);
  }

  // Longest win streak
  const ids = new Set(chrono.flatMap((m) => m.players.map((p) => p.playerId)));
  let streakBest: GroupRecord | null = null;
  for (const id of ids) {
    let cur = 0;
    for (const m of chrono) {
      const t = teamOf(m, id);
      if (!t) continue;
      cur = winnerOf(m) === t ? cur + 1 : 0;
      if (cur >= 2 && (!streakBest || cur > streakBest.value))
        streakBest = {
          key: "streak",
          label: "Serie di vittorie più lunga",
          value: cur,
          display: `${cur} di fila`,
          playerIds: [id],
          matchId: m.id,
          date: m.playedAt,
        };
    }
  }
  if (streakBest) out.push(streakBest);

  // Biggest comeback, biggest margin, closest game
  let comeback: GroupRecord | null = null;
  let blowout: GroupRecord | null = null;
  let closest: GroupRecord | null = null;
  for (const m of chrono) {
    const w = winnerOf(m);
    if (!w) continue;
    const winners = m.players.filter((p) => p.team === w).map((p) => p.playerId);
    const c = comebackSize(m);
    if (c >= 3 && (!comeback || c > comeback.value))
      comeback = {
        key: "comeback",
        label: "Rimonta più grande",
        value: c,
        display: `da −${c}`,
        playerIds: winners,
        matchId: m.id,
        date: m.playedAt,
      };
    const margin = Math.abs(m.scoreA - m.scoreB);
    const score = `${Math.max(m.scoreA, m.scoreB)}–${Math.min(m.scoreA, m.scoreB)}`;
    if (!blowout || margin > blowout.value)
      blowout = {
        key: "blowout",
        label: "Vittoria più netta",
        value: margin,
        display: score,
        playerIds: winners,
        matchId: m.id,
        date: m.playedAt,
      };
    if (!closest || margin < closest.value)
      closest = {
        key: "closest",
        label: "Partita più combattuta",
        value: margin,
        display: score,
        playerIds: winners,
        matchId: m.id,
        date: m.playedAt,
      };
  }
  if (comeback) out.push(comeback);
  if (blowout) out.push(blowout);
  if (closest) out.push(closest);

  // Most games in a single month
  const perMonth = new Map<string, Map<string, number>>();
  for (const m of chrono) {
    const { year, month } = monthOf(m.playedAt);
    const k = monthKey(year, month);
    if (!perMonth.has(k)) perMonth.set(k, new Map());
    for (const p of m.players) perMonth.get(k)!.set(p.playerId, (perMonth.get(k)!.get(p.playerId) ?? 0) + 1);
  }
  let busiest: GroupRecord | null = null;
  for (const [k, counts] of perMonth)
    for (const [id, n] of counts)
      if (!busiest || n > busiest.value)
        busiest = {
          key: "busiest",
          label: "Più partite in un mese",
          value: n,
          display: `${n} partite`,
          playerIds: [id],
          matchId: null,
          date: `${k}-01`,
        };
  if (busiest) out.push(busiest);

  return out;
}

export function teamPlayers(m: Match, t: Team): string[] {
  return m.players.filter((p) => p.team === t).map((p) => p.playerId);
}
