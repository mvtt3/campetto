"use client";

import { useEffect, useRef, useState } from "react";
import { Mascot } from "@/components/mascot";
import { useData } from "@/lib/data/provider";
import { play, type SoundName } from "@/lib/sound";

/**
 * L'apertura dell'app: Spicchio tira a canestro e sotto compare una frase sul
 * campetto, ogni volta diversa. Parte già dall'HTML (solo CSS), così non c'è la
 * schermata bianca; si chiude da sola appena l'app è pronta, o con un tocco.
 * Una volta per sessione.
 */

/** Le frasi dell'apertura: il campetto come lo viviamo, una a caso ogni volta (mai la stessa di prima). */
export const CAPTIONS = [
  "Oggi la tripla entra, me lo sento",
  "Incrocio le dita: niente pioggia sul campetto",
  "Ultimo tiro e poi andiamo. Forse",
  "Chi perde offre i ghiaccioli",
  "Il ferro di destra è più buono, fidati",
  "Scarpe allacciate, si scende in campo",
  "Oggi niente airball, promesso",
  "Il campetto è aperto, le scuse no",
  "Sto ancora pensando a quel tiro di ieri",
  "Pallone gonfio, campo libero, si parte",
  "Regola del campetto: chi segna resta",
  "Riscaldamento finito, ora si fa sul serio",
];

/** Quanto resta l'apertura, per ogni tiro: il tempo di vedere com'è andata e leggere la frase. */
const MIN_MS: Record<number, number> = { 0: 2600, 1: 2550, 2: 2650, 3: 2900 };

/** Quanto dopo l'ultimo rumore della palla parte il fischio (secondi): subito, ma separato. */
const WHISTLE_AFTER = 0.06;

/** I suoni dei quattro tiri, in secondi dall'inizio dell'animazione (allineati alle parabole). */
const SHOT_SOUNDS: Record<number, [SoundName, number][]> = {
  0: [["board", 1.7]],
  1: [["swish", 1.64]],
  2: [
    ["rim", 1.64],
    ["rim", 1.97],
  ],
  3: [
    ["rim", 1.64],
    ["rim", 2.0],
    ["swish", 2.04],
  ],
};

function pickCaption(): string {
  let last = -1;
  try {
    last = Number(localStorage.getItem("campetto:frase") ?? -1);
  } catch {
    /* ignore */
  }
  let i = Math.floor(Math.random() * CAPTIONS.length);
  if (i === last)
    i =
      (i + 1 + Math.floor(Math.random() * (CAPTIONS.length - 1))) %
      CAPTIONS.length;
  try {
    localStorage.setItem("campetto:frase", String(i));
  } catch {
    /* ignore */
  }
  return CAPTIONS[i];
}

const DONE_EVENT = "campetto:intro-done";

function introGone(): boolean {
  if (typeof document === "undefined") return false;
  const v = document.documentElement.dataset.intro;
  return v === "off" || v === "done";
}

/**
 * true quando l'apertura non c'è più: le feste e la guida aspettano lei, così non
 * compaiono (e non suonano) sotto Spicchio che tira.
 */
export function useIntroDone(): boolean {
  const [done, setDone] = useState(introGone);
  useEffect(() => {
    if (done) return;
    const on = () => setDone(true);
    window.addEventListener(DONE_EVENT, on);
    // Già finita tra il primo disegno e adesso.
    if (introGone()) on();
    return () => window.removeEventListener(DONE_EVENT, on);
  }, [done]);
  return done;
}

/** Da mettere nel <head>: decide prima del disegno se l'apertura va mostrata. */
export const introScript = `(function(){try{var q=location.search;var m=q.match(/shot=(\\d)/);document.documentElement.dataset.shot=m?m[1]:String(Math.floor(Math.random()*4));var force=q.indexOf('intro=1')>-1;if(!force&&(navigator.webdriver||sessionStorage.getItem('campetto:intro')||q.indexOf('mock=')>-1)){document.documentElement.dataset.intro='off';}else{sessionStorage.setItem('campetto:intro','1');}}catch(e){}})();`;

export function Intro() {
  const { auth } = useData();
  const [caption, setCaption] = useState("");
  const [phase, setPhase] = useState<"show" | "leaving" | "gone">("show");
  const [minDone, setMinDone] = useState(false);
  const stopSounds = useRef<() => void>(() => {});

  useEffect(() => {
    if (document.documentElement.dataset.intro === "off") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("gone");
      return;
    }
    setCaption(pickCaption());
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const shot = Number(document.documentElement.dataset.shot ?? 1);
    const t = window.setTimeout(
      () => setMinDone(true),
      reduce ? 700 : (MIN_MS[shot] ?? 2700),
    );
    // Il fischio che apre e il rumore del tiro, a tempo con l'animazione già partita.
    const timers: number[] = [];
    const ball = document.querySelector(".intro-ball-x") as HTMLElement | null;
    const anim = ball?.getAnimations?.()[0];
    const elapsed =
      anim && typeof anim.currentTime === "number"
        ? anim.currentTime / 1000
        : 0;
    const at = (name: SoundName, sec: number) => {
      const wait = sec - elapsed;
      if (wait > -0.05)
        timers.push(
          window.setTimeout(() => play(name), Math.max(0, wait) * 1000),
        );
    };
    // Il fischio arriva appena finisce il tiro di Spicchio (dentro o fuori), un attimo dopo
    // l'ultimo suono della palla. Se in quel momento il telefono non lascia suonare (iPhone
    // appena aperto, prima di un tocco) il fischio si salta: mai più tardi, mentre usi l'app.
    const sounds = reduce ? [] : (SHOT_SOUNDS[shot] ?? []);
    for (const [name, sec] of sounds) at(name, sec);
    const lastHit = sounds.length
      ? Math.max(...sounds.map(([, sec]) => sec))
      : 0.5;
    at("whistle", lastHit + WHISTLE_AFTER);
    stopSounds.current = () => timers.forEach((x) => window.clearTimeout(x));
    return () => {
      window.clearTimeout(t);
      timers.forEach((x) => window.clearTimeout(x));
    };
  }, []);

  const ready = auth.status !== "loading";
  useEffect(() => {
    if (phase !== "show" || !minDone || !ready) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase("leaving");
  }, [phase, minDone, ready]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const t = window.setTimeout(() => setPhase("gone"), 420);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "gone") return;
    if (document.documentElement.dataset.intro !== "off")
      document.documentElement.dataset.intro = "done";
    window.dispatchEvent(new Event(DONE_EVENT));
  }, [phase]);

  if (phase === "gone") return null;
  return (
    <div
      className={`intro halftone ${phase === "leaving" ? "intro-leave" : ""}`}
      role="status"
      aria-label="Campetto si sta aprendo"
      onClick={() => {
        stopSounds.current();
        setPhase("leaving");
      }}
    >
      <div className="intro-title">
        <p className="display intro-word">Campetto</p>
        <p className="intro-sub">★ Nichelino ★</p>
      </div>
      <div className="intro-stage" aria-hidden>
        <svg
          className="intro-hoop"
          viewBox="0 0 120 150"
          width="120"
          height="150"
        >
          <g className="intro-board">
            <rect
              x="18"
              y="4"
              width="96"
              height="66"
              rx="6"
              fill="#fffaf0"
              stroke="#1d1a16"
              strokeWidth="4"
            />
            <rect
              x="48"
              y="28"
              width="36"
              height="28"
              fill="none"
              stroke="#e5412d"
              strokeWidth="3.5"
            />
            <rect x="62" y="70" width="8" height="10" fill="#1d1a16" />
            <g className="intro-net">
              <path
                d="M40 86 L48 128 M56 86 L58 128 M76 86 L74 128 M92 86 L84 128 M44 100 Q66 106 88 100 M47 116 Q66 121 85 116"
                stroke="#fffaf0"
                strokeWidth="2.6"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M40 86 L48 128 M56 86 L58 128 M76 86 L74 128 M92 86 L84 128"
                stroke="#1d1a16"
                strokeWidth="0.8"
                fill="none"
                opacity="0.5"
              />
            </g>
            <ellipse
              cx="66"
              cy="84"
              rx="28"
              ry="6"
              fill="none"
              stroke="#1d1a16"
              strokeWidth="6.5"
            />
            <ellipse
              cx="66"
              cy="84"
              rx="28"
              ry="6"
              fill="none"
              stroke="#f26a1b"
              strokeWidth="3.6"
            />
          </g>
        </svg>
        <div className="intro-ball-x">
          <div className="intro-ball-y">
            <svg
              viewBox="0 0 30 30"
              width="30"
              height="30"
              className="intro-ball"
            >
              <circle
                cx="15"
                cy="15"
                r="13"
                fill="#f26a1b"
                stroke="#1d1a16"
                strokeWidth="2.6"
              />
              <path
                d="M15 2 V28 M2 15 H28 M6 6 Q12 15 6 24 M24 6 Q18 15 24 24"
                stroke="#1d1a16"
                strokeWidth="1.8"
                fill="none"
              />
            </svg>
          </div>
        </div>
        <div className="intro-spicchio">
          <div className="intro-pose intro-pose-a">
            <Mascot pose="ciao" size={128} animate={false} />
          </div>
          <div className="intro-pose intro-pose-b">
            <Mascot pose="esulta" size={128} animate={false} />
          </div>
          <div className="intro-pose intro-pose-c">
            <Mascot pose="boh" size={128} animate={false} />
          </div>
        </div>
        <p className="display intro-say intro-say-in">Ciuff!</p>
        <p className="display intro-say intro-say-miss">Ops!</p>
        <p className="display intro-say intro-say-rim">Sul ferro!</p>
      </div>
      <p className="intro-caption">
        {caption}
        {caption && (
          <span className="intro-dots">
            <i>.</i>
            <i>.</i>
            <i>.</i>
          </span>
        )}
      </p>
    </div>
  );
}
