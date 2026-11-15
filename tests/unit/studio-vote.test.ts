import { describe, expect, it } from "vitest";
import { percentages } from "@/components/studio/studio-vote";

describe("percentuali del voto", () => {
  it("sommano sempre a 100 e rispettano l'ordine dei voti", () => {
    for (const counts of [[1, 1, 1], [2, 1, 1, 1], [1, 2, 3, 4], [5, 0, 0, 0], [7, 7, 7, 7, 7, 7], [1, 1, 0], [33, 33, 34], [0, 0, 1, 0]]) {
      const p = percentages(counts);
      expect(p.reduce((a, b) => a + b, 0)).toBe(100);
      expect(p.length).toBe(counts.length);
      for (let i = 0; i < counts.length; i++) for (let j = 0; j < counts.length; j++) if (counts[i] > counts[j]) expect(p[i]).toBeGreaterThanOrEqual(p[j]);
    }
  });
  it("senza voti è tutto zero (niente divisioni per zero)", () => {
    expect(percentages([0, 0, 0])).toEqual([0, 0, 0]);
    expect(percentages([])).toEqual([]);
  });
  it("un voto solo fa 100 a quella scelta", () => {
    expect(percentages([0, 1, 0, 0])).toEqual([0, 100, 0, 0]);
  });
});
