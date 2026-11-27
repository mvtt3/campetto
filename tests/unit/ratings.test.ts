import { describe, expect, it } from "vitest";
import { onScale, overall, SCALES, steadyAvg, steadyPct } from "@/lib/stats/ratings";

const three = (m: number, a: number) => onScale(steadyPct(m, a, 0.25, 30), SCALES.three);

describe("attributi sulle proprie prestazioni", () => {
  it("scala fissa da 60 a 99", () => {
    expect(onScale(-5, SCALES.points)).toBe(60);
    expect(onScale(40, SCALES.points)).toBe(99);
    expect(onScale(10, SCALES.points)).toBe(90);
  });

  it("pochi tiri valgono meno di tanti tiri buoni", () => {
    expect(three(4, 4)).toBe(87);
    expect(three(4, 6)).toBe(85);
    expect(three(40, 100)).toBe(89);
    expect(three(4, 4)).toBeLessThan(three(40, 100));
    expect(three(55, 100)).toBe(96);
  });

  it("poche partite: voto prudente", () => {
    const reb = (avg: number, g: number) => onScale(steadyAvg(avg * g, g, 4), SCALES.rebounds);
    expect(reb(9.8, 20)).toBe(92);
    expect(reb(9.5, 20)).toBeLessThanOrEqual(reb(9.8, 20));
    expect(reb(9.8, 3)).toBe(87);
  });

  it("OVR: le tre voci migliori contano il doppio, più la produzione", () => {
    const a = [90, 90, 90, 60, 60, 60, 60].map((value) => ({ label: "x", value }));
    // (90·6 + 60·4) / 10 = 78 → 0,7·78 + 0,3·80 = 78,6
    expect(overall(a, 80)).toBe(79);
    expect(overall([{ label: "x", value: null }], null)).toBeNull();
  });
});
