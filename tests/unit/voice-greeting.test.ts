import { describe, expect, it } from "vitest";
import { greeting } from "@/lib/greeting";
import { say } from "@/lib/voice";

describe("saluto in Home", () => {
  it("segue le fasce orarie", () => {
    expect(greeting(8).lead).toBe("Buongiorno");
    expect(greeting(12).lead).toBe("Buongiorno");
    expect(greeting(13).lead).toBe("Buon pomeriggio");
    expect(greeting(17).lead).toBe("Buon pomeriggio");
    expect(greeting(18).lead).toBe("Buonasera");
    expect(greeting(23).lead).toBe("Buonasera");
    expect(greeting(0)).toEqual({ lead: "Nottambulo oggi", question: true });
    expect(greeting(7).question).toBe(true);
  });
});

describe("la voce di Spicchio", () => {
  it("traduce gli errori in prima persona", () => {
    expect(say(new Error("Failed to fetch"))).toMatch(
      /^Ho perso la connessione/,
    );
    expect(
      say(
        new Error(
          'duplicate key value violates unique constraint "players_nickname_key"',
        ),
      ),
    ).toMatch(/nome ce l'ha già/);
    expect(say(new Error("Per il 3v3 servono 3 giocatori per squadra."))).toBe(
      "Per il 3v3 mi servono 3 giocatori per squadra",
    );
    expect(say(new Error("Il risultato non può essere un pareggio."))).toMatch(
      /non si pareggia/,
    );
    expect(say(new Error("boh"))).toBe(
      "Qualcosa non ha funzionato: riprova tra poco",
    );
  });
  it("nessun messaggio finisce con il punto", () => {
    for (const m of [
      "Failed to fetch",
      "JWT expired",
      "Invito non valido o scaduto.",
      "x",
    ])
      expect(say(new Error(m)).endsWith(".")).toBe(false);
  });
});
