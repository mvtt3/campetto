"use client";

import clsx from "clsx";
import { Heart, MessageCircle, Play, RotateCcw } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Mascot } from "@/components/mascot";
import { compactCount, tickerText, type TickerItem } from "@/lib/highlights";
import type { Highlight } from "@/lib/types";
import { BallIcon } from "./ball-icon";

export interface SlideProps {
  h: Highlight;
  index: number;
  /** Quello che si sta guardando. */
  active: boolean;
  /** Vicino a quello attivo: il video è già montato e si carica in anticipo. */
  near: boolean;
  /** Il prossimo si scarica tutto in anticipo, il precedente solo l'inizio. */
  preload: "auto" | "metadata";
  title: string;
  ticker: TickerItem[];
  /** Il racconto della partita (scritto dai numeri); se manca, la descrizione salvata. */
  story: string | null;
  /** Squadre e risultato per l'apertura. */
  score: { a: string; b: string; score: string } | null;
  likes: number;
  liked: boolean;
  comments: number;
  onEnded: (index: number) => void;
  /** In pausa (tocco) o di nuovo in corsa: la musica la segue. */
  onHold: (held: boolean) => void;
  onLike: (id: string, on: boolean) => void;
  onComments: (id: string) => void;
}

const LOADER_DELAY = 280;
/** L'apertura di ogni video: Spicchio palleggia col titolo, poi parte. */
const INTRO_MS = 1300;
const INTRO_OUT_MS = 220;

/**
 * Un video del feed. Solo quello attivo e i due vicini hanno il <video>: gli altri sono
 * il poster, così anche con tanti highlights il telefono non si appesantisce.
 * Barra di avanzamento e canestro corrente si aggiornano senza ridisegnare tutto.
 */
export const Slide = memo(function Slide(p: SlideProps) {
  const { h, index, active, near, onEnded, onHold, onLike } = p;
  const description = p.story ?? h.description;
  const video = useRef<HTMLVideoElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [loaderDue, setLoaderDue] = useState(false);
  const [failed, setFailed] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>(
    [],
  );
  const [expanded, setExpanded] = useState(false);
  // L'intro: "show" (Spicchio e titolo), "out" (sfuma), "off" (si vede il video).
  const [intro, setIntro] = useState<"show" | "out" | "off">("off");
  const retried = useRef(false);
  const activeRef = useRef(active);
  const userPausedRef = useRef(false);
  const introRef = useRef(intro);
  useLayoutEffect(() => {
    activeRef.current = active;
    userPausedRef.current = userPaused;
    introRef.current = intro;
  });

  // Il caricamento si mostra solo se dura: niente lampi di Spicchio a ogni video.
  useEffect(() => {
    if (!loading || !active || intro !== "off") return;
    const t = window.setTimeout(() => setLoaderDue(true), LOADER_DELAY);
    return () => {
      window.clearTimeout(t);
      setLoaderDue(false);
    };
  }, [loading, active, intro]);
  const showLoader = loaderDue && loading && active && intro === "off";

  // I video sono sempre muti: sotto c'è la musica del feed.
  const play = useCallback(async () => {
    const el = video.current;
    if (!el || !activeRef.current || introRef.current !== "off") return;
    el.muted = true;
    try {
      await el.play();
    } catch {
      /* fermato da uno scorrimento veloce: riparte quando torna attivo */
    }
  }, []);

  // Diventa attivo: torna all'inizio, intro e poi via. Non più attivo: si ferma.
  useEffect(() => {
    if (!active) {
      video.current?.pause();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIntro("off");
      return;
    }
    setUserPaused(false);
    setExpanded(false);
    const el = video.current;
    if (el) {
      el.pause();
      try {
        if (el.currentTime > 0.05) el.currentTime = 0;
      } catch {
        /* non ancora pronto */
      }
    }
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    // Subito, non al prossimo disegno: nessuno deve far partire il video durante l'intro.
    introRef.current = "show";
    setIntro("show");
    const t1 = window.setTimeout(
      () => setIntro("out"),
      reduce ? 500 : INTRO_MS,
    );
    const t2 = window.setTimeout(
      () => setIntro("off"),
      (reduce ? 500 : INTRO_MS) + INTRO_OUT_MS,
    );
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [active]);

  // Finita l'intro (o saltata), il video parte; anche se il <video> arriva dopo (scorrimento veloce).
  useEffect(() => {
    if (active && near && intro === "off" && !userPausedRef.current)
      void play();
  }, [active, near, intro, play]);

  // La musica si ferma con la pausa e riparte col video.
  useEffect(() => {
    if (active) onHold(userPaused);
  }, [active, userPaused, onHold]);

  // Telefono bloccato o app in sottofondo: pausa; al ritorno riparte se non l'avevi fermato tu.
  useEffect(() => {
    if (!active) return;
    const onVis = () => {
      const el = video.current;
      if (!el) return;
      if (document.hidden) el.pause();
      else if (!userPausedRef.current) void play();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [active, play]);

  // La barra di avanzamento: un requestAnimationFrame che tocca solo lo stile.
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      const el = video.current;
      if (el && bar.current && el.duration > 0)
        bar.current.style.transform = `scaleX(${Math.min(1, el.currentTime / el.duration)})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  const toggle = () => {
    const el = video.current;
    if (!el || failed) return;
    // Durante l'intro un tocco la salta.
    if (intro !== "off") {
      setIntro("off");
      return;
    }
    if (el.paused) {
      setUserPaused(false);
      void play();
    } else {
      el.pause();
      setUserPaused(true);
    }
  };

  // Un tocco mette in pausa, due tocchi danno il pallone (come nelle app di video).
  const lastTap = useRef(0);
  const tapTimer = useRef<number | null>(null);
  const onTap = (e: React.MouseEvent) => {
    const now = performance.now();
    if (now - lastTap.current < 300) {
      if (tapTimer.current) window.clearTimeout(tapTimer.current);
      tapTimer.current = null;
      lastTap.current = 0;
      const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const id = now;
      setBursts((b) => [
        ...b.slice(-3),
        { id, x: e.clientX - box.left, y: e.clientY - box.top },
      ]);
      window.setTimeout(
        () => setBursts((b) => b.filter((x) => x.id !== id)),
        800,
      );
      if (!p.liked) onLike(h.id, true);
      return;
    }
    lastTap.current = now;
    tapTimer.current = window.setTimeout(() => {
      tapTimer.current = null;
      toggle();
    }, 300);
  };
  useEffect(
    () => () => {
      if (tapTimer.current) window.clearTimeout(tapTimer.current);
    },
    [],
  );

  const retry = () => {
    const el = video.current;
    setFailed(false);
    setLoading(true);
    retried.current = false;
    if (el) {
      el.load();
      void play();
    }
  };

  return (
    <section
      className="hl-slide relative h-full w-full shrink-0 snap-start snap-always overflow-hidden bg-[#17130f]"
      aria-roledescription="video"
      aria-label={p.title}
      data-testid="hl-slide"
      data-active={active ? "1" : undefined}
    >
      {/* Lo sfondo: il poster sfocato, così il video orizzontale non galleggia nel nero. */}
      {near && h.posterUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={h.posterUrl}
          alt=""
          aria-hidden
          className="hl-backdrop pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      )}

      <div
        className={clsx("hl-stage absolute", portrait && "hl-stage-full")}
        onClick={onTap}
        data-testid="hl-stage"
      >
        {near ? (
          <video
            ref={video}
            src={h.videoUrl}
            poster={h.posterUrl ?? undefined}
            preload={active ? "auto" : p.preload}
            playsInline
            muted
            // Niente audio dai video, mai: si sente solo la musica del feed.
            onVolumeChange={(e) => {
              if (!e.currentTarget.muted) e.currentTarget.muted = true;
            }}
            disablePictureInPicture
            disableRemotePlayback
            controlsList="nodownload noplaybackrate noremoteplayback"
            className={clsx(
              "h-full w-full",
              portrait ? "object-cover" : "object-contain",
            )}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              setPortrait(v.videoHeight > v.videoWidth * 1.1);
            }}
            onWaiting={() => setLoading(true)}
            onPlaying={() => {
              setLoading(false);
              setFailed(false);
            }}
            onCanPlay={(e) => {
              setLoading(false);
              // Arrivato dopo essere diventato attivo: parte adesso.
              if (
                activeRef.current &&
                e.currentTarget.paused &&
                !userPausedRef.current
              )
                void play();
            }}
            onEnded={() => onEnded(index)}
            onError={() => {
              // Un intoppo di rete: si riprova una volta da soli, poi si chiede.
              const el = video.current;
              if (!retried.current && el) {
                retried.current = true;
                window.setTimeout(() => {
                  el.load();
                  void play();
                }, 600);
                return;
              }
              setFailed(true);
              setLoading(false);
            }}
            data-testid="hl-video"
          />
        ) : (
          h.posterUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={h.posterUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-contain"
            />
          )
        )}

        {bursts.map((b) => (
          <span
            key={b.id}
            className="hl-burst pointer-events-none absolute"
            style={{ left: b.x, top: b.y }}
            aria-hidden
          >
            <BallIcon size={86} filled />
          </span>
        ))}

        {active && userPaused && !failed && (
          <span className="hl-paused pointer-events-none absolute left-1/2 top-1/2 grid h-[74px] w-[74px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#17130f]/45 text-[#f6eedc]">
            <Play size={34} fill="currentColor" aria-hidden />
          </span>
        )}

        {/* Spicchio palleggia mentre il video arriva. */}
        {showLoader && !failed && (
          <div
            className="hl-loader pointer-events-none absolute inset-0 grid place-items-center"
            role="status"
            data-testid="hl-loading"
          >
            <div className="flex flex-col items-center gap-1.5 rounded-[22px] bg-[#17130f]/45 px-5 pb-3 pt-2 backdrop-blur-sm">
              <div className="live-stage relative h-[76px] w-[66px]">
                <span className="live-shadow absolute bottom-0 left-1/2 h-2 w-3/5 -translate-x-1/2 rounded-[50%] bg-[#17130f]/50" />
                <span className="live-bounce absolute inset-x-0 bottom-1.5 flex justify-center">
                  <Mascot pose="esulta" size={62} animate={false} />
                </span>
              </div>
              <span className="text-[13px] font-semibold text-[#f6eedc]/90">
                Arriva il video
                <span className="typing-dots ml-1 inline-flex gap-[3px] align-middle">
                  <span />
                  <span />
                  <span />
                </span>
              </span>
            </div>
          </div>
        )}

        {failed && (
          <div
            className="absolute inset-0 grid place-items-center"
            role="alert"
            data-testid="hl-error"
          >
            <div className="flex flex-col items-center gap-2 rounded-[22px] bg-[#17130f]/60 px-5 py-4 text-center text-[#f6eedc]">
              <Mascot pose="boh" size={64} animate={false} />
              <p className="text-[14px] font-semibold">
                Il video non vuole partire
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  retry();
                }}
                className="press flex h-10 items-center gap-1.5 rounded-full bg-[#f47a2e] px-4 text-[14px] font-bold text-[#fffaf0]"
              >
                <RotateCcw size={16} aria-hidden /> Riprova
              </button>
            </div>
          </div>
        )}
      </div>

      {/* L'apertura: Spicchio palleggia col giorno e il risultato, poi sfuma sul video. */}
      {active && intro !== "off" && (
        <div
          className={clsx(
            "hl-intro absolute inset-0 z-[15] grid place-items-center px-16 text-center",
            intro === "out" && "hl-intro-out",
          )}
          onClick={() => setIntro("off")}
          data-testid="hl-intro"
        >
          <div className="hl-intro-body flex w-full min-w-0 flex-col items-center">
            <span className="text-[12px] font-extrabold uppercase tracking-[0.22em] text-[#ef7d2d]">
              Highlights
            </span>
            {/* Spicchio alza le braccia sopra la sua scatola: spazio sopra, così non tocca la scritta. */}
            <div
              className="hl-intro-stage live-stage relative mt-8 h-[104px] w-[96px]"
              aria-hidden
            >
              <span className="live-shadow absolute bottom-0 left-1/2 h-2.5 w-3/5 -translate-x-1/2 rounded-[50%] bg-[#17130f]/55" />
              <span className="live-bounce absolute inset-x-0 bottom-2 flex justify-center">
                <Mascot pose="esulta" size={88} animate={false} />
              </span>
            </div>
            <p className="display mt-3 max-w-full text-[26px] leading-tight">
              {p.title}
            </p>
            {p.score && (
              <div className="mt-2 flex w-full max-w-[30ch] flex-col items-center">
                <span className="title line-clamp-2 max-w-full text-[15px] leading-snug text-[#f6eedc]/85 [overflow-wrap:anywhere]">
                  {p.score.a}
                </span>
                <span className="score my-0.5 text-[34px] leading-none text-[#ef7d2d]">
                  {p.score.score}
                </span>
                <span className="title line-clamp-2 max-w-full text-[15px] leading-snug text-[#f6eedc]/85 [overflow-wrap:anywhere]">
                  {p.score.b}
                </span>
              </div>
            )}
            {h.clips.length > 0 && (
              <p className="mt-2 text-[13px] font-semibold text-[#f6eedc]/65">
                {h.clips.length === 1
                  ? "1 canestro"
                  : `${h.clips.length} canestri`}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Avanzamento: sottile, sul bordo basso del video. */}
      {active && (
        <div
          className={clsx(
            "hl-progress pointer-events-none absolute inset-x-0 h-[3px] bg-[#f6eedc]/25",
            portrait && "hl-progress-full",
          )}
          aria-hidden
        >
          <div
            ref={bar}
            className="h-full origin-left bg-[#ef7d2d]"
            style={{ transform: "scaleX(0)" }}
          />
        </div>
      )}

      {/* Pallone e commenti, a destra come nelle app di video. */}
      {/* Come nelle app di video del 2026: icone leggere a contorno, numero sotto, tocco ampio. */}
      <div className="hl-rail absolute right-1.5 z-[16] flex flex-col items-center gap-3">
        <button
          onClick={() => onLike(h.id, !p.liked)}
          aria-pressed={p.liked}
          aria-label={`${p.liked ? "Togli il mi piace" : "Mi piace"}: ${compactCount(p.likes)}`}
          className="press flex h-[58px] w-12 flex-col items-center justify-center gap-1"
          data-testid="hl-like"
        >
          <span
            key={p.liked ? "on" : "off"}
            className={clsx("hl-icon", p.liked && "hl-pop")}
          >
            <Heart
              size={29}
              strokeWidth={2}
              className={p.liked ? "text-[#ff5a4a]" : "text-[#f6eedc]"}
              fill={p.liked ? "currentColor" : "none"}
              aria-hidden
            />
          </span>
          <span className="hl-count text-[12px] font-semibold text-[#f6eedc] tnum">
            {compactCount(p.likes)}
          </span>
        </button>
        <button
          onClick={() => p.onComments(h.id)}
          aria-label={`Commenti: ${compactCount(p.comments)}`}
          className="press flex h-[58px] w-12 flex-col items-center justify-center gap-1"
          data-testid="hl-comments"
        >
          <MessageCircle
            size={28}
            strokeWidth={2}
            className="hl-icon -scale-x-100 text-[#f6eedc]"
            aria-hidden
          />
          <span className="hl-count text-[12px] font-semibold text-[#f6eedc] tnum">
            {compactCount(p.comments)}
          </span>
        </button>
      </div>

      {/* Titolo e descrizione in basso. */}
      <div className="hl-meta pointer-events-none absolute left-0 right-[60px] z-10 px-4 text-[#f6eedc]">
        <h2 className="hl-title title truncate text-[17px] leading-tight">
          {p.title}
        </h2>
        {description && (
          <button
            className="pointer-events-auto mt-1 block w-full text-left text-[14px] leading-snug text-[#f6eedc]/90"
            onClick={() => setExpanded((x) => !x)}
            aria-expanded={expanded}
            data-testid="hl-desc"
          >
            {/* Due righe, il resto con un tocco (sul bottone il taglio non funziona: serve lo span). */}
            <span className={clsx(!expanded && "line-clamp-2")}>
              {description}
            </span>
          </button>
        )}
      </div>

      {/* La striscia coi numeri della partita, che scorre: un nastro da manifesto, inchiostro e
          crema, con l'etichetta arancione e un pallone tra una voce e l'altra. */}
      {p.ticker.length > 0 && (
        <div
          className="hl-ticker absolute inset-x-0 z-10 overflow-hidden text-[#f6eedc]"
          aria-label={tickerText(p.ticker)}
          role="marquee"
        >
          <div
            className={clsx(
              "hl-ticker-track flex w-max",
              !active && "hl-still",
            )}
            style={{
              animationDuration: `${Math.max(16, tickerText(p.ticker).length * 0.34)}s`,
            }}
            aria-hidden
          >
            {[0, 1].map((k) => (
              <span key={k} className="flex shrink-0">
                {p.ticker.map((t, i) => (
                  <span
                    key={i}
                    className="flex items-center whitespace-nowrap pl-4"
                  >
                    <span className="hl-ticker-k text-[10.5px] font-extrabold uppercase tracking-[0.2em] text-[#ef7d2d]">
                      {t.k}
                    </span>
                    <span className="display ml-2 text-[14.5px]">{t.v}</span>
                    <TickerBall />
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Lettori di schermo: lo stato del video. */}
      {active && (
        <span className="sr-only" aria-live="polite">
          {failed ? "Il video non parte" : userPaused ? "In pausa" : ""}
        </span>
      )}
    </section>
  );
});

/** Il pallino tra una voce e l'altra della striscia: un piccolo pallone a spicchi. */
function TickerBall() {
  return (
    <svg
      viewBox="0 0 12 12"
      width={11}
      height={11}
      className="ml-4"
      aria-hidden
    >
      <circle cx="6" cy="6" r="5.4" fill="#ef7d2d" />
      <g fill="none" stroke="#17130f" strokeWidth="0.9" strokeLinecap="round">
        <path d="M6 0.8v10.4M0.8 6h10.4" />
        <path d="M2.6 2.4c1.3 1 2 2.2 2 3.6s-.7 2.6-2 3.6M9.4 2.4c-1.3 1-2 2.2-2 3.6s.7 2.6 2 3.6" />
      </g>
    </svg>
  );
}
