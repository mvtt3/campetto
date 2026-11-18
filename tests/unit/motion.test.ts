import { describe, expect, it } from "vitest";
import { createShakeDetector, createTiltTracker } from "@/lib/motion";

describe("inclinazione del telefono", () => {
  it("parte da dritta e si muove quando inclini", () => {
    const t = createTiltTracker();
    expect(t.feed(40, 0, 0)).toEqual({ x: 0, y: 0 });
    const r = t.feed(40, 9, 16);
    expect(r.x).toBeGreaterThan(0.4);
    expect(Math.abs(r.y)).toBeLessThan(0.01);
  });

  it("tenuto fermo inclinato, torna dritta da sola", () => {
    const t = createTiltTracker();
    t.feed(40, 0, 0);
    let r = t.feed(40, 15, 16);
    for (let ms = 32; ms < 6000; ms += 16) r = t.feed(40, 15, ms);
    expect(Math.abs(r.x)).toBeLessThan(0.05);
  });

  it("non va mai oltre -1 e 1", () => {
    const t = createTiltTracker();
    t.feed(40, 0, 0);
    const r = t.feed(-60, 80, 16);
    expect(r.x).toBe(1);
    expect(r.y).toBe(-1);
  });
});

describe("scossone", () => {
  const g = { x: 0, y: 9.8, z: 0 };

  it("tre colpi forti avanti e indietro: scossone", () => {
    const d = createShakeDetector();
    let t = 0;
    for (let i = 0; i < 10; i++) expect(d.feed(g, (t += 16))).toBeNull();
    const out = [25, -25, 25].map((x, i) =>
      d.feed({ x, y: 9.8, z: 0 }, (t += 120 * (i + 1))),
    );
    expect(out[0]).toBeNull();
    expect(out[1]).toBeNull();
    expect(out[2]).not.toBeNull();
  });

  it("inclinare piano o camminare non è uno scossone", () => {
    const d = createShakeDetector();
    let t = 0;
    // Il telefono ruota di 90 gradi in mezzo secondo: la gravità passa da y a x.
    for (let i = 0; i <= 30; i++) {
      const a = (i / 30) * (Math.PI / 2);
      expect(d.feed({ x: 9.8 * Math.sin(a), y: 9.8 * Math.cos(a), z: 0 }, (t += 16))).toBeNull();
    }
    // Passi: piccoli colpi su e giù.
    for (let i = 0; i < 120; i++)
      expect(d.feed({ x: 9.8, y: 3 * Math.sin(i / 3), z: 0 }, (t += 16))).toBeNull();
  });

  it("colpi tutti dalla stessa parte non bastano", () => {
    const d = createShakeDetector();
    let t = 0;
    d.feed(g, t);
    for (let i = 0; i < 6; i++) expect(d.feed({ x: 30, y: 9.8, z: 0 }, (t += 100))).toBeNull();
  });

  it("dopo uno scossone aspetta un attimo prima del prossimo", () => {
    const d = createShakeDetector();
    let t = 0;
    const hit = (x: number) => d.feed({ x, y: 0, z: 0 }, (t += 120), true);
    hit(25);
    hit(-25);
    expect(hit(25)).not.toBeNull();
    expect(hit(-25)).toBeNull();
    expect(hit(25)).toBeNull();
  });
});
