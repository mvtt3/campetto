import { describe, expect, it } from "vitest";
import { assistSplit, pctTone, shotZones, zoneTier } from "@/lib/stats/zones";
import { match } from "./fixtures";

describe("mappa di tiro", () => {
  const m = match({
    date: "2026-10-29T17:00:00Z",
    a: 22,
    b: 10,
    lines: [
      {
        id: "a",
        team: "A",
        box: { pts: 14, fg2m: 7, fg2a: 15, fg3m: 0, fg3a: 1, fgrm: 4, fgra: 5 },
      },
      { id: "b", team: "B", box: { pts: 4, fg2m: 2, fg2a: 6 } },
    ],
  });

  it("divide i tiri da 2 tra sotto e media, quando si sa", () => {
    const z = shotZones("a", [m]);
    expect(z.sotto).toEqual({ made: 4, att: 5 });
    expect(z.media).toEqual({ made: 3, att: 10 });
    expect(z.tre).toEqual({ made: 0, att: 1 });
    expect(z.unknown2).toBe(0);
    // Senza zone: i tiri da 2 non finiscono sulla mappa, si contano a parte.
    expect(shotZones("b", [m]).unknown2).toBe(6);
  });

  it("livelli come i badge e colori della percentuale", () => {
    expect(zoneTier({ made: 1, att: 2 })).toBe(0);
    expect(zoneTier({ made: 1, att: 5 })).toBe(1);
    expect(zoneTier({ made: 2, att: 5 })).toBe(2);
    expect(zoneTier({ made: 3, att: 5 })).toBe(3);
    expect(zoneTier({ made: 9, att: 10 })).toBe(4);
    expect(pctTone(0.1)).toBe("bad");
    expect(pctTone(0.3)).toBe("mid");
    expect(pctTone(0.5)).toBe("good");
    expect(pctTone(null)).toBe("none");
  });

  it("canestri su assist o da solo, dalla cronaca", () => {
    const withEvents = match({
      date: "2026-10-29T17:30:00Z",
      a: 4,
      b: 0,
      lines: [
        { id: "a", team: "A", box: { fg2m: 2, fg2a: 2 } },
        { id: "c", team: "A", box: {} },
        { id: "b", team: "B", box: {} },
      ],
      events: [
        { playerId: "a", kind: "2pt", targetPlayerId: null, videoTs: null },
        { playerId: "c", kind: "ast", targetPlayerId: "a", videoTs: null },
        { playerId: "a", kind: "2pt", targetPlayerId: null, videoTs: null },
        { playerId: "a", kind: "ast", targetPlayerId: "c", videoTs: null },
      ],
    });
    const s = assistSplit("a", [withEvents])!;
    expect(s.assisted).toBe(1);
    expect(s.alone).toBe(1);
    expect(s.bestPasser).toEqual({ id: "c", n: 1 });
    expect(s.bestTarget).toEqual({ id: "c", n: 1 });
    expect(assistSplit("a", [m])).toBeNull();
  });
});
