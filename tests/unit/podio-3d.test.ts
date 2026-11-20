import { describe, expect, it } from "vitest";
import { GESTI, type Award } from "@/components/c3d/podium-stage";
import { preset3d } from "@/components/c3d/cast";

describe("podio 3D", () => {
  it("ogni gesto parte e finisce esattamente nella posa della foto: niente scatti al tocco", () => {
    for (const award of Object.keys(GESTI.KEYS) as Award[]) {
      const rest = GESTI.REST[award];
      GESTI.KEYS[award].forEach((keys, arm) => {
        for (const t of [0, 1])
          GESTI.track(keys, t).forEach((v, k) =>
            expect(v).toBeCloseTo(rest[arm][k], 9),
          );
      });
    }
  });

  it("i gesti si muovono senza salti tra un fotogramma e l'altro", () => {
    for (const award of Object.keys(GESTI.KEYS) as Award[])
      for (const keys of GESTI.KEYS[award]) {
        let prev = GESTI.track(keys, 0);
        for (let t = 1 / 120; t <= 1; t += 1 / 120) {
          const now = GESTI.track(keys, t);
          expect(Math.abs(now[0] - prev[0])).toBeLessThan(0.25);
          expect(Math.abs(now[1] - prev[1])).toBeLessThan(0.25);
          prev = now;
        }
      }
  });

  it("i personaggi del gruppo hanno il loro 3D, gli altri restano disegnati", () => {
    for (const id of [
      "collana",
      "occhiali",
      "bomber",
      "bandana",
      "lungo",
      "coppola",
      "muscoli",
      "rimbalzo",
      "cecchino",
      "regista",
      "muro",
      "lampo",
      "jolly",
    ])
      expect(preset3d(id)).not.toBeNull();
    expect(preset3d("drago")).toBeNull();
  });
});
