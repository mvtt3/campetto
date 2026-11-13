import { describe, expect, it } from "vitest";
import {
  armAt,
  blinkAt,
  cameraAt,
  captionAt,
  captionPages,
  chapters,
  guestAt,
  replayFrame,
  lineAt,
  lookAt,
  modeAt,
  mouthAt,
  replayAt,
  screenAt,
  type StudioShow,
} from "@/lib/studio";

const show: StudioShow = {
  v: 2,
  id: "x",
  day: "2026-11-09",
  hosts: { lui: "Lui", lei: "Lei" },
  audio: "/studio/x.m4a",
  duration: 40,
  intro: 3,
  outro: { t: 36, next: null },
  credits: "",
  screens: [
    { kind: "sigla" },
    { kind: "numeri", kicker: "", tiles: [] },
    {
      kind: "replay",
      clips: [
        { src: "/h/a.mp4", from: 4, to: 7.5, game: 1, t: 26 },
        { src: "/h/b.mp4", from: 0, to: 3.5, game: 2, t: 29.5 },
      ],
    },
  ],
  shots: [
    { t: 3, cam: "coppia", screen: 0 },
    { t: 3, cam: "lui", screen: 0 },
    { t: 6, cam: "coppia", screen: 0 },
    { t: 10, cam: "schermo", screen: 1 },
    { t: 20, cam: "lei", screen: 1 },
    { t: 26, cam: "replay", screen: 2 },
    { t: 36, cam: "fine", screen: 2 },
  ],
  lines: [
    {
      who: "lui",
      t: 3.2,
      d: 2.4,
      text: "Buonasera e benvenuti allo Studio Campetto.",
      mouth: "0369",
      words: [
        ["Buonasera", 0, 0.5],
        ["e", 0.55, 0.6],
        ["benvenuti", 0.65, 1.1],
        ["allo", 1.15, 1.3],
        ["Studio", 1.35, 1.7],
        ["Campetto.", 1.75, 2.3],
      ],
    },
    { who: "lei", t: 6, d: 3, text: "Due", mouth: "9", words: [["Due", 0, 0.4]] },
  ],
  props: [{ t: 7, who: "lei", act: "foglio" }],
};

describe("Studio Campetto", () => {
  it("sigla, studio, replay e chiusura arrivano al momento giusto", () => {
    expect(modeAt(show, 1)).toBe("sigla");
    expect(modeAt(show, 12)).toBe("studio");
    expect(modeAt(show, 27)).toBe("replay");
    expect(modeAt(show, 37)).toBe("fine");
  });

  it("stacca netto sui presentatori, ma sul maxischermo ci arriva con lo zoom e ci resta", () => {
    // Stacco: un attimo prima e un attimo dopo il cambio, inquadrature completamente diverse.
    const a = cameraAt(show, 19.99);
    const b = cameraAt(show, 20.01);
    expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.s - b.s) * 100).toBeGreaterThan(50);
    // Zoom sul maxischermo: parte dall'inquadratura di prima e arriva in meno di un secondo.
    const z0 = cameraAt(show, 10.01);
    const z1 = cameraAt(show, 10.5);
    const z2 = cameraAt(show, 11);
    expect(z0.s).toBeLessThan(z1.s);
    expect(z1.s).toBeLessThan(z2.s);
    // Fermo finché non si stacca.
    expect(cameraAt(show, 14)).toEqual(cameraAt(show, 18));
  });

  it("i canestri del replay vanno interi, uno dopo l'altro", () => {
    expect(replayAt(show, 26.5)).toEqual({ screen: 2, clip: 0, local: 0.5 });
    expect(replayAt(show, 30)).toEqual({ screen: 2, clip: 1, local: 0.5 });
    expect(screenAt(show, 12)).toEqual({ index: 1, since: 10 });
  });

  it("sottotitoli a pagine corte, con la parola detta in quel momento", () => {
    const pages = captionPages(show.lines[0]);
    expect(pages.every((p) => p.to - p.from <= 2)).toBe(true);
    // Le pagine si toccano: niente buchi tra una e l'altra.
    pages.slice(1).forEach((p, i) => expect(p.s).toBe(pages[i].e));
    const c = captionAt(show, 3.2 + 1.4)!;
    expect(c.line.words[c.active][0]).toBe("Studio");
    expect(captionAt(show, 5.9)).toBeNull();
  });

  it("muove la bocca solo di chi parla; chi ascolta guarda chi parla", () => {
    const l = lineAt(show, 3.3)!;
    expect(mouthAt(l, "lui", 3.2 + 3 / 30)).toBe(1);
    expect(mouthAt(l, "lei", 3.3)).toBe(0);
    const l2 = lineAt(show, 7)!;
    expect(lookAt(l2, "lui", 7)).toBe(-1);
    expect(lookAt(l2, "lei", 7)).toBe(0);
  });

  it("alza il foglio e lo rimette giù; sbatte le palpebre ogni tanto", () => {
    expect(armAt(show, "lei", 6.9)).toBe(0);
    expect(armAt(show, "lei", 8)).toBe(1);
    expect(armAt(show, "lei", 10)).toBe(0);
    const closed = Array.from({ length: 1800 }, (_, i) => blinkAt("lui", i / 60)).filter((v) => v < 0.5);
    expect(closed.length).toBeGreaterThan(0);
    expect(closed.length).toBeLessThan(30);
  });

  it("la barra in alto ha la sigla, una parte per grafica e la chiusura", () => {
    const c = chapters(show);
    expect(c[0]).toEqual({ t: 0, end: 3 });
    expect(c[c.length - 1]).toEqual({ t: 36, end: 40 });
  });

  it("l'ospite entra con la sedia, si siede al centro, poi si alza ed esce", () => {
    const withGuest = { ...show, guest: { playerId: "p", name: "Ospite", enter: 10, sit: 13.4, rise: 30, exit: 32.6 } };
    expect(guestAt(withGuest, 9).on).toBe(false);
    const walking = guestAt(withGuest, 11);
    expect(walking.on && walking.x > 0 && walking.seat === 0).toBe(true);
    expect(guestAt(withGuest, 20)).toMatchObject({ on: true, x: 0, seat: 1, apart: 1 });
    expect(guestAt(withGuest, 31.5).x).toBeGreaterThan(0);
    expect(guestAt(withGuest, 33).on).toBe(false);
    // Con l'ospite seduto, il primo piano di lui segue il suo posto più a destra.
    const lui = cameraAt({ ...withGuest, shots: [{ t: 0, cam: "lui", screen: 0 }] }, 20);
    const luiSolo = cameraAt({ ...show, shots: [{ t: 0, cam: "lui", screen: 0 }] }, 20);
    expect(lui.x).toBeLessThan(luiSolo.x);
  });

  it("la regia del replay passa da un'inquadratura all'altra senza scatti", () => {
    const clip = { cam: [[0, 0.5, 0.8, 0.5], [1, 0.3, 0.4, 0.45]] as [number, number, number, number][] };
    expect(replayFrame(clip, 0.5)).toEqual({ cx: 0.4, w: 0.6000000000000001, cy: 0.475 });
    expect(replayFrame(clip, 5).w).toBe(0.4);
    expect(replayFrame({}, 1)).toEqual({ cx: 0.5, w: 1, cy: 0.5 });
  });
});
