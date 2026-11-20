"use client";

import { useSyncExternalStore } from "react";
import type { Outfit, Preset } from "./build";
import type { Award } from "./podium-stage";

/**
 * Le foto dei personaggi 3D (podio e Home), salvate sul telefono: si mostrano subito, senza
 * scaricare il 3D. Si fanno dal 3D vero, quindi quando il 3D vivo prende il loro posto il
 * cambio non si vede. Al massimo qualche decina, le più vecchie si buttano.
 */
const NS = "campetto:figura3d:v1:";
const INDEX = `${NS}indice`;
const MAX = 36;

export interface PhotoSpec {
  preset: Preset;
  outfit: Outfit;
  number?: string;
  award: Award;
  w: number;
  h: number;
  /** Verso dove guarda (radianti). */
  yaw?: number;
}

export const photoDpr = () =>
  typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);

export const photoKey = (p: PhotoSpec) =>
  `${p.preset}|${JSON.stringify(p.outfit)}|${p.number ?? ""}|${p.award}|${p.yaw ?? ""}|${Math.round(p.w)}x${Math.round(p.h)}@${photoDpr()}`;

const mem = new Map<string, string | null>();
const listeners = new Set<() => void>();

export function readPhoto(key: string): string | null {
  if (mem.has(key)) return mem.get(key) ?? null;
  let v: string | null = null;
  try {
    v = localStorage.getItem(NS + key);
  } catch {
    /* niente memoria: si rifà */
  }
  mem.set(key, v);
  return v;
}

export function savePhoto(key: string, url: string) {
  mem.set(key, url);
  try {
    const list: string[] = JSON.parse(localStorage.getItem(INDEX) ?? "[]");
    const next = [...list.filter((k) => k !== key), key];
    while (next.length > MAX) {
      const old = next.shift()!;
      localStorage.removeItem(NS + old);
      mem.delete(old);
    }
    localStorage.setItem(NS + key, url);
    localStorage.setItem(INDEX, JSON.stringify(next));
  } catch {
    /* spazio finito: resta solo in memoria per questa volta */
  }
  for (const l of listeners) l();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/** La foto salvata (e si aggiorna da sola quando qualcuno la crea). */
export function usePhotoUrl(key: string | null): string | null {
  return useSyncExternalStore(
    subscribe,
    () => (key ? readPhoto(key) : null),
    () => null,
  );
}

let queue: Promise<void> = Promise.resolve();
/**
 * Crea le foto che mancano, una alla volta e quando il telefono è libero. Da chiamare solo
 * dove il 3D è già scaricato (la classifica): la Home poi le trova pronte.
 */
export function makePhotos(jobs: PhotoSpec[]) {
  for (const job of jobs) {
    const key = photoKey(job);
    if (readPhoto(key)) continue;
    queue = queue.then(
      () =>
        new Promise<void>((resolve) => {
          const run = async () => {
            try {
              const m = await import("./podium-stage");
              const url = await m.figurePhoto({ ...job, fig: job.h });
              if (url) savePhoto(key, url);
            } finally {
              resolve();
            }
          };
          const idle =
            window.requestIdleCallback ??
            ((cb: () => void) => window.setTimeout(cb, 200));
          idle(() => void run(), { timeout: 3000 });
        }),
    );
  }
}
