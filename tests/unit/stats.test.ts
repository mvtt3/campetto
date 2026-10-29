import { describe, expect, it } from "vitest";
import { computePlayerStats, efficiency, normalizeBox, teamBoxPoints } from "@/lib/stats/player";
import { chemistry, bestPairs, headToHead, rivalries, streaks, form } from "@/lib/stats/relations";
import { filterMatches } from "@/lib/periods";
import { box, duel, match } from "./fixtures";

describe("box score", () => {
  it("derives points from shots", () => {
    expect(normalizeBox(box({ fg2m: 3, fg2a: 5, fg3m: 2, fg3a: 4 })).pts).toBe(12);
  });
  it("keeps stored points when no shot breakdown", () => {
    expect(normalizeBox(box({ pts: 9 })).pts).toBe(9);
  });
  it("never has more makes than attempts", () => {
    const b = normalizeBox(box({ fg2m: 3, fg2a: 1 }));
    expect(b.fg2a).toBe(3);
  });
  it("computes NBA efficiency", () => {
    // pts 10 (fg2 5/8), reb 4, ast 3, stl 1, blk 1, missed 3, tov 2 → 10+4+3+1+1-3-2 = 14
    const b = normalizeBox(box({ fg2m: 5, fg2a: 8, oreb: 1, dreb: 3, ast: 3, stl: 1, blk: 1, tov: 2 }));
    expect(efficiency(b)).toBe(14);
  });
});

describe("player stats", () => {
  const ms = [
    duel("2026-10-01T16:00:00Z", "p1", "p2", 21, 15, [
      { fg2m: 6, fg2a: 10, fg3m: 3, fg3a: 5, ast: 2, oreb: 1, dreb: 4, tov: 1 },
      { fg2m: 6, fg2a: 12, fg3m: 1, fg3a: 6, ast: 1, dreb: 2, stl: 2, tov: 3 },
    ]),
    duel("2026-10-03T16:00:00Z", "p2", "p1", 21, 19),
    duel("2026-11-02T16:00:00Z", "p1", "p2", 21, 10, [{ pts: 21 }, { pts: 10 }]),
  ];

  it("counts games, wins and percentages", () => {
    const s = computePlayerStats("p1", ms);
    expect(s.games).toBe(3);
    expect(s.wins).toBe(2);
    expect(s.losses).toBe(1);
    expect(s.winPct).toBeCloseTo(2 / 3);
  });

  it("averages only over games with stats", () => {
    const s = computePlayerStats("p1", ms);
    expect(s.statGames).toBe(2);
    expect(s.totals.pts).toBe(21 + 21);
    expect(s.avg.pts).toBe(21);
  });

  it("computes shooting splits", () => {
    const s = computePlayerStats("p1", ms.slice(0, 1));
    expect(s.fgm).toBe(9);
    expect(s.fga).toBe(15);
    expect(s.fgPct).toBeCloseTo(9 / 15);
    expect(s.fg3Pct).toBeCloseTo(3 / 5);
    expect(s.efgPct).toBeCloseTo((9 + 1.5) / 15);
    expect(s.tsPct).toBeCloseTo(21 / 30);
    expect(s.astTov).toBe(2);
  });

  it("computes plus/minus from team score", () => {
    const s = computePlayerStats("p1", ms);
    expect(s.plusMinus).toBe(6 - 2 + 11);
  });

  it("returns null percentages without attempts", () => {
    const s = computePlayerStats("p1", ms.slice(1, 2));
    expect(s.fgPct).toBeNull();
    expect(s.effAvg).toBeNull();
  });

  it("filters by month and format", () => {
    expect(filterMatches(ms, { period: { kind: "month", year: 2026, month: 9 } })).toHaveLength(2);
    expect(filterMatches(ms, { format: "2v2" })).toHaveLength(0);
    expect(filterMatches(ms, { period: { kind: "season", year: 2026, quarter: 3 }, format: "1v1" })).toHaveLength(3);
  });

  it("checks team points against the box score", () => {
    expect(teamBoxPoints(ms[0], "A")).toBe(21);
    expect(teamBoxPoints(ms[1], "A")).toBeNull();
  });
});

describe("relations", () => {
  const ms = [
    match({ date: "2026-10-01T10:00:00Z", a: 21, b: 18, lines: [{ id: "a", team: "A" }, { id: "b", team: "A" }, { id: "c", team: "B" }, { id: "d", team: "B" }] }),
    match({ date: "2026-10-02T10:00:00Z", a: 21, b: 12, lines: [{ id: "a", team: "A" }, { id: "b", team: "A" }, { id: "c", team: "B" }, { id: "d", team: "B" }] }),
    match({ date: "2026-10-03T10:00:00Z", a: 15, b: 21, lines: [{ id: "a", team: "A" }, { id: "c", team: "A" }, { id: "b", team: "B" }, { id: "d", team: "B" }] }),
    match({
      date: "2026-10-04T10:00:00Z",
      a: 21,
      b: 19,
      lines: [{ id: "a", team: "A" }, { id: "b", team: "A" }, { id: "c", team: "B" }, { id: "d", team: "B" }],
      events: [
        { playerId: "b", kind: "2pt", targetPlayerId: null, videoTs: 1 },
        { playerId: "a", kind: "ast", targetPlayerId: "b", videoTs: 1 },
      ],
    }),
  ];

  it("computes chemistry with teammates and assists", () => {
    const ch = chemistry("a", ms);
    const withB = ch.find((l) => l.playerId === "b")!;
    expect(withB.games).toBe(3);
    expect(withB.wins).toBe(3);
    expect(withB.assistsTo).toBe(1);
    const withC = ch.find((l) => l.playerId === "c")!;
    expect(withC.wins).toBe(0);
  });

  it("ranks best pairs", () => {
    expect(bestPairs(ms, 3)[0]).toMatchObject({ a: "a", b: "b", wins: 3, games: 3 });
  });

  it("computes head to head", () => {
    expect(headToHead("a", "d", ms)).toMatchObject({ games: 4, winsA: 3, winsB: 1 });
    expect(headToHead("a", "b", ms)).toMatchObject({ games: 1, winsA: 0, winsB: 1 });
  });

  it("finds rivalries", () => {
    const r = rivalries(ms, 4);
    expect(r.map((x) => `${x.a}-${x.b}`)).toContain("a-d");
  });

  it("tracks streaks and form", () => {
    expect(streaks("a", ms)).toEqual({ current: 1, bestWin: 2 });
    expect(form("a", ms)).toEqual(["V", "S", "V", "V"]);
  });
});
