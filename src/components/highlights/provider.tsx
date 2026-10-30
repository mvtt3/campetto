"use client";

import dynamic from "next/dynamic";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useData } from "@/lib/data/provider";
import { feedOrder } from "@/lib/highlights";
import type { Highlight } from "@/lib/types";

// Il feed si scarica solo quando serve: chi non apre gli highlights non lo paga.
const Feed = dynamic(() => import("./feed"), { ssr: false });

interface HighlightsApi {
  /** Ci sono highlights da vedere (per ora solo per l'amministratore). */
  available: boolean;
  forMatch: (matchId: string) => Highlight | undefined;
  /** Apre il feed sul video di quella partita. replace: prende il posto della scheda partita. */
  open: (matchId: string, opts?: { replace?: boolean }) => void;
  /** Mai aperto su questo telefono: pallino delle novità. */
  unseen: (matchId: string) => boolean;
}

const Ctx = createContext<HighlightsApi>({
  available: false,
  forMatch: () => undefined,
  open: () => {},
  unseen: () => false,
});
export const useHighlights = () => useContext(Ctx);

const SEEN_KEY = "campetto:highlights-visti";
const MUSIC_KEY = "campetto:highlights-musica";
/** La base del feed: composta per il Campetto, già bassa di suo (−23 LUFS). */
const MUSIC_URL = "/hl-musica.m4a";
const MUSIC_VOLUME = 0.6;

/** La musica sotto ai video: accesa, spenta da te, o bloccata dal telefono (serve un tocco). */
export interface Music {
  state: "on" | "off" | "blocked";
  toggle: () => void;
  /** Video in pausa: la musica aspetta. */
  hold: (held: boolean) => void;
}

function musicWanted(): boolean {
  try {
    return localStorage.getItem(MUSIC_KEY) !== "off";
  } catch {
    return true;
  }
}

/** Il volume sale e scende piano (dove il telefono lo permette; su iPhone resta fisso). */
function fade(a: HTMLAudioElement, to: number, ms: number, done?: () => void) {
  const from = a.volume;
  const start = performance.now();
  const id = window.setInterval(() => {
    const k = Math.min(1, (performance.now() - start) / ms);
    try {
      a.volume = from + (to - from) * k;
    } catch {
      /* volume non regolabile */
    }
    if (k >= 1) {
      window.clearInterval(id);
      done?.();
    }
  }, 30);
  return () => window.clearInterval(id);
}

function readSeen(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** L'indirizzo del feed: ?h=<partita>. Indietro (anche col tasto del telefono) lo chiude. */
function urlWith(h: string | null): string {
  const u = new URL(window.location.href);
  u.searchParams.delete("m");
  u.searchParams.delete("c");
  if (h) u.searchParams.set("h", h);
  else u.searchParams.delete("h");
  return u.pathname + u.search;
}

export function HighlightsProvider({ children }: { children: ReactNode }) {
  const { data } = useData();
  const items = useMemo(
    () => feedOrder(data.highlights ?? [], data.matches),
    [data.highlights, data.matches],
  );
  const [view, setView] = useState<{
    startId: string;
    closing: boolean;
  } | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [musicState, setMusicState] = useState<Music["state"]>("off");
  const audio = useRef<HTMLAudioElement | null>(null);
  const stopFade = useRef<(() => void) | null>(null);
  const held = useRef(false);

  const audioEl = useCallback(() => {
    if (!audio.current) {
      const a = new Audio(MUSIC_URL);
      a.loop = true;
      a.preload = "auto";
      audio.current = a;
    }
    return audio.current;
  }, []);

  /** Parte dentro il tocco (così anche l'iPhone la lascia suonare), sempre dall'inizio. */
  const startMusic = useCallback(
    (fromStart: boolean) => {
      const a = audioEl();
      stopFade.current?.();
      if (fromStart) {
        try {
          a.currentTime = 0;
        } catch {
          /* non ancora caricata */
        }
      }
      try {
        a.volume = 0;
      } catch {
        /* ok */
      }
      a.play().then(
        () => {
          setMusicState("on");
          stopFade.current = fade(a, MUSIC_VOLUME, 1200);
        },
        (e: DOMException) => {
          // Fermata da una pausa subito dopo: non è un blocco.
          if (e?.name === "NotAllowedError") setMusicState("blocked");
        },
      );
    },
    [audioEl],
  );

  const stopMusic = useCallback((ms = 250) => {
    const a = audio.current;
    if (!a) return;
    stopFade.current?.();
    if (a.paused) return;
    stopFade.current = fade(a, 0, ms, () => a.pause());
  }, []);
  // Aperto da dentro l'app (c'è un passo nella cronologia da togliere) o da un link diretto.
  const entered = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeen(readSeen());
  }, []);

  const byMatch = useMemo(
    () => new Map(items.map((h) => [h.matchId, h])),
    [items],
  );

  const markSeen = useCallback((matchId: string) => {
    setSeen((s) => {
      if (s.includes(matchId)) return s;
      const next = [...s, matchId].slice(-200);
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(next));
      } catch {
        /* resta il pallino, pazienza */
      }
      return next;
    });
  }, []);

  const open = useCallback(
    (matchId: string, opts?: { replace?: boolean }) => {
      const h = byMatch.get(matchId);
      if (!h) return;
      entered.current = true;
      const url = urlWith(matchId);
      if (opts?.replace) window.history.replaceState(null, "", url);
      else window.history.pushState(null, "", url);
      markSeen(matchId);
      held.current = false;
      if (musicWanted()) startMusic(true);
      else setMusicState("off");
      setView({ startId: h.id, closing: false });
    },
    [byMatch, markSeen, startMusic],
  );

  // Link diretto (es. da una notifica): ?h=<partita> apre il feed appena ci sono i dati.
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || !items.length) return;
    const m = new URLSearchParams(window.location.search).get("h");
    if (!m) return;
    deepLinked.current = true;
    const h = byMatch.get(m);
    if (!h) {
      window.history.replaceState(null, "", urlWith(null));
      return;
    }
    entered.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    markSeen(m);
    // Senza un tocco il telefono di solito non fa partire la musica: ci prova, se no la chiede.
    if (musicWanted()) startMusic(true);
    setView({ startId: h.id, closing: false });
  }, [items, byMatch, markSeen, startMusic]);

  // Indietro: se l'indirizzo non ha più ?h, il feed esce con la sua animazione.
  useEffect(() => {
    if (!view || view.closing) return;
    const onPop = () => {
      if (!new URLSearchParams(window.location.search).has("h"))
        setView((v) => (v ? { ...v, closing: true } : v));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [view]);

  const requestClose = useCallback(() => {
    if (!new URLSearchParams(window.location.search).has("h")) {
      setView((v) => (v ? { ...v, closing: true } : v));
      return;
    }
    if (entered.current) window.history.back();
    else {
      window.history.replaceState(null, "", urlWith(null));
      setView((v) => (v ? { ...v, closing: true } : v));
    }
  }, []);

  const finishClose = useCallback(() => setView(null), []);

  // Il feed si chiude: la musica sfuma (solo allora: all'apertura non si tocca).
  const closing = view?.closing === true;
  useEffect(() => {
    if (closing) stopMusic(220);
  }, [closing, stopMusic]);

  // Telefono bloccato o app in sottofondo: silenzio; al ritorno riprende (se era accesa).
  useEffect(() => {
    if (!view || view.closing) return;
    const onVis = () => {
      if (document.hidden) {
        stopFade.current?.();
        audio.current?.pause();
      } else if (musicState === "on" && !held.current) startMusic(false);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [view, musicState, startMusic]);

  const music = useMemo<Music>(
    () => ({
      state: musicState,
      toggle: () => {
        if (musicState === "on") {
          try {
            localStorage.setItem(MUSIC_KEY, "off");
          } catch {
            /* ok */
          }
          setMusicState("off");
          stopMusic(200);
        } else {
          try {
            localStorage.setItem(MUSIC_KEY, "on");
          } catch {
            /* ok */
          }
          // Dentro il tocco: è il permesso che serviva.
          startMusic(false);
        }
      },
      hold: (h: boolean) => {
        if (held.current === h) return;
        held.current = h;
        if (musicState !== "on") return;
        if (h) stopMusic(180);
        else startMusic(false);
      },
    }),
    [musicState, startMusic, stopMusic],
  );

  const api = useMemo<HighlightsApi>(
    () => ({
      available: items.length > 0,
      forMatch: (id) => byMatch.get(id),
      open,
      unseen: (id) => byMatch.has(id) && !seen.includes(id),
    }),
    [items.length, byMatch, open, seen],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {view &&
        items.length > 0 &&
        createPortal(
          <Feed
            items={items}
            startId={view.startId}
            closing={view.closing}
            onRequestClose={requestClose}
            onClosed={finishClose}
            onSeen={markSeen}
            music={music}
          />,
          document.body,
        )}
    </Ctx.Provider>
  );
}
