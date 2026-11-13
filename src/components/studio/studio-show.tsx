"use client";

import clsx from "clsx";
import {
  IconCalendarEvent,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconRewindBackward10,
  IconRewindForward10,
  IconRotate,
  IconVolume,
  IconVolumeOff,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  armAt,
  blinkAt,
  cameraAt,
  captionAt,
  GUEST_SPREAD,
  guestAt,
  lineAt,
  lookAt,
  modeAt,
  mouthAt,
  fullScreenAt,
  replayAt,
  replayFrame,
  SCREEN,
  screenAt,
  screenRect,
  STAGE,
  studioUrl,
  type StudioHost,
  type StudioShow,
  type StudioWho,
} from "@/lib/studio";
import { KIT } from "@/components/avatar-presets";
import { useData } from "@/lib/data/provider";
import { Character, characterOf } from "../character";
import { Logo } from "../mascot";
import { CourtLines } from "../ui/basics";
import { Notes, Presenter } from "./presenter";
import { StudioScreenView } from "./screens";

const easeOut = (u: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const el = (s: number): CSSProperties => ({ ["--el" as string]: `${-s}s` });
const at = (d: number): CSSProperties => ({ ["--d" as string]: `${d}s` });
const longDate = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });

/** Carica la puntata e la apre a tutto schermo. */
export function StudioShowLoader({ id, onClose, startAt = 0 }: { id: string; onClose: () => void; startAt?: number }) {
  const [show, setShow] = useState<StudioShow | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(studioUrl(id), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((s: StudioShow) => alive && (s.v === 2 ? setShow(s) : setError(true)))
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
      <div className="fixed inset-0 z-[90] grid place-items-center bg-[#FFC531] text-[#1d1a16]" role="dialog" aria-modal="true" aria-label="Studio Campetto">
        {error ? (
          <div className="px-8 text-center">
            <p className="title text-[18px]">La puntata non si apre</p>
            <p className="mt-1 text-[14px] opacity-70">Controlla la connessione e riprova.</p>
            <button type="button" className="press mt-5 rounded-full bg-[#1d1a16] px-5 py-2.5 font-semibold text-white" onClick={onClose}>
              Chiudi
            </button>
          </div>
        ) : (
          <Logo size={110} top="STUDIO" bottom="★ CAMPETTO ★" className="animate-pulse" />
        )}
      </div>
    ),
    document.body,
  );
}

/**
 * Il player dello Studio Campetto, come un reel: tocco per fermare, doppio tocco ai lati per
 * 10 secondi indietro o avanti, barra in alto per saltare. L'audio è l'orologio: telecamera,
 * presentatori, grafiche, sottotitoli e replay si calcolano tutti dal suo tempo.
 */
export function StudioShowPlayer({ show, onClose, startAt = 0 }: { show: StudioShow; onClose: () => void; startAt?: number }) {
  const audio = useRef<HTMLAudioElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const lui = useRef<HTMLDivElement>(null);
  const lei = useRef<HTMLDivElement>(null);
  const luiNotes = useRef<HTMLDivElement>(null);
  const leiNotes = useRef<HTMLDivElement>(null);
  const screenBox = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const timeLabel = useRef<HTMLSpanElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const videoBoxes = useRef<(HTMLDivElement | null)[]>([]);
  const replayBg = useRef<HTMLCanvasElement>(null);
  const guestBox = useRef<HTMLDivElement>(null);
  const guestChair = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const chromeTimer = useRef(0);
  const clock = useRef({ t: startAt, at: 0, running: false, audioOk: true });
  const smooth = useRef({ lui: { mouth: 0, look: 0 }, lei: { mouth: 0, look: 0 }, ospite: { mouth: 0, look: 0 } });

  const [playing, setPlaying] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(false);
  // Ogni salto ricrea i pezzi animati con il loro punto di partenza (nonce), così le animazioni CSS
  // ripartono dal momento giusto anche andando avanti e indietro.
  const [nonce, setNonce] = useState(0);
  const [scr, setScr] = useState(() => ({ ...screenAt(show, startAt), el: startAt - screenAt(show, startAt).since }));
  const [mode, setMode] = useState(() => modeAt(show, startAt));
  const [modeEl, setModeEl] = useState(0);
  const [cap, setCap] = useState<ReturnType<typeof captionAt>>(null);
  const [replayClip, setReplayClip] = useState(-1);
  const [full, setFull] = useState(() => fullScreenAt(show, startAt));
  const [flash, setFlash] = useState<{ kind: "play" | "pause" | "back" | "fwd"; n: number } | null>(null);

  const [k, setK] = useState(1);
  const view = useRef({ w: 390, h: 844 });
  useEffect(() => {
    // Il player occupa la parte di schermo davvero visibile (visualViewport): così le barre del
    // browser o dei tasti di sistema non coprono niente, nemmeno quando appaiono e spariscono.
    const vv = window.visualViewport;
    const fit = () => {
      const w = vv?.width ?? window.innerWidth;
      const h = vv?.height ?? window.innerHeight;
      view.current = { w, h };
      const r = root.current;
      if (r && vv) {
        r.style.top = `${vv.offsetTop}px`;
        r.style.height = `${h}px`;
        r.style.bottom = "auto";
      }
      setK(Math.min(w / STAGE.w, h / STAGE.h) * 1.0001);
    };
    fit();
    window.addEventListener("resize", fit);
    vv?.addEventListener("resize", fit);
    vv?.addEventListener("scroll", fit);
    return () => {
      window.removeEventListener("resize", fit);
      vv?.removeEventListener("resize", fit);
      vv?.removeEventListener("scroll", fit);
    };
  }, []);

  // Fascia alta e comandi: nascosti di base; un tocco li mostra e dopo 3 secondi spariscono
  // (restano finché la puntata è ferma).
  const [chrome, setChrome] = useState(true);
  const showChrome = useCallback((stay = false) => {
    setChrome(true);
    window.clearTimeout(chromeTimer.current);
    if (!stay) chromeTimer.current = window.setTimeout(() => clock.current.running && setChrome(false), 3000);
  }, []);
  useEffect(() => {
    chromeTimer.current = window.setTimeout(() => clock.current.running && setChrome(false), 2500);
    return () => window.clearTimeout(chromeTimer.current);
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
        if ((e as Error).name === "NotAllowedError") {
          c.running = false;
          setPlaying(false);
          setNeedsTap(true);
          root.current?.classList.add("studio-paused");
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
    setChrome(true);
    window.clearTimeout(chromeTimer.current);
  }, [now]);

  const seek = useCallback(
    (to: number) => {
      const c = clock.current;
      const t = Math.max(0, Math.min(show.duration - 0.05, to));
      c.t = t;
      c.at = performance.now();
      if (audio.current) audio.current.currentTime = t;
      const s = screenAt(show, t);
      setScr({ ...s, el: t - s.since });
      const m = modeAt(show, t);
      setMode(m);
      setModeEl(m === "sigla" ? t : m === "fine" ? t - show.outro.t : 0);
      setNonce((n) => n + 1);
      setEnded(false);
    },
    [show],
  );

  useEffect(() => {
    const a = audio.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void start();
    return () => a?.pause();
  }, [start]);

  useEffect(() => {
    const onHide = () => document.hidden && clock.current.running && pause();
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [pause]);

  // Il motore: a ogni fotogramma telecamera, presentatori, grafica, replay, sottotitoli e barra.
  useEffect(() => {
    let raf = 0;
    let lastScreen = -1;
    let lastMode = "";
    let lastCap = "";
    let lastClip = -2;
    let lastFull: boolean | null = null;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = now();
      const c = clock.current;
      if (t >= show.duration - 0.02 && c.running) {
        c.t = show.duration;
        c.running = false;
        setPlaying(false);
        setEnded(true);
      }
      const cam = cameraAt(show, t);
      if (world.current) world.current.style.transform = `translate3d(${cam.x}px, ${cam.y}px, 0) scale(${cam.s})`;

      const line = lineAt(show, t);
      const g = guestAt(show, t);
      for (const who of ["lui", "lei"] as const) {
        const box = who === "lui" ? lui.current : lei.current;
        if (!box) continue;
        const sm = smooth.current[who];
        sm.mouth += (mouthAt(line, who, t) - sm.mouth) * 0.55;
        sm.look += (lookAt(line, who, t, g.on && g.seat > 0.5) - sm.look) * 0.14;
        // Con l'ospite i conduttori si spostano un po' ai lati per fargli posto.
        const dx = `translateX(${((who === "lui" ? 1 : -1) * GUEST_SPREAD * g.apart).toFixed(2)}px)`;
        box.style.transform = dx;
        const listening = line && line.who !== who;
        box.style.setProperty("--mouth", sm.mouth.toFixed(3));
        box.style.setProperty("--look", sm.look.toFixed(3));
        box.style.setProperty("--blink", blinkAt(who, t).toFixed(2));
        box.style.setProperty("--breath", Math.sin(t * 1.5 + (who === "lui" ? 0 : 1.7)).toFixed(3));
        box.style.setProperty("--nod", listening ? (Math.max(0, Math.sin(t * 2.4)) ** 3).toFixed(3) : (sm.mouth * 0.45).toFixed(3));
        const arm = armAt(show, who, t).toFixed(3);
        box.style.setProperty("--arm", arm);
        const notes = (who === "lui" ? luiNotes : leiNotes).current;
        if (notes) {
          notes.style.setProperty("--arm", arm);
          notes.style.transform = who === "lui" ? `${dx} scaleX(-1)` : dx;
        }
      }
      // L'ospite: entra camminando con la sua sedia, si siede al centro, parla, saluta ed esce.
      const gb = guestBox.current;
      if (gb) {
        const gs = smooth.current.ospite;
        gs.mouth += (mouthAt(line, "ospite", t) - gs.mouth) * 0.55;
        const bob = g.walk ? -Math.abs(Math.sin(g.walk * Math.PI)) * 7 : 0;
        const tilt = g.walk ? Math.sin(g.walk * Math.PI) * 2.5 : 0;
        const talk = line?.who === "ospite" ? Math.sin(t * 9) * 0.6 : 0;
        gb.style.visibility = g.on ? "visible" : "hidden";
        gb.style.transform = `translate3d(${g.x.toFixed(1)}px, ${((1 - g.seat) * -30 + bob + talk).toFixed(1)}px, 0) rotate(${tilt.toFixed(2)}deg)`;
        gb.style.setProperty("--mouth", gs.mouth.toFixed(3));
        gb.dataset.walk = g.walk ? "1" : "0";
        gb.dataset.seat = g.seat > 0.5 ? "1" : "0";
        // La sedia: la tira dietro di sé entrando e la riporta via uscendo.
        const ch = guestChair.current;
        if (ch) {
          const trail = g.dir === -1 ? 70 : g.dir === 1 ? -70 : 0;
          const settle = g.dir === 0 && g.seat < 1 && t < (show.guest?.sit ?? 0) ? 70 * (1 - g.seat) : 0;
          ch.style.visibility = g.on ? "visible" : "hidden";
          ch.style.transform = `translate3d(${(g.x + trail + settle).toFixed(1)}px, 0, 0)`;
        }
      }

      const s = screenAt(show, t);
      if (s.index !== lastScreen) {
        lastScreen = s.index;
        setScr((p) => (p.index === s.index ? p : { ...s, el: t - s.since }));
      }
      const m = modeAt(show, t);
      if (m !== lastMode) {
        if (lastMode) setModeEl(m === "sigla" ? t : m === "fine" ? t - show.outro.t : 0);
        lastMode = m;
        setMode(m);
      }
      const f = fullScreenAt(show, t);
      if (f !== lastFull) {
        lastFull = f;
        setFull(f);
      }
      // I numeri delle grafiche contano col tempo della puntata (nello studio e a tutto schermo).
      root.current?.querySelectorAll<HTMLElement>("[data-to]").forEach((n) => {
        const to = Number(n.dataset.to);
        const u = easeOut((t - s.since - Number(n.dataset.at)) / 1.0);
        n.textContent = String(Math.round(to * u));
      });

      // Il replay: un video per canestro, già caricato; parte dall'inizio della clip e va fino in fondo.
      const r = replayAt(show, t);
      const scrR = show.screens[s.index];
      if (scrR?.kind === "replay") {
        const on = m === "replay" && r ? r.clip : -1;
        if (on !== lastClip) {
          lastClip = on;
          setReplayClip(on);
        }
        scrR.clips.forEach((clip, i) => {
          const v = videos.current[i];
          if (!v) return;
          if (i !== on) {
            if (!v.paused) v.pause();
            if (v.readyState >= 1 && Math.abs(v.currentTime - clip.from) > 0.05 && (on < 0 || i > on)) v.currentTime = clip.from;
            return;
          }
          const want = clip.from + (r?.local ?? 0);
          if (v.readyState >= 1 && Math.abs(v.currentTime - want) > 0.3) v.currentTime = want;
          // La regia: il riquadro del video segue canestro e giocatori, a tutto schermo.
          const box = videoBoxes.current[i];
          if (box) {
            const { w: vw, h: vh } = view.current;
            const f = replayFrame(clip, r?.local ?? 0);
            const wf = Math.max(0.2, Math.min(1, f.w));
            const z = 1 / wf;
            const hd = ((vw * 9) / 16) * z;
            const tx = Math.min(0, Math.max(vw - vw * z, vw / 2 - f.cx * vw * z));
            const ty = hd >= vh ? Math.min(0, Math.max(vh - hd, vh / 2 - f.cy * hd)) : Math.min(vh - hd, Math.max(0, vh * 0.47 - f.cy * hd));
            box.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) scale(${z.toFixed(4)})`;
          }
          // Dietro, lo stesso video piccolissimo e ingrandito: sfocato e in movimento riempie
          // lo schermo sopra e sotto, come i video orizzontali nei reel (costa pochissimo).
          const bg = replayBg.current?.getContext("2d");
          if (bg && v.readyState >= 2) {
            try {
              bg.drawImage(v, 0, 0, 32, 18);
            } catch {
              /* il fotogramma non è pronto: si riprova al prossimo */
            }
          }
          if (c.running && v.paused) void v.play().catch(() => {});
          if (!c.running && !v.paused) v.pause();
        });
      }

      const cp = captionAt(show, t);
      const key = cp ? `${cp.line.t}:${cp.page.from}:${cp.active}` : "";
      if (key !== lastCap) {
        lastCap = key;
        setCap(cp);
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

  // Tocco: uno mostra i comandi, due a sinistra o a destra saltano di 10 secondi.
  const taps = useRef<{ at: number; x: number; timer: number }>({ at: 0, x: 0, timer: 0 });
  const onTap = (e: React.PointerEvent<HTMLDivElement>) => {
    if (ended || needsTap) return;
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
    // Un tocco mostra o nasconde fascia e comandi (la pausa è sul pulsante).
    tp.timer = window.setTimeout(() => {
      if (chrome && clock.current.running) {
        window.clearTimeout(chromeTimer.current);
        setChrome(false);
      } else showChrome(!clock.current.running);
    }, side === 0 ? 0 : 300);
  };

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
  const replay = screen?.kind === "replay" ? screen : null;

  return (
    <div ref={root} className="fixed inset-0 z-[90] select-none overflow-hidden bg-[#1f45b8] text-white" role="dialog" aria-modal="true" aria-label={`Studio Campetto, le partite di ${longDate(show.day)}`} onPointerUp={onTap}>
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
      <div className="absolute left-1/2 top-1/2 overflow-hidden" style={{ width: STAGE.w, height: STAGE.h, transform: `translate(-50%, -50%) scale(${k})` }}>
        <div ref={world} className="absolute left-0 top-0 origin-top-left will-change-transform" style={{ width: STAGE.w, height: STAGE.h }}>
          <StudioSet day={show.day} />
          {/* Il maxischermo. */}
          <div
            className="absolute overflow-hidden rounded-[16px] ring-[3px] ring-white/90"
            style={{ left: SCREEN.x, top: SCREEN.y, width: SCREEN.w, height: SCREEN.h, boxShadow: "0 18px 40px -12px rgb(10 20 60 / 0.6)" }}
          >
            <div ref={screenBox} className="origin-top-left" style={{ transform: `scale(${SCREEN.w / SCREEN.nativeW})` }}>
              <div key={`${scr.index}-${nonce}`} style={el(scr.el)} className="studio-screen-in">
                {screen && <StudioScreenView screen={screen} />}
              </div>
            </div>
          </div>
          {show.guest && <GuestInStudio playerId={show.guest.playerId} boxRef={guestBox} chairRef={guestChair} />}
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
        {/* A zoom finito la grafica prende il posto dello studio: stesso punto, stessa misura. */}
        <div className={clsx("absolute inset-0 transition-opacity duration-200", full && screen?.kind !== "replay" ? "opacity-100" : "pointer-events-none opacity-0")} aria-hidden={!full}>
          <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, #3D6AF0 0%, var(--court) 45%, var(--court-deep) 100%)" }}>
            <span className="blob -left-24 top-0 h-80 w-80 bg-[radial-gradient(circle,rgb(255_197_49/0.38),transparent_68%)]" />
            <span className="blob -bottom-20 -right-24 h-80 w-80 bg-[radial-gradient(circle,rgb(242_106_27/0.3),transparent_70%)]" />
          </div>
          <FullCard screen={screen} keyId={`${scr.index}-${nonce}`} el={scr.el} />
        </div>
      </div>

      {/* Il replay a tutto schermo: una telecamera virtuale tiene dentro canestro e giocatori e
          allarga solo quando serve; clip dall'inizio alla fine. */}
      {replay && (
        <div className={clsx("absolute inset-0 overflow-hidden transition-opacity duration-150", mode === "replay" ? "opacity-100" : "pointer-events-none opacity-0")} aria-hidden={mode !== "replay"}>
          <div className="absolute inset-0 bg-[#0d1124]">
            <canvas ref={replayBg} width={32} height={18} className="absolute left-1/2 top-1/2 h-full w-auto max-w-none -translate-x-1/2 -translate-y-1/2 opacity-60" style={{ aspectRatio: "16 / 9" }} aria-hidden />
            <span className="absolute inset-0 bg-gradient-to-b from-[#0d1124]/40 via-transparent to-[#0d1124]/50" />
          </div>
          {replay.clips.map((clip, i) => (
            <div
              key={clip.src + clip.from}
              ref={(d) => {
                videoBoxes.current[i] = d;
              }}
              className={clsx("absolute left-0 top-0 origin-top-left will-change-transform", i === replayClip ? "opacity-100" : "opacity-0")}
              style={{ width: "100%", aspectRatio: "16 / 9", maskImage: "linear-gradient(to bottom, transparent, #000 5%, #000 95%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 5%, #000 95%, transparent)" }}
            >
              <video
                ref={(v) => {
                  videos.current[i] = v;
                }}
                src={`${clip.src}#t=${clip.from}`}
                muted
                playsInline
                preload="auto"
                className="h-full w-full bg-black object-cover"
              />
            </div>
          ))}
          <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/40 to-transparent px-4 pb-8 pt-[max(18px,calc(var(--sat)+10px))]">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-volt px-3 py-1 text-[13px] font-bold text-volt-ink">Replay</span>
              <span className="text-[15px] font-bold drop-shadow-[0_1px_2px_rgb(0_0_0/0.6)]">{replayClip >= 0 ? `Partita ${replay.clips[replayClip].game}` : ""}</span>
              <span className="ml-auto flex gap-1.5" aria-hidden>
                {replay.clips.map((_, i) => (
                  <span key={i} className={clsx("h-2 w-2 rounded-full", i === replayClip ? "bg-volt" : "bg-white/45")} />
                ))}
              </span>
            </div>
          </div>
          {replayClip >= 0 && (
            <div className="absolute inset-x-3" style={{ bottom: "calc(26px + var(--sab))" }}>
              <ReplayScore show={show} game={replay.clips[replayClip].game} />
            </div>
          )}
        </div>
      )}

      {/* La sigla: il badge dell'app con le scritte dello show, poi si apre sullo studio. */}
      {mode === "sigla" && <Sigla key={`s${nonce}`} show={show} at={modeEl} />}
      {mode === "fine" && <Fine key={`f${nonce}`} show={show} at={modeEl} />}

      {/* Sopra lo studio: barra, titolo, sottotitoli e comandi (non zoomano). */}
      <div ref={top} data-on={chrome && mode !== "sigla" ? "1" : "0"} className="studio-chrome is-top pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/45 to-transparent px-4 pb-8 pt-[max(14px,var(--sat))]">
        <div className="flex items-center gap-2">
          <Logo size={30} top="STUDIO" bottom="★ CAMPETTO ★" text={false} />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold leading-tight">Studio Campetto</span>
            <span className="block text-[12px] leading-tight text-white/75">Le partite di {longDate(show.day)}</span>
          </span>
          <button type="button" className="press pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-white/20" aria-label="Chiudi" onClick={onClose}>
            <IconX size={22} />
          </button>
        </div>
      </div>

      <LowerThird show={show} now={now} />

      {/* Sottotitoli come nei reel: poche parole alla volta, che compaiono mentre vengono dette;
          l'ultima detta in giallo. */}
      <div className="pointer-events-none absolute inset-x-0 z-10 flex justify-center px-5" style={{ bottom: mode === "replay" ? "calc(118px + var(--sab))" : "calc(104px + var(--sab))" }} aria-live="polite">
        {cap && mode !== "sigla" && (
          <p key={`${cap.line.t}:${cap.page.from}`} className="studio-cap flex max-w-[92%] flex-wrap justify-center gap-x-[0.36em] gap-y-1 text-center text-[30px] font-extrabold leading-[1.2] tracking-[0.005em] text-white">
            {cap.line.words.slice(cap.page.from, cap.page.to + 1).map(([w], i) => {
              const k = cap.page.from + i;
              return (
                <span key={i} className={clsx("studio-word", k <= cap.active && "is-said", k === cap.active && "is-on")}>
                  {w.replace(/[.,:;]+$/, "")}
                </span>
              );
            })}
          </p>
        )}
      </div>

      <div ref={bottom} data-on={chrome ? "1" : "0"} className="studio-chrome is-bottom pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/60 to-transparent px-4 pb-[max(22px,calc(var(--sab)+14px))] pt-10">
        {/* Una sola linea continua, come nei reel: niente tacche. */}
        <div
          ref={bar}
          className="pointer-events-auto relative mb-2 flex h-6 cursor-pointer items-center"
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
          <span className="relative h-[3px] w-full overflow-hidden rounded-full bg-white/30">
            <span className="absolute inset-0 origin-left bg-white" style={{ transform: "scaleX(var(--p, 0))" }} />
          </span>
        </div>
        <div className="pointer-events-auto flex items-center justify-between">
          <span ref={timeLabel} className="tnum w-24 text-[12.5px] text-white/80" />
          <div className="flex items-center gap-3">
            <button type="button" className="press grid h-11 w-11 place-items-center rounded-full bg-white/20" aria-label="Indietro di 10 secondi" onClick={() => seek(now() - 10)}>
              <IconRewindBackward10 size={24} />
            </button>
            <button type="button" className="press grid h-14 w-14 place-items-center rounded-full bg-white text-[#1f45b8]" aria-label={playing ? "Pausa" : "Riprendi"} onClick={() => (clock.current.running ? pause() : void start())}>
              {playing ? <IconPlayerPauseFilled size={26} /> : <IconPlayerPlayFilled size={26} />}
            </button>
            <button type="button" className="press grid h-11 w-11 place-items-center rounded-full bg-white/20" aria-label="Avanti di 10 secondi" onClick={() => seek(now() + 10)}>
              <IconRewindForward10 size={24} />
            </button>
          </div>
          <div className="flex w-24 justify-end">
            <button type="button" className="press grid h-11 w-11 place-items-center rounded-full bg-white/20" aria-label={muted ? "Attiva l'audio" : "Togli l'audio"} onClick={() => setMuted((m) => !m)}>
              {muted ? <IconVolumeOff size={22} /> : <IconVolume size={22} />}
            </button>
          </div>
        </div>
      </div>

      {flash && (
        <span key={flash.n} className="studio-flash pointer-events-none absolute top-[45%] grid h-20 w-20 place-items-center rounded-full bg-black/40" style={{ left: flash.kind === "back" ? "12%" : flash.kind === "fwd" ? "calc(88% - 80px)" : "calc(50% - 40px)" }}>
          {flash.kind === "pause" ? <IconPlayerPauseFilled size={34} /> : flash.kind === "play" ? <IconPlayerPlayFilled size={34} /> : flash.kind === "back" ? <IconRewindBackward10 size={34} /> : <IconRewindForward10 size={34} />}
        </span>
      )}

      {(needsTap || ended) && (
        <div className="absolute inset-0 grid place-items-center bg-[#1f45b8]/70">
          <div className="text-center">
            <Logo size={96} top="STUDIO" bottom="★ CAMPETTO ★" className="mx-auto" />
            <p className="display mt-3 text-[28px]">{ended ? "Fine della puntata" : "Studio Campetto"}</p>
            <div className="mt-5 flex justify-center gap-3">
              {ended && (
                <button type="button" className="press rounded-full bg-white/20 px-5 py-3 font-semibold" onClick={onClose}>
                  Chiudi
                </button>
              )}
              <button
                type="button"
                className="press inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-[#1f45b8]"
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

/** La grafica del maxischermo a tutto schermo, nello stesso punto dove arriva lo zoom. */
function FullCard({ screen, keyId, el: e }: { screen: StudioShow["screens"][number] | undefined; keyId: string; el: number }) {
  if (!screen || screen.kind === "replay") return null;
  const r = screenRect();
  return (
    <div className="absolute overflow-hidden rounded-[30px] ring-[3px] ring-white/90 shadow-[0_24px_50px_-16px_rgb(10_20_60/0.6)]" style={{ left: r.x, top: r.y, width: r.w, height: r.h }}>
      <div className="origin-top-left" style={{ transform: `scale(${r.w / SCREEN.nativeW})` }}>
        <div key={keyId} style={el(e)} className="studio-screen-in">
          <StudioScreenView screen={screen} />
        </div>
      </div>
    </div>
  );
}

/** Sotto il replay: chi ha giocato quella partita e come è finita (dalla grafica dei risultati). */
function ReplayScore({ show, game }: { show: StudioShow; game: number }) {
  const { data } = useData();
  const res = show.screens.find((x) => x.kind === "risultati");
  const g = res?.kind === "risultati" ? res.games[game - 1] : null;
  if (!g) return null;
  const nm = (id: string) => {
    const p = data.players.find((x) => x.id === id);
    return p?.nickname?.trim() || p?.firstName || "—";
  };
  const aWon = g.sa > g.sb;
  return (
    <div key={game} className="studio-in mt-3 flex items-center gap-3 rounded-[20px] bg-[#FFFAF0] px-4 py-3 text-[#1d1a16] shadow-[0_14px_30px_-12px_rgb(0_0_0/0.45)]" style={el(0)}>
      <span className={clsx("min-w-0 flex-1 text-[14px] leading-tight", aWon ? "font-bold" : "font-medium text-[#1d1a16]/55")}>{g.a.map(nm).join(" e ")}</span>
      <span className="score shrink-0 text-[26px]">
        <span className={aWon ? "" : "text-[#1d1a16]/35"}>{g.sa}</span>
        <span className="text-[#1d1a16]/30">–</span>
        <span className={!aWon ? "" : "text-[#1d1a16]/35"}>{g.sb}</span>
      </span>
      <span className={clsx("min-w-0 flex-1 text-right text-[14px] leading-tight", !aWon ? "font-bold" : "font-medium text-[#1d1a16]/55")}>{g.b.map(nm).join(" e ")}</span>
    </div>
  );
}

/** Il nome di chi parla, la prima volta che è inquadrato da vicino, come in TV; quello
 *  dell'ospite appena si siede. */
function LowerThird({ show, now }: { show: StudioShow; now: () => number }) {
  const [who, setWho] = useState<StudioWho | null>(null);
  useEffect(() => {
    const firsts: { w: StudioWho; t: number }[] = (["lui", "lei"] as const).map((w) => ({ w, t: show.shots.find((s) => s.cam === w)?.t ?? -99 }));
    if (show.guest) firsts.push({ w: "ospite", t: show.guest.sit + 0.2 });
    let raf = 0;
    let last: StudioWho | null = null;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = now();
      const on = firsts.find((f) => t >= f.t && t < f.t + (f.w === "ospite" ? 3.4 : 2.8))?.w ?? null;
      if (on !== last) {
        last = on;
        setWho(on);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [show, now]);
  if (!who) return null;
  if (who === "ospite" && show.guest)
    return (
      // Stretto e a sinistra: al centro della scrivania c'è il badge.
      <div key="ospite" className="studio-in pointer-events-none absolute bottom-[190px] left-4 max-w-[150px] overflow-hidden rounded-[14px] bg-[#FFFAF0] px-3 py-1.5 text-[#1d1a16] shadow-[0_10px_24px_-8px_rgb(0_0_0/0.5)]" style={el(0)}>
        <span className="block truncate text-[17px] font-extrabold leading-tight">{show.guest.name}</span>
        <span className="block text-[11.5px] font-semibold text-[#1d1a16]/60">Ospite in studio</span>
      </div>
    );
  const host = who as StudioHost;
  return (
    // Dal lato opposto al badge della scrivania, che nel primo piano di lui finisce a sinistra e in quello di lei a destra.
    <div
      key={who}
      className={clsx("studio-in pointer-events-none absolute bottom-[190px] flex items-stretch overflow-hidden rounded-[14px] shadow-[0_10px_24px_-8px_rgb(0_0_0/0.5)]", who === "lui" ? "right-4 flex-row-reverse text-right" : "left-4")}
      style={el(0)}
    >
      <span className="grid w-10 place-items-center bg-volt">
        <Logo size={30} text={false} />
      </span>
      <span className="bg-[#FFFAF0] px-3 py-1.5 text-[#1d1a16]">
        <span className="block text-[17px] font-extrabold leading-tight">{show.hosts[host]}</span>
        <span className="block text-[11.5px] font-semibold text-[#1d1a16]/60">{who === "lei" ? "Conduttrice" : "Conduttore"} · Studio Campetto</span>
      </span>
    </div>
  );
}

// Dove ha la bocca ogni personaggio (nel disegno a figura intera), per farla aprire quando parla.
const MOUTH: Partial<Record<string, [number, number]>> = {
  collana: [63, 1], bandana: [61, 0.8], coppola: [70, 0.92], muscoli: [61.6, 0.62], volo: [64, 1.05], gigante: [60, 0.9], mago: [66, 0.8],
  rimbalzo: [60, 0.85], fuoco: [69, 0.9], uragano: [62, 0.8], bomber: [72, 0.92], postino: [72.6, 0.8], gentiluomo: [70, 0.8], marinaio: [69, 0.9],
  professore: [65.4, 0.8], pirata: [72, 0.88], samurai: [66.5, 0.8], aviatore: [69, 0.9], faraone: [65, 0.8], drago: [71, 0.9], luchador: [63.4, 0.8],
  astronauta: [67, 0.95], sole: [66, 1], direttore: [68.4, 0.8], leggenda: [65, 1],
};
/** Alto 288 px nello studio: la testa grande come quella dei conduttori. */
const GUEST_H = 288;

/**
 * L'ospite: il personaggio del giocatore, come nell'app, con la sua sedia. Il player lo muove
 * con transform e variabili CSS (--mouth); entra e palleggia, seduto il pallone non c'è.
 */
function GuestInStudio({ playerId, boxRef, chairRef }: { playerId: string; boxRef: React.RefObject<HTMLDivElement | null>; chairRef: React.RefObject<HTMLDivElement | null> }) {
  const { data } = useData();
  const player = data.players.find((p) => p.id === playerId);
  if (!player) return null;
  const id = characterOf(player);
  const vh = 185 + (KIT[id]?.legs ?? 0);
  const w = (GUEST_H * 100) / vh;
  const [my, mw] = MOUTH[id] ?? [62, 0.85];
  return (
    <>
      {/* La sedia: si vede lo schienale dietro le spalle; il resto è dietro la scrivania. */}
      <div ref={chairRef} className="absolute will-change-transform" style={{ left: 195 - 56, top: 506, width: 112, height: 170, visibility: "hidden" }} aria-hidden>
        <svg viewBox="0 0 112 170" width="112" height="170">
          <path d="M14 60 L14 168 M98 60 L98 168" stroke="#1d1a16" strokeWidth="6" strokeLinecap="round" />
          <rect x="4" y="2" width="104" height="80" rx="22" fill="#1f45b8" stroke="#1d1a16" strokeWidth="4" />
          <rect x="14" y="11" width="84" height="62" rx="15" fill="#FFFAF0" />
          <path d="M14 34 H98" stroke="#FFC531" strokeWidth="5" />
          <rect x="2" y="104" width="108" height="18" rx="9" fill="#1f45b8" stroke="#1d1a16" strokeWidth="4" />
        </svg>
      </div>
      <div ref={boxRef} className="studio-guest absolute will-change-transform" data-walk="0" data-seat="0" style={{ left: 195 - w / 2, top: 463, width: w, visibility: "hidden", transformOrigin: "50% 100%" }} aria-hidden>
        <Character id={id} outfit={player.outfit} number={player.jerseyNumber} height={GUEST_H} idle />
        <svg className="absolute inset-0" viewBox={`0 0 100 ${vh}`} width={w} height={GUEST_H} style={{ overflow: "visible" }}>
          <g transform={`translate(50 ${my + 1}) scale(${mw} 1)`}>
            <g className="studio-guest-mouth">
              <ellipse rx="8.5" ry="6.5" fill="#5A1410" stroke="#1D1A16" strokeWidth="2" />
              <ellipse cy="3" rx="4.6" ry="2.4" fill="#E5412D" />
            </g>
          </g>
        </svg>
      </div>
    </>
  );
}

/** La sigla: sfondo giallo dell'app, raggi, il badge che entra girando, il nome dello show. */
function Sigla({ show, at: t0 }: { show: StudioShow; at: number }) {
  return (
    <div className="studio-sigla absolute inset-0 z-10 grid place-items-center bg-[#FFC531] text-[#1d1a16]" style={{ ...el(t0), ["--out" as string]: `${show.intro - 0.75}s` }}>
      <span className="mvp-rays studio-spin absolute left-1/2 top-[42%] h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2" aria-hidden />
      <div className="relative -mt-16 flex flex-col items-center text-center">
        <span className="relative grid place-items-center">
          {[0.55, 0.85].map((d) => (
            <span key={d} className="studio-wave absolute h-[210px] w-[210px] rounded-full border-[6px] border-[#1d1a16]/80" style={at(d)} aria-hidden />
          ))}
          <span className="studio-logo-in drop-shadow-[0_18px_28px_rgb(29_26_22/0.35)]" style={at(0.1)}>
            <span className="studio-float block">
              <Logo size={210} top="STUDIO" bottom="★ CAMPETTO ★" />
            </span>
          </span>
        </span>
        <p className="studio-in display mt-6 text-[46px] leading-[0.95]" style={at(0.85)}>
          Studio
          <br />
          Campetto
        </p>
        <p className="studio-in mt-4 rounded-full bg-[#1d1a16] px-4 py-1.5 text-[14px] font-semibold text-white" style={at(1.2)}>
          Le partite di {longDate(show.day)}
        </p>
      </div>
    </div>
  );
}

/** La chiusura: grazie, la prossima partita, i crediti della musica. */
function Fine({ show, at: t0 }: { show: StudioShow; at: number }) {
  const { data } = useData();
  // La prossima partita: quella annunciata nella puntata, o la prossima aperta nel calendario.
  const nowIso = new Date().toISOString();
  const live = data.proposals
    .filter((p) => p.status === "aperta" && p.startsAt > nowIso)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  // Il posto: per l'indoor l'indirizzo scritto nella proposta (nome e via), se c'è.
  const placeOf = (p: (typeof data.proposals)[number]) =>
    p.place === "indoor" ? (p.address?.split(",").slice(0, 2).join(",").trim() || "Indoor") : p.place === "niche" ? "Niche" : p.place === "decathlon" ? "Decathlon" : undefined;
  const next = live ? { startsAt: live.startsAt, place: placeOf(live) } : show.outro.next;
  const when = next
    ? new Date(next.startsAt).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Rome" }) +
      " · " +
      new Date(next.startsAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" })
    : null;
  return (
    <div className="studio-in absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center" style={{ ...el(t0), background: "linear-gradient(160deg, var(--court) 0%, var(--court-deep) 100%)" }}>
      <span className="blob -right-16 -top-16 h-72 w-72 bg-[radial-gradient(circle,rgb(255_197_49/0.45),transparent_68%)]" aria-hidden />
      <span className="blob -bottom-24 -left-16 h-72 w-72 bg-[radial-gradient(circle,rgb(242_106_27/0.35),transparent_70%)]" aria-hidden />
      <CourtLines className="absolute inset-x-0 bottom-0 h-1/2 w-full opacity-70" />
      <span className="studio-logo-in relative drop-shadow-[0_14px_24px_rgb(0_0_0/0.35)]" style={at(0.05)}>
        <Logo size={120} top="STUDIO" bottom="★ CAMPETTO ★" />
      </span>
      <p className="studio-in display relative mt-5 text-[40px] leading-none" style={at(0.35)}>
        Alla prossima!
      </p>
      {when && (
        <div className="studio-in relative mt-6 flex w-full max-w-[320px] items-center gap-3 rounded-[22px] bg-[#FFFAF0] px-4 py-3 text-left text-[#1d1a16] shadow-[0_14px_30px_-10px_rgb(0_0_0/0.45)]" style={at(0.6)}>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-volt">
            <IconCalendarEvent size={22} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[12px] font-semibold text-[#1d1a16]/60">Prossima partita</span>
            <span className="block text-[15.5px] font-bold leading-tight first-letter:uppercase">{when}</span>
            {next?.place && <span className="block text-[13px] font-medium text-[#1d1a16]/70">{next.place}</span>}
          </span>
        </div>
      )}
      <p className="studio-in relative mt-8 max-w-[300px] text-[11.5px] leading-snug text-white/65" style={at(0.9)}>
        {show.credits}
      </p>
    </div>
  );
}

/** Lo studio nello stile dell'app: parete blu campo con luci gialle e arancio, pannelli vetro,
 *  pavimento color carta con la linea da tre, il giorno delle partite sul pannello di sinistra. */
function StudioSet({ day }: { day: string }) {
  const d = new Date(`${day}T12:00:00`);
  const wd = d.toLocaleDateString("it-IT", { weekday: "short" }).replace(".", "");
  const num = d.getDate();
  const mon = d.toLocaleDateString("it-IT", { month: "short" }).replace(".", "");
  return (
    <div className="absolute inset-0" aria-hidden>
      {/* La parete: va oltre i bordi, così quando la telecamera si allarga non si vede il vuoto. */}
      <div className="absolute -inset-x-40 -top-40 bottom-[260px]" style={{ background: "linear-gradient(160deg, #3D6AF0 0%, var(--court) 45%, var(--court-deep) 100%)" }} />
      <span className="blob left-[-90px] top-[40px] h-[320px] w-[320px] bg-[radial-gradient(circle,rgb(255_197_49/0.42),transparent_68%)]" />
      <span className="blob right-[-110px] top-[260px] h-[340px] w-[340px] bg-[radial-gradient(circle,rgb(242_106_27/0.32),transparent_70%)]" />
      <CourtLines className="absolute inset-x-[-40px] top-[60px] h-[520px] w-[470px] opacity-60" />
      {/* Pannelli vetro ai lati del maxischermo: il giorno a sinistra, il logo a destra. */}
      <div className="absolute left-[14px] top-[128px] flex h-[148px] w-[66px] flex-col items-center justify-center rounded-[18px] border border-white/25 bg-white/15">
        <span className="text-[12px] font-bold uppercase text-white/75">{wd}</span>
        <span className="score text-[40px] text-volt">{num}</span>
        <span className="text-[12px] font-bold uppercase text-white/75">{mon}</span>
      </div>
      <div className="absolute right-[14px] top-[128px] flex h-[148px] w-[66px] flex-col items-center justify-center gap-3 rounded-[18px] border border-white/25 bg-white/15">
        <Logo size={52} text={false} />
        <span className="text-center text-[10px] font-bold uppercase leading-tight tracking-wide text-white/80">
          Studio
          <br />
          Campetto
        </span>
      </div>
      {/* Il pavimento color carta, con la linea da tre arancio. */}
      <div className="absolute -inset-x-40 -bottom-60 top-[584px] bg-[#F2E8D5]" style={{ backgroundImage: "url(/grain-light.png)", backgroundSize: "128px 128px" }} />
      <div className="absolute inset-x-0 top-[584px] h-[30px] bg-gradient-to-b from-[#1d1a16]/25 to-transparent" />
      <svg className="absolute left-[-30px] top-[640px] h-[220px] w-[450px]" viewBox="0 0 450 220" fill="none">
        <path d="M10 210 Q225 -10 440 210" stroke="#F26A1B" strokeWidth="5" opacity="0.8" />
      </svg>
    </div>
  );
}

/** La scrivania: una scheda color carta come quelle dell'app, con il badge dello show. */
function Desk() {
  return (
    <div className="absolute" style={{ left: 10, top: 596, width: 370, height: 150 }} aria-hidden>
      <div className="absolute inset-x-0 top-0 h-[16px] rounded-[10px] bg-white shadow-[0_6px_14px_-6px_rgb(29_26_22/0.35)]" />
      <div className="absolute inset-x-[10px] bottom-0 top-[14px] overflow-hidden rounded-b-[26px] bg-[#FFFAF0] shadow-[0_22px_40px_-18px_rgb(29_26_22/0.55)]">
        <span className="absolute inset-x-0 top-[18px] h-[5px] bg-ball" />
        <span className="absolute inset-x-0 top-[23px] h-[3px] bg-volt" />
        {/* Al centro solo il badge, senza scritte: nei primi piani la scrivania si vede tagliata ai lati. */}
        <div className="absolute inset-x-0 top-[36px] flex justify-center">
          <Logo size={62} top="STUDIO" bottom="★ CAMPETTO ★" />
        </div>
      </div>
    </div>
  );
}
