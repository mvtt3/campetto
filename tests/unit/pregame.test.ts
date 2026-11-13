import { describe, expect, it } from "vitest";
import { computeElo } from "@/lib/stats/elo";
import {
  pregameCandidates,
  pregameTargets,
  previewProposal,
} from "@/lib/stats/pregame";
import type { Proposal } from "@/lib/types";
import { match } from "./fixtures";

// Rimbalzi: a 4+5+9 = 18 (media 6,0), b 6+7+6 = 19 (6,33), c 12, d 7.
// Punti (dai canestri): c 14+18+16 = 48 (record del gruppo 18), a 10+12+17.
const matches = [
  match({
    date: "2026-11-02T17:00:00Z",
    a: 21,
    b: 15,
    lines: [
      { id: "a", team: "A", box: { oreb: 1, dreb: 3, fg2m: 5, fg2a: 9 } },
      { id: "b", team: "A", box: { dreb: 6, fg2m: 5, fg2a: 10 } },
      { id: "c", team: "B", box: { dreb: 4, fg2m: 7, fg2a: 12 } },
      { id: "d", team: "B", box: { dreb: 2 } },
    ],
  }),
  match({
    date: "2026-11-04T17:00:00Z",
    a: 21,
    b: 18,
    lines: [
      { id: "a", team: "A", box: { dreb: 5, fg2m: 6, fg2a: 11 } },
      { id: "b", team: "A", box: { dreb: 7, fg2m: 4, fg2a: 9 } },
      { id: "c", team: "B", box: { dreb: 4, fg2m: 9, fg2a: 13 } },
      { id: "d", team: "B", box: { dreb: 3 } },
    ],
  }),
  match({
    date: "2026-11-06T17:00:00Z",
    a: 19,
    b: 21,
    lines: [
      { id: "a", team: "A", box: { dreb: 9, fg2m: 7, fg2a: 12, fg3m: 1, fg3a: 2 } },
      { id: "b", team: "A", box: { dreb: 6, fg2m: 1, fg2a: 6 } },
      { id: "c", team: "B", box: { dreb: 4, fg2m: 8, fg2a: 12 } },
      { id: "d", team: "B", box: { dreb: 2 } },
    ],
  }),
];
const ids = ["a", "b", "c", "d"];
const elo = computeElo(matches, ids);

const proposal = (yes: string[], startsAt = "2026-11-14T17:00:00Z"): Proposal => ({
  id: "p",
  startsAt,
  format: "2v2",
  note: null,
  createdBy: "a",
  status: "aperta",
  createdAt: "2026-11-10T10:00:00Z",
  responses: yes.map((playerId) => ({ playerId, response: "si", updatedAt: "" })),
});

describe("anteprima della partita", () => {
  it("dice quanti rimbalzi servono in una partita per passare chi sta davanti", () => {
    const all = pregameCandidates({ meId: "a", playerIds: ids, matches, proposal: proposal(["a", "c", "d", "x"]), elo });
    const reb = all.find((t) => t.kind === "sorpasso" && t.stat === "rimbalzi");
    // 7 non bastano (25/4 = 6,25 < 6,33), 8 sì (26/4 = 6,5).
    expect(reb?.need).toBe(8);
    expect(reb?.board?.rivalId).toBe("b");
    expect(reb?.board?.afterRank).toBe(1);
    expect(reb?.board?.rivalPlays).toBe(false);
  });

  it("segnala quando gioca anche chi va passato", () => {
    const all = pregameCandidates({ meId: "a", playerIds: ids, matches, proposal: proposal(["a", "b", "c", "d"]), elo });
    expect(all.find((t) => t.stat === "rimbalzi" && t.kind === "sorpasso")?.board?.rivalPlays).toBe(true);
  });

  it("non propone obiettivi oltre il tuo massimo in una partita", () => {
    // d per passare c nei rimbalzi ne dovrebbe prendere 10: non ne ha mai presi più di 3.
    const all = pregameCandidates({ meId: "d", playerIds: ids, matches, proposal: proposal(["a", "b", "c", "d"]), elo });
    expect(all.some((t) => t.stat === "rimbalzi" && t.kind === "sorpasso")).toBe(false);
  });

  it("trova i traguardi tondi e i record vicini", () => {
    const c = pregameCandidates({ meId: "c", playerIds: ids, matches, proposal: proposal(["a", "b", "c", "d"]), elo });
    expect(c.find((t) => t.kind === "traguardo" && t.stat === "punti")).toMatchObject({ need: 2, bar: { from: 48, to: 50 } });
    // Il record di punti è di c (18): a, con un massimo di 17, ne deve fare 19.
    const a = pregameCandidates({ meId: "a", playerIds: ids, matches, proposal: proposal(["a", "b", "c", "d"]), elo });
    expect(a.find((t) => t.kind === "record" && t.stat === "punti")).toMatchObject({ need: 19, bar: { from: 17, record: 18 } });
    expect(c.some((t) => t.kind === "record" && t.stat === "punti")).toBe(false);
  });

  it("ne mostra al massimo tre, di statistiche diverse", () => {
    const t = pregameTargets({ meId: "a", playerIds: ids, matches, proposal: proposal(["a", "b", "c", "d"]), elo });
    expect(t.length).toBeLessThanOrEqual(3);
    expect(new Set(t.map((x) => x.stat)).size).toBe(t.length);
  });

  it("si vede dalle 18 del giorno prima fino all'inizio, solo a chi ha detto sì", () => {
    const p = proposal(["a", "b", "c", "d"]); // sabato 14 alle 18 (ora italiana)
    expect(previewProposal([p], "a", new Date("2026-11-13T16:30:00Z"))).toBeNull(); // venerdì 17:30
    expect(previewProposal([p], "a", new Date("2026-11-13T17:05:00Z"))?.id).toBe("p"); // venerdì 18:05
    expect(previewProposal([p], "a", new Date("2026-11-14T09:00:00Z"))?.id).toBe("p"); // sabato mattina
    expect(previewProposal([p], "a", new Date("2026-11-14T17:01:00Z"))).toBeNull(); // già iniziata
    expect(previewProposal([p], "x", new Date("2026-11-14T09:00:00Z"))).toBeNull(); // non ha detto sì
    expect(previewProposal([proposal(["a", "b", "c"])], "a", new Date("2026-11-14T09:00:00Z"))).toBeNull(); // meno di 4
  });
});
