import { describe, expect, it } from "vitest";
import { computeElo, eloOf, expectedScore, marginMultiplier, playerK, winProbability, ELO_START } from "@/lib/stats/elo";
import { balanceTeams, rankSplits } from "@/lib/stats/teams";
import { categoryKings, currentMvp, monthlyHistory, mvpRanking, seasonHistory, trophiesOf } from "@/lib/stats/awards";
import { duel, match } from "./fixtures";

describe("elo", () => {
  it("starts at 1000 and is zero-sum in 1v1", () => {
    const r = computeElo([duel("2026-10-01T10:00:00Z", "x", "y", 21, 15)], ["x", "y", "z"]);
    expect(eloOf(r, "z")).toBe(ELO_START);
    const x = r.ratings.get("x")!;
    const y = r.ratings.get("y")!;
    expect(x).toBeGreaterThan(ELO_START);
    expect(x + y).toBeCloseTo(2000);
  });

  it("gives less than K for an expected win", () => {
    expect(expectedScore(1200, 1000)).toBeGreaterThan(0.75);
  });

  it("scales K by team size and margin", () => {
    expect(playerK(1)).toBe(32);
    expect(playerK(4)).toBe(16);
    expect(marginMultiplier(10)).toBeCloseTo(1);
    expect(marginMultiplier(1)).toBe(0.6);
    expect(marginMultiplier(21)).toBeLessThanOrEqual(1.4);
  });

  it("processes matches chronologically regardless of input order", () => {
    const m1 = duel("2026-10-01T10:00:00Z", "x", "y", 21, 15);
    const m2 = duel("2026-10-02T10:00:00Z", "y", "x", 21, 19);
    const a = computeElo([m1, m2], ["x", "y"]);
    const b = computeElo([m2, m1], ["x", "y"]);
    expect(a.ratings.get("x")).toBeCloseTo(b.ratings.get("x")!);
    expect(a.history.get("x")).toHaveLength(2);
  });

  it("predicts win probability", () => {
    const r = new Map([
      ["a", 1100],
      ["b", 1100],
      ["c", 900],
      ["d", 900],
    ]);
    expect(winProbability(["a", "b"], ["c", "d"], r)).toBeGreaterThan(0.7);
    expect(winProbability(["a", "c"], ["b", "d"], r)).toBeCloseTo(0.5);
  });
});

describe("team balancer", () => {
  const r = new Map([
    ["a", 1200],
    ["b", 1100],
    ["c", 1000],
    ["d", 900],
  ]);
  it("produces the most balanced split first", () => {
    const best = balanceTeams(["a", "b", "c", "d"], r, 2)!;
    const teams = [best.teamA.sort().join(), best.teamB.sort().join()].sort();
    expect(teams).toEqual(["a,d", "b,c"]);
    expect(best.imbalance).toBeLessThan(0.01);
  });
  it("has no mirrored duplicates", () => {
    expect(rankSplits(["a", "b", "c", "d"], r, 2)).toHaveLength(3);
  });
  it("shuffle stays near balanced", () => {
    const s = balanceTeams(["a", "b", "c", "d"], r, 2, 1, () => 0.99)!;
    expect(s.imbalance).toBeLessThan(0.07);
  });
  it("handles 1v1 and new players", () => {
    const s = balanceTeams(["a", "new"], r, 1)!;
    expect(s.teamA).toHaveLength(1);
    expect(s.teamB).toHaveLength(1);
  });
});

describe("mvp and awards", () => {
  const oct = (d: number) => `2026-10-${String(d).padStart(2, "0")}T16:00:00Z`;
  const ms = [
    duel(oct(1), "x", "y", 21, 10, [{ pts: 21, ast: 2 }, { pts: 10 }]),
    duel(oct(2), "x", "y", 21, 12, [{ pts: 21, ast: 3 }, { pts: 12 }]),
    duel(oct(3), "y", "x", 21, 19, [{ pts: 21 }, { pts: 19, ast: 4 }]),
    duel(oct(4), "x", "z", 21, 5),
  ];
  const ids = ["x", "y", "z"];

  it("requires the minimum games", () => {
    const rank = mvpRanking(ids, ms, { kind: "month", year: 2026, month: 9 });
    expect(rank.map((r) => r.playerId)).toEqual(["x", "y"]);
    expect(rank[0].score).toBeGreaterThan(rank[1].score);
  });

  it("works with result-only months", () => {
    const only = [1, 2, 3].map((d) => duel(oct(d), "x", "y", 21, 15));
    const rank = mvpRanking(ids, only, { kind: "month", year: 2026, month: 9 });
    expect(rank[0].playerId).toBe("x");
    expect(rank[0].effAvg).toBeNull();
  });

  it("finds the MVP in charge, falling back to the previous month", () => {
    expect(currentMvp(ids, ms, new Date("2026-10-20T10:00:00Z"))?.entry.playerId).toBe("x");
    expect(currentMvp(ids, ms, new Date("2026-11-05T10:00:00Z"))?.period).toEqual({ kind: "month", year: 2026, month: 9 });
    expect(currentMvp(ids, ms, new Date("2026-12-05T10:00:00Z"))).toBeNull();
  });

  it("supports per-format MVP", () => {
    expect(mvpRanking(ids, ms, { kind: "all" }, "3v3")).toHaveLength(0);
    expect(mvpRanking(ids, ms, { kind: "all" }, "1v1")[0].playerId).toBe("x");
  });

  it("names category kings", () => {
    const kings = categoryKings(ids, ms, { kind: "month", year: 2026, month: 9 });
    expect(kings.find((k) => k.category === "punti")?.playerId).toBe("x");
    expect(kings.find((k) => k.category === "assist")?.playerId).toBe("x");
  });

  it("builds monthly and season history with trophies only for closed seasons", () => {
    const months = monthlyHistory(ids, ms, new Date("2027-01-10T00:00:00Z"));
    expect(months[0]).toMatchObject({ year: 2026, month: 9, closed: true });
    const seasonsOpen = seasonHistory(ids, ms, new Date("2026-11-01T00:00:00Z"));
    expect(trophiesOf("x", seasonsOpen)).toHaveLength(0);
    const seasonsClosed = seasonHistory(ids, ms, new Date("2027-01-10T00:00:00Z"));
    expect(trophiesOf("x", seasonsClosed)).toHaveLength(1);
  });

  it("ignores team games for nobody's advantage", () => {
    const m = match({ date: oct(5), format: "2v2", a: 21, b: 20, lines: [{ id: "x", team: "A" }, { id: "z", team: "A" }, { id: "y", team: "B" }] });
    expect(computeElo([m], ids).ratings.get("x")).toBeGreaterThan(ELO_START);
  });
});
