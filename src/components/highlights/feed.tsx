"use client";

import clsx from "clsx";
import { ChevronLeft, Volume2, VolumeX } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { haptic } from "@/components/ui/basics";
import { useToast } from "@/components/ui/toast";
import { useData } from "@/lib/data/provider";
import { highlightTitle, scoreOf, tickerItems } from "@/lib/highlights";
import type { Highlight, HighlightSocial } from "@/lib/types";
import { CommentsPanel, type ShownComment } from "./comments";
import type { Music } from "./provider";
import { Slide } from "./slide";

const FADE_MS = 260;

/**
 * Il feed degli highlights, a schermo intero: un video per partita, si scorre in verticale
 * a scatti. Finito un video, dissolvenza e parte il successivo. Pallone (mi piace) e commenti
 * sono ottimisti: si vedono subito, poi si salvano; se qualcosa va storto si torna indietro.
 */
export default function HighlightsFeed({
  items,
  startId,
  closing,
  onRequestClose,
  onClosed,
  onSeen,
  music,
}: {
  music: Music;
  items: Highlight[];
  startId: string;
  closing: boolean;
  onRequestClose: () => void;
  onClosed: () => void;
  onSeen: (matchId: string) => void;
}) {
  const { data, me, backend } = useData();
  const toast = useToast();
  const scroller = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const startIndex = Math.max(
    0,
    items.findIndex((h) => h.id === startId),
  );
  const [active, setActive] = useState(startIndex);
  const activeRef = useRef(active);
  useLayoutEffect(() => {
    activeRef.current = active;
  }, [active]);
  const [fading, setFading] = useState(false);
  const [entered, setEntered] = useState(false);

  // --- Like e commenti: dal database, più le modifiche ancora in viaggio. ---
  const [social, setSocial] = useState<HighlightSocial | null>(null);
  const [socialError, setSocialError] = useState(false);
  const [likeWish, setLikeWish] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<ShownComment[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const ids = useMemo(() => items.map((h) => h.id), [items]);

  const loadSocial = useCallback(async () => {
    try {
      const s = await backend.loadHighlightSocial(ids);
      setSocial(s);
      setSocialError(false);
    } catch {
      setSocialError(true);
    }
  }, [backend, ids]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSocial();
    // Gli altri mettono like o commentano mentre guardi: si aggiorna da solo (a raffica, una volta).
    let t: number | null = null;
    const off = backend.subscribeHighlights(() => {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => void loadSocial(), 350);
    });
    return () => {
      off();
      if (t) window.clearTimeout(t);
    };
  }, [backend, loadSocial]);

  // Il pallone: si vede subito; si salva in coda, e conta solo l'ultimo tocco.
  const inFlight = useRef(new Set<string>());
  const wishRef = useRef(likeWish);
  useLayoutEffect(() => {
    wishRef.current = likeWish;
  }, [likeWish]);
  const syncLike = useCallback(
    async (id: string) => {
      if (inFlight.current.has(id)) return;
      inFlight.current.add(id);
      try {
        let sent: boolean | undefined;
        while (
          wishRef.current[id] !== undefined &&
          wishRef.current[id] !== sent
        ) {
          sent = wishRef.current[id];
          await backend.setHighlightLike(id, sent);
        }
        const s = await backend.loadHighlightSocial(ids);
        setSocial(s);
        setLikeWish((w) => {
          if (w[id] !== sent) return w;
          const next = { ...w };
          delete next[id];
          return next;
        });
      } catch {
        setLikeWish((w) => {
          const next = { ...w };
          delete next[id];
          return next;
        });
        toast("Spicchio non è riuscito a salvare il pallone", "error");
      } finally {
        inFlight.current.delete(id);
      }
    },
    [backend, ids, toast],
  );

  const onLike = useCallback(
    (id: string, on: boolean) => {
      if (on) haptic(12);
      setLikeWish((w) => ({ ...w, [id]: on }));
      wishRef.current = { ...wishRef.current, [id]: on };
      void syncLike(id);
    },
    [syncLike],
  );

  const likeInfo = useMemo(() => {
    const out = new Map<string, { count: number; liked: boolean }>();
    for (const h of items) {
      const all = social?.likes.filter((l) => l.highlightId === h.id) ?? [];
      const serverLiked = all.some((l) => l.playerId === me?.id);
      const wish = likeWish[h.id];
      const liked = wish ?? serverLiked;
      out.set(h.id, {
        liked,
        count: all.length + (liked === serverLiked ? 0 : liked ? 1 : -1),
      });
    }
    return out;
  }, [items, social, likeWish, me?.id]);

  const commentsOf = useCallback(
    (id: string): ShownComment[] => {
      const saved = (social?.comments ?? []).filter(
        (c) => c.highlightId === id && !hidden.includes(c.id),
      );
      const mine = pending.filter((c) => c.highlightId === id);
      return [...saved, ...mine];
    },
    [social, pending, hidden],
  );

  const sendComment = useCallback(
    async (c: ShownComment) => {
      setPending((p) => [
        ...p.filter((x) => x.id !== c.id),
        { ...c, state: "sending" },
      ]);
      try {
        const saved = await backend.addHighlightComment(c.highlightId, c.body);
        // Prima entra quello salvato, poi sparisce la copia in viaggio: niente salti.
        setSocial((s) =>
          s && !s.comments.some((x) => x.id === saved.id)
            ? { ...s, comments: [...s.comments, saved] }
            : s,
        );
        setPending((p) => p.filter((x) => x.id !== c.id));
      } catch (e) {
        setPending((p) =>
          p.map((x) => (x.id === c.id ? { ...x, state: "failed" } : x)),
        );
        toast(
          e instanceof Error && e.message
            ? e.message
            : "Il commento non è partito",
          "error",
        );
      }
    },
    [backend, toast],
  );

  const onSend = useCallback(
    (body: string) => {
      if (!commentsFor || !me) return;
      void sendComment({
        id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        highlightId: commentsFor,
        playerId: me.id,
        body,
        createdAt: new Date().toISOString(),
      });
    },
    [commentsFor, me, sendComment],
  );

  const onDelete = useCallback(
    async (c: ShownComment) => {
      if (c.id.startsWith("tmp-")) {
        setPending((p) => p.filter((x) => x.id !== c.id));
        return;
      }
      setHidden((h) => [...h, c.id]);
      try {
        await backend.deleteHighlightComment(c.id);
        setSocial((s) =>
          s ? { ...s, comments: s.comments.filter((x) => x.id !== c.id) } : s,
        );
      } catch {
        setHidden((h) => h.filter((x) => x !== c.id));
        toast("Non sono riuscito a eliminarlo", "error");
      }
    },
    [backend, toast],
  );

  // --- Scorrimento: quale video si guarda. ---
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = startIndex * el.clientHeight;
    // Solo all'apertura: poi decide chi scorre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = Math.min(
          items.length - 1,
          Math.max(0, Math.round(el.scrollTop / Math.max(1, el.clientHeight))),
        );
        if (i !== activeRef.current) setActive(i);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [items.length]);

  // Ruotando il telefono cambia l'altezza: si resta sullo stesso video.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      el.scrollTop = activeRef.current * el.clientHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const h = items[active];
    if (h) onSeen(h.matchId);
  }, [active, items, onSeen]);

  const goTo = useCallback(
    (i: number, smooth = true) => {
      const el = scroller.current;
      if (!el) return;
      const target = Math.min(items.length - 1, Math.max(0, i));
      el.scrollTo({
        top: target * el.clientHeight,
        behavior: smooth ? "smooth" : "instant",
      });
    },
    [items.length],
  );

  // Finito un video: dissolvenza al nero, si passa al prossimo, dissolvenza al video.
  const fadeTimer = useRef<number | null>(null);
  const onEnded = useCallback(
    (i: number) => {
      if (i !== activeRef.current) return;
      if (i >= items.length - 1) {
        // L'ultimo ricomincia: è finita la serata.
        const v = scroller.current?.querySelectorAll("video");
        const el = [...(v ?? [])].find(
          (x) => x.closest("[data-active]") !== null,
        );
        if (el) {
          el.currentTime = 0;
          void el.play().catch(() => {});
        }
        return;
      }
      setFading(true);
      fadeTimer.current = window.setTimeout(() => {
        goTo(i + 1, false);
        setActive(i + 1);
        fadeTimer.current = window.setTimeout(() => setFading(false), 40);
      }, FADE_MS);
    },
    [items.length, goTo],
  );
  useEffect(
    () => () => {
      if (fadeTimer.current) window.clearTimeout(fadeTimer.current);
    },
    [],
  );

  // --- Commenti: si aprono con un passo nella cronologia, così "indietro" li chiude. ---
  const openComments = useCallback((id: string) => {
    setCommentsFor(id);
    const u = new URL(window.location.href);
    u.searchParams.set("c", "1");
    window.history.pushState(null, "", u.pathname + u.search);
  }, []);
  const closeComments = useCallback(() => {
    if (new URLSearchParams(window.location.search).has("c"))
      window.history.back();
    else setCommentsFor(null);
  }, []);
  useEffect(() => {
    const onPop = () => {
      if (!new URLSearchParams(window.location.search).has("c"))
        setCommentsFor(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // --- Apertura e chiusura animate. ---
  useEffect(() => {
    const t = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(t);
  }, []);
  useEffect(() => {
    if (!closing) return;
    const t = window.setTimeout(onClosed, 240);
    return () => window.clearTimeout(t);
  }, [closing, onClosed]);

  // Tastiera (o telecomando): frecce per scorrere, spazio per la pausa, Esc per uscire.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (commentsFor) {
        if (e.key === "Escape") closeComments();
        return;
      }
      if (e.key === "Escape") onRequestClose();
      else if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        goTo(activeRef.current + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goTo(activeRef.current - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commentsFor, closeComments, onRequestClose, goTo]);

  // Il fuoco entra nel feed e, all'uscita, torna dove era.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    // Il fuoco si sposta senza l'anello arancione: serve alla tastiera, non si deve vedere.
    root.current
      ?.querySelector<HTMLElement>("[data-hl-close]")
      ?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
    return () => prev?.focus?.({ preventScroll: true });
  }, []);

  const matchOf = useMemo(
    () => new Map(data.matches.map((m) => [m.id, m])),
    [data.matches],
  );
  const meta = useMemo(
    () =>
      items.map((h) => {
        const m = matchOf.get(h.matchId);
        return {
          title: m ? highlightTitle(m, data.matches) : "Highlights",
          ticker: m ? tickerItems(m, data.players) : [],
          score: m ? scoreOf(m, data.players) : null,
        };
      }),
    [items, matchOf, data.matches, data.players],
  );

  if (!me) return null;
  const shown = commentsFor ? commentsOf(commentsFor) : [];

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label="Highlights"
      className={clsx(
        "hl-feed pointer-events-auto fixed inset-0 z-[90] bg-[#0b0907] text-white",
        entered && !closing ? "hl-in" : "hl-out",
      )}
      data-testid="hl-feed"
    >
      <div className="relative mx-auto h-full max-w-lg">
        <div
          ref={scroller}
          className="hl-scroller h-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
          data-testid="hl-scroller"
        >
          {items.map((h, i) => {
            const li = likeInfo.get(h.id)!;
            return (
              <Slide
                key={h.id}
                h={h}
                index={i}
                active={i === active && !closing}
                near={Math.abs(i - active) <= 1}
                preload={i > active ? "auto" : "metadata"}
                title={meta[i].title}
                ticker={meta[i].ticker}
                score={meta[i].score}
                likes={li.count}
                liked={li.liked}
                comments={commentsOf(h.id).length}
                onEnded={onEnded}
                onHold={music.hold}
                onLike={onLike}
                onComments={openComments}
              />
            );
          })}
        </div>

        {/* Il nero della dissolvenza tra un video e l'altro. */}
        <div
          className={clsx(
            "pointer-events-none absolute inset-0 z-20 bg-[#0b0907] transition-opacity ease-in-out",
            fading ? "opacity-100" : "opacity-0",
          )}
          style={{ transitionDuration: `${FADE_MS}ms` }}
          aria-hidden
        />

        {/* In alto: indietro, il titolo e l'audio. */}
        <div className="hl-top pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-2">
          <button
            data-hl-close
            onClick={onRequestClose}
            aria-label="Chiudi gli highlights"
            className="press pointer-events-auto grid h-11 w-11 place-items-center rounded-full text-white"
            data-testid="hl-close"
          >
            <ChevronLeft size={30} strokeWidth={2.4} className="hl-icon" />
          </button>
          <span className="hl-brand display text-[19px] tracking-wide">
            Highlights
            {items.length > 1 && (
              <span className="ml-2 align-middle text-[12px] font-bold text-white/70 tnum">
                {active + 1}/{items.length}
              </span>
            )}
          </span>
          {/* Audio bloccato dal telefono (si parte muti): il tasto diventa un invito a toccarlo. */}
          <button
            onClick={music.toggle}
            aria-label={
              music.state === "on" ? "Togli la musica" : "Metti la musica"
            }
            aria-pressed={music.state === "on"}
            data-music={music.state}
            className={clsx(
              "press pointer-events-auto flex h-11 items-center justify-center rounded-full",
              music.state === "blocked"
                ? "hl-unmute mr-1 h-9 gap-1.5 bg-white px-3 text-[13px] font-bold text-[#1d1a16] shadow-lg"
                : "w-11 text-white",
            )}
            data-testid="hl-sound"
          >
            {music.state === "on" ? (
              <Volume2 size={24} className="hl-icon" />
            ) : music.state === "blocked" ? (
              <>
                <VolumeX size={17} aria-hidden /> Musica
              </>
            ) : (
              <VolumeX size={24} className="hl-icon" />
            )}
          </button>
        </div>

        <CommentsPanel
          open={commentsFor !== null}
          comments={shown}
          loading={!social && !socialError}
          error={socialError}
          players={[...data.players, ...(data.guests ?? [])]}
          me={me}
          onClose={closeComments}
          onSend={onSend}
          onRetry={(c) => void sendComment(c)}
          onDelete={(c) => void onDelete(c)}
          onReload={() => void loadSocial()}
        />
      </div>
    </div>
  );
}
