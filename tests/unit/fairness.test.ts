import { describe, expect, it } from "vitest";
import { computeElo } from "@/lib/stats/elo";
import { minGamesFor, mvpRanking } from "@/lib/stats/awards";
import { leaderboard, STAT_BY_KEY } from "@/lib/stats/leaderboards";
import { computePlayerStats } from "@/lib/stats/player";
import { duel } from "./fixtures";

const oct = (d: number) => `2026-10-${String(d).padStart(2, "0")}T16:00:00Z`;

describe("classifiche eque", () => {
  it("chiede almeno il 40% delle partite del più presente", () => {
    expect(minGamesFor(2, 3)).toBe(3);
    expect(minGamesFor(10, 3)).toBe(4);
    expect(minGamesFor(20, 2)).toBe(8);
  });

  // x gioca 10 partite con medie normali, y solo 2 con medie altissime.
  const ms = [
    ...Array.from({ length: 10 }, (_, i) => duel(oct(i + 1), "x", "z", 21, 15, [{ pts: 12 }, { pts: 10 }])),
    duel(oct(20), "y", "z", 21, 2, [{ pts: 21 }, { pts: 2 }]),
    duel(oct(21), "y", "z", 21, 3, [{ pts: 21 }, { pts: 3 }]),
  ];
  const ids = ["x", "y", "z"];

  it("chi gioca poco resta fuori dalle medie, con le partite che mancano", () => {
    const stats = ids.map((id) => computePlayerStats(id, ms));
    const lb = leaderboard(STAT_BY_KEY.get("punti")!, stats, { elo: computeElo(ms, ids), allTime: true });
    expect(lb.minGames).toBe(5);
    expect(lb.rows.map((r) => r.playerId)).toEqual(["x", "z"]);
    expect(lb.pending).toEqual([{ playerId: "y", value: 21, missing: 3 }]);
  });

  it("i totali premiano chi viene", () => {
    const stats = ids.map((id) => computePlayerStats(id, ms));
    const lb = leaderboard(STAT_BY_KEY.get("vittorie")!, stats, { elo: computeElo(ms, ids), allTime: true });
    expect(lb.rows[0].playerId).toBe("x");
    expect(lb.pending).toEqual([]);
  });

  it("l'MVP richiede presenza", () => {
    const rank = mvpRanking(ids, ms, { kind: "month", year: 2026, month: 9 });
    expect(rank.map((r) => r.playerId)).not.toContain("y");
    expect(rank[0].playerId).toBe("x");
  });
});
