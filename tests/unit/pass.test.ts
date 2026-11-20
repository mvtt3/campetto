import { describe, expect, it } from "vitest";
import { surprise } from "@/lib/pass/actions";
import { ITEMS, PASS_LEVELS, POINTS_PER_LEVEL, SHOT_ODDS, SPICCHI_PER_MATCH } from "@/lib/pass/catalog";
import { computePass } from "@/lib/pass/engine";
import type { PassState } from "@/lib/pass/store";
import { match } from "./fixtures";

const EMPTY: PassState = {
  claimed: [],
  pendingBoost: [],
  boosts: 0,
  boostActivations: [],
  owned: [],
  outfit: {},
  spent: 0,
  bonus: 0,
  shot: null,
  lockerSeen: [],
};
const NOW = new Date("2026-11-19T12:00:00+01:00");

/** Una partita del giocatore "me" nella season di prova, coi numeri scelti. */
const game = (date: string, box: Parameters<typeof match>[0]["lines"][number]["box"], won = true) =>
  match({
    date,
    a: won ? 21 : 15,
    b: won ? 15 : 21,
    lines: [
      { id: "me", team: "A", box },
      { id: "x", team: "B", box: {} },
    ],
  });

describe("pass", () => {
  it("una sfida fatta fa salire subito di livello, i punti si sommano", () => {
    // 2 punti segnati: chiude la sfida del livello 1. In più 15 punti pass.
    const p = computePass("me", [game("2026-11-03T18:00:00+01:00", { fg2m: 1, fg2a: 2, pts: 2 })], EMPTY, NOW);
    expect(p.level).toBe(1);
    expect(p.ups[0]).toMatchObject({ level: 1, via: "sfida", alt: 0 });
    expect(p.bar).toBe(15);
    expect(p.spicchi).toBe(SPICCHI_PER_MATCH);
  });

  it("senza sfide si sale coi punti: 40 a livello, 15 a partita", () => {
    const games = [1, 2, 3].map((d) => game(`2026-11-0${d + 2}T18:00:00+01:00`, {}, false));
    // Nessun tabellino utile: niente sfide (servono le statistiche), solo punti.
    const p = computePass("me", games, EMPTY, NOW);
    expect(p.matches.length * 15).toBe(45);
    expect(p.level).toBe(1);
    expect(p.bar).toBe(45 - POINTS_PER_LEVEL);
  });

  it("il boost raddoppia tutta la prima giornata giocata dopo averlo acceso", () => {
    const st = { ...EMPTY, boostActivations: ["2026-11-04T09:00:00+01:00"] };
    const games = [
      game("2026-11-03T18:00:00+01:00", {}, false),
      game("2026-11-05T18:00:00+01:00", {}, false),
      game("2026-11-05T19:00:00+01:00", {}, false),
    ];
    const p = computePass("me", games, st, NOW);
    expect(p.matches.map((m) => m.points)).toEqual([15, 30, 30]);
  });

  it("le partite fuori dalla season non contano", () => {
    const p = computePass("me", [game("2026-10-20T18:00:00+02:00", { pts: 10, fg2m: 5, fg2a: 5 })], EMPTY, NOW);
    expect(p.matches).toHaveLength(0);
    expect(p.level).toBe(0);
  });

  it("i premi riscattati entrano negli Spicchi e tra gli oggetti", () => {
    const games = Array.from({ length: 8 }, (_, i) => game(`2026-11-${String(i + 2).padStart(2, "0")}T18:00:00+01:00`, {}, false));
    const st = { ...EMPTY, claimed: [1, 2] };
    const p = computePass("me", games, st, NOW);
    expect(p.level).toBeGreaterThanOrEqual(2);
    const lv1 = PASS_LEVELS[0].reward;
    expect(lv1.kind).toBe("spicchi");
    expect(p.spicchiFrom.pass).toBe(lv1.kind === "spicchi" ? lv1.amount : 0);
    expect(p.owned.has("cap-volt")).toBe(true);
    expect(p.toClaim).not.toContain(1);
  });

  it("le sorprese danno un oggetto che non hai, finché ce ne sono", () => {
    const owned = new Set(ITEMS.filter((i) => i.rarity === "comune").map((i) => i.id));
    const res = surprise({ comune: 100, raro: 0, epico: 0, leggendario: 0 }, owned, "seme");
    expect(res.duplicate).toBe(true);
    const fresh = surprise({ comune: 0, raro: 100, epico: 0, leggendario: 0 }, new Set(), "seme");
    expect(fresh.item.rarity).toBe("raro");
    expect(fresh.duplicate).toBe(false);
    expect(fresh.item.esclusivo).toBeFalsy();
  });

  it("le probabilità del tiro sommano a 100", () => {
    for (const odds of Object.values(SHOT_ODDS)) expect(Object.values(odds).reduce((a, b) => a + b, 0)).toBe(100);
  });
});
