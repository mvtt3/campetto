import { describe, expect, it } from "vitest";
import {
  BADGES,
  computeBadges,
  showcaseBadges,
  tierFor,
  BADGE_BY_KEY,
} from "@/lib/badges";
import { monthlyHistory, seasonHistory } from "@/lib/stats/awards";
import { groupRecords, comebackSize } from "@/lib/stats/records";
import { matchRecap } from "@/lib/recap";
import { parseImport, matchPlayer } from "@/lib/importer";
import {
  decideProposalNotifications,
  summaryText,
  neededPlayers,
} from "@/lib/notifications/grouping";
import { rainRisk, weatherAt, weatherKind, parseForecast } from "@/lib/weather";
import { duel, match, player } from "./fixtures";

const day = (m: number, d: number) =>
  `2026-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T16:00:00Z`;

describe("badges", () => {
  it("has unique keys and five increasing thresholds", () => {
    expect(new Set(BADGES.map((b) => b.key)).size).toBe(BADGES.length);
    for (const b of BADGES)
      for (let i = 1; i < 5; i++)
        expect(b.thresholds[i]).toBeGreaterThan(b.thresholds[i - 1]);
  });

  it("computes tiers", () => {
    const def = BADGE_BY_KEY.get("assist")!;
    expect(tierFor(def, 0)).toBe(0);
    expect(tierFor(def, 49)).toBe(0);
    expect(tierFor(def, 50)).toBe(1);
    expect(tierFor(def, 250)).toBe(3);
    expect(tierFor(def, 9999)).toBe(5);
  });

  const ms = Array.from({ length: 12 }, (_, i) =>
    duel(day(10, i + 1), "x", "y", 21, 10 + (i % 3), [
      { fg2m: 6, fg2a: 9, fg3m: 3, fg3a: 4, ast: 3, dreb: 3 },
      { pts: 10, tov: 2 },
    ]),
  );

  const ctx = (now: Date) => ({
    months: monthlyHistory(["x", "y"], ms, now),
    seasons: seasonHistory(["x", "y"], ms, now),
  });

  it("replays history and records unlock dates", () => {
    const { states, unlocks } = computeBadges(
      "x",
      ms,
      ctx(new Date("2026-10-20T00:00:00Z")),
    );
    const presenze = states.find((s) => s.def.key === "presenze")!;
    expect(presenze.value).toBe(12);
    // Una dozzina di partite non basta più per il bronzo.
    expect(presenze.tier).toBe(0);
    expect(presenze.next).toBe(30);
    const serie = states.find((s) => s.def.key === "serie")!;
    expect(serie.value).toBe(12);
    expect(serie.tier).toBe(3);
    const first = unlocks.find((u) => u.key === "serie" && u.tier === 1)!;
    expect(first.date).toBe(day(10, 5));
    // Le grandi serate si contano: 12 partite da 21 punti sono un argento, non la Leggenda.
    const serata = states.find((s) => s.def.key === "partita-punti")!;
    expect(serata.value).toBe(12);
    expect(serata.tier).toBe(2);
    expect(states.find((s) => s.def.key === "uno-contro-uno")!.tier).toBe(1);
    expect(states.find((s) => s.def.key === "tuttofare")!.value).toBe(12);
    expect(states.find((s) => s.def.key === "mvp-mese")!.value).toBe(0);
  });

  it("is idempotent and adds month specials once the month closes", () => {
    const later = new Date("2027-02-01T00:00:00Z");
    const a = computeBadges("x", ms, ctx(later));
    const b = computeBadges("x", [...ms].reverse(), ctx(later));
    expect(a.states.map((s) => s.value)).toEqual(b.states.map((s) => s.value));
    expect(a.states.find((s) => s.def.key === "mvp-mese")!.value).toBe(1);
    expect(a.states.find((s) => s.def.key === "campione")!.value).toBe(1);
  });

  it("picks the showcase", () => {
    const { states } = computeBadges(
      "x",
      ms,
      ctx(new Date("2026-10-20T00:00:00Z")),
    );
    const sc = showcaseBadges(states, ["serie"]);
    expect(sc).toHaveLength(3);
    expect(sc[0].def.key).toBe("serie");
    const none = computeBadges("z", ms, ctx(new Date())).states;
    expect(showcaseBadges(none, ["presenze"])).toHaveLength(0);
  });
});

describe("records and recap", () => {
  const comeback = match({
    date: day(10, 5),
    format: "1v1",
    a: 7,
    b: 5,
    lines: [
      { id: "x", team: "A", box: { fg2m: 2, fg3m: 1 } },
      { id: "y", team: "B", box: { fg2m: 1, fg3m: 1 } },
    ],
    events: [
      { playerId: "y", kind: "3pt", targetPlayerId: null, videoTs: 1 },
      { playerId: "y", kind: "2pt", targetPlayerId: null, videoTs: 2 },
      { playerId: "x", kind: "2pt", targetPlayerId: null, videoTs: 3 },
      { playerId: "x", kind: "2pt", targetPlayerId: null, videoTs: 4 },
      { playerId: "x", kind: "3pt", targetPlayerId: null, videoTs: 5 },
    ],
  });

  it("measures comebacks from events", () => {
    expect(comebackSize(comeback)).toBe(5);
  });

  it("builds group records", () => {
    const recs = groupRecords([
      comeback,
      duel(day(10, 6), "x", "y", 21, 3, [{ pts: 21 }, { pts: 3 }]),
    ]);
    expect(recs.find((r) => r.key === "pts")).toMatchObject({
      value: 21,
      playerIds: ["x"],
    });
    expect(recs.find((r) => r.key === "comeback")).toMatchObject({ value: 5 });
    expect(recs.find((r) => r.key === "blowout")).toMatchObject({ value: 18 });
    expect(recs.find((r) => r.key === "closest")).toMatchObject({ value: 2 });
  });

  it("writes a recap", () => {
    const players = [player("x", "Mattia"), player("y", "Valerio", "Semeraro")];
    expect(matchRecap(comeback, players)).toMatch(/Mattia/);
    expect(matchRecap(comeback, players)).toMatch(/−5/);
    const plain = duel(day(10, 7), "x", "y", 21, 19);
    expect(matchRecap(plain, players)).toMatch(/21–19/);
  });
});

describe("importer", () => {
  const players = [
    player("p1", "Matteo", "Pepe"),
    player("p2", "Matteo", "Mocciaro"),
    player("p3", "Valerio", "Semeraro"),
    player("p4", "Mattia"),
  ];

  it("matches names with typos and ambiguity", () => {
    expect(matchPlayer("valerio semeraro", players)).toBe("p3");
    expect(matchPlayer("Semeraro", players)).toBe("p3");
    expect(matchPlayer("Mocciaro", players)).toBe("p2");
    expect(matchPlayer("Matia", players)).toBe("p4");
    expect(matchPlayer("Matteo", players)).toBeNull();
  });

  it("parses semicolon CSV with Italian headers", () => {
    const res = parseImport(
      "Giocatore;Squadra;Punti;Assist;Rimbalzi;Triple\nValerio Semeraro;A;9;3;4;1\nMattia;B;7;1;2;0",
      players,
    );
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0]).toMatchObject({ playerId: "p3", team: "A" });
    expect(res.rows[0].box).toMatchObject({ pts: 9, ast: 3, dreb: 4, fg3m: 1 });
    expect(res.errors).toHaveLength(0);
  });

  it("parses JSON with score", () => {
    const res = parseImport(
      JSON.stringify({
        scoreA: 21,
        scoreB: 17,
        players: [{ name: "Pepe", team: "B", pts: 8 }],
      }),
      players,
    );
    expect(res.scoreA).toBe(21);
    expect(res.rows[0]).toMatchObject({ playerId: "p1", team: "B" });
  });

  it("reports problems", () => {
    expect(parseImport("{oops", players).errors[0]).toMatch(/JSON/);
    expect(parseImport("nome,punti\nSconosciuto,4", players).errors[0]).toMatch(
      /Sconosciuto/,
    );
  });
});

describe("grouped notifications", () => {
  const base = {
    format: "2v2" as const,
    lastSummaryAt: null,
    thresholdNotified: false,
    yesNames: ["A", "B"],
    pendingYes: 1,
  };
  it("sends the first summary right away", () => {
    expect(decideProposalNotifications(base)).toEqual({
      threshold: false,
      summary: true,
    });
  });
  it("waits 30 minutes between summaries", () => {
    const now = new Date("2026-10-29T10:20:00Z");
    expect(
      decideProposalNotifications(
        { ...base, lastSummaryAt: "2026-10-29T10:00:00Z" },
        now,
      ).summary,
    ).toBe(false);
    expect(
      decideProposalNotifications(
        { ...base, lastSummaryAt: "2026-10-29T09:40:00Z" },
        now,
      ).summary,
    ).toBe(true);
  });
  it("sends nothing without new yes", () => {
    expect(decideProposalNotifications({ ...base, pendingYes: 0 })).toEqual({
      threshold: false,
      summary: false,
    });
  });
  it("sends 'si gioca' once when full", () => {
    expect(
      decideProposalNotifications({ ...base, yesNames: ["A", "B", "C", "D"] })
        .threshold,
    ).toBe(true);
    expect(
      decideProposalNotifications({
        ...base,
        yesNames: ["A", "B", "C", "D"],
        thresholdNotified: true,
      }).threshold,
    ).toBe(false);
    expect(neededPlayers(null)).toBe(6);
  });
  it("writes the summary text", () => {
    expect(
      summaryText(
        ["Matteo", "Simone", "Valerio", "Mattia"],
        "giovedì alle 18:00",
      ),
    ).toBe(
      "Matteo, Simone e altri 2 ci sono giovedì alle 18:00, vieni anche tu?",
    );
  });
});

describe("weather", () => {
  it("maps codes and rain risk", () => {
    expect(weatherKind(0)).toBe("sereno");
    expect(weatherKind(63)).toBe("pioggia");
    expect(rainRisk({ rainProb: 60, code: 1 })).toBe(true);
    expect(rainRisk({ rainProb: 10, code: 2 })).toBe(false);
  });
  it("finds the hour in Rome time", () => {
    const f = parseForecast({
      hourly: {
        time: ["2026-10-29T18:00", "2026-10-29T19:00"],
        temperature_2m: [12, 11],
        precipitation_probability: [5, 70],
        weather_code: [1, 61],
      },
    });
    // 18:00 UTC = 19:00 in Rome (CET)
    expect(weatherAt(f, "2026-10-29T18:00:00Z")?.temp).toBe(11);
  });
});
