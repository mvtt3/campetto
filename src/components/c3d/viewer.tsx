"use client";

import clsx from "clsx";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Outfit, Preset } from "./build";
import type { Framing, Stage } from "./stage";

/**
 * Il 3D si scarica solo quando serve (three.js pesa): la prima volta che compare un
 * personaggio vivo o una foto. Poi resta in memoria.
 */
let mod: Promise<typeof import("./stage")> | null = null;
export const loadStage = () => (mod ??= import("./stage"));

/** Il personaggio vivo: si gira col dito, palleggia se lo tocchi. Uno solo per schermata. */
export function Statuina({
  preset,
  outfit,
  number,
  framing = "full",
  interactive = true,
  className,
  onReady,
  yaw,
  paused = false,
  spin,
  pivot,
}: {
  preset: Preset;
  outfit: Outfit;
  number?: string;
  framing?: Framing;
  interactive?: boolean;
  className?: string;
  onReady?: () => void;
  yaw?: number;
  /** Fermo mentre c'è sopra un'altra finestra col 3D. */
  paused?: boolean;
  /** Gira da solo piano (radianti al secondo), come in vetrina. */
  spin?: number;
  /** Gira attorno al pallone o al braccio invece che attorno al personaggio. */
  pivot?: "pallone" | "braccio";
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<Stage | null>(null);
  const [ready, setReady] = useState(false);
  const latest = useRef({ preset, outfit, number, framing });
  const readyCb = useRef(onReady);
  const pausedRef = useRef(paused);
  // Gli ultimi valori, per il palco che si crea in ritardo (dopo aver scaricato il 3D).
  useLayoutEffect(() => {
    latest.current = { preset, outfit, number, framing };
    readyCb.current = onReady;
    pausedRef.current = paused;
  });

  useEffect(() => {
    let dead = false;
    void loadStage().then(async (m) => {
      await m.preloadTextures();
      if (dead || !canvas.current) return;
      const l = latest.current;
      const s = new m.Stage(canvas.current, { interactive, framing: l.framing, yaw, spin, pivot });
      s.onFirstFrame = () => {
        setReady(true);
        readyCb.current?.();
      };
      s.setCharacter(l.preset, l.outfit, l.number);
      if (pausedRef.current) s.setPaused(true);
      stage.current = s;
    });
    return () => {
      dead = true;
      stage.current?.dispose();
      stage.current = null;
    };
    // Il palco si crea una volta: i cambi arrivano dagli effetti qui sotto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const outfitKey = JSON.stringify(outfit);
  useEffect(() => {
    stage.current?.setCharacter(preset, outfit, number);
    // outfitKey al posto di outfit: lo stesso vestito non ricostruisce il personaggio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, outfitKey, number]);
  useEffect(() => {
    stage.current?.setFraming(framing);
  }, [framing]);
  useEffect(() => {
    stage.current?.setPaused(paused);
  }, [paused]);

  return (
    <canvas
      ref={canvas}
      aria-label="Il tuo personaggio in 3D: trascina per girarlo, tocca per palleggiare"
      role="img"
      className={clsx("block h-full w-full transition-opacity duration-500", ready ? "opacity-100" : "opacity-0", className)}
    />
  );
}

/* ---------------------------------------------------------------- */
/* Le foto: una alla volta, quando il telefono è libero              */
/* ---------------------------------------------------------------- */

const photos = new Map<string, string>();
const waiting = new Map<string, ((url: string) => void)[]>();
/** Chi aspetta una foto senza chiederla (la Home): la riceve appena qualcuno la crea. */
const watchers = new Map<string, Set<(url: string) => void>>();
const queue: { key: string; persist: boolean; make: (m: typeof import("./stage")) => Promise<Blob | null> }[] = [];
let running = false;

/**
 * Le foto piccole che servono anche fuori dal pass (la Home) restano salvate sul telefono:
 * così la Home le mostra subito senza scaricare il 3D.
 */
// v2: scarpe da sneaker vere e catena ad anelli (le foto vecchie si buttano).
const SAVED = "campetto:foto3d:v2:";
let swept = false;
function sweepOld() {
  if (swept) return;
  swept = true;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith("campetto:foto3d:") && !k.startsWith(SAVED)) localStorage.removeItem(k);
    }
  } catch {
    /* niente memoria: niente da pulire */
  }
}
function saved(key: string): string | null {
  sweepOld();
  try {
    return localStorage.getItem(SAVED + key);
  } catch {
    return null;
  }
}
function save(key: string, blob: Blob) {
  const r = new FileReader();
  r.onload = () => {
    try {
      localStorage.setItem(SAVED + key, String(r.result));
    } catch {
      /* spazio finito: si rifà la prossima volta */
    }
  };
  r.readAsDataURL(blob);
}

function pump() {
  if (running) return;
  const job = queue.shift();
  if (!job) return;
  running = true;
  const idle = (cb: () => void) =>
    window.requestIdleCallback ? window.requestIdleCallback(cb, { timeout: 400 }) : window.setTimeout(cb, 16);
  idle(() => {
    void loadStage()
      .then(async (m) => {
        await m.preloadTextures();
        const blob = await job.make(m);
        if (!blob) throw new Error("foto vuota");
        const url = URL.createObjectURL(blob);
        if (job.persist) save(job.key, blob);
        photos.set(job.key, url);
        for (const cb of waiting.get(job.key) ?? []) cb(url);
        for (const cb of watchers.get(job.key) ?? []) cb(url);
        waiting.delete(job.key);
      })
      .catch(() => waiting.delete(job.key))
      .finally(() => {
        running = false;
        pump();
      });
  });
}

/**
 * Una foto del personaggio (già pronta se l'hai vista prima).
 * `make: false` non la crea: mostra solo quella salvata (per la Home, che resta leggera).
 */
export function usePhoto(
  preset: Preset,
  outfit: Outfit,
  framing: Framing,
  size = 176,
  opts: { make?: boolean; persist?: boolean } = {},
): string | null {
  const key = `${preset}|${framing}|${size}|${JSON.stringify(outfit)}`;
  const make = opts.make ?? true;
  const persist = opts.persist ?? false;
  const [url, setUrl] = useState(() => photos.get(key) ?? null);
  useEffect(() => {
    const hit = photos.get(key) ?? (persist || !make ? saved(key) : null);
    if (hit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrl(hit);
      return;
    }
    setUrl(null);
    if (!make) {
      const set = watchers.get(key) ?? new Set();
      const w = (u: string) => setUrl(u);
      set.add(w);
      watchers.set(key, set);
      return () => {
        set.delete(w);
      };
    }
    let live = true;
    const cb = (u: string) => {
      if (live) setUrl(u);
    };
    const list = waiting.get(key);
    if (list) list.push(cb);
    else {
      waiting.set(key, [cb]);
      queue.push({ key, persist, make: (m) => m.snapshot(preset, outfit, framing, size) });
      pump();
    }
    return () => {
      live = false;
    };
    // La chiave contiene già tutto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, make, persist]);
  return url;
}

export function Photo({
  preset,
  outfit,
  framing,
  size = 176,
  className,
  alt = "",
  make,
  persist,
  fallback,
}: {
  preset: Preset;
  outfit: Outfit;
  framing: Framing;
  size?: number;
  className?: string;
  alt?: string;
  make?: boolean;
  persist?: boolean;
  /** Cosa mostrare se la foto non c'è e non si crea. */
  fallback?: React.ReactNode;
}) {
  const url = usePhoto(preset, outfit, framing, size, { make, persist });
  return (
    <span className={clsx("block overflow-hidden", !className?.includes("absolute") && "relative", className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} draggable={false} className="photo-in h-full w-full object-cover" />
      ) : make === false ? (
        fallback
      ) : (
        <span className="photo-wait absolute inset-0" aria-hidden />
      )}
    </span>
  );
}
