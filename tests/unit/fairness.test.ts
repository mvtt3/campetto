import { describe, expect, it } from "vitest";
import { computeElo } from "@/lib/stats/elo";
import { minGamesFor, mvpRanking } from "@/lib/stats/awards";
import { leaderboard, STAT_BY_KEY } from "@/lib/stats/leaderboards";
import { computePlayerStats } from "@/lib/stats/player";
import { duel, match } from "./fixtures";

const oct = (d: number) => `2026-10-${String(d).padStart(2, "0")}T16:00:00Z`;

describe("classifiche eque", () => {
  it("chiede almeno il 40% delle partite del più presente", () => {
    expect(minGamesFor(2, 3)).toBe(3);
    expect(minGamesFor(10, 3)).toBe(4);
    expect(minGamesFor(20, 2)).toBe(8);
  });

  // x gioca 10 partite con medie normali, y solo 2 con medie altissime.
  const ms = [
    ...Array.from({ length: 10 }, (_, i) =>
      duel(oct(i + 1), "x", "z", 21, 15, [{ pts: 12 }, { pts: 10 }]),
    ),
    duel(oct(20), "y", "z", 21, 2, [{ pts: 21 }, { pts: 2 }]),
    duel(oct(21), "y", "z", 21, 3, [{ pts: 21 }, { pts: 3 }]),
  ];
  const ids = ["x", "y", "z"];

  it("chi gioca poco resta fuori dalle medie, con le partite che mancano", () => {
    const stats = ids.map((id) => computePlayerStats(id, ms));
    const lb = leaderboard(STAT_BY_KEY.get("punti")!, stats, {
      elo: computeElo(ms, ids),
      allTime: true,
    });
    expect(lb.minGames).toBe(5);
    expect(lb.rows.map((r) => r.playerId)).toEqual(["x", "z"]);
    expect(lb.pending).toEqual([{ playerId: "y", value: 21, missing: 3 }]);
  });

  it("i totali premiano chi viene", () => {
    const stats = ids.map((id) => computePlayerStats(id, ms));
    const lb = leaderboard(STAT_BY_KEY.get("vittorie")!, stats, {
      elo: computeElo(ms, ids),
      allTime: true,
    });
    expect(lb.rows[0].playerId).toBe("x");
    expect(lb.pending).toEqual([]);
  });

  it("l'MVP richiede presenza", () => {
    const rank = mvpRanking(ids, ms, { kind: "month", year: 2026, month: 9 });
    expect(rank.map((r) => r.playerId)).not.toContain("y");
    expect(rank[0].playerId).toBe("x");
  });
});

describe("MVP: conta far vincere la squadra", () => {
  // In 2v2: "g" (gregario) segna poco ma vince sempre; "s" (solista) segna tanto ma perde sempre.
  const ms = Array.from({ length: 6 }, (_, i) =>
    match({
      date: oct(i + 1),
      a: 21,
      b: 17,
      lines: [
        {
          id: "g",
          team: "A",
          box: { pts: 4, fg2m: 2, fg2a: 4, ast: 5, dreb: 4 },
        },
        {
          id: i % 2 ? "c" : "d",
          team: "A",
          box: { pts: 17, fg2m: 7, fg3m: 1, fg2a: 12, fg3a: 3 },
        },
        {
          id: "s",
          team: "B",
          box: { pts: 13, fg2m: 5, fg3m: 1, fg2a: 9, fg3a: 2, dreb: 2 },
        },
        { id: i % 2 ? "d" : "c", team: "B", box: { pts: 4, fg2m: 2, fg2a: 8 } },
      ],
    }),
  );
  it("chi vince sempre batte chi fa più punti ma perde", () => {
    const rank = mvpRanking(["g", "s", "c", "d"], ms, {
      kind: "month",
      year: 2026,
      month: 9,
    });
    const pos = (id: string) => rank.findIndex((r) => r.playerId === id);
    expect(pos("g")).toBeLessThan(pos("s"));
    expect(rank.find((r) => r.playerId === "g")!.plusMinusAvg).toBe(4);
  });
});
