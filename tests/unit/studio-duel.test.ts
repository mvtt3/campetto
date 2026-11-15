import { describe, expect, it } from "vitest";
import { duelChampion, duelFavorite, duelMine, duelPair, duelWinners, itemsOfKind, type StudioDuelState } from "@/lib/studio";

const item = (kind: "canestro" | "assist") => ({ kind, t: 0, d: 5, release: 3, playerId: "p", game: 1, label: "", poster: "" });
const show = { top: { src: "", t0: 0, items: [item("canestro"), item("canestro"), item("canestro"), item("assist"), item("assist")] } };
const empty: StudioDuelState = { mine: [], counts: [], champs: [] };

describe("voto a sfide", () => {
  it("le azioni di una categoria, in ordine", () => {
    expect(itemsOfKind(show, "canestro")).toEqual([0, 1, 2]);
    expect(itemsOfKind(show, "assist")).toEqual([3, 4]);
  });

  it("la preferita: la prima azione, poi l'ultima scelta (una sfida saltata non cambia niente)", () => {
    expect(duelChampion(show, empty, "canestro", 1)).toBe(0);
    expect(duelChampion(show, empty, "assist", 1)).toBe(3);
    const s: StudioDuelState = { ...empty, mine: [{ c: "canestro", r: 1, a: 0, b: 1, x: 1 }] };
    expect(duelChampion(show, s, "canestro", 2)).toBe(1);
    expect(duelChampion(show, s, "canestro", 3)).toBe(1);
    expect(duelChampion(show, s, "assist", 1)).toBe(3);
    expect(duelMine(s, "canestro", 1)).toBe(1);
    expect(duelMine(s, "canestro", 2)).toBeNull();
    expect(duelFavorite(s, "canestro")).toBe(1);
    expect(duelFavorite(s, "assist")).toBeNull();
    expect(duelChampion(show, null, "canestro", 2)).toBe(0);
  });

  it("le percentuali di una coppia sommano a 100", () => {
    const s: StudioDuelState = { ...empty, counts: [{ c: "canestro", a: 0, b: 1, x: 0, n: 1 }, { c: "canestro", a: 0, b: 1, x: 1, n: 2 }, { c: "assist", a: 0, b: 1, x: 0, n: 9 }] };
    expect(duelPair(s, "canestro", 0, 1)).toEqual({ na: 1, nb: 2, pa: 33, pb: 67 });
    expect(duelPair(s, "canestro", 0, 2)).toEqual({ na: 0, nb: 0, pa: 0, pb: 0 });
  });

  it("vince chi è stato portato in fondo da più persone; a parità chi ha vinto più sfide; poi pari merito", () => {
    expect(duelWinners(empty, "canestro")).toEqual([]);
    const base: StudioDuelState = { ...empty, champs: [{ c: "canestro", item: 1, n: 3 }, { c: "canestro", item: 2, n: 5 }, { c: "assist", item: 4, n: 9 }] };
    expect(duelWinners(base, "canestro")).toEqual([2]);
    const tie: StudioDuelState = { mine: [], champs: [{ c: "canestro", item: 1, n: 4 }, { c: "canestro", item: 2, n: 4 }], counts: [{ c: "canestro", a: 0, b: 1, x: 1, n: 6 }, { c: "canestro", a: 1, b: 2, x: 2, n: 4 }] };
    expect(duelWinners(tie, "canestro")).toEqual([1]);
    tie.counts[1].n = 6;
    expect(duelWinners(tie, "canestro")).toEqual([1, 2]);
  });
});
