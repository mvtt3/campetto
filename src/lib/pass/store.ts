"use client";

import { useSyncExternalStore } from "react";
import type { Slot } from "./catalog";

/**
 * Quello che decidi tu nel pass e nel camerino: livelli riscattati, cosa indossi, cosa hai
 * comprato o vinto, gli Spicchi spesi, i boost. Per l'anteprima resta sul telefono, per
 * giocatore; i progressi invece si ricalcolano sempre dalle partite.
 */
export interface PassState {
  /** Livelli già riscattati. */
  claimed: number[];
  /** Livelli col boost lasciato in sospeso perché i posti erano pieni. */
  pendingBoost: number[];
  /** Boost in tasca (al massimo 3). */
  boosts: number;
  /** Quando hai acceso un boost: vale per la prima giornata giocata dopo. */
  boostActivations: string[];
  /** Oggetti vinti o comprati (gli id del catalogo), oltre a quelli del pass. */
  owned: string[];
  /** Cosa indossi, per parte del corpo. */
  outfit: Partial<Record<Slot, string>>;
  /** Spicchi spesi alla bancarella. */
  spent: number;
  /** Spicchi presi fuori dalle partite: tiro del giorno, doppioni. */
  bonus: number;
  /** Il tiro del giorno: data (AAAA-MM-GG) e canestri. */
  shot: { day: string; made: number; prize: string | null } | null;
  /** Lo Spogliatoio già visto, per giornata. */
  lockerSeen: string[];
  /** La bancarella del giorno, fissata la prima volta che la apri. */
  stall?: { day: string; ids: string[] };
}

const EMPTY: PassState = {
  claimed: [],
  pendingBoost: [],
  boosts: 0,
  boostActivations: [],
  owned: [],
  outfit: {},
  spent: 0,
  bonus: 0,
  shot: null,
  lockerSeen: [],
};

const key = (playerId: string) => `campetto:pass:${playerId}`;
const cache = new Map<string, PassState>();
const listeners = new Set<() => void>();

function read(playerId: string): PassState {
  const hit = cache.get(playerId);
  if (hit) return hit;
  let s: PassState = EMPTY;
  try {
    const raw = localStorage.getItem(key(playerId));
    if (raw) s = { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    /* il telefono non salva: si parte da zero */
  }
  cache.set(playerId, s);
  return s;
}

export function updatePass(playerId: string, fn: (s: PassState) => PassState) {
  const prev = read(playerId);
  const next = fn(prev);
  if (next === prev) return;
  cache.set(playerId, next);
  try {
    localStorage.setItem(key(playerId), JSON.stringify(next));
  } catch {
    /* vale solo per ora */
  }
  for (const l of listeners) l();
}

/** Azzera l'anteprima (per rifare la prova da capo). */
export function resetPass(playerId: string) {
  updatePass(playerId, () => EMPTY);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith("campetto:pass:")) {
      cache.clear();
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
};

export function usePassState(playerId: string | undefined): PassState {
  return useSyncExternalStore(
    subscribe,
    () => (playerId ? read(playerId) : EMPTY),
    () => EMPTY,
  );
}

export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
