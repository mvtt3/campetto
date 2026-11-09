import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fromExport } from "@/lib/data/mock-dati";

describe("dati veri in locale", () => {
  it("trasforma l'esportazione nelle strutture dell'app", () => {
    const raw = JSON.parse(readFileSync("tests/fixtures/dati-locali.json", "utf8"));
    const d = fromExport(raw);
    expect(d.meId).toBe("a1");
    expect(d.players.map((p) => p.nickname ?? p.firstName)).toEqual(["Razzo", "Bruno"]);
    expect(d.matches[0].players[0].box.pts).toBe(11);
    expect(d.matches[0].players[0].box.fgrm).toBe(2);
    expect(d.news[0].link).toBe("/partite");
  });

  it("rifiuta un file che non è un'esportazione", () => {
    expect(() => fromExport({})).toThrow(/esporta-dati/);
  });
});
