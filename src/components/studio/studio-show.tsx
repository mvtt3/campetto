"use client";

import clsx from "clsx";
import {
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconRewindBackward10,
  IconRewindForward10,
  IconRotate,
  IconVolume,
  IconVolumeOff,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  armAt,
  blinkAt,
  cameraAt,
  captionAt,
  chapters,
  lineAt,
  lookAt,
  mouthAt,
  SCREEN,
  screenAt,
  STAGE,
  studioUrl,
  type StudioLine,
  type StudioShow,
  type StudioWho,
} from "@/lib/studio";
import { Notes, Presenter } from "./presenter";
import { StudioScreenView } from "./screens";

const ease = (u: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Carica la puntata e la apre a tutto schermo. */
export function StudioShowLoader({ id, onClose, startAt = 0 }: { id: string; onClose: () => void; startAt?: number }) {
  const [show, setShow] = useState<StudioShow | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(studioUrl(id), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((s: StudioShow) => alive && setShow(s))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [id]);
  if (typeof document === "undefined") return null;
  return createPortal(
    show ? (
      <StudioShowPlayer show={show} onClose={onClose} startAt={startAt} />
    ) : (
      <div className="fixed inset-0 z-[90] grid place-items-center bg-[#060B1A] text-white" role="dialog" aria-modal="true" aria-label="Studio Campetto">
        {error ? (
          <div className="px-8 text-center">
            <p className="title text-[18px]">La puntata non si apre</p>
            <p className="mt-1 text-[14px] text-white/70">Controlla la connessione e riprova.</p>
            <button type="button" className="press mt-5 rounded-full bg-white px-5 py-2.5 font-semibold text-[#0C1736]" onClick={onClose}>
              Chiudi
            </button>
          </div>
        ) : (
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white" aria-label="Caricamento" />
        )}
      </div>
    ),
    document.body,
  );
}

/**
 * Il player dello Studio Campetto: come un reel. Tocco per fermare e riprendere, doppio tocco
 * a sinistra o a destra per 10 secondi indietro o avanti, barra in alto per saltare.
 * L'audio è l'orologio: tutto quello che si vede si calcola dal suo tempo.
 */
export function StudioShowPlayer({ show, onClose, startAt = 0 }: { show: StudioShow; onClose: () => void; startAt?: number }) {
  const audio = useRef<HTMLAudioElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const lui = useRef<HTMLDivElement>(null);
  const lei = useRef<HTMLDivElement>(null);
  const screenBox = useRef<HTMLDivElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const clipLabel = useRef<HTMLSpanElement>(null);
  const leiNotes = useRef<HTMLDivElement>(null);
  const luiNotes = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const timeLabel = useRef<HTMLSpanElement>(null);
  const clock = useRef({ t: startAt, at: 0, running: false, audioOk: true });
  const smooth = useRef({ lui: { mouth: 0, look: 0 }, lei: { mouth: 0, look: 0 } });

  const [playing, setPlaying] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [scr, setScr] = useState(() => {
    const s = screenAt(show, startAt);
    return { index: s.index, since: s.since, nonce: 0, el: startAt - s.since };
  });
  const [caption, setCaption] = useState<StudioLine | null>(null);
  const [close, setClose] = useState<StudioWho | null>(null);
  const [flash, setFlash] = useState<{ kind: "play" | "pause" | "back" | "fwd"; n: number } | null>(null);

  const [k, setK] = useState(1);
  useEffect(() => {
    const fit = () => setK(Math.min(window.innerWidth / STAGE.w, window.innerHeight / STAGE.h) * 1.0001);
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const now = useCallback(() => {
    const c = clock.current;
    const a = audio.current;
    if (a && c.audioOk && !a.paused && a.readyState >= 2) return a.currentTime;
    return c.running ? c.t + (performance.now() - c.at) / 1000 : c.t;
  }, []);

  const start = useCallback(async () => {
    const c = clock.current;
    const a = audio.current;
    c.at = performance.now();
    c.running = true;
    setPlaying(true);
    setNeedsTap(false);
    root.current?.classList.remove("studio-paused");
    if (a && c.audioOk) {
      try {
        if (Math.abs(a.currentTime - c.t) > 0.05) a.currentTime = c.t;
        await a.play();
      } catch (e) {
        // Il browser vuole un tocco prima del suono: fermi e si aspetta il tocco.
        if ((e as Error).name === "NotAllowedError") {
          c.running = false;
          setPlaying(false);
          setNeedsTap(true);
        } else c.audioOk = false;
      }
    }
  }, []);

  const pause = useCallback(() => {
    const c = clock.current;
    c.t = now();
    c.running = false;
    audio.current?.pause();
    videos.current.forEach((v) => v?.pause());
    setPlaying(false);
    root.current?.classList.add("studio-paused");
  }, [now]);

  const seek = useCallback(
    (to: number) => {
      const c = clock.current;
      const t = Math.max(0, Math.min(show.duration - 0.05, to));
      c.t = t;
      c.at = performance.now();
      if (audio.current) audio.current.currentTime = t;
      const s = screenAt(show, t);
      setScr((p) => ({ index: s.index, since: s.since, nonce: p.nonce + 1, el: t - s.since }));
      setEnded(false);
    },
    [show],
  );

  // Si parte da soli: la puntata si apre con un tocco, quindi il suono è permesso.
  useEffect(() => {
    const a = audio.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void start();
    return () => a?.pause();
  }, [start]);

  // Il motore: a ogni fotogramma telecamera, presentatori, grafica, sottotitoli e barra.
  useEffect(() => {
    let raf = 0;
    let lastScreen = -1;
    let lastCaption: StudioLine | null = null;
    let lastClose: StudioWho | null = null;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = now();
      const c = clock.current;
      if (t >= show.duration) {
        if (c.running) {
          c.t = show.duration;
          c.running = false;
          setPlaying(false);
          setEnded(true);
        }
      }
      const cam = cameraAt(show, t);
      if (world.current) world.current.style.transform = `translate3d(${cam.x}px, ${cam.y}px, 0) scale(${cam.s})`;

      const line = lineAt(show, t);
      for (const who of ["lui", "lei"] as const) {
        const el = who === "lui" ? lui.current : lei.current;
        if (!el) continue;
        const sm = smooth.current[who];
        sm.mouth += (mouthAt(line, who, t) - sm.mouth) * 0.55;
        sm.look += (lookAt(line, who, t) - sm.look) * 0.12;
        const listening = line && line.who !== who;
        el.style.setProperty("--mouth", sm.mouth.toFixed(3));
        el.style.setProperty("--look", sm.look.toFixed(3));
        el.style.setProperty("--blink", blinkAt(who, t).toFixed(2));
        const arm = armAt(show, who, t).toFixed(3);
        el.style.setProperty("--arm", arm);
        (who === "lui" ? luiNotes : leiNotes).current?.style.setProperty("--arm", arm);
        el.style.setProperty("--breath", Math.sin(t * 1.5 + (who === "lui" ? 0 : 1.7)).toFixed(3));
        el.style.setProperty("--nod", listening ? (Math.max(0, Math.sin(t * 2.4)) ** 3).toFixed(3) : (sm.mouth * 0.4).toFixed(3));
      }

      const s = screenAt(show, t);
      if (s.index !== lastScreen) {
        lastScreen = s.index;
        setScr((p) => (p.index === s.index ? p : { index: s.index, since: s.since, nonce: p.nonce + 1, el: t - s.since }));
      }
      // I numeri delle grafiche contano col tempo della puntata.
      screenBox.current?.querySelectorAll<HTMLElement>("[data-to]").forEach((el) => {
        const to = Number(el.dataset.to);
        const u = ease((t - s.since - Number(el.dataset.at)) / 1.0);
        el.textContent = String(Math.round(to * u));
      });

      // I canestri: un video per clip, tutti già caricati; si vede quello del momento.
      const scr0 = show.screens[s.index];
      if (scr0?.kind === "montaggio") {
        let on = scr0.clips.findIndex((x) => t >= x.t && t < x.t + x.dur);
        if (on < 0) on = t < scr0.clips[0].t ? 0 : scr0.clips.length - 1;
        scr0.clips.forEach((clip, i) => {
          const v = videos.current[i];
          if (!v) return;
          const want = clip.from + Math.min(clip.dur, Math.max(0, t - clip.t));
          if (i !== on) {
            if (!v.paused) v.pause();
            v.style.opacity = "0";
            if (v.readyState >= 1 && Math.abs(v.currentTime - clip.from) > 0.3 && t < clip.t) v.currentTime = clip.from;
            return;
          }
          v.style.opacity = "1";
          if (v.readyState >= 1 && Math.abs(v.currentTime - want) > 0.35) v.currentTime = want;
          const live = c.running && t >= clip.t && t < clip.t + clip.dur;
          if (live && v.paused) void v.play().catch(() => {});
          if (!live && !v.paused) v.pause();
          if (clipLabel.current && clipLabel.current.textContent !== clip.label) clipLabel.current.textContent = clip.label;
        });
      }

      const cap = captionAt(show, t);
      if (cap !== lastCaption) {
        lastCaption = cap;
        setCaption(cap);
      }
      let shot = show.shots[0];
      for (const x of show.shots) if (x.t <= t) shot = x;
      const cl = shot.cam === "lui" || shot.cam === "lei" ? shot.cam : null;
      if (cl !== lastClose) {
        lastClose = cl;
        setClose(cl);
      }
      if (bar.current) {
        bar.current.style.setProperty("--p", String(Math.min(1, t / show.duration)));
        bar.current.setAttribute("aria-valuenow", String(Math.round(t)));
      }
      if (timeLabel.current) timeLabel.current.textContent = `${fmt(t)} / ${fmt(show.duration)}`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [show, now]);

  // Tocco: uno ferma o riprende, due a sinistra o a destra saltano di 10 secondi.
  const taps = useRef<{ at: number; x: number; timer: number }>({ at: 0, x: 0, timer: 0 });
  const onTap = (e: React.PointerEvent<HTMLDivElement>) => {
    if (ended) return;
    if ((e.target as HTMLElement).closest("button, [role=slider]")) return;
    const x = e.clientX / window.innerWidth;
    const tp = taps.current;
    const side = x < 0.33 ? -1 : x > 0.67 ? 1 : 0;
    const t0 = performance.now();
    if (side !== 0 && t0 - tp.at < 300 && Math.sign(tp.x) === side) {
      window.clearTimeout(tp.timer);
      tp.at = 0;
      seek(now() + side * 10);
      setFlash({ kind: side < 0 ? "back" : "fwd", n: t0 });
      return;
    }
    tp.at = t0;
    tp.x = side;
    window.clearTimeout(tp.timer);
    tp.timer = window.setTimeout(() => {
      if (clock.current.running) {
        pause();
        setFlash({ kind: "pause", n: performance.now() });
      } else {
        void start();
        setFlash({ kind: "play", n: performance.now() });
      }
    }, side === 0 ? 0 : 300);
  };

  // Se si esce dall'app (telefono in tasca, altra app) la puntata si ferma.
  useEffect(() => {
    const onHide = () => document.hidden && clock.current.running && pause();
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [pause]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " ") {
        e.preventDefault();
        if (clock.current.running) pause();
        else void start();
      }
      if (e.key === "ArrowLeft") seek(now() - 10);
      if (e.key === "ArrowRight") seek(now() + 10);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pause, start, seek, now]);

  const screen = show.screens[scr.index];
  const parts = chapters(show);
  const date = new Date(`${show.day}T12:00:00`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div ref={root} className="fixed inset-0 z-[90] select-none overflow-hidden bg-[#060B1A] text-white" role="dialog" aria-modal="true" aria-label={`Studio Campetto, ${date}`} onPointerUp={onTap}>
      <audio
        ref={audio}
        src={show.audio}
        preload="auto"
        muted={muted}
        onError={() => {
          clock.current.audioOk = false;
        }}
      />

      {/* Lo studio, disegnato a 390×844 e adattato allo schermo. */}
      <div
        className="absolute left-1/2 top-1/2 overflow-hidden"
        style={{ width: STAGE.w, height: STAGE.h, transform: `translate(-50%, -50%) scale(${k})` }}
      >
        <div ref={world} className="absolute left-0 top-0 origin-top-left will-change-transform" style={{ width: STAGE.w, height: STAGE.h }}>
          <StudioSet day={show.day} />
          {/* Il maxischermo. */}
          <div className="absolute overflow-hidden rounded-[10px] ring-[5px] ring-[#1B2C5C]" style={{ left: SCREEN.x, top: SCREEN.y, width: SCREEN.w, height: SCREEN.h, boxShadow: "0 0 50px rgb(61 106 240 / 0.55)" }}>
            <div ref={screenBox} className="origin-top-left" style={{ transform: `scale(${SCREEN.w / SCREEN.nativeW})` }}>
              <div key={`${scr.index}-${scr.nonce}`} style={{ ["--el" as string]: `${-scr.el}s` }} className="studio-screen-in">
                {screen && <StudioScreenView screen={screen} day={show.day} />}
              </div>
            </div>
            {screen?.kind === "montaggio" && (
              <div className="absolute inset-0 bg-black">
                {screen.clips.map((clip, i) => (
                  <video
                    key={clip.src + i}
                    ref={(el) => {
                      videos.current[i] = el;
                    }}
                    src={`${clip.src}#t=${clip.from}`}
                    muted
                    playsInline
                    preload="auto"
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ opacity: i === 0 ? 1 : 0 }}
                  />
                ))}
                <span className="absolute left-2 top-2 rounded-full bg-volt px-2 py-0.5 text-[8px] font-bold text-volt-ink">{screen.kicker}</span>
                <span ref={clipLabel} className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[8px] font-bold" />
              </div>
            )}
          </div>
          {/* I presentatori dietro la scrivania. */}
          <div ref={lei} className="absolute" style={{ left: 27, top: 438, width: 170 }}>
            <Presenter who="lei" />
          </div>
          <div ref={lui} className="absolute" style={{ left: 193, top: 438, width: 170 }}>
            <Presenter who="lui" />
          </div>
          <div ref={leiNotes} className="absolute" style={{ left: 27, top: 556, width: 170 }}>
            <Notes who="lei" />
          </div>
          <div ref={luiNotes} className="absolute" style={{ left: 193, top: 556, width: 170, transform: "scaleX(-1)" }}>
            <Notes who="lui" />
          </div>
          <Desk />
        </div>
      </div>

      {/* Sopra lo studio: titolo, barra, sottotitoli e comandi (non zoomano). */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-[#03060f] via-[#03060f]/75 to-transparent px-4 pb-8 pt-[max(12px,env(safe-area-inset-top))]">
        <div
          ref={bar}
          className="pointer-events-auto relative flex h-5 cursor-pointer items-center gap-1"
          onPointerDown={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            seek(((e.clientX - r.left) / r.width) * show.duration);
          }}
          role="slider"
          aria-label="Posizione nella puntata"
          aria-valuemin={0}
          aria-valuemax={Math.round(show.duration)}
          aria-valuenow={0}
          tabIndex={0}
        >
          {parts.map((p) => (
            <span key={p.t} className="relative h-[3px] overflow-hidden rounded-full bg-white/30" style={{ flex: p.end - p.t }}>
              <span
                className="absolute inset-y-0 left-0 bg-white"
                style={{ width: `calc(clamp(0%, (var(--p) * ${show.duration} - ${p.t}) / ${p.end - p.t} * 100%, 100%))` }}
              />
            </span>
          ))}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-ball text-[11px] font-black">SC</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold leading-tight">Studio Campetto</span>
            <span className="block text-[12px] leading-tight text-white/70">Le partite di {date}</span>
          </span>
          <button type="button" className="press pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-white/15" aria-label="Chiudi" onClick={onClose}>
            <IconX size={22} />
          </button>
        </div>
      </div>

      {close && (
        <div key={close} className="studio-in pointer-events-none absolute bottom-[230px] left-4" style={{ ["--el" as string]: "0s" }}>
          <p className="rounded-t-lg bg-ball px-3 py-1 text-[17px] font-extrabold leading-tight">{show.hosts[close]}</p>
          <p className="rounded-b-lg bg-[#0C1736]/90 px-3 py-1 text-[12px] font-semibold text-white/80">Studio Campetto</p>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#03060f] via-[#03060f]/80 to-transparent px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-16">
        <div className="min-h-[86px]">
          {caption && (
            <p key={caption.t} className="studio-in text-[16px] font-semibold leading-snug" style={{ ["--el" as string]: "0s" }} aria-live="polite">
              <span className={clsx("mr-1.5 rounded-md px-1.5 py-0.5 text-[12px] font-extrabold", caption.who === "lei" ? "bg-[#B4234A]" : "bg-[#3D6AF0]")}>{show.hosts[caption.who]}</span>
              {caption.text}
            </p>
          )}
        </div>
        <div className="pointer-events-auto mt-2 flex items-center justify-between">
          <span ref={timeLabel} className="tnum w-24 text-[12.5px] text-white/75" />
          <div className="flex items-center gap-3">
            <button type="button" className="press grid h-11 w-11 place-items-center rounded-full bg-white/12" aria-label="Indietro di 10 secondi" onClick={() => seek(now() - 10)}>
              <IconRewindBackward10 size={24} />
            </button>
            <button
              type="button"
              className="press grid h-14 w-14 place-items-center rounded-full bg-white text-[#0C1736]"
              aria-label={playing ? "Pausa" : "Riprendi"}
              onClick={() => (clock.current.running ? pause() : void start())}
            >
              {playing ? <IconPlayerPauseFilled size={26} /> : <IconPlayerPlayFilled size={26} />}
            </button>
            <button type="button" className="press grid h-11 w-11 place-items-center rounded-full bg-white/12" aria-label="Avanti di 10 secondi" onClick={() => seek(now() + 10)}>
              <IconRewindForward10 size={24} />
            </button>
          </div>
          <div className="flex w-24 justify-end">
            <button type="button" className="press grid h-11 w-11 place-items-center rounded-full bg-white/12" aria-label={muted ? "Attiva l'audio" : "Togli l'audio"} onClick={() => setMuted((m) => !m)}>
              {muted ? <IconVolumeOff size={22} /> : <IconVolume size={22} />}
            </button>
          </div>
        </div>
      </div>

      {flash && (
        <span key={flash.n} className="studio-flash pointer-events-none absolute top-1/2 grid h-20 w-20 -translate-y-1/2 place-items-center rounded-full bg-black/45" style={{ left: flash.kind === "back" ? "12%" : flash.kind === "fwd" ? "calc(88% - 80px)" : "calc(50% - 40px)" }}>
          {flash.kind === "pause" ? <IconPlayerPauseFilled size={34} /> : flash.kind === "play" ? <IconPlayerPlayFilled size={34} /> : flash.kind === "back" ? <IconRewindBackward10 size={34} /> : <IconRewindForward10 size={34} />}
        </span>
      )}

      {(needsTap || ended) && (
        <div className="absolute inset-0 grid place-items-center bg-black/55">
          <div className="text-center">
            <p className="display text-[30px]">{ended ? "Fine della puntata" : "Studio Campetto"}</p>
            <div className="mt-5 flex justify-center gap-3">
              {ended && (
                <button type="button" className="press rounded-full bg-white/15 px-5 py-3 font-semibold" onClick={onClose}>
                  Chiudi
                </button>
              )}
              <button
                type="button"
                className="press inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-[#0C1736]"
                onClick={() => {
                  if (ended) seek(0);
                  void start();
                }}
              >
                {ended ? <IconRotate size={20} /> : <IconPlayerPlayFilled size={20} />}
                {ended ? "Rivedi" : "Guarda"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Le pareti dello studio: led, luci, il giorno delle partite sui pannelli laterali. */
function StudioSet({ day }: { day: string }) {
  const d = new Date(`${day}T12:00:00`);
  const wd = d.toLocaleDateString("it-IT", { weekday: "short" }).replace(".", "");
  const num = d.getDate();
  const mon = d.toLocaleDateString("it-IT", { month: "short" }).replace(".", "");
  return (
    <div className="absolute inset-0" aria-hidden>
      {/* Il fondo va oltre i bordi: quando la telecamera si allontana non si vede il vuoto. */}
      <div className="absolute -inset-x-40 -bottom-60 -top-40 bg-[linear-gradient(180deg,#070E24_0%,#0E1D48_40%,#13275E_58%,#0A1430_75%,#050A1A_100%)]" />
      {/* Luci dall'alto. */}
      <div className="absolute -top-10 left-[8%] h-[420px] w-[120px] rotate-[14deg] bg-[linear-gradient(180deg,rgb(160_196_255/0.28),transparent)] blur-md" />
      <div className="absolute -top-10 right-[8%] h-[420px] w-[120px] -rotate-[14deg] bg-[linear-gradient(180deg,rgb(160_196_255/0.28),transparent)] blur-md" />
      {/* Pannelli led ai lati del maxischermo. */}
      <div className="absolute left-[14px] top-[150px] flex h-[218px] w-[66px] flex-col items-center justify-center rounded-[10px] bg-[#0F2150] ring-2 ring-[#1B2C5C]">
        <span className="text-[12px] font-bold uppercase tracking-wide text-white/60">{wd}</span>
        <span className="score text-[40px] text-volt">{num}</span>
        <span className="text-[12px] font-bold uppercase tracking-wide text-white/60">{mon}</span>
      </div>
      <div className="absolute right-[14px] top-[150px] flex h-[218px] w-[66px] flex-col items-center justify-center gap-2 rounded-[10px] bg-[#0F2150] ring-2 ring-[#1B2C5C]">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="studio-pulse h-6 w-6 rounded-full bg-ball" style={{ animationDelay: `${i * 0.35}s`, opacity: 0.9 }} />
        ))}
      </div>
      {/* Striscia luminosa sotto il maxischermo. */}
      <div className="absolute left-[30px] right-[30px] top-[404px] h-[6px] rounded-full bg-[linear-gradient(90deg,transparent,#F26A1B,#FFC531,#F26A1B,transparent)] opacity-80" />
      {/* Pavimento lucido. */}
      <div className="absolute -inset-x-40 -bottom-60 top-[584px] bg-[linear-gradient(180deg,#0B1636,#050A1A)]" />
      <div className="absolute inset-x-[60px] bottom-[60px] h-[120px] rounded-full bg-[radial-gradient(ellipse,rgb(61_106_240/0.35),transparent_70%)]" />
    </div>
  );
}

/** La scrivania davanti ai presentatori, con il nome dello studio. */
function Desk() {
  return (
    <div className="absolute" style={{ left: 8, top: 596, width: 374, height: 150 }} aria-hidden>
      <svg viewBox="0 0 374 150" className="h-full w-full">
        <defs>
          <linearGradient id="desk-top" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#E9F0FF" />
            <stop offset="1" stopColor="#9DB4E8" />
          </linearGradient>
          <linearGradient id="desk-front" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#1C3576" />
            <stop offset="1" stopColor="#0C1736" />
          </linearGradient>
        </defs>
        <path d="M6 16 Q187 2 368 16 L368 24 Q187 10 6 24 Z" fill="url(#desk-top)" stroke="#1D1A16" strokeWidth="3" />
        <path d="M14 24 Q187 10 360 24 L344 142 Q187 132 30 142 Z" fill="url(#desk-front)" stroke="#1D1A16" strokeWidth="3" />
        <path d="M24 46 Q187 34 350 46" stroke="#F26A1B" strokeWidth="4" fill="none" />
        <text x="187" y="92" textAnchor="middle" fill="#FFF8EA" fontSize="22" fontWeight="800" style={{ letterSpacing: "0.04em" }}>
          STUDIO CAMPETTO
        </text>
        <circle cx="187" cy="116" r="8" fill="#F26A1B" stroke="#1D1A16" strokeWidth="2" />
      </svg>
    </div>
  );
}
