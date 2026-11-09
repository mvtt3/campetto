import { computeElo, expectedScore, type EloResult } from "./stats/elo";
import { matchMvp } from "./stats/match-mvp";
import { normalizeBox } from "./stats/player";
import { comebackSize } from "./stats/records";
import {
  shortName,
  winnerOf,
  type Match,
  type Player,
  type Team,
} from "./types";

/**
 * Il racconto della partita in due o tre frasi, come lo farebbe un telecronista del campetto:
 * com'è finita (dominio, punto a punto, rimonta, sorpresa), chi l'ha decisa (record, triple,
 * rimbalzi), chi l'ha aiutato e, se serve, chi non è bastato dall'altra parte.
 * Le frasi cambiano da partita a partita ma sono sempre le stesse per la stessa partita.
 */
export function matchStory(
  m: Match,
  all: Match[],
  players: Player[],
  elo: EloResult = computeElo(all),
): string | null {
  const w = winnerOf(m);
  if (!w) return null;
  const l: Team = w === "A" ? "B" : "A";
  const seed = seedOf(m.id);
  const nameOf = (id: string) =>
    shortName(
      players.find((p) => p.id === id),
      players,
    );
  const onCourt = (t: Team) => m.players.filter((p) => p.team === t && !p.sub);
  const W = joinNames(onCourt(w).map((p) => nameOf(p.playerId)));
  const L = joinNames(onCourt(l).map((p) => nameOf(p.playerId)));
  if (!W || !L) return null;
  const many = onCourt(w).length > 1;
  const manyL = onCourt(l).length > 1;
  const v = (one: string, more: string) => (many ? more : one);
  const vL = (one: string, more: string) => (manyL ? more : one);
  const hi = Math.max(m.scoreA, m.scoreB);
  const lo = Math.min(m.scoreA, m.scoreB);
  const score = `${hi}–${lo}`;
  const margin = hi - lo;

  // 1) Com'è andata.
  const back = comebackSize(m);
  const chance = winChance(m, w, elo);
  let lead: string;
  if (back >= 6)
    lead = pick(seed, [
      `Sotto di ${back}, ${W} non ${v("molla", "mollano")}: rimonta e finisce ${score}.`,
      `Che rimonta: ${W} ${v("recupera", "recuperano")} ${back} punti e ${v("vince", "vincono")} ${score}.`,
    ]);
  else if (chance !== null && chance < 0.36)
    lead = pick(seed, [
      `${W} ${v("batte", "battono")} ${L} contro i pronostici: ${score}.`,
      `Sorpresa al campetto: ${W} ${v("supera", "superano")} ${L}, che ${vL("partiva", "partivano")} con i favori del pronostico. Finisce ${score}.`,
    ]);
  else if (chance !== null && chance < 0.44 && strongLoser(m, l, elo))
    lead =
      margin >= 12 || lo <= 8
        ? `${W} ${v("travolge", "travolgono")} ${manyL ? "una squadra storicamente forte" : "chi di solito vince"}: ${score}.`
        : `${W} ${v("porta", "portano")} a casa il risultato contro ${manyL ? "una squadra storicamente forte" : "chi di solito vince"}: ${score}.`;
  else if (margin <= 2)
    lead = pick(seed, [
      `Punto a punto fino alla fine: ${W} la ${v("chiude", "chiudono")} ${score}.`,
      `Si decide all'ultimo canestro: ${v("vince", "vincono")} ${W}, ${score}.`,
    ]);
  else if (margin >= 12 || lo <= 8)
    lead = pick(seed, [
      `Partita a senso unico: ${W} ${v("vince", "vincono")} ${score}.`,
      `${W} non ${v("lascia", "lasciano")} scampo a ${L}: ${score}.`,
      `Dominio di ${W}: ${score}.`,
    ]);
  else
    lead = pick(seed, [
      `${W} ${v("porta", "portano")} a casa la partita: ${score}.`,
      `${v("Vince", "Vincono")} ${W}, ${score} contro ${L}.`,
    ]);

  const parts = [lead];

  // 2) Chi l'ha decisa, e chi l'ha aiutato (solo col tabellino della squadra che ha vinto).
  const winners = m.players.filter((p) => p.team === w && p.hasStats);
  if (
    winners.length &&
    winners.length === m.players.filter((p) => p.team === w).length
  ) {
    const lines = winners.map((p) => ({
      id: p.playerId,
      b: normalizeBox(p.box),
    }));
    const mvp = matchMvp(m);
    const star =
      lines.find((x) => x.id === mvp?.playerId) ??
      [...lines].sort((x, y) => y.b.pts - x.b.pts)[0];
    const S = nameOf(star.id);
    const reb = star.b.oreb + star.b.dreb;
    const mates = lines.filter((x) => x.id !== star.id);
    const scorer = [...mates].sort((x, y) => y.b.pts - x.b.pts)[0];
    // Se l'MVP non è il miglior marcatore, si dice perché è l'MVP: rimbalzi, assist, recuperi.
    const notTop = !!scorer && scorer.b.pts > star.b.pts;
    const extra = [
      star.b.fg3m >= 3 ? `${star.b.fg3m} triple` : null,
      reb >= (notTop ? 5 : 10) ? `${reb} rimbalzi` : null,
      star.b.ast >= (notTop ? 3 : 6) ? `${star.b.ast} assist` : null,
      notTop && star.b.stl >= 3 ? `${star.b.stl} recuperi` : null,
      notTop && star.b.blk >= 2 ? `${star.b.blk} stoppate` : null,
    ]
      .filter((x): x is string => !!x)
      .slice(0, 2);
    const pts = `${star.b.pts} punti`;
    const stats = joinNames([pts, ...extra]);
    const record =
      star.b.pts >= 8 && isPersonalBest(star.id, star.b.pts, m, all);
    let line: string;
    if (record)
      line = pick(seed >>> 3, [
        `${S} firma il suo record: ${stats}`,
        `Massimo in carriera per ${S}: ${stats}`,
      ]);
    else if (star.b.pts >= 14)
      line = pick(seed >>> 3, [
        `${S} ne mette ${star.b.pts}${extra.length ? `, con ${joinNames(extra)}` : ""}`,
        many
          ? `${S} trascina la squadra con ${stats}`
          : `${S} chiude con ${stats}`,
      ]);
    else
      line = pick(seed >>> 3, [
        `MVP ${S}: ${stats}`,
        `${S} è l'MVP con ${stats}`,
      ]);

    // Il compagno che ha dato una mano: più assist, altrimenti più punti.
    const passer = [...mates].sort((x, y) => y.b.ast - x.b.ast)[0];
    if (notTop)
      line += `, con ${nameOf(scorer.id)} miglior marcatore a quota ${scorer.b.pts}.`;
    else if (passer && passer.b.ast >= 4)
      line += pick(seed >>> 5, [
        `, con ${nameOf(passer.id)} che serve ${passer.b.ast} assist.`,
        `, con un grande aiuto di ${nameOf(passer.id)}: ${passer.b.ast} assist.`,
      ]);
    else if (scorer && scorer.b.pts >= 8)
      line += `, e ${nameOf(scorer.id)} ne aggiunge ${scorer.b.pts}.`;
    else line += ".";
    parts.push(line);
  }

  // 3) Dall'altra parte: chi ci ha provato da solo.
  const losers = m.players.filter((p) => p.team === l && p.hasStats);
  if (losers.length) {
    const top = losers
      .map((p) => ({ id: p.playerId, pts: normalizeBox(p.box).pts }))
      .sort((x, y) => y.pts - x.pts)[0];
    if (top.pts >= 12 && top.pts >= lo * 0.6)
      parts.push(`A ${nameOf(top.id)} non bastano ${top.pts} punti.`);
  }
  return parts.join(" ");
}

/** La probabilità di vincere che la squadra aveva prima di giocare (null se nessuno ha uno storico). */
function winChance(m: Match, w: Team, elo: EloResult): number | null {
  const before = (t: Team) => {
    const rs = m.players
      .filter((p) => p.team === t)
      .map((p) => elo.history.get(p.playerId)?.find((h) => h.matchId === m.id))
      .filter((h) => !!h);
    if (!rs.length) return null;
    // Chi gioca la prima partita non dice nulla: serve qualcuno che abbia già giocato.
    const played = m.players.filter(
      (p) =>
        p.team === t &&
        (elo.history.get(p.playerId)?.findIndex((h) => h.matchId === m.id) ??
          0) > 0,
    ).length;
    if (!played) return null;
    return rs.reduce((s, h) => s + h.before, 0) / rs.length;
  };
  const rw = before(w);
  const rl = before(w === "A" ? "B" : "A");
  if (rw === null || rl === null) return null;
  return expectedScore(rw, rl);
}

/** Chi ha perso vinceva spesso: tutti con almeno tre partite e una media sopra la partenza. */
function strongLoser(m: Match, l: Team, elo: EloResult): boolean {
  const hs = m.players
    .filter((p) => p.team === l)
    .map((p) => {
      const h = elo.history.get(p.playerId) ?? [];
      const i = h.findIndex((x) => x.matchId === m.id);
      return i >= 3 ? h[i].before : null;
    });
  if (!hs.length || hs.some((x) => x === null)) return false;
  return hs.reduce((s: number, x) => s + (x ?? 0), 0) / hs.length >= 1012;
}

/** Il massimo in carriera: più punti di tutte le partite prima (con almeno due partite col tabellino). */
function isPersonalBest(
  id: string,
  pts: number,
  m: Match,
  all: Match[],
): boolean {
  const before = all.filter(
    (x) =>
      x.id !== m.id &&
      (x.playedAt < m.playedAt || (x.playedAt === m.playedAt && x.id < m.id)),
  );
  const prev = before
    .flatMap((x) => x.players)
    .filter((p) => p.playerId === id && p.hasStats)
    .map((p) => normalizeBox(p.box).pts);
  return prev.length >= 2 && pts > Math.max(...prev);
}

function joinNames(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? "";
  return `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`;
}

function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function pick<T>(seed: number, xs: T[]): T {
  return xs[seed % xs.length];
}
