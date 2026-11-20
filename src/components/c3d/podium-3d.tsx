"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { Outfit, Preset } from "./build";
import {
  photoDpr,
  photoFresh,
  photoKey,
  readPhoto,
  savePhoto,
} from "./figure-photos";
import type { Award, PodiumSlot, PodiumStage } from "./podium-stage";
import { play } from "@/lib/sound";

/** Chi sta su un posto del podio, in 3D. */
export interface Figure3D {
  key: string;
  preset: Preset;
  outfit: Outfit;
  number?: string;
  award: Award;
}

const SOUND = {
  oro: "coppa",
  argento: "medaglia",
  bronzo: "applauso",
} as const;

let mod: Promise<typeof import("./podium-stage")> | null = null;
const load = () => (mod ??= import("./podium-stage"));

/**
 * Un solo palco per tutta l'app: cambiare classifica non ricrea il 3D (crearlo è la parte
 * lenta). Se la classifica non si apre per un po', si butta e libera la memoria.
 */
let shared: { canvas: HTMLCanvasElement; stage: PodiumStage } | null = null;
let disposeTimer = 0;

async function getShared() {
  if (shared) return shared;
  const m = await load();
  if (shared) return shared;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;opacity:0;pointer-events:none";
  canvas.dataset.testid = "podio-3d";
  const stage = new m.PodiumStage(canvas);
  // Ogni gesto ha il suo suono (se i suoni sono accesi).
  stage.onPlay = (award) => {
    if (award !== "riposo") play(SOUND[award]);
  };
  shared = { canvas, stage };
  return shared;
}

function release() {
  window.clearTimeout(disposeTimer);
  disposeTimer = window.setTimeout(() => {
    if (shared && !shared.canvas.isConnected) {
      shared.stage.dispose();
      shared = null;
    }
  }, 90_000);
}

/** Quanto aspettare che il podio finisca di salire prima di misurarlo. */
const SETTLE_MS = 850;

/**
 * Il podio 3D: prima le foto (salvate, identiche al 3D) o il disegno, poi, quando il telefono
 * è libero e il podio è fermo, il 3D vivo prende il loro posto senza che si veda. Da lì un
 * tocco fa partire il gesto e col dito si gira.
 */
export function usePodium3D(figs: (Figure3D | null)[] | null) {
  const root = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const boxes = useRef<(HTMLDivElement | null)[]>([]);
  const [live, setLive] = useState(false);
  const [sizes, setSizes] = useState<({ w: number; h: number } | null)[]>([]);
  const queued = useRef<number | null>(null);
  const liveRef = useRef(false);
  const sig = figs
    ? figs.map((f) => (f ? `${f.key}|${f.award}` : "-")).join(",")
    : "";
  const figsRef = useRef(figs);
  useLayoutEffect(() => {
    figsRef.current = figs;
  });

  // Le misure dei riquadri, prima di disegnare: servono a scegliere la foto giusta.
  useLayoutEffect(() => {
    if (!figs) return;
    setSizes(
      figs.map((f, i) => {
        const b = boxes.current[i];
        return f && b
          ? { w: Math.round(b.clientWidth), h: Math.round(b.clientHeight) }
          : null;
      }),
    );
    // Cambia chi c'è sul podio: si torna alle foto finché il 3D non è pronto di nuovo.
    setLive(false);
    liveRef.current = false;
    if (shared) shared.canvas.style.opacity = "0";
    // sig contiene già chi c'è e dove.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const measure = useCallback((): PodiumSlot[] | null => {
    const r = root.current?.getBoundingClientRect();
    const list = figsRef.current;
    if (!r || !list) return null;
    const out: PodiumSlot[] = [];
    list.forEach((f, i) => {
      const b = boxes.current[i]?.getBoundingClientRect();
      if (!f || !b || !b.width) return;
      out.push({
        ...f,
        cx: b.left - r.left + b.width / 2,
        bottom: b.bottom - r.top,
        w: Math.round(b.width),
        h: Math.round(b.height),
      });
    });
    return out;
  }, []);

  useEffect(() => {
    const el = root.current;
    const box = host.current;
    if (!figsRef.current || !el || !figsRef.current.some(Boolean)) return;
    let dead = false;
    let started = false;
    let timer = 0;
    const go = async () => {
      if (started || dead) return;
      started = true;
      const sh = await getShared();
      if (dead || !host.current) return;
      window.clearTimeout(disposeTimer);
      if (sh.canvas.parentElement !== host.current)
        host.current.appendChild(sh.canvas);
      const slots = measure();
      const r = root.current?.getBoundingClientRect();
      if (!slots || !r) return;
      sh.stage.resize(r.width, r.height);
      await sh.stage.setSlots(slots);
      if (dead) return;
      // Le foto che mancano si ritagliano da questo stesso fotogramma: la prossima volta sono pronte.
      const missing = slots.map((s) => !photoFresh(photoKey(s)));
      const shots = missing.some(Boolean) ? sh.stage.photos() : [];
      sh.stage.render();
      sh.canvas.style.opacity = "1";
      liveRef.current = true;
      setLive(true);
      // Si salvano dopo, una alla volta, quando il telefono è libero.
      void (async () => {
        const { breathe, encode } = await load();
        for (let i = 0; i < slots.length; i++) {
          const c = shots[i];
          if (!missing[i] || !c) continue;
          await breathe();
          const url = encode(c);
          if (url) savePhoto(photoKey(slots[i]), url);
        }
      })();
      if (queued.current !== null) {
        const i = queued.current;
        queued.current = null;
        const k = slots.findIndex((s) => s.key === figsRef.current?.[i]?.key);
        if (k >= 0) sh.stage.play(k);
      }
    };
    // Solo quando la classifica si vede davvero (le schede nascoste restano preparate ma ferme).
    const io = new IntersectionObserver(([e]) => {
      window.clearTimeout(timer);
      if (!e.isIntersecting || el.closest(".tab-off")) return;
      timer = window.setTimeout(() => {
        const idle =
          window.requestIdleCallback ??
          ((cb: () => void) => window.setTimeout(cb, 16));
        idle(() => void go(), { timeout: 1200 });
      }, SETTLE_MS);
    });
    io.observe(el);
    // Se cambia la larghezza (telefono girato) si rimettono a posto.
    const ro = new ResizeObserver(() => {
      if (!liveRef.current || !shared) return;
      const slots = measure();
      const r = root.current?.getBoundingClientRect();
      if (!slots || !r) return;
      shared.stage.resize(r.width, r.height);
      void shared.stage.setSlots(slots);
    });
    ro.observe(el);
    return () => {
      dead = true;
      window.clearTimeout(timer);
      io.disconnect();
      ro.disconnect();
      if (box && shared?.canvas.parentElement === box) {
        shared.canvas.style.opacity = "0";
        shared.canvas.remove();
      }
      release();
    };
  }, [sig, measure]);

  /** Indice del posto nel palco (che conta solo i posti in 3D). */
  const stageIndex = (i: number) => {
    const list = figsRef.current ?? [];
    return list.slice(0, i).filter(Boolean).length;
  };

  const bind = (i: number) => ({
    ref: (el: HTMLDivElement | null) => {
      boxes.current[i] = el;
    },
    onPointerDown: (e: React.PointerEvent) => {
      if (!liveRef.current || !shared) return;
      const st = shared.stage;
      st.pointerDown(stageIndex(i), e.clientX);
      const move = (ev: PointerEvent) => st.pointerMove(ev.clientX);
      const up = () => {
        st.pointerUp();
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
      };
      // Scorrendo la pagina il dito non gira il personaggio e non lo fa partire.
      const cancel = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
        st.pointerCancel();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancel);
    },
    // Il personaggio si tocca per farlo esultare: il gradino sotto porta al profilo.
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!liveRef.current) queued.current = i;
    },
  });

  const photoOf = (i: number): string | null => {
    const f = figs?.[i];
    const s = sizes[i];
    if (!f || !s) return null;
    return readPhoto(photoKey({ ...f, w: s.w, h: s.h }));
  };

  return { root, host, live, bind, photoOf, dpr: photoDpr() };
}
