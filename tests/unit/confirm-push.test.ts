import { describe, expect, it } from "vitest";
import { confirmedInvite, confirmedPush, proposalUrl } from "@/lib/notifications/confirm";

const now = new Date("2026-11-05T10:00:00Z");
const m = { startsAt: "2026-11-07T09:00:00Z", place: "indoor" as const, yes: 6 };

describe("notifica di partita confermata", () => {
  it("a chi ha detto ci sono: quando, dove, quanti", () => {
    expect(confirmedPush(m, now)).toEqual({
      title: "✅ Partita confermata",
      body: "Sabato alle 10:00 al campetto indoor: siete in 6, si gioca. Se non puoi più venire, dillo nell'app",
    });
  });
  it("a chi non ha risposto: l'invito", () => {
    expect(confirmedInvite(m, now).body).toBe("Sabato alle 10:00 al campetto indoor: siete già in 6. Vuoi esserci anche tu?");
  });
  it("porta al giorno giusto nel calendario", () => {
    expect(proposalUrl("x", m.startsAt)).toBe("/organizza?giorno=2026-11-07&p=x");
  });
});
