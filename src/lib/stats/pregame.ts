/**
 * L'anteprima della partita: la sera prima o la mattina, a chi ha detto "Ci sono", uno o tre
 * obiettivi alla portata in una sola partita. Come le "milestones to watch" dell'NBA e le
 * leghe di Duolingo: un numero preciso, una persona da passare, mai un rimprovero.
 *
 * Tutto si basa su quello che si sa adesso: per le medie, chi va passato resta alla sua media
 * (vale anche se gioca e fa la sua solita partita); per i totali, chi gioca può allungare,
 * e la scheda lo dice.
 */
import { leaderboard, STAT_BY_KEY } from "./leaderboards";
import { computePlayerStats, normalizeBox } from "./player";
import { groupRecords } from "./records";
import { filterMatches, MONTHS_IT, type Period } from "../periods";
import { CONFIRM_MIN } from "../proposals";
import type { Format, Match, Proposal } from "../types";
import type { EloResult } from "./elo";

/** Le statistiche che si possono inseguire in una partita. */
export type PregameStat =
  | "punti"
  | "rimbalzi"
  | "assist"
  | "rubate"
  | "stoppate"
  | "triple"
  | "campo"
  | "vittorie"
  | "partite";

const UNIT: Record<PregameStat, [one: string, many: string]> = {
  punti: ["punto", "punti"],
  rimbalzi: ["rimbalzo", "rimbalzi"],
  assist: ["assist", "assist"],
  rubate: ["rubata", "rubate"],
  stoppate: ["stoppata", "stoppate"],
  triple: ["tripla", "triple"],
  campo: ["tiro", "tiri"],
  vittorie: ["vittoria", "vittorie"],
  partite: ["partita", "partite"],
};
export const unitOf = (s: PregameStat, n: number) => UNIT[s][n === 1 ? 0 : 1];

export interface PregameScope {
  key: "formato" | "mese" | "sempre";
  /** "3v3", "Novembre", "Sempre": come nei filtri delle classifiche. */
  label: string;
}

export interface PregameTarget {
  id: string;
  kind: "sorpasso" | "traguardo" | "record";
  stat: PregameStat;
  /** Quanto fare: 7 (rimbalzi). Per il tiro, i canestri su `attempts` tiri. */
  need: number;
  attempts?: number;
  /** Quanto conta: si mostra il più alto, poi altri due di statistiche diverse. */
  score: number;
  /** Sorpasso: chi passi, in quale classifica, e dove arrivi. */
  board?: {
    label: string;
    scope: PregameScope;
    rivalId: string;
    rivalRank: number;
    rivalValue: number;
    /** Gioca anche lui: per i totali può allungare. */
    rivalPlays: boolean;
    myRank: number;
    myValue: number;
    after: number;
    afterRank: number;
    /** Medie e percentuali: il valore si scrive con i decimali o in %. */
    kind: "media" | "totale" | "percentuale";
  };
  /** Traguardo e record: da dove parti, dove arrivi. */
  bar?: {
    from: number;
    to: number;
    holderIds?: string[];
    record?: number;
    /** Traguardi: quanto fai di solito in una partita (per le vittorie, la % di vinte). */
    usual?: number;
  };
}

/**
 * La partita di cui mostrare l'anteprima: aperta, con il tuo "Ci sono" e almeno 4 sì,
 * dalle 18 del giorno prima fino all'inizio. La più vicina.
 */
export function previewProposal(
  proposals: Proposal[],
  meId: string,
  now: Date,
): Proposal | null {
  const t = now.getTime();
  return (
    proposals
      .filter((p) => {
        if (p.status !== "aperta") return false;
        if (p.responses.find((r) => r.playerId === meId)?.response !== "si")
          return false;
        if (p.responses.filter((r) => r.response === "si").length < CONFIRM_MIN)
          return false;
        const start = new Date(p.startsAt);
        const day = new Date(start);
        day.setHours(0, 0, 0, 0);
        const from = day.getTime() - 6 * 3_600_000; // le 18 del giorno prima
        return t >= from && t < start.getTime();
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null
  );
}

const AVG_STATS: { stat: PregameStat; key: "punti" | "rimbalzi" | "assist" | "rubate" | "stoppate"; weight: number }[] = [
  { stat: "punti", key: "punti", weight: 4 },
  { stat: "rimbalzi", key: "rimbalzi", weight: 4 },
  { stat: "assist", key: "assist", weight: 4 },
  { stat: "rubate", key: "rubate", weight: 1 },
  { stat: "stoppate", key: "stoppate", weight: 1 },
];

/** Il valore di una statistica in una partita. */
function inGame(stat: PregameStat, box: Match["players"][number]["box"]): number {
  const b = normalizeBox(box);
  switch (stat) {
    case "punti":
      return b.pts;
    case "rimbalzi":
      return b.oreb + b.dreb;
    case "assist":
      return b.ast;
    case "rubate":
      return b.stl;
    case "stoppate":
      return b.blk;
    case "triple":
      return b.fg3m;
    case "campo":
      return b.fg2m + b.fg3m;
    default:
      return 0;
  }
}

const MILESTONES_PTS = [50, 100, 150, 200, 250, 300, 400, 500, 600, 750, 1000, 1250, 1500, 2000];
const MILESTONES = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000];

interface PregameInput {
  meId: string;
  playerIds: string[];
  matches: Match[];
  proposal: Proposal;
  elo: EloResult;
}

/** Il più forte prima; poi al massimo altri due, di statistiche diverse. */
export function pregameTargets(opts: PregameInput): PregameTarget[] {
  const picked: PregameTarget[] = [];
  for (const t of pregameCandidates(opts).sort((a, b) => b.score - a.score)) {
    if (picked.some((p) => p.stat === t.stat)) continue;
    picked.push(t);
    if (picked.length === 3) break;
  }
  return picked;
}

/** Tutti gli obiettivi alla portata, non ancora scelti né ordinati. */
export function pregameCandidates(opts: PregameInput): PregameTarget[] {
  const { meId, playerIds, matches, proposal, elo } = opts;
  const playing = new Set(
    proposal.responses.filter((r) => r.response === "si").map((r) => r.playerId),
  );
  const start = new Date(proposal.startsAt);
  const month: Period = { kind: "month", year: start.getFullYear(), month: start.getMonth() };
  const scopes: (PregameScope & { matches: Match[] })[] = [
    ...(proposal.format
      ? [{ key: "formato" as const, label: proposal.format as Format as string, matches: filterMatches(matches, { format: proposal.format }) }]
      : []),
    { key: "mese", label: MONTHS_IT[start.getMonth()], matches: filterMatches(matches, { period: month }) },
    { key: "sempre", label: "Sempre", matches },
  ];
  const scopeBonus = { formato: 3, mese: 2, sempre: 0 } as const;

  // Il tuo massimo in una partita, per ogni statistica: oltre non è "alla portata".
  const mine = matches.flatMap((m) =>
    m.players.filter((p) => p.playerId === meId && p.hasStats),
  );
  const best = (stat: PregameStat) =>
    Math.max(0, ...mine.map((p) => inGame(stat, p.box)));

  const out: PregameTarget[] = [];

  for (const scope of scopes) {
    const stats = playerIds.map((id) => computePlayerStats(id, scope.matches));
    const me = stats.find((s) => s.playerId === meId);
    if (!me || !me.games) continue;
    const ctx = { elo, allTime: true };

    // 1. Le medie a partita: x in una partita e la tua media supera la sua.
    for (const a of AVG_STATS) {
      const def = STAT_BY_KEY.get(a.key)!;
      const lb = leaderboard(def, stats, ctx);
      const row = lb.rows.find((r) => r.playerId === meId);
      if (!row || row.rank === 1) continue;
      const n = me.statGames;
      const sum = {
        punti: me.totals.pts,
        rimbalzi: me.reb,
        assist: me.totals.ast,
        rubate: me.totals.stl,
        stoppate: me.totals.blk,
      }[a.key];
      const avg = row.value;
      const top = best(a.stat);
      for (const rival of lb.rows.filter((r) => r.value > row.value)) {
        const x = Math.floor(rival.value * (n + 1) - sum + 1e-9) + 1;
        if (x < 1 || x > top) continue;
        const after = (sum + x) / (n + 1);
        const afterRank =
          1 + lb.rows.filter((r) => r.playerId !== meId && r.value > after).length;
        const ratio = x / Math.max(avg, 0.5);
        out.push({
          id: `s:${a.stat}:${scope.key}:${rival.playerId}`,
          kind: "sorpasso",
          stat: a.stat,
          need: x,
          score:
            60 +
            a.weight +
            scopeBonus[scope.key] +
            (afterRank === 1 ? 25 : afterRank <= 3 ? 12 : 0) -
            Math.max(0, ratio - 0.8) * 15,
          board: {
            label: def.label,
            scope,
            rivalId: rival.playerId,
            rivalRank: rival.rank,
            rivalValue: rival.value,
            rivalPlays: playing.has(rival.playerId),
            myRank: row.rank,
            myValue: avg,
            after,
            afterRank,
            kind: "media",
          },
        });
      }
    }

    // 2. Il tiro: segnane y su t (i tiri che prendi di solito) e la percentuale lo passa.
    {
      const def = STAT_BY_KEY.get("campo")!;
      const lb = leaderboard(def, stats, ctx);
      const row = lb.rows.find((r) => r.playerId === meId);
      if (row && row.rank > 1 && me.statGames) {
        const t = Math.max(3, Math.round(me.fga / me.statGames));
        const rival = [...lb.rows].reverse().find((r) => r.value > row.value);
        if (rival) {
          let y = -1;
          for (let k = 0; k <= t; k++)
            if ((me.fgm + k) / (me.fga + t) > rival.value + 1e-9) {
              y = k;
              break;
            }
          const pct = me.fga ? me.fgm / me.fga : 0;
          if (y >= 0 && y / t <= Math.min(0.75, pct + 0.2) && y <= best("campo")) {
            const after = (me.fgm + y) / (me.fga + t);
            const afterRank =
              1 + lb.rows.filter((r) => r.playerId !== meId && r.value > after).length;
            out.push({
              id: `s:campo:${scope.key}:${rival.playerId}`,
              kind: "sorpasso",
              stat: "campo",
              need: y,
              attempts: t,
              score: 52 + scopeBonus[scope.key] + (afterRank <= 3 ? 8 : 0) - (y / t) * 10,
              board: {
                label: def.label,
                scope,
                rivalId: rival.playerId,
                rivalRank: rival.rank,
                rivalValue: rival.value,
                rivalPlays: playing.has(rival.playerId),
                myRank: row.rank,
                myValue: row.value,
                after,
                afterRank,
                kind: "percentuale",
              },
            });
          }
        }
      }
    }

    // 3. I totali: triple segnate (sempre) e vittorie (nel mese della partita).
    const totals: { stat: PregameStat; key: "triple" | "vittorie"; max: number; base: number }[] = [
      { stat: "triple", key: "triple", max: best("triple"), base: 50 },
      { stat: "vittorie", key: "vittorie", max: 3, base: 56 },
    ];
    for (const tot of totals) {
      if (tot.stat === "vittorie" && scope.key === "sempre") continue;
      if (tot.stat === "triple" && scope.key === "mese") continue;
      const def = STAT_BY_KEY.get(tot.key)!;
      const lb = leaderboard(def, stats, ctx);
      const row = lb.rows.find((r) => r.playerId === meId);
      if (!row || row.rank === 1) continue;
      const rival = [...lb.rows].reverse().find((r) => r.value > row.value);
      if (!rival) continue;
      const x = rival.value - row.value + 1;
      if (x > tot.max) continue;
      const after = row.value + x;
      const afterRank =
        1 + lb.rows.filter((r) => r.playerId !== meId && r.value > after).length;
      out.push({
        id: `s:${tot.stat}:${scope.key}:${rival.playerId}`,
        kind: "sorpasso",
        stat: tot.stat,
        need: x,
        score:
          tot.base +
          scopeBonus[scope.key] +
          (afterRank === 1 ? 20 : afterRank <= 3 ? 10 : 0) -
          x * 4 -
          (playing.has(rival.playerId) ? 4 : 0),
        board: {
          label: def.label,
          scope,
          rivalId: rival.playerId,
          rivalRank: rival.rank,
          rivalValue: rival.value,
          rivalPlays: playing.has(rival.playerId),
          myRank: row.rank,
          myValue: row.value,
          after,
          afterRank,
          kind: "totale",
        },
      });
    }
  }

  // 4. I traguardi tondi, da quando giochi: 100 punti, 50 rimbalzi, la 25ª partita.
  const all = computePlayerStats(meId, matches);
  if (all.games) {
    const per = (v: number) => (all.statGames ? v / all.statGames : 0);
    const totalsNow: { stat: PregameStat; total: number; perGame: number; slack: number }[] = [
      { stat: "punti", total: all.totals.pts, perGame: per(all.totals.pts), slack: 0 },
      { stat: "rimbalzi", total: all.reb, perGame: per(all.reb), slack: 0 },
      { stat: "assist", total: all.totals.ast, perGame: per(all.totals.ast), slack: 0 },
      { stat: "rubate", total: all.totals.stl, perGame: per(all.totals.stl), slack: 0 },
      { stat: "stoppate", total: all.totals.blk, perGame: per(all.totals.blk), slack: 0 },
      { stat: "triple", total: all.totals.fg3m, perGame: per(all.totals.fg3m), slack: 0 },
      { stat: "vittorie", total: all.wins, perGame: 1, slack: 1 },
      { stat: "partite", total: all.games, perGame: 1, slack: 1 },
    ];
    for (const t of totalsNow) {
      if (t.stat !== "vittorie" && t.stat !== "partite" && !all.statGames) continue;
      const list = t.stat === "punti" ? MILESTONES_PTS : MILESTONES;
      const next = list.find((m) => m > t.total);
      if (!next) continue;
      const gap = next - t.total;
      const reach = Math.max(1, Math.round(t.perGame)) + t.slack;
      if (gap > reach) continue;
      out.push({
        id: `t:${t.stat}:${next}`,
        kind: "traguardo",
        stat: t.stat,
        need: gap,
        score: 44 + (next % 100 === 0 ? 8 : next % 50 === 0 ? 4 : 0) - (gap / reach) * 6,
        bar: {
          from: t.total,
          to: next,
          usual: t.stat === "vittorie" ? all.winPct : t.stat === "partite" ? undefined : t.perGame,
        },
      });
    }
  }

  // 5. I record del gruppo in una partita, quando il tuo massimo è lì vicino.
  const recStat: Record<string, PregameStat> = {
    pts: "punti",
    reb: "rimbalzi",
    ast: "assist",
    stl: "rubate",
    blk: "stoppate",
    fg3m: "triple",
  };
  for (const r of groupRecords(matches)) {
    const stat = recStat[r.key];
    if (!stat || r.playerIds.includes(meId)) continue;
    const b = best(stat);
    const need = r.value + 1;
    if (!b || need - b > 2) continue;
    out.push({
      id: `r:${stat}`,
      kind: "record",
      stat,
      need,
      score: 50 - (need - b) * 6 + (stat === "punti" ? 4 : 0),
      bar: { from: b, to: need, holderIds: r.playerIds, record: r.value },
    });
  }

  return out;
}
