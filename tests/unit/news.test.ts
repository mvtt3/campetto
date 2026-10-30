import { describe, expect, it } from "vitest";
import { BOX_KEYS, IERI } from "@/lib/data/mock-ieri";
import { buildNews } from "@/lib/news";
import { computeElo } from "@/lib/stats/elo";
import type { Match, Player } from "@/lib/types";

const players = ["p1", "p2", "p3", "p6", "p7"].map(
  (id, i) =>
    ({
      id,
      firstName: ["Matteo", "Valerio", "Davide", "Mocciaro", "Simone"][i],
      lastName: null,
      nickname: i === 0 ? "Springs" : null,
    }) as unknown as Player,
);
const matches: Match[] = IERI.map((m, i) => ({
  id: `m${i}`,
  playedAt: new Date(m.at).toISOString(),
  format: "2v2",
  targetPoints: 21,
  scoreA: m.score[0],
  scoreB: m.score[1],
  statsSource: "tabellino",
  confirmedBy: null,
  confirmedAt: null,
  createdBy: null,
  notes: null,
  createdAt: m.at,
  events: [],
  players: m.lines.map(([pid, team, v, [fgrm, fgra]]) => ({
    matchId: `m${i}`,
    playerId: pid,
    team,
    hasStats: true,
    box: {
      ...(Object.fromEntries(BOX_KEYS.map((k, j) => [k, v[j]])) as Record<string, number>),
      fgrm,
      fgra,
    },
  })),
})) as never;

describe("notizie dalle partite", () => {
  const now = new Date("2026-10-30T10:00:00+01:00");
  const news = buildNews(
    matches,
    players,
    [],
    computeElo(
      matches,
      players.map((p) => p.id),
    ),
    now,
  );

  it("racconta la serata, le doppie doppie, la serie e il mese", () => {
    const ids = news.map((n) => n.id);
    expect(ids.some((id) => id.startsWith("night-"))).toBe(true);
    // Simone: 21 punti e 10 rimbalzi nella quarta partita.
    expect(
      news.some((n) => n.icon === "double" && n.title.includes("Simone")),
    ).toBe(true);
    // Springs le ha vinte tutte e quattro.
    expect(
      news.some(
        (n) =>
          n.icon === "streak" &&
          n.title.includes("Springs") &&
          n.title.includes("4"),
      ),
    ).toBe(true);
    expect(
      news.some((n) => n.icon === "crown" && n.title.includes("ottobre")),
    ).toBe(true);
    expect(news.some((n) => n.icon === "leader")).toBe(true);
  });

  it("gli annunci stanno in cima e ogni notizia ha un testo", () => {
    const withPost = buildNews(
      matches,
      players,
      [
        {
          id: "a",
          title: "Ciao",
          body: "Benvenuti",
          kind: "annuncio",
          createdAt: "2026-10-01T10:00:00Z",
        },
      ],
      computeElo(matches, []),
      now,
    );
    expect(withPost[0].id).toBe("post-a");
    for (const n of news) {
      expect(n.title.length).toBeGreaterThan(5);
      expect(n.body.length).toBeGreaterThan(5);
      expect(n.title).not.toMatch(/undefined|NaN/);
      expect(n.body).not.toMatch(/undefined|NaN/);
    }
  });
});
