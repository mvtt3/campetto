import { describe, expect, it } from "vitest";
import { matchStory } from "@/lib/story";
import {
  emptyBox,
  type Box,
  type Match,
  type MatchEvent,
  type Player,
} from "@/lib/types";

const players = ["Simone", "Valerio", "Paolo", "Matteo"].map(
  (firstName, i) =>
    ({ id: `p${i + 1}`, firstName, lastName: null, nickname: null }) as Player,
);

function line(
  playerId: string,
  team: "A" | "B",
  b: Partial<Box> | null,
): Match["players"][number] {
  return {
    matchId: "m",
    playerId,
    team,
    hasStats: !!b,
    box: { ...emptyBox(), ...(b ?? {}) },
  };
}

function match(
  id: string,
  at: string,
  score: [number, number],
  lines: Match["players"],
  events: Partial<MatchEvent>[] = [],
): Match {
  return {
    id,
    playedAt: at,
    format: lines.length === 2 ? "1v1" : "2v2",
    targetPoints: 21,
    scoreA: score[0],
    scoreB: score[1],
    statsSource: "tabellino",
    confirmedBy: null,
    confirmedAt: null,
    createdBy: "p1",
    notes: null,
    createdAt: at,
    players: lines.map((l) => ({ ...l, matchId: id })),
    events: events.map((e, seq) => ({
      id: `${id}-${seq}`,
      matchId: id,
      targetPlayerId: null,
      videoTs: null,
      seq,
      playerId: "p1",
      kind: "2pt",
      ...e,
    })),
  } as Match;
}

describe("il racconto della partita", () => {
  const old = [
    match(
      "a",
      "2026-10-29T16:00:00Z",
      [21, 10],
      [
        line("p1", "A", { pts: 12, fg2m: 6, fg2a: 9 }),
        line("p2", "A", { pts: 9, fg2m: 3, fg2a: 6, fg3m: 1, fg3a: 2 }),
        line("p3", "B", { pts: 6, fg2m: 3, fg2a: 8 }),
        line("p4", "B", { pts: 4, fg2m: 2, fg2a: 9 }),
      ],
    ),
    match(
      "b",
      "2026-10-29T16:30:00Z",
      [21, 16],
      [
        line("p1", "A", { pts: 14, fg2m: 7, fg2a: 12 }),
        line("p2", "A", { pts: 7, fg2m: 2, fg2a: 6, fg3m: 1, fg3a: 2 }),
        line("p3", "B", { pts: 10, fg2m: 5, fg2a: 9 }),
        line("p4", "B", { pts: 6, fg2m: 3, fg2a: 8 }),
      ],
    ),
  ];

  it("dominio e massimo in carriera, con i rimbalzi e le triple", () => {
    const m = match(
      "c",
      "2026-10-29T17:15:00Z",
      [8, 23],
      [
        line("p3", "A", { pts: 2, fg2m: 1, fg2a: 10 }),
        line("p4", "A", { pts: 6, fg2m: 3, fg2a: 14 }),
        line("p1", "B", {
          pts: 21,
          fg2m: 6,
          fg2a: 13,
          fg3m: 3,
          fg3a: 7,
          oreb: 1,
          dreb: 9,
        }),
        line("p2", "B", { pts: 2, fg2m: 1, fg2a: 6, ast: 5 }),
      ],
    );
    const s = matchStory(m, [...old, m], players)!;
    expect(s).toMatch(/23–8/);
    expect(s).toMatch(/Simone e Valerio/);
    expect(s).toMatch(/(record|Massimo in carriera)/);
    expect(s).toMatch(/21 punti, 3 triple e 10 rimbalzi/);
    expect(s).toMatch(/Valerio[^.]*5 assist/);
  });

  it("punto a punto", () => {
    const m = match(
      "d",
      "2026-10-30T17:00:00Z",
      [21, 20],
      [
        line("p1", "A", null),
        line("p2", "A", null),
        line("p3", "B", null),
        line("p4", "B", null),
      ],
    );
    const s = matchStory(m, [m], players)!;
    expect(s).toMatch(/(Punto a punto|ultimo canestro)/);
    // Senza tabellino: solo come è finita.
    expect(s.split(". ").length).toBe(1);
  });

  it("la rimonta, dalle azioni del video", () => {
    const ev: Partial<MatchEvent>[] = [
      ...Array.from({ length: 4 }, () => ({
        playerId: "p3",
        kind: "2pt" as const,
      })),
      ...Array.from({ length: 8 }, () => ({
        playerId: "p1",
        kind: "2pt" as const,
      })),
    ];
    const m = match(
      "e",
      "2026-10-30T18:00:00Z",
      [16, 8],
      [
        line("p1", "A", null),
        line("p2", "A", null),
        line("p3", "B", null),
        line("p4", "B", null),
      ],
      ev,
    );
    expect(matchStory(m, [m], players)).toMatch(/(Sotto di 8|recuperano 8)/);
  });

  it("nell'1 contro 1 non c'è la squadra", () => {
    for (const id of ["f", "g", "h", "i", "j", "k"]) {
      const m = match(
        id,
        "2026-10-30T19:00:00Z",
        [21, 15],
        [
          line("p1", "A", { pts: 21, fg2m: 9, fg2a: 14, fg3m: 1, fg3a: 3 }),
          line("p2", "B", { pts: 15, fg2m: 6, fg2a: 13, fg3m: 1, fg3a: 4 }),
        ],
      );
      const s = matchStory(m, [m], players)!;
      expect(s).not.toMatch(/squadra/);
      expect(s).toMatch(/A Valerio non bastano 15 punti/);
    }
  });

  it("sempre la stessa frase per la stessa partita, mai undefined", () => {
    const m = old[1];
    expect(matchStory(m, old, players)).toBe(matchStory(m, old, players));
    for (const x of old)
      expect(matchStory(x, old, players)).not.toMatch(/undefined|null/);
  });

  it("niente racconto senza un vincitore", () => {
    const m = match(
      "z",
      "2026-10-30T20:00:00Z",
      [10, 10],
      [line("p1", "A", null), line("p2", "B", null)],
    );
    expect(matchStory(m, [m], players)).toBeNull();
  });
});
