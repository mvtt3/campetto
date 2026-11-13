import { describe, expect, it } from "vitest";
import { splitGuests, withGuestLines } from "@/lib/guests";
import { computePlayerStats } from "@/lib/stats/player";
import { emptyBox, type Match, type Player } from "@/lib/types";

const player = (id: string, guest = false) =>
  ({ id, firstName: id, guest }) as unknown as Player;

const line = (playerId: string, team: "A" | "B", pts: number) => ({
  matchId: "m1",
  playerId,
  team,
  hasStats: true,
  box: { ...emptyBox(), pts, fg2m: pts / 2, fg2a: pts / 2 },
});

const match: Match = {
  id: "m1",
  playedAt: "2026-10-30T17:00:00Z",
  format: "2v2",
  targetPoints: 21,
  scoreA: 21,
  scoreB: 10,
  statsSource: "tabellino",
  confirmedBy: null,
  confirmedAt: null,
  createdBy: null,
  notes: null,
  createdAt: "2026-10-30T17:00:00Z",
  players: [
    line("p1", "A", 11),
    line("ospite", "A", 10),
    line("p2", "B", 6),
    line("p3", "B", 4),
  ],
  events: [
    {
      id: "e1",
      matchId: "m1",
      playerId: "ospite",
      kind: "ast",
      targetPlayerId: "p1",
      videoTs: null,
    } as Match["events"][number],
  ],
};

describe("ospiti", () => {
  const all = [player("p1"), player("p2"), player("p3"), player("ospite", true)];
  const out = splitGuests(all, [match]);

  it("fuori dal gruppo e dalle statistiche, dentro il tabellino", () => {
    expect(out.players.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    expect(out.guests.map((p) => p.id)).toEqual(["ospite"]);
    const m = out.matches[0];
    expect(m.players.map((l) => l.playerId)).toEqual(["p1", "p2", "p3"]);
    expect(m.guests?.map((l) => l.playerId)).toEqual(["ospite"]);
    expect(m.events).toEqual([]);
    expect(withGuestLines(m).players).toHaveLength(4);
  });

  it("la partita conta per chi ha giocato col gruppo", () => {
    const s = computePlayerStats("p1", out.matches);
    expect(s.games).toBe(1);
    expect(s.wins).toBe(1);
    expect(s.totals.pts).toBe(11);
  });

  it("senza ospiti non cambia niente", () => {
    const plain = splitGuests([player("p1")], [match]);
    expect(plain.matches[0]).toBe(match);
  });
});

describe("extra (senza app)", () => {
  const leo = { id: "ospite", firstName: "Leo", extra: true } as unknown as Player;
  const all = [player("p1"), player("p2"), player("p3"), leo];
  const out = splitGuests(all, [match]);

  it("si segna e si sceglie (extras), ma resta fuori da gruppo e statistiche", () => {
    expect(out.players.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    expect(out.extras.map((p) => p.firstName)).toEqual(["Leo"]);
    expect(out.guests.map((p) => p.id)).toEqual(["ospite"]);
    expect(out.matches[0].guests?.map((l) => l.playerId)).toEqual(["ospite"]);
    expect(out.matches[0].events).toEqual([]);
  });

  it("un extra archiviato non si propone più, ma il suo tabellino resta", () => {
    const old = splitGuests([player("p1"), { ...leo, archived: true }], [match]);
    expect(old.extras).toEqual([]);
    expect(old.matches[0].guests?.map((l) => l.playerId)).toEqual(["ospite"]);
  });
});
