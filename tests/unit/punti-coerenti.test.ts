import { describe, expect, it } from "vitest";
import { demoMatches } from "@/lib/data/mock-backend";
import { IERI } from "@/lib/data/mock-ieri";
import { teamBoxPoints } from "@/lib/stats/player";
import type { Player } from "@/lib/types";

const players = Array.from(
  { length: 9 },
  (_, i) =>
    ({
      id: `p${i + 1}`,
      firstName: `G${i + 1}`,
      lastName: null,
      nickname: null,
    }) as Player,
);

describe("il tabellino torna sempre col risultato", () => {
  it("nelle partite di prova", () => {
    for (const n of [24, 90]) {
      const ms = demoMatches(players, new Date(2026, 9, 30), n);
      for (const m of ms)
        for (const t of ["A", "B"] as const) {
          const pts = teamBoxPoints(m, t);
          if (pts === null) continue;
          expect(pts, `${m.id} squadra ${t}`).toBe(
            t === "A" ? m.scoreA : m.scoreB,
          );
        }
    }
  });
  it("nelle cinque partite vere del 29/10", () => {
    for (const m of IERI)
      for (const [k, t] of (["A", "B"] as const).entries()) {
        const pts = m.lines
          .filter((l) => l[1] === t)
          .reduce((s, l) => s + l[2][1] * 2 + l[2][3] * 3, 0);
        expect(pts, `${m.at} squadra ${t}`).toBe(m.score[k]);
      }
  });
});
