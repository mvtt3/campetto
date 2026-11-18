import { describe, expect, it } from "vitest";
import { matchMvp } from "@/lib/stats/match-mvp";
import type { Match, MatchPlayer } from "@/lib/types";

const box = (pts: number, reb = 0) => ({ pts, fg2m: pts / 2, fg2a: pts / 2, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, oreb: 0, dreb: reb, ast: 0, stl: 0, blk: 0, tov: 0, fouls: 0 });
const pl = (id: string, team: "A" | "B", pts: number): MatchPlayer =>
  ({ matchId: "m", playerId: id, team, hasStats: true, box: box(pts), sub: false }) as unknown as MatchPlayer;
const base = {
  id: "m", playedAt: "2026-11-16T19:00:00+01:00", format: "2v2", targetPoints: 21, scoreA: 21, scoreB: 10,
  statsSource: "tabellino", confirmedBy: null, confirmedAt: null, createdBy: null, notes: null, createdAt: "",
  events: [], players: [pl("forte", "A", 16), pl("scelto", "A", 5), pl("perde", "B", 10)],
} as unknown as Match;

describe("MVP scelto dall'amministratore", () => {
  it("senza scelta vale il calcolo: il migliore di chi vince", () => {
    expect(matchMvp(base)?.playerId).toBe("forte");
  });
  it("con la scelta vince lo scelto, anche se un compagno ha fatto di più", () => {
    expect(matchMvp({ ...base, mvpId: "scelto" })?.playerId).toBe("scelto");
  });
  it("una scelta di chi non ha giocato non conta", () => {
    expect(matchMvp({ ...base, mvpId: "assente" })?.playerId).toBe("forte");
  });
});
