import { describe, expect, it } from "vitest";
import { alternativesOf, altLabel, namesList } from "@/lib/proposals";
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
