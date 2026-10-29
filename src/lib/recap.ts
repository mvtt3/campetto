import { efficiency, normalizeBox } from "./stats/player";
import { comebackSize } from "./stats/records";
import { shortName, winnerOf, type Match, type Player } from "./types";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/** One- or two-sentence summary of a match, built from templates (no AI). */
export function matchRecap(m: Match, players: Player[]): string {
  const byId = new Map(players.map((p) => [p.id, p]));
  const name = (id: string) => shortName(byId.get(id), players);
  const w = winnerOf(m);
  if (!w) return `Pareggio ${m.scoreA}–${m.scoreB}.`;
  const winners = m.players.filter((p) => p.team === w).map((p) => name(p.playerId));
  const losers = m.players.filter((p) => p.team !== w).map((p) => name(p.playerId));
  const hi = Math.max(m.scoreA, m.scoreB);
  const lo = Math.min(m.scoreA, m.scoreB);
  const margin = hi - lo;
  const seed = hash(m.id);
  const W = joinNames(winners);
  const L = joinNames(losers);
  const verb = winners.length > 1 ? "vincono" : "vince";
  const verbTake = winners.length > 1 ? "la spuntano" : "la spunta";
  const verbDom = winners.length > 1 ? "dominano" : "domina";

  let first: string;
  const comeback = comebackSize(m);
  if (comeback >= 5) {
    first = pick(
      [
        `${W} ${verb} ${hi}–${lo} rimontando da −${comeback}.`,
        `Rimonta da −${comeback}: ${W} ${verb} ${hi}–${lo}.`,
      ],
      seed,
    );
  } else if (margin <= 2) {
    first = pick(
      [
        `${W} ${verbTake} ${hi}–${lo} contro ${L}, decisa all'ultimo canestro.`,
        `Finale tiratissimo: ${W} ${verb} ${hi}–${lo}.`,
        `${hi}–${lo}, punto a punto fino alla fine: ${verbTake} ${W}.`,
      ],
      seed,
    );
  } else if (margin >= 12) {
    first = pick(
      [`${W} ${verbDom} ${hi}–${lo} contro ${L}.`, `Partita a senso unico: ${W} ${verb} ${hi}–${lo}.`],
      seed,
    );
  } else {
    first = pick(
      [`${W} ${verb} ${hi}–${lo} contro ${L}.`, `${hi}–${lo} per ${W} contro ${L}.`],
      seed,
    );
  }

  const withStats = m.players.filter((p) => p.hasStats);
  if (!withStats.length) return first;

  const best = [...withStats].sort((a, b) => efficiency(normalizeBox(b.box)) - efficiency(normalizeBox(a.box)))[0];
  const b = normalizeBox(best.box);
  const reb = b.oreb + b.dreb;
  const n = name(best.playerId);
  const parts: string[] = [];
  if (b.pts) parts.push(`${b.pts} punti`);
  if (b.ast >= 2) parts.push(`${b.ast} assist`);
  if (reb >= 3) parts.push(`${reb} rimbalzi`);
  if (b.fg3m >= 2) parts.push(`${b.fg3m} triple`);
  if (b.stl + b.blk >= 3) parts.push(`${b.stl + b.blk} tra rubate e stoppate`);
  if (!parts.length) return first;
  const line = joinNames(parts.slice(0, 3));
  const isWinner = best.team === w;
  const second = isWinner
    ? pick([`Trascina la squadra ${n} con ${line}.`, `Il migliore è ${n}: ${line}.`, `${n} firma ${line}.`], seed >> 3)
    : pick([`A ${n} non bastano ${line}.`, `${n} ci prova con ${line}, ma non basta.`], seed >> 3);
  return `${first} ${second}`;
}
