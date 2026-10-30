import { describe, expect, it } from "vitest";
import { isOffensive, nickIdeas } from "@/lib/nickname-filter";
import { nameError, OFFENSIVE_NAME } from "@/lib/types";

describe("soprannomi: niente parole offensive", () => {
  it("blocca volgarità, insulti, bestemmie e odio, anche storpiati", () => {
    for (const n of ["Cazzone", "c4zz0", "C.A.Z.Z.O", "caaazzzo", "Merdina", "Fr0cio", "Porcodio", "porco dio", "D1oCane", "Puttan3lla", "Vaffanculo", "Coglione", "Stronzo", "Troia", "Fica", "Culo", "Ritardato", "Mongoloide", "Zingaro", "Terrone", "Hitler", "Nazi", "fuck3r", "sh1t", "N1gga", "Ass", "Bastardo", "Minchia"]) {
      expect(isOffensive(n), n).toBe(true);
    }
  });
  it("lascia passare i nomi normali (anche quelli che le librerie bloccano)", () => {
    for (const n of ["Springs", "Pegu", "Mocciaro", "Assist", "Figaro", "Pompeo", "Polentina", "Ficarra", "Negroni", "Nazionale", "Dio del canestro", "Bomber", "Cande", "Lampo", "Ritardatario", "Checco", "Splash", "Il Muro", "Mamba", "Diomede", "Scemo"]) {
      expect(isOffensive(n), n).toBe(false);
    }
  });
  it("lo dice con un messaggio gentile e propone idee libere", () => {
    expect(nameError("C4zz0ne", [], "p1")).toBe(OFFENSIVE_NAME);
    expect(OFFENSIVE_NAME).not.toMatch(/\.$/);
    const ideas = nickIdeas("Matteo", ["Splash"]);
    expect(ideas.length).toBe(3);
    expect(ideas).not.toContain("Splash");
    for (const i of ideas) expect(isOffensive(i)).toBe(false);
  });
});
