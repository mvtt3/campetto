import { describe, expect, it } from "vitest";
import { clock, parseShots, suggestedKind } from "@/lib/video-shots";

describe("tiri trovati nel video", () => {
  it("legge il file di tiri.py, in ordine di tempo", () => {
    const shots = parseShots(
      JSON.stringify({
        tiri: [
          { t: 84.2, dentro: false, da: "sotto" },
          { t: 20.3, dentro: true, da: "fuori" },
          { t: "x" },
        ],
        traccia: [[1, 2, 3]],
      }),
    );
    expect(shots).toEqual([
      { t: 20.3, made: true, zone: "fuori" },
      { t: 84.2, made: false, zone: "sotto" },
    ]);
    expect(suggestedKind(shots[0])).toBe("2pt");
    expect(suggestedKind(shots[1])).toBe("miss2");
  });

  it("rifiuta i file che non sono tiri", () => {
    expect(() => parseShots("ciao")).toThrow(/tiri\.py/);
    expect(() => parseShots("{}")).toThrow(/tiri\.py/);
    expect(() => parseShots('{"tiri":[]}')).toThrow(/non ci sono tiri/);
  });

  it("scrive i secondi come minuti", () => {
    expect(clock(84.2)).toBe("1:24");
    expect(clock(5)).toBe("0:05");
    expect(clock(805)).toBe("13:25");
  });
});
