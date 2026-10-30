import { describe, expect, it } from "vitest";
import { isNewcomer } from "@/components/rewards";
import type { Match } from "@/lib/types";

const m = (id: string, playedAt: string, players: string[]): Match =>
  ({
    id,
    playedAt,
    players: players.map((p) => ({ playerId: p })),
  }) as unknown as Match;

describe("novità da riscattare su un telefono nuovo", () => {
  const now = new Date("2026-10-30T09:00:00+01:00").getTime();
  it("chi ha iniziato a giocare da poco trova tutto da scoprire", () => {
    expect(
      isNewcomer("a", [m("1", "2026-10-29T17:00:00+01:00", ["a", "b"])], now),
    ).toBe(true);
    expect(
      isNewcomer("z", [m("1", "2026-10-29T17:00:00+01:00", ["a", "b"])], now),
    ).toBe(true);
  });
  it("chi gioca da più di tre settimane e cambia telefono no", () => {
    expect(
      isNewcomer(
        "a",
        [
          m("1", "2026-10-01T17:00:00+01:00", ["a"]),
          m("2", "2026-10-29T17:00:00+01:00", ["a"]),
        ],
        now,
      ),
    ).toBe(false);
  });
});
