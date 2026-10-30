import { describe, expect, it } from "vitest";
import { NUDGES, nudgeFor } from "@/lib/notifications/nudges";

describe("promemoria 'torna a giocare'", () => {
  it("ogni settimana una frase diversa, e dopo un giro completo si ricomincia", () => {
    const seen = new Set<string>();
    for (let n = 1; n <= NUDGES.length; n++) seen.add(nudgeFor("p3", n, "Davide", 6).title);
    expect(seen.size).toBe(NUDGES.length);
    expect(nudgeFor("p3", 1, "Davide", 6)).toEqual(nudgeFor("p3", 1 + NUDGES.length, "Davide", 6));
  });

  it("nel gruppo non arriva a tutti la stessa frase", () => {
    const first = new Set(["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"].map((id) => nudgeFor(id, 1, "X", 6).title));
    expect(first.size).toBeGreaterThan(3);
  });

  it("frasi brevi, senza punto finale, con il nome quando serve", () => {
    for (let i = 0; i < NUDGES.length; i++) {
      const m = NUDGES[i]("Mocciaro", 9);
      expect(m.title.length).toBeLessThanOrEqual(40);
      expect(m.body.length).toBeLessThanOrEqual(90);
      expect(m.title).not.toMatch(/\.$/);
      expect(m.body).not.toMatch(/\.$/);
      expect(m.url.startsWith("/")).toBe(true);
      expect(`${m.title} ${m.body}`).not.toMatch(/undefined|NaN/);
    }
    expect(nudgeFor("p1", 1, "  ", 3).title + nudgeFor("p1", 1, "  ", 3).body).not.toMatch(/,\s*$|\s{2}/);
  });
});
