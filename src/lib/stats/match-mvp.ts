import { winnerOf, type Match } from "../types";
import { efficiency, normalizeBox } from "./player";

export interface MatchMvp {
  playerId: string;
  /** La valutazione con cui l'ha vinto. */
  eff: number;
}

/**
 * L'MVP della partita: il migliore della squadra che ha vinto, per valutazione
 * (punti, rimbalzi, assist, rubate, stoppate, meno tiri sbagliati e palle perse).
 * A pari valutazione chi ha segnato di più, poi chi ha perso meno palloni.
 * Serve il tabellino dei vincitori: senza numeri, niente MVP.
 */
export function matchMvp(m: Match): MatchMvp | null {
  const w = winnerOf(m);
  if (!w) return null;
  const winners = m.players.filter((p) => p.team === w && p.hasStats);
  if (!winners.length) return null;
  const rated = winners.map((p) => {
    const b = normalizeBox(p.box);
    return { playerId: p.playerId, eff: efficiency(b), pts: b.pts, tov: b.tov };
  });
  rated.sort((x, y) => y.eff - x.eff || y.pts - x.pts || x.tov - y.tov || x.playerId.localeCompare(y.playerId));
  return { playerId: rated[0].playerId, eff: rated[0].eff };
}
