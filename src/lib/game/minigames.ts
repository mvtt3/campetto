import type { GameState, MiniGame } from "./types";
import { clamp, type Rng } from "./economy";

/**
 * Le tre sfide con le classifiche condivise del gruppo. Ogni tentativo costa un
 * gettone; in classifica resta il tuo record di sempre (non si azzera mai).
 * A mezzanotte chi è primo prende il premio.
 */

export const MINI: Record<
  MiniGame,
  { name: string; line: string; how: string; unit: string; max?: number }
> = {
  triple: {
    name: "Gara delle triple",
    line: "5 carrelli da 5 palloni in 60 secondi",
    how: "Tieni premuto e lascia sul verde. L'ultimo pallone di ogni carrello vale doppio.",
    unit: "punti",
    max: 30,
  },
  liberi: {
    name: "Tiri liberi a oltranza",
    line: "Avanti finché non sbagli",
    how: "Ogni canestro il verde si stringe un po'. Al primo errore è finita.",
    unit: "di fila",
  },
  schiacciate: {
    name: "Gara delle schiacciate",
    line: "Rincorsa, stacco, chiusura: voti dei giudici da 30 a 50",
    how: "Tocca quando il pallino è nel cerchio, tre volte. Più è difficile la schiacciata, più può valere.",
    unit: "punti",
    max: 50,
  },
};

// ———————————— Gara delle triple ————————————

export const RACKS = 5;
export const PER_RACK = 5;
export const TRIPLE_SECONDS = 60;
export const TRIPLE_SWEEP = 620;

export const isMoneyBall = (i: number) => i % PER_RACK === PER_RACK - 1;

/** Larghezza del verde nelle triple: un po' più larga se tiri bene nel gioco. */
export function tripleZone(s: Pick<GameState, "skills">): number {
  return clamp(0.1 + (s.skills.tiro - 45) / 600, 0.08, 0.16);
}

/** Verde pieno: dentro. Vicino al verde: a volte. Fuori: quasi mai. */
export function tripleShot(pos: number, center: number, zone: number, rng: Rng): { made: boolean; green: boolean } {
  const d = Math.abs(pos - center);
  if (d <= zone / 2) return { made: true, green: true };
  if (d <= zone) return { made: rng() < 0.5, green: false };
  return { made: rng() < 0.03, green: false };
}

export const tripleValue = (i: number, made: boolean) => (made ? (isMoneyBall(i) ? 2 : 1) : 0);

// ———————————— Tiri liberi ————————————

export const LIBERI_SWEEP = 820;

/** Il verde dei liberi: parte largo e a ogni canestro si stringe del 7%. */
export function liberiZone(s: Pick<GameState, "skills">, streak: number): number {
  const start = clamp(0.2 + (s.skills.tiro - 45) / 500, 0.16, 0.26);
  return Math.max(0.018, start * Math.pow(0.93, streak));
}

/** Nei liberi o è dentro o è fuori: niente fortuna, conta solo il verde. */
export const liberiMade = (pos: number, center: number, zone: number) =>
  Math.abs(pos - center) <= zone / 2;

// ———————————— Schiacciate ————————————

export const DUNKS = [
  { id: "classica", name: "Classica a due mani", max: 44, ms: 1150, win: 0.16 },
  { id: "mulino", name: "Mulino a vento", max: 47, ms: 980, win: 0.12 },
  { id: "360", name: "360 gradi", max: 50, ms: 840, win: 0.09 },
] as const;
export type Dunk = (typeof DUNKS)[number];

export const DUNK_STEPS = ["Rincorsa", "Stacco", "Chiusura"] as const;

/** Precisione di un tocco: 1 al centro del cerchio, 0 fuori. */
export function tapQuality(p: number | null, win: number): number {
  if (p === null) return 0;
  return clamp(1 - Math.abs(p - 0.5) / win, 0, 1);
}

/** I cinque giudici, da 6 a 10 ciascuno. Una chiusura sbagliata vale il minimo. */
export function dunkScore(q: number[], dunk: Dunk, rng: Rng): { judges: number[]; total: number; missed: boolean } {
  const missed = (q[2] ?? 0) <= 0.05;
  const avg = q.reduce((a, b) => a + b, 0) / Math.max(1, q.length);
  const top = dunk.max / 5;
  const judges = Array.from({ length: 5 }, () => {
    if (missed) return 6;
    const v = 6 + (top - 6) * avg + (rng() - 0.5) * 1.2;
    return clamp(Math.round(v), 6, 10);
  });
  // Il massimo vero si prende solo con tre tocchi perfetti.
  if (!missed && q.length === 3 && q.every((x) => x >= 0.92)) {
    const base = Math.floor(dunk.max / 5);
    judges.forEach((_, i) => (judges[i] = base + (i < dunk.max % 5 ? 1 : 0)));
  }
  // Mai oltre il massimo di quella schiacciata.
  let total = judges.reduce((a, b) => a + b, 0);
  for (let i = 0; total > dunk.max; i = (i + 1) % 5)
    if (judges[i] > 6) {
      judges[i]--;
      total--;
    }
  return { judges, total, missed };
}
