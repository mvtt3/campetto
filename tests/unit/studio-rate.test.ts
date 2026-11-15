import { describe, expect, it } from "vitest";
import { fmtAvg, rateStats, rateWinners } from "@/lib/studio";

const st = (...rows: number[][]) => rows.map((counts) => ({ counts, mine: null }));

describe("voto da 1 a 5 delle azioni", () => {
  it("media e numero dei voti", () => {
    expect(rateStats([0, 0, 0, 0, 0])).toEqual({ n: 0, sum: 0, avg: null });
    expect(rateStats([1, 0, 0, 0, 1])).toEqual({ n: 2, sum: 6, avg: 3 });
    expect(rateStats([0, 0, 1, 2, 2]).avg).toBeCloseTo(4.2);
    // Valori strani non rompono niente.
    expect(rateStats([-1, Number.NaN, 2, 0, 0, 9]).n).toBe(2);
  });

  it("la media si legge con la virgola e una cifra", () => {
    expect(fmtAvg(4.25)).toBe("4,3");
    expect(fmtAvg(4)).toBe("4,0");
    expect(fmtAvg(null)).toBe("–");
  });

  it("vince la media più alta", () => {
    expect(rateWinners([0, 1, 2], st([0, 0, 0, 3, 0], [0, 0, 0, 0, 2], [0, 0, 3, 0, 0]))).toEqual([1]);
  });

  it("a pari media vincono più 5, poi più voti, poi pari merito", () => {
    // Media 4: [4,4] contro [3,5] → più 5.
    expect(rateWinners([0, 1], st([0, 0, 0, 2, 0], [0, 0, 1, 0, 1]))).toEqual([1]);
    // Media 5 per tutte e due, una con più voti.
    expect(rateWinners([0, 1], st([0, 0, 0, 0, 1], [0, 0, 0, 0, 3]))).toEqual([1]);
    // Uguali in tutto: vincono insieme.
    expect(rateWinners([0, 1, 2], st([0, 0, 1, 1, 1], [0, 0, 1, 1, 1], [1, 0, 0, 0, 0]))).toEqual([0, 1]);
  });

  it("senza voti non vince nessuno, e conta solo le azioni indicate", () => {
    expect(rateWinners([0, 1], st([0, 0, 0, 0, 0], [0, 0, 0, 0, 0]))).toEqual([]);
    expect(rateWinners([0, 2], st([0, 0, 0, 1, 0], [0, 0, 0, 0, 9], [0, 0, 1, 0, 0]))).toEqual([0]);
    expect(rateWinners([0], null)).toEqual([]);
  });
});
