import { describe, expect, it } from "vitest";
import { teamRecords } from "@/lib/stats/relations";
import { duel, match } from "./fixtures";

const two = (date: string, a: [string, string], b: [string, string], sa: number, sb: number) =>
  match({
    date,
    format: "2v2",
    a: sa,
    b: sb,
    lines: [
      { id: a[0], team: "A" },
      { id: a[1], team: "A" },
      { id: b[0], team: "B" },
      { id: b[1], team: "B" },
    ],
  });

describe("teamRecords", () => {
  it("conta le squadre esatte del formato, solo vinte e perse", () => {
    const ms = [
      two("2026-10-01T18:00:00Z", ["m", "s"], ["v", "d"], 21, 15),
      two("2026-10-02T18:00:00Z", ["s", "m"], ["v", "d"], 21, 19),
      two("2026-10-03T18:00:00Z", ["m", "s"], ["d", "v"], 12, 21),
      two("2026-10-04T18:00:00Z", ["m", "s"], ["c", "d"], 21, 9),
      duel("2026-10-05T18:00:00Z", "m", "s", 11, 4),
    ];
    const r = teamRecords(ms, "2v2");
    expect(r[0]).toMatchObject({ ids: ["m", "s"], games: 4, wins: 3, losses: 1 });
    expect(r[1]).toMatchObject({ ids: ["d", "v"], wins: 1, losses: 2 });
    // c+d ha giocato una volta sola: fuori.
    expect(r.find((x) => x.ids.includes("c"))).toBeUndefined();
    // Il 2v2 non entra nell'1v1 e viceversa.
    expect(teamRecords(ms, "1v1", 1)).toHaveLength(2);
  });

  it("a pari saldo vince la percentuale, poi chi ha giocato di più", () => {
    const ms = [
      two("2026-10-01T18:00:00Z", ["a", "b"], ["c", "d"], 21, 10),
      two("2026-10-02T18:00:00Z", ["a", "b"], ["c", "d"], 21, 10),
      two("2026-10-03T18:00:00Z", ["e", "f"], ["g", "h"], 21, 10),
      two("2026-10-04T18:00:00Z", ["e", "f"], ["g", "h"], 21, 10),
      two("2026-10-05T18:00:00Z", ["e", "f"], ["g", "h"], 21, 10),
      two("2026-10-06T18:00:00Z", ["e", "f"], ["g", "h"], 10, 21),
    ];
    const r = teamRecords(ms, "2v2");
    // a+b 2–0 (saldo +2, 100%) e e+f 3–1 (saldo +2, 75%).
    expect(r[0].ids).toEqual(["a", "b"]);
    expect(r[1].ids).toEqual(["e", "f"]);
  });
});
