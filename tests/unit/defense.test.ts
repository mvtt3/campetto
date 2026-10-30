import { describe, expect, it } from "vitest";
import { STAT_BY_KEY } from "@/lib/stats/leaderboards";
import { defenseAvg, type PlayerStats } from "@/lib/stats/player";

const stats = (stl: number, blk: number, dreb: number, statGames = 2) =>
  ({
    playerId: "p1",
    statGames,
    avg: { stl, blk, dreb },
  }) as unknown as PlayerStats;

describe("miglior difensore", () => {
  it("rubate e stoppate valgono 1, i rimbalzi in difesa mezzo punto", () => {
    expect(defenseAvg(stats(1, 1, 4))).toBe(4);
    expect(defenseAvg(stats(0, 0, 3))).toBe(1.5);
  });

  it("chi ruba tanto batte chi prende solo rimbalzi", () => {
    expect(defenseAvg(stats(3, 0, 0))).toBeGreaterThan(
      defenseAvg(stats(0, 0, 5)),
    );
  });

  it("in classifica serve il tabellino", () => {
    const def = STAT_BY_KEY.get("difesa")!;
    const ctx = { elo: {} as never, allTime: false };
    expect(def.value(stats(1, 0, 2, 0), ctx)).toBeNull();
    expect(def.value(stats(1, 0, 2), ctx)).toBe(2);
    expect(def.format(2)).toBe("2.0");
  });
});
