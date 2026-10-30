import { describe, expect, it } from "vitest";
import {
  alternativesOf,
  altLabel,
  awaitingStats,
  namesList,
  proposalPhase,
} from "@/lib/proposals";
import type { Proposal } from "@/lib/types";

const at = (h: number, m = 0) => new Date(2026, 10, 3, h, m).toISOString();

function proposal(responses: Proposal["responses"]): Proposal {
  return {
    id: "x",
    startsAt: at(18),
    format: "3v3",
    note: null,
    place: "decathlon",
    createdBy: "p1",
    status: "aperta",
    createdAt: at(9),
    responses,
  };
}

const yes = (
  playerId: string,
  altStartsAt: string | null = null,
  altPlace: "niche" | "decathlon" | null = null,
) => ({
  playerId,
  response: "si" as const,
  updatedAt: at(10),
  altStartsAt,
  altPlace,
});

describe("controproposte", () => {
  it("raggruppa chi preferisce lo stesso orario e campetto, dalla più seguita", () => {
    const p = proposal([
      yes("p1"),
      yes("p2", at(19), "niche"),
      yes("p3", at(19, 30)),
      yes("p4", at(19), "niche"),
    ]);
    const g = alternativesOf(p);
    expect(g.map((x) => x.playerIds)).toEqual([["p2", "p4"], ["p3"]]);
    expect(altLabel(p, g[0])).toBe("Alle 19:00 al Niche");
    expect(altLabel(p, g[1])).toBe("Alle 19:30");
  });

  it("solo il campetto diverso", () => {
    const p = proposal([yes("p2", null, "niche")]);
    expect(altLabel(p, alternativesOf(p)[0])).toBe("Al Niche");
  });

  it("ignora chi non ha detto sì e le alternative uguali alla partita", () => {
    const p = proposal([
      { ...yes("p2", at(20)), response: "forse" },
      yes("p3", at(18), "decathlon"),
    ]);
    expect(alternativesOf(p)).toEqual([]);
  });

  it("elenca i nomi come si parla", () => {
    expect(namesList(["Davide"])).toBe("Davide");
    expect(namesList(["Davide", "Simone"])).toBe("Davide e Simone");
    expect(namesList(["A", "B", "C"])).toBe("A, B e C");
    expect(namesList(["A", "B", "C", "D", "E"])).toBe("A, B e altri 3");
  });
});

describe("partita confermata e in corso", () => {
  const start = new Date(2026, 10, 3, 18).getTime();
  const p = (n: number) =>
    proposal(Array.from({ length: n }, (_, i) => yes(`p${i + 1}`)));
  const at = (hoursBefore: number) =>
    new Date(start - hoursBefore * 3_600_000);

  it("al completo è confermata subito", () => {
    expect(proposalPhase(p(6), at(48), 6)).toBe("confirmed");
  });
  it("in 4 si conferma solo da 12 ore prima", () => {
    expect(proposalPhase(p(4), at(13), 6)).toBe("open");
    expect(proposalPhase(p(4), at(12), 6)).toBe("confirmed");
    expect(proposalPhase(p(3), at(2), 6)).toBe("open");
  });
  it("confermata e iniziata è in corso per due ore, poi finita", () => {
    expect(proposalPhase(p(4), at(-0.5), 6)).toBe("live");
    expect(proposalPhase(p(4), at(-2), 6)).toBe("over");
    expect(proposalPhase(p(3), at(-0.5), 6)).toBe("over");
  });
  it("per un 1v1 bastano due", () => {
    expect(proposalPhase(p(2), at(48), 2)).toBe("confirmed");
  });
});

describe("statistiche in arrivo", () => {
  const start = new Date(2026, 10, 3, 18);
  const p = proposal(Array.from({ length: 4 }, (_, i) => yes(`p${i + 1}`)));
  const h = (n: number) => new Date(start.getTime() + n * 3_600_000);
  const six = () => 6;
  it("dopo la fine, finché non c'è il risultato", () => {
    expect(awaitingStats([p], [], h(1), six)).toBeNull();
    expect(awaitingStats([p], [], h(2.5), six)?.id).toBe("x");
    expect(
      awaitingStats([p], [{ playedAt: h(1).toISOString() }], h(3), six),
    ).toBeNull();
    expect(awaitingStats([p], [], h(19), six)).toBeNull();
  });
  it("solo se era confermata", () => {
    const few = proposal([yes("p1"), yes("p2")]);
    expect(awaitingStats([few], [], h(3), six)).toBeNull();
  });
});
