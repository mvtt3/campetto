import { describe, expect, it } from "vitest";
import { teamRecords } from "@/lib/stats/relations";
import { balanceTeams, rankSplits } from "@/lib/stats/teams";
import { withSubs } from "@/lib/types";
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

describe("cambi", () => {
  it("in cinque per un 2 contro 2: squadre da 3 e 2, il terzo è il cambio", () => {
    const r = new Map([
      ["a", 1100],
      ["b", 1000],
      ["c", 1000],
      ["d", 950],
      ["e", 900],
    ]);
    const s = balanceTeams(["a", "b", "c", "d", "e"], r, 2, 0, Math.random, 2)!;
    expect(s.teamA.length + s.teamB.length).toBe(5);
    expect([s.teamA.length, s.teamB.length].sort()).toEqual([2, 3]);
    // Senza cambi il quinto resta fuori.
    const noSubs = balanceTeams(["a", "b", "c", "d", "e"], r, 2)!;
    expect(noSubs.teamA.length + noSubs.teamB.length).toBe(4);
    // Al massimo due cambi a testa: in nove per un 2v2 ne restano fuori uno.
    expect(rankSplits(["a", "b", "c", "d", "e", "f", "g", "h", "i"], r, 2, 2)[0].teamA.length).toBe(4);
  });

  it("chi va oltre il formato, nell'ordine, è il cambio", () => {
    const lines = withSubs("2v2", [
      { id: "a", team: "A" as const },
      { id: "b", team: "A" as const },
      { id: "c", team: "B" as const },
      { id: "d", team: "B" as const },
      { id: "e", team: "A" as const },
    ]);
    expect(lines.filter((l) => l.sub).map((l) => l.id)).toEqual(["e"]);
  });

  it("con un cambio è un'altra squadra nel record", () => {
    const base = match({
      date: "2026-10-01T18:00:00Z",
      format: "2v2",
      a: 21,
      b: 10,
      lines: [
        { id: "m", team: "A" },
        { id: "s", team: "A" },
        { id: "v", team: "B" },
        { id: "d", team: "B" },
      ],
    });
    const withSub = (date: string) => {
      const x = match({
        date,
        format: "2v2",
        a: 21,
        b: 12,
        lines: [
          { id: "m", team: "A" },
          { id: "s", team: "A" },
          { id: "c", team: "A" },
          { id: "v", team: "B" },
          { id: "d", team: "B" },
        ],
      });
      x.players[2].sub = true;
      return x;
    };
    const r = teamRecords([base, { ...base, id: "x2" }, withSub("2026-10-02T18:00:00Z"), withSub("2026-10-03T18:00:00Z")], "2v2");
    const plain = r.find((t) => t.ids.length === 2 && t.ids.includes("m"))!;
    const rotating = r.find((t) => t.subs.length === 1)!;
    expect(plain).toMatchObject({ wins: 2, games: 2 });
    expect(rotating).toMatchObject({ ids: ["m", "s", "c"], subs: ["c"], wins: 2 });
  });
});

describe("ELO con i cambi", () => {
  it("chi gioca a turno prende la sua parte: la squadra non guadagna più del dovuto", async () => {
    const { computeElo } = await import("@/lib/stats/elo");
    const m = match({
      date: "2026-10-05T18:00:00Z",
      format: "2v2",
      a: 21,
      b: 15,
      lines: [
        { id: "a", team: "A" },
        { id: "b", team: "A" },
        { id: "c", team: "A" },
        { id: "d", team: "B" },
        { id: "e", team: "B" },
      ],
    });
    m.players[2].sub = true;
    const r = computeElo([m], ["a", "b", "c", "d", "e"]).ratings;
    const gainA = ["a", "b", "c"].reduce((s, id) => s + r.get(id)! - 1000, 0);
    const lossB = ["d", "e"].reduce((s, id) => s + r.get(id)! - 1000, 0);
    expect(gainA).toBeCloseTo(-lossB, 6);
    expect(r.get("a")! - 1000).toBeCloseTo(r.get("c")! - 1000, 6);
  });
});
