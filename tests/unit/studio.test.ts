import { describe, expect, it } from "vitest";
import {
  armAt,
  blinkAt,
  cameraAt,
  captionAt,
  chapters,
  lineAt,
  lookAt,
  mouthAt,
  screenAt,
  type StudioShow,
} from "@/lib/studio";

const show: StudioShow = {
  id: "x",
  day: "2026-11-09",
  hosts: { lui: "Lui", lei: "Lei" },
  audio: "/studio/x.m4a",
  duration: 30,
  screens: [
    { kind: "sigla", title: "Studio", subtitle: "" },
    { kind: "sigla", title: "Studio", subtitle: "" },
  ],
  shots: [
    { t: 0, cam: "ampio", screen: 0 },
    { t: 4, cam: "coppia", screen: 0 },
    { t: 10, cam: "schermo", screen: 1 },
  ],
  lines: [
    { who: "lui", t: 1, d: 2, text: "Uno", mouth: "0369" },
    { who: "lei", t: 4, d: 3, text: "Due", mouth: "9" },
  ],
  props: [{ t: 5, who: "lei", act: "foglio" }],
};

describe("Studio Campetto", () => {
  it("la telecamera si muove senza scatti tra un'inquadratura e l'altra", () => {
    const a = cameraAt(show, 3.99);
    const b = cameraAt(show, 4.01);
    expect(Math.abs(a.s - b.s)).toBeLessThan(0.02);
    expect(Math.abs(a.x - b.x)).toBeLessThan(3);
    // A movimento finito è zoomata sullo schermo.
    expect(cameraAt(show, 12).s).toBeGreaterThan(1.8);
  });

  it("sa quale grafica c'è e da quando", () => {
    expect(screenAt(show, 2)).toEqual({ index: 0, since: 0 });
    expect(screenAt(show, 11)).toEqual({ index: 1, since: 10 });
  });

  it("muove la bocca solo di chi parla, seguendo la voce", () => {
    const l = lineAt(show, 1.05)!;
    expect(l.text).toBe("Uno");
    expect(mouthAt(l, "lui", 1.0)).toBe(0);
    expect(mouthAt(l, "lui", 1 + 3 / 30)).toBe(1);
    expect(mouthAt(l, "lei", 1.1)).toBe(0);
    expect(lineAt(show, 3.5)).toBeNull();
  });

  it("chi ascolta guarda chi parla, chi parla guarda in camera", () => {
    const l = lineAt(show, 5)!;
    expect(lookAt(l, "lui", 5)).toBe(-1);
    expect(lookAt(l, "lei", 5)).toBe(0);
  });

  it("i sottotitoli restano un attimo dopo la battuta", () => {
    expect(captionAt(show, 3.3)?.text).toBe("Uno");
    expect(captionAt(show, 3.8)).toBeNull();
  });

  it("alza il foglio e lo rimette giù; sbatte le palpebre ogni tanto", () => {
    expect(armAt(show, "lei", 4.9)).toBe(0);
    expect(armAt(show, "lei", 6)).toBe(1);
    expect(armAt(show, "lei", 8)).toBe(0);
    expect(armAt(show, "lui", 6)).toBe(0);
    const closed = Array.from({ length: 1800 }, (_, i) => blinkAt("lui", i / 60)).filter((v) => v < 0.5);
    expect(closed.length).toBeGreaterThan(0);
    expect(closed.length).toBeLessThan(30);
  });

  it("divide la barra in alto in una parte per grafica", () => {
    expect(chapters(show)).toEqual([
      { t: 0, end: 10 },
      { t: 10, end: 30 },
    ]);
  });
});
