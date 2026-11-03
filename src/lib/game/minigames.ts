import type { GameState, MiniGame } from "./types";
import { clamp, type Rng } from "./economy";
import { ZONE_CENTER } from "./match";

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
export const TRIPLE_SWEEP = 560;

export const isMoneyBall = (i: number) => i % PER_RACK === PER_RACK - 1;

/** Larghezza del verde nelle triple: un po' più larga se tiri bene nel gioco. */
export function tripleZone(s: Pick<GameState, "skills">): number {
  return clamp(0.085 + (s.skills.tiro - 45) / 650, 0.065, 0.14);
}

/** Verde pieno: dentro. Vicino al verde: ogni tanto. Fuori: quasi mai. */
export function tripleShot(pos: number, center: number, zone: number, rng: Rng): { made: boolean; green: boolean } {
  const d = Math.abs(pos - center);
  if (d <= zone / 2) return { made: rng() < 0.96, green: true };
  if (d <= zone) return { made: rng() < 0.35, green: false };
  return { made: rng() < 0.02, green: false };
}

export const tripleValue = (i: number, made: boolean) => (made ? (isMoneyBall(i) ? 2 : 1) : 0);

// ———————————— Tiri liberi ————————————

export const LIBERI_SWEEP = 820;

/** Il verde dei liberi: parte largo e a ogni canestro si stringe del 5%. */
export function liberiZone(s: Pick<GameState, "skills">, streak: number): number {
  const start = clamp(0.2 + (s.skills.tiro - 45) / 500, 0.16, 0.26);
  return Math.max(0.02, start * Math.pow(0.95, streak));
}

/**
 * I livelli dei liberi: ogni tre canestri di fila se ne aggiunge una. La barra corre di
 * più, poi il verde si sposta, poi respira (si allarga e si stringe), poi arriva un
 * difensore davanti, e alla fine balla anche il canestro.
 */
export const LIBERI_LEVELS = [
  { from: 0, name: "Riscaldamento", sweep: 820, move: 0, pulse: 0, defender: false, sway: 0 },
  { from: 3, name: "La barra corre", sweep: 650, move: 0, pulse: 0, defender: false, sway: 0 },
  { from: 6, name: "Il verde si sposta", sweep: 680, move: 0.11, pulse: 0, defender: false, sway: 0 },
  { from: 9, name: "Il verde respira", sweep: 660, move: 0.1, pulse: 0.45, defender: false, sway: 0 },
  { from: 12, name: "Arriva un difensore", sweep: 640, move: 0.1, pulse: 0.35, defender: true, sway: 0 },
  { from: 15, name: "Il canestro balla", sweep: 620, move: 0.06, pulse: 0.35, defender: true, sway: 0.5 },
] as const;
export type LiberiLevel = (typeof LIBERI_LEVELS)[number];

export function liberiLevel(streak: number): { n: number; lv: LiberiLevel } {
  let n = 0;
  LIBERI_LEVELS.forEach((l, i) => {
    if (streak >= l.from) n = i;
  });
  return { n: n + 1, lv: LIBERI_LEVELS[n] };
}

/** Dove sta il canestro che balla, in metri di lato, al tempo `t` (ms). */
export const swayAt = (lv: LiberiLevel, t: number) => lv.sway * Math.sin((2 * Math.PI * t) / 2600);

/** Il verde al tempo `t` (ms): quanto è largo e dove sta. Il difensore lo stringe di un quarto. */
export function liberiZoneAt(base: number, lv: LiberiLevel, t: number): { zone: number; center: number } {
  const zone = base * (lv.defender ? 0.75 : 1) * (1 + lv.pulse * Math.sin((2 * Math.PI * t) / 1400));
  // Il verde segue anche il canestro che balla: si tira quando passa in mezzo.
  const shift = lv.move * Math.sin((2 * Math.PI * t) / 1900) + (lv.sway ? 0.16 * Math.sin((2 * Math.PI * t) / 2600) : 0);
  const center = clamp(ZONE_CENTER + shift, zone / 2 + 0.05, 0.98 - zone / 2);
  return { zone: Math.max(0.012, zone), center };
}

/** Nei liberi o è dentro o è fuori: niente fortuna, conta solo il verde. */
export const liberiMade = (pos: number, center: number, zone: number) =>
  Math.abs(pos - center) <= zone / 2;

// ———————————— Schiacciate ————————————

export const DUNKS = [
  { id: "classica", name: "Classica a due mani", max: 44, ms: 1050, win: 0.12 },
  { id: "mulino", name: "Mulino a vento", max: 47, ms: 900, win: 0.09 },
  { id: "360", name: "360 gradi", max: 50, ms: 780, win: 0.065 },
] as const;

/** La chiusura (il terzo tocco) è la più difficile: finestra più stretta e più veloce. */
export const dunkStep = (d: Dunk, step: number) => ({ ms: step >= 2 ? d.ms * 0.88 : d.ms, win: step >= 2 ? d.win * 0.8 : d.win });
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
