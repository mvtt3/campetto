import { describe, expect, it } from "vitest";
import {
  cleanComment,
  clipIndexAt,
  compactCount,
  feedOrder,
  highlightTitle,
  tickerItems,
  timeAgo,
} from "@/lib/highlights";
import { emptyBox, type Highlight, type Match, type Player } from "@/lib/types";

const hl = (id: string, matchId: string, createdAt = "2026-10-30T10:00:00Z") =>
  ({
    id,
    matchId,
    videoUrl: `/h/${id}.mp4`,
    posterUrl: null,
    duration: 30,
    description: null,
    clips: [],
    createdAt,
  }) as Highlight;

describe("feed degli highlights", () => {
  const matches = [
    { id: "m1", playedAt: "2026-10-27T18:00:00Z" },
    { id: "m2", playedAt: "2026-10-29T18:00:00Z" },
    { id: "m3", playedAt: "2026-10-29T18:30:00Z" },
  ];
  it("dalla partita più recente; senza partita il video sparisce", () => {
    const out = feedOrder(
      [hl("a", "m1"), hl("b", "m3"), hl("c", "m2"), hl("x", "eliminata")],
      matches,
    );
    expect(out.map((h) => h.id)).toEqual(["b", "c", "a"]);
  });
  it("il titolo dice quale partita della serata", () => {
    expect(highlightTitle(matches[2], matches)).toMatch(
      /29 ottobre · partita 2$/,
    );
    expect(highlightTitle(matches[0], matches)).toMatch(/^Martedì 27 ottobre$/);
  });
});

describe("il canestro che si vede", () => {
  const clips = [
    { t: 0, punti: 2 as const, come: "", descrizione: "" },
    { t: 3.5, punti: 3 as const, come: "", descrizione: "" },
    { t: 7, punti: 2 as const, come: "", descrizione: "" },
  ];
  it("segue il secondo del video", () => {
    expect(clipIndexAt(clips, 0)).toBe(0);
    expect(clipIndexAt(clips, 3.49)).toBe(1);
    expect(clipIndexAt(clips, 6.9)).toBe(1);
    expect(clipIndexAt(clips, 30)).toBe(2);
    expect(clipIndexAt([], 4)).toBe(-1);
  });
});

describe("la striscia coi numeri", () => {
  const p = (id: string, nickname: string) =>
    ({ id, firstName: nickname, lastName: null, nickname }) as Player;
  const players = [
    p("a", "Paolo"),
    p("b", "Simone"),
    p("c", "Vale"),
    p("d", "Mori"),
  ];
  const line = (
    playerId: string,
    team: "A" | "B",
    box: Partial<Match["players"][number]["box"]>,
  ) => ({
    matchId: "m",
    playerId,
    team,
    hasStats: true,
    box: { ...emptyBox(), ...box },
  });
  const m = {
    id: "m",
    playedAt: "2026-10-29T18:00:00Z",
    format: "2v2",
    scoreA: 22,
    scoreB: 10,
    players: [
      line("a", "A", { pts: 14, fg2m: 7, fg2a: 10, dreb: 6, ast: 2 }),
      line("b", "A", { pts: 8, fg2m: 4, fg2a: 8, ast: 5, stl: 2 }),
      line("c", "B", { pts: 6, fg2m: 3, fg2a: 9, oreb: 3, dreb: 5 }),
      line("d", "B", { pts: 4, fg2m: 2, fg2a: 7 }),
    ],
    events: [],
  } as unknown as Match;
  it("risultato, MVP e i migliori, senza gli zeri", () => {
    const t = tickerItems(m, players);
    expect(t[0]).toBe("Paolo e Simone 22–10 Vale e Mori");
    expect(t).toContain("Più punti Paolo · 14 punti");
    expect(t).toContain("Più rimbalzi Vale · 8");
    expect(t).toContain("Più assist Simone · 5");
    expect(t).toContain("Più rubate Simone · 2");
    expect(t.some((x) => x.startsWith("Più stoppate"))).toBe(false);
    expect(t.some((x) => x.includes("tripl"))).toBe(false);
    expect(t.some((x) => x.startsWith("MVP "))).toBe(true);
  });
});

describe("commenti", () => {
  const now = new Date("2026-10-30T20:00:00Z");
  it("da quanto tempo", () => {
    expect(timeAgo("2026-10-30T19:59:30Z", now)).toBe("adesso");
    expect(timeAgo("2026-10-30T19:52:00Z", now)).toBe("8 min");
    expect(timeAgo("2026-10-30T17:00:00Z", now)).toBe("3 h");
    expect(timeAgo("2026-10-29T17:00:00Z", now)).toBe("ieri");
    expect(timeAgo("2026-10-26T17:00:00Z", now)).toBe("4 g");
    expect(timeAgo("2026-10-01T17:00:00Z", now)).toBe("1 ott");
    // Orologio del telefono un po' avanti: mai "fra 2 minuti".
    expect(timeAgo("2026-10-30T20:02:00Z", now)).toBe("adesso");
  });
  it("si puliscono spazi e righe vuote, e si tagliano a 280", () => {
    expect(cleanComment("   ")).toBe("");
    expect(cleanComment("  ciao  \n\n\n\n  a tutti ")).toBe(
      "ciao\n\n  a tutti",
    );
    expect(cleanComment("x".repeat(400))).toHaveLength(280);
  });
  it("numeri compatti", () => {
    expect(compactCount(0)).toBe("0");
    expect(compactCount(999)).toBe("999");
    expect(compactCount(1234)).toBe("1,2 mila");
    expect(compactCount(25_000)).toBe("25 mila");
  });
});
