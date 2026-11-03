"use client";

import clsx from "clsx";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Character, type Pose } from "@/components/character";
import { AVATAR_PRESETS, KIT, type AvatarPresetId } from "@/components/avatar-presets";
import { jerseyOf } from "@/components/outfit-layer";
import { play } from "@/lib/sound";
import { hash } from "@/lib/game/economy";
import {
  DIFF,
  SHOTS,
  ZONE_CENTER,
  defenseResult,
  judgeRing,
  judgeShot,
  passResult,
  ringWindow,
  shotResult,
  shotZone,
  type MomentResult,
  type Shot,
} from "@/lib/game/match";
import type { Difficulty, GameState } from "@/lib/game/types";
import { HoldButton, MeterBar, ringScale, RING_START, useHoldMeter, useRing } from "./meters";
import { Ball, Hoop } from "./scene";
import { useGame } from "./store";

/**
 * L'azione di ogni momento della partita, come in New Star Soccer: la telecamera è
 * alle spalle del tuo personaggio (lo vedi di schiena, col nome e il numero), i
 * compagni hanno i tuoi colori, gli avversari quelli della squadra inventata.
 * Prima un attimo di gioco (palleggi, ti sposti, il difensore ti segue), poi tocca a te.
 */

type P = { x: number; y: number };

/** Prospettiva: più in basso nello schermo = più vicino = più grande. */
const depth = (y: number) => 0.42 + (y / 100) * 0.68;
/** Altezza del personaggio, in frazione dell'altezza della scena, a grandezza 1. */
const CHAR = 0.33;
/** Proporzioni del personaggio intero (viewBox 100 × 185 circa). */
const CHAR_RATIO = 100 / 185;

export type ScenePoint = P;

/** Da che parte rimbalza il pallone: a caso, a sinistra o a destra. */
const sideCoin = () => (Math.random() < 0.5 ? -1 : 1);

const PALETTE: { jersey: string; trim: string }[] = [
  { jersey: "#E5412D", trim: "#FFF8EA" },
  { jersey: "#2E9E5B", trim: "#FFC531" },
  { jersey: "#7C4DCC", trim: "#FFF8EA" },
  { jersey: "#1D3B66", trim: "#F26A1B" },
  { jersey: "#FFC531", trim: "#1D1A16" },
  { jersey: "#1597A6", trim: "#FFF8EA" },
  { jersey: "#2B2724", trim: "#E8A80C" },
  { jersey: "#C93B78", trim: "#FFF8EA" },
];

const EXTRAS = AVATAR_PRESETS.filter((p) => p.rarity === "base" || p.rarity === "rara").map((p) => p.id);

/** La divisa di una squadra inventata: sempre la stessa per nome, diversa dalla nostra. */
export function teamKit(team: string, avoid?: string): { jersey: string; trim: string } {
  let i = hash(team) % PALETTE.length;
  if (avoid && PALETTE[i].jersey.toLowerCase() === avoid.toLowerCase()) i = (i + 1) % PALETTE.length;
  return PALETTE[i];
}

function extraId(seed: string, not: AvatarPresetId): AvatarPresetId {
  const pool = EXTRAS.filter((x) => x !== not);
  return pool[hash(seed) % pool.length];
}

function useStage() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, ...size };
}

interface ActorSpec {
  key: string;
  id: AvatarPresetId;
  at: P;
  back?: boolean;
  pose?: Pose;
  kit?: { jersey: string; trim: string };
  outfit?: GameState["outfit"];
  number?: number | null;
  backName?: string;
  jump?: boolean;
  crouch?: boolean;
  /** Durata dello spostamento, in ms. */
  move?: number;
  dim?: boolean;
}

function Actor({ a, h }: { a: ActorSpec; h: number }) {
  const ch = Math.round(h * CHAR * depth(a.at.y));
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: `${a.at.x}%`,
        top: `${a.at.y}%`,
        zIndex: Math.round(a.at.y),
        transition: `left ${a.move ?? 900}ms ease-in-out, top ${a.move ?? 900}ms ease-in-out`,
        opacity: a.dim ? 0.55 : 1,
      }}
    >
      <div
        style={{
          transform: `translate(-50%, -100%) translateY(${a.jump ? -ch * 0.2 : 0}px) scaleY(${a.crouch ? 0.93 : 1})`,
          transformOrigin: "50% 100%",
          transition: a.jump ? "transform 260ms cubic-bezier(.2,.9,.3,1)" : "transform 300ms cubic-bezier(.5,0,.7,.4)",
        }}
      >
        <Character
          id={a.id}
          height={ch}
          back={a.back}
          backName={a.backName}
          number={a.number}
          pose={a.pose}
          kit={a.kit}
          outfit={a.outfit}
          noBall
          idle={!a.jump && (a.pose ?? "dribble") === "dribble"}
        />
      </div>
    </div>
  );
}

/** Il pallone della scena: si sposta e vola con l'animazione del browser, fuori da React. */
function useSceneBall(stage: { w: number; h: number }) {
  const el = useRef<HTMLDivElement>(null);
  const pos = useRef<{ x: number; y: number; s: number }>({ x: 0, y: 0, s: 1 });
  const px = useCallback((p: P) => ({ x: (p.x / 100) * stage.w, y: (p.y / 100) * stage.h }), [stage.w, stage.h]);
  const place = useCallback(
    (p: P, s = 1) => {
      const e = el.current;
      if (!e) return;
      const q = px(p);
      pos.current = { ...q, s };
      e.getAnimations?.().forEach((a) => a.cancel());
      e.style.transform = `translate(${q.x}px, ${q.y}px) translate(-50%, -50%) scale(${s})`;
    },
    [px],
  );
  /** Vola fino a `to` con un arco alto `arc` (frazione della scena). */
  const fly = useCallback(
    (to: P, opts: { arc?: number; ms?: number; s?: number; then?: P[] } = {}) => {
      const e = el.current;
      if (!e || !e.animate) return Promise.resolve();
      const from = pos.current;
      const end = px(to);
      const arc = (opts.arc ?? 0.2) * stage.h;
      const s1 = opts.s ?? from.s;
      const steps = 18;
      const frames: Keyframe[] = [];
      const cx = (from.x + end.x) / 2;
      const cy = Math.min(from.y, end.y) - arc;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * cx + t * t * end.x;
        const y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * cy + t * t * end.y;
        const s = from.s + (s1 - from.s) * t;
        frames.push({ transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})`, offset: t * (opts.then ? 0.75 : 1) });
      }
      if (opts.then) {
        opts.then.forEach((p, k) => {
          const q = px(p);
          frames.push({
            transform: `translate(${q.x}px, ${q.y}px) translate(-50%, -50%) scale(${s1})`,
            offset: 0.75 + (0.25 * (k + 1)) / opts.then!.length,
          });
        });
      }
      const last = opts.then ? px(opts.then[opts.then.length - 1]) : end;
      pos.current = { ...last, s: s1 };
      const a = e.animate(frames, { duration: opts.ms ?? 800, easing: "linear", fill: "forwards" });
      return a.finished.then(
        () => undefined,
        () => undefined,
      );
    },
    [px, stage.h],
  );
  return { el, place, fly };
}

/** Dove sono le mani di un personaggio fermo in `at`: sopra la testa, al petto o al fianco. */
function handsAt(at: P, where: "up" | "chest"): P {
  const hp = CHAR * depth(at.y) * 100;
  return where === "up" ? { x: at.x, y: at.y - hp * 0.97 } : { x: at.x, y: at.y - hp * 0.55 };
}

/** Le misure del canestro nella scena: il ferro sta al 17% dell'altezza. */
const RIM: P = { x: 50, y: 16.5 };
const NET: P = { x: 50, y: 23 };

const SPOTS: Record<Shot, P[]> = {
  sotto: [
    { x: 42, y: 64 },
    { x: 58, y: 65 },
  ],
  media: [
    { x: 32, y: 77 },
    { x: 68, y: 77 },
    { x: 50, y: 79 },
  ],
  tripla: [
    { x: 50, y: 94 },
    { x: 22, y: 89 },
    { x: 78, y: 89 },
  ],
};

interface Formation {
  me: P;
  start: P;
  marker: P;
  markerStart: P;
  mates: P[];
  others: P[];
  open: number;
}

function formation(size: 3 | 5, shot: Shot, open: boolean, seed: number): Formation {
  const spots = SPOTS[shot];
  const me = spots[seed % spots.length];
  const side = me.x < 50 ? -1 : 1;
  const start = { x: me.x - side * 14, y: Math.min(97, me.y + 6) };
  const marker = open ? { x: me.x + side * 22, y: me.y - 6 } : { x: me.x + side * 3, y: me.y - 11 };
  const markerStart = { x: me.x - side * 4, y: me.y - 14 };
  const mates3 = [
    { x: 18, y: 71 },
    { x: 82, y: 72 },
  ];
  const mates5 = [
    { x: 15, y: 70 },
    { x: 85, y: 69 },
    { x: 27, y: 56 },
    { x: 73, y: 55 },
  ];
  const mates = (size === 3 ? mates3 : mates5).map((m) => (Math.abs(m.x - me.x) < 12 && Math.abs(m.y - me.y) < 10 ? { x: 100 - m.x, y: m.y } : m));
  const others = (
    size === 3
      ? [
          { x: 30, y: 55 },
          { x: 69, y: 56 },
        ]
      : [
          { x: 21, y: 62 },
          { x: 79, y: 61 },
          { x: 40, y: 49 },
          { x: 60, y: 49 },
        ]
  ).map((o, k) => ({ x: o.x + ((seed + k) % 3) * 2 - 2, y: o.y }));
  return { me, start, marker, markerStart, mates, others, open: (seed * 7 + 3) % mates.length };
}

/** Il cerchio a tempo sopra un punto della scena (un compagno, il pallone). */
function RingAt({
  at,
  win,
  ring,
  size = 64,
  tone = "volt",
}: {
  at: P;
  win: number;
  ring: React.RefObject<HTMLDivElement | null>;
  size?: number;
  tone?: "volt" | "danger";
}) {
  const color = tone === "danger" ? "var(--danger)" : "var(--volt)";
  const outer = ringScale(0.75 - win);
  const inner = ringScale(0.75 + win);
  return (
    <div className="pointer-events-none absolute z-[200]" style={{ left: `${at.x}%`, top: `${at.y}%` }}>
      <div className="relative -translate-x-1/2 -translate-y-1/2" style={{ width: size, height: size }}>
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: size * outer,
            height: size * outer,
            background: `radial-gradient(circle, transparent ${(inner / outer) * 70.7}%, color-mix(in srgb, ${color} 38%, transparent) ${(inner / outer) * 70.7}%)`,
          }}
        />
        <div className="absolute inset-0 rounded-full border-[3px] border-dashed border-white/80" />
        <div
          ref={ring}
          className="absolute inset-0 rounded-full border-[5px]"
          style={{ borderColor: color, transform: `scale(${RING_START})`, boxShadow: "0 0 0 2px #1d1a16, inset 0 0 0 2px #1d1a16" }}
        />
      </div>
    </div>
  );
}

function Stage({
  stageRef,
  swish,
  children,
}: {
  stageRef: React.RefObject<HTMLDivElement | null>;
  swish: boolean;
  children: ReactNode;
}) {
  return (
    <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden">
      <div className="pointer-events-none absolute left-1/2 top-[1.5%] z-[1] w-[44%] max-w-[170px] -translate-x-1/2">
        <Hoop className="!w-full" swish={swish} />
      </div>
      {children}
    </div>
  );
}

function useMyKit(game: GameState, charId: AvatarPresetId) {
  return useMemo(() => {
    const k = jerseyOf(game.outfit) ?? KIT[charId];
    return { jersey: k.jersey, trim: k.trim };
  }, [game.outfit, charId]);
}

const NUMS = [0, 3, 4, 5, 7, 8, 9, 11, 12, 13, 14, 15, 21, 22, 24, 30, 31, 33, 44, 55];

/** Attacco: tiro (tieni premuto e lascia sul verde) oppure passaggio al compagno libero. */
export function AttackAction({
  seed,
  game,
  diff,
  size,
  opponent,
  shot,
  open,
  locked,
  onResult,
}: {
  seed: number;
  game: GameState;
  diff: Difficulty;
  size: 3 | 5;
  opponent: string;
  shot: Shot;
  open: boolean;
  locked: boolean;
  onResult: (r: MomentResult) => void;
}) {
  const { me, charId } = useGame();
  const { ref: stageRef, ...stage } = useStage();
  const { el: ballEl, ...ball } = useSceneBall(stage);
  const f = useMemo(() => formation(size, shot, open, seed + game.day), [size, shot, open, seed, game.day]);
  const myKit = useMyKit(game, charId);
  const oppKit = useMemo(() => teamKit(opponent, myKit.jersey), [opponent, myKit.jersey]);
  const zone = shotZone(game, diff, shot, open);
  const [phase, setPhase] = useState<"intro" | "ready" | "pass" | "flying" | "done">("intro");
  const [mePos, setMePos] = useState<P>(f.start);
  const [markerPos, setMarkerPos] = useState<P>(f.markerStart);
  const [mePose, setMePose] = useState<Pose>("dribble");
  const [meJump, setMeJump] = useState(false);
  const [markerJump, setMarkerJump] = useState(false);
  const [mate, setMate] = useState<{ jump: boolean; pose: Pose } | null>(null);
  const [swish, setSwish] = useState(false);
  const [flash, setFlash] = useState<"verde" | "buono" | "fuori" | null>(null);
  const backName = me.nickname ?? me.firstName;
  const sideBall = useCallback(
    (at: P): P => {
      const hp = CHAR * depth(at.y);
      const wPx = hp * stage.h * CHAR_RATIO;
      return { x: at.x - ((wPx * 0.38) / Math.max(1, stage.w)) * 100, y: at.y - hp * 100 * 0.26 };
    },
    [stage.h, stage.w],
  );

  // L'azione parte: palleggi e ti sposti, il difensore ti segue (o resta indietro).
  useEffect(() => {
    if (!stage.h) return;
    ball.place(sideBall(f.start), 0.9 * depth(f.start.y));
    const t1 = window.setTimeout(() => {
      setMePos(f.me);
      setMarkerPos(f.marker);
      void ball.fly(sideBall(f.me), { arc: 0.01, ms: 900, s: depth(f.me.y) });
    }, 120);
    const t2 = window.setTimeout(() => setPhase("ready"), 1050);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // Solo all'inizio dell'azione, quando la scena ha le misure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.h > 0]);

  const ballSize = (y: number) => depth(y);

  const shoot = (pos: number) => {
    const j = judgeShot(pos, zone, game.skills.tiro, Math.random);
    setFlash(j.outcome);
    setPhase("flying");
    setMePose("up");
    setMeJump(true);
    if (!open) setMarkerJump(true);
    ball.place(handsAt(f.me, "up"), ballSize(f.me.y));
    play("whoosh");
    const side = Math.random() < 0.5 ? -1 : 1;
    const flight = j.made
      ? ball.fly(RIM, { arc: 0.22, ms: 820, s: 0.62, then: [NET, { x: 50 + side * 3, y: 34 }] })
      : j.outcome === "fuori"
        ? ball.fly({ x: 50 + side * 9, y: RIM.y + 2 }, { arc: 0.2, ms: 760, s: 0.62, then: [{ x: 50 + side * 22, y: 44 }] })
        : ball.fly({ x: 50 + side * 4, y: RIM.y - 1 }, { arc: 0.24, ms: 800, s: 0.62, then: [{ x: 50 + side * 6, y: RIM.y - 9 }, { x: 50 + side * 16, y: 36 }] });
    window.setTimeout(() => {
      setMeJump(false);
      setMarkerJump(false);
    }, 420);
    void flight.then(() => {
      if (j.made) {
        setSwish(true);
        play("swish");
      } else play(j.outcome === "fuori" ? "board" : "rim");
      setMePose(j.made ? "up" : "dribble");
      setPhase("done");
      onResult(shotResult(shot, j));
    });
  };

  const meter = useHoldMeter({
    sweep: DIFF[diff].sweep,
    disabled: phase !== "ready" || locked,
    onRelease: shoot,
  });

  const passWin = ringWindow(game, diff, "passaggio");
  const mateAt = f.mates[f.open];
  const { ring, tap } = useRing({
    ms: DIFF[diff].ringMs,
    active: phase === "pass",
    delay: 200,
    onDone: (p) => {
      if (phase !== "pass") return;
      const hit = judgeRing(p, passWin);
      setPhase("flying");
      play("whoosh");
      ball.place(handsAt(f.me, "chest"), ballSize(f.me.y));
      const r = passResult(game, shot, open, hit, Math.random);
      if (r.kind !== "passaggio") return;
      if (!r.ok) {
        // Intercettato: il pallone finisce al difensore più vicino al compagno.
        const thief = f.others.reduce((a, b) => (Math.hypot(b.x - mateAt.x, b.y - mateAt.y) < Math.hypot(a.x - mateAt.x, a.y - mateAt.y) ? b : a));
        void ball.fly(handsAt(thief, "chest"), { arc: 0.04, ms: 520, s: ballSize(thief.y) }).then(() => {
          play("error");
          setPhase("done");
          onResult(r);
        });
        return;
      }
      void ball.fly(handsAt(mateAt, "chest"), { arc: 0.05, ms: 480, s: ballSize(mateAt.y) }).then(() => {
        setMate({ jump: true, pose: "up" });
        ball.place(handsAt(mateAt, "up"), ballSize(mateAt.y));
        window.setTimeout(() => setMate({ jump: false, pose: r.made ? "up" : "dribble" }), 420);
        const side = mateAt.x < 50 ? 1 : -1;
        const fl = r.made
          ? ball.fly(RIM, { arc: 0.2, ms: 760, s: 0.62, then: [NET, { x: 50 + side * 3, y: 34 }] })
          : ball.fly({ x: 50 + side * 4, y: RIM.y - 1 }, { arc: 0.22, ms: 760, s: 0.62, then: [{ x: 50 - side * 14, y: 38 }] });
        void fl.then(() => {
          if (r.made) {
            setSwish(true);
            play("swish");
          } else play("rim");
          setPhase("done");
          onResult(r);
        });
      });
    },
  });

  const actors: ActorSpec[] = [
    ...f.others.map((o, k) => ({ key: `o${k}`, id: extraId(`${opponent}-${k}`, charId), at: o, kit: oppKit, number: NUMS[(hash(opponent) + k * 5) % NUMS.length], pose: "defend" as Pose })),
    {
      key: "marker",
      id: extraId(`${opponent}-m`, charId),
      at: markerPos,
      kit: oppKit,
      number: NUMS[(hash(opponent) + 9) % NUMS.length],
      pose: (markerJump ? "up" : "defend") as Pose,
      jump: markerJump,
      move: open ? 1100 : 850,
    },
    ...f.mates.map((m, k) => ({
      key: `m${k}`,
      id: extraId(`${game.contract.team}-${k}`, charId),
      at: m,
      back: true,
      kit: myKit,
      number: NUMS[(hash(game.contract.team) + k * 3) % NUMS.length],
      pose: (k === f.open && mate ? mate.pose : "dribble") as Pose,
      jump: k === f.open && !!mate?.jump,
      dim: phase === "pass" && k !== f.open,
    })),
    {
      key: "me",
      id: charId,
      at: mePos,
      back: true,
      backName,
      number: me.jerseyNumber,
      outfit: game.outfit,
      pose: mePose,
      jump: meJump,
      crouch: meter.holding,
    },
  ];

  return (
    <div className="absolute inset-0 flex flex-col">
      <Stage stageRef={stageRef} swish={swish}>
        {stage.h > 0 && actors.map((a) => <Actor key={a.key} a={a} h={stage.h} />)}
        <div ref={ballEl} className="pointer-events-none absolute left-0 top-0 z-[150] will-change-transform" style={{ transform: "translate(-200px,-200px)" }}>
          <Ball size={Math.max(16, Math.round(stage.h * CHAR * 0.13))} />
        </div>
        {phase === "pass" && <RingAt at={handsAt(mateAt, "chest")} win={passWin} ring={ring} size={Math.round(stage.h * 0.11)} />}
        {phase !== "pass" && (
          <div className="absolute right-2 top-[22%] z-[160]">
            <MeterBar fill={meter.fill} zone={zone} center={ZONE_CENTER} height={Math.min(180, Math.round(stage.h * 0.42))} flash={flash} />
          </div>
        )}
        <p className="absolute left-2 top-2 z-[160] rounded-full bg-[#1d1a16]/60 px-2.5 py-1 text-[12px] font-bold text-white">
          {phase === "pass" ? "Tocca quando il cerchio si chiude sul compagno" : `${SHOTS[shot].label} · ${SHOTS[shot].pts} punti`}
        </p>
      </Stage>
      <div className="flex gap-2 p-3">
        {phase === "pass" ? (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              tap();
            }}
            className="press sticker display h-20 w-full touch-none rounded-full bg-volt text-[28px] text-volt-ink"
          >
            Passa ora
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                play("tap");
                setPhase("pass");
              }}
              disabled={phase !== "ready" || locked || meter.holding}
              className="press sticker display h-20 w-[34%] rounded-full bg-surface text-[21px] disabled:opacity-40"
            >
              Passa
            </button>
            <HoldButton handlers={meter.handlers} holding={meter.holding} disabled={phase !== "ready" || locked} className="flex-1">
              {meter.holding ? "Lascia!" : "Tira"}
            </HoldButton>
          </>
        )}
      </div>
    </div>
  );
}

/** Difesa: l'avversario attacca il tuo canestro; tu lo vedi in faccia e provi a rubare o stoppare. */
export function DefenseAction({
  seed,
  game,
  diff,
  size,
  opponent,
  action,
  locked,
  onResult,
}: {
  seed: number;
  game: GameState;
  diff: Difficulty;
  size: 3 | 5;
  opponent: string;
  action: "rubata" | "stoppata";
  locked: boolean;
  onResult: (r: MomentResult) => void;
}) {
  const { me, charId } = useGame();
  const { ref: stageRef, ...stage } = useStage();
  const { el: ballEl, ...ball } = useSceneBall(stage);
  const myKit = useMyKit(game, charId);
  const oppKit = useMemo(() => teamKit(opponent, myKit.jersey), [opponent, myKit.jersey]);
  const side = (seed + game.day) % 2 ? 1 : -1;
  const handlerStart: P = { x: 50 + side * 12, y: 99 };
  const handlerAt: P = { x: 50 + side * 3, y: 91 };
  const meAt: P = { x: 50 + side * 2, y: 74 };
  const meStart: P = { x: 50 - side * 8, y: 68 };
  const [hPos, setHPos] = useState(handlerStart);
  const [mPos, setMPos] = useState(meStart);
  const [hPose, setHPose] = useState<Pose>("dribble");
  const [hJump, setHJump] = useState(false);
  const [mPose, setMPose] = useState<Pose>("defend");
  const [mJump, setMJump] = useState(false);
  const [phase, setPhase] = useState<"intro" | "ring" | "flying" | "done">("intro");
  const [swish, setSwish] = useState(false);
  const skill = action === "rubata" ? "difesa" : "fisico";
  const win = ringWindow(game, diff, skill);
  const others = useMemo(
    () =>
      (size === 3
        ? [
            { x: 18, y: 72 },
            { x: 82, y: 70 },
          ]
        : [
            { x: 13, y: 70 },
            { x: 87, y: 68 },
            { x: 31, y: 56 },
            { x: 69, y: 55 },
          ]
      ).map((o) => ({ x: o.x, y: o.y })),
    [size],
  );
  const mates = useMemo(() => others.map((o) => ({ x: o.x + (o.x < 50 ? 7 : -7), y: o.y - 7 })), [others]);
  const sideBall = useCallback(
    (at: P): P => {
      const hp = CHAR * depth(at.y);
      const wPx = hp * stage.h * CHAR_RATIO;
      return { x: at.x - ((wPx * 0.38) / Math.max(1, stage.w)) * 100, y: at.y - hp * 100 * 0.26 };
    },
    [stage.h, stage.w],
  );

  useEffect(() => {
    if (!stage.h) return;
    ball.place(sideBall(handlerStart), depth(handlerStart.y) * 0.9);
    const t1 = window.setTimeout(() => {
      setHPos(handlerAt);
      setMPos(meAt);
      void ball.fly(sideBall(handlerAt), { arc: 0.01, ms: 900, s: depth(handlerAt.y) });
    }, 120);
    const t2 = window.setTimeout(() => {
      if (action === "stoppata") {
        // Si alza per tirare: il pallone sopra la testa, il cerchio parte lì.
        setHPose("up");
        setHJump(true);
        ball.place(handsAt(handlerAt, "up"), depth(handlerAt.y));
      }
      setPhase("ring");
    }, 1000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.h > 0]);

  const target = action === "stoppata" ? handsAt(handlerAt, "up") : sideBall(handlerAt);
  const { ring, tap } = useRing({
    ms: DIFF[diff].ringMs * (action === "stoppata" ? 0.9 : 1),
    active: phase === "ring",
    delay: 150,
    onDone: (p) => {
      if (phase !== "ring") return;
      const hit = judgeRing(p, win);
      const r = defenseResult(action, hit, Math.random);
      if (r.kind !== "difesa") return;
      setPhase("flying");
      if (action === "rubata") {
        if (r.ok) {
          setMPose("up");
          play("bounce");
          void ball.fly(handsAt(meAt, "chest"), { arc: 0.03, ms: 380, s: depth(meAt.y) }).then(() => {
            setPhase("done");
            onResult(r);
          });
        } else {
          // Ti salta e va a canestro.
          setHPos({ x: 50 - side * 8, y: 40 });
          void ball.fly(sideBall({ x: 50 - side * 8, y: 40 }), { arc: 0.02, ms: 700, s: depth(40) }).then(() => {
            setHPose("up");
            setHJump(true);
            play("whoosh");
            return ball.fly(RIM, { arc: 0.08, ms: 520, s: 0.62, then: [NET, { x: 50, y: 34 }] });
          }).then(() => {
            setHJump(false);
            setSwish(true);
            play("swish");
            setPhase("done");
            onResult(r);
          });
        }
      } else {
        setMPose("up");
        setMJump(true);
        window.setTimeout(() => {
          setMJump(false);
          setHJump(false);
        }, 450);
        if (r.ok) {
          play("board");
          void ball.fly({ x: 50 + side * 6, y: 48 }, { arc: 0.06, ms: 260, s: 0.8 }).then(() =>
            ball.fly({ x: side > 0 ? 96 : 4, y: 74 }, { arc: 0.12, ms: 520, s: 0.95 }),
          ).then(() => {
            setPhase("done");
            onResult(r);
          });
        } else {
          play("whoosh");
          void ball.fly(RIM, { arc: 0.24, ms: 820, s: 0.62, then: [NET, { x: 50, y: 34 }] }).then(() => {
            setSwish(true);
            play("swish");
            setPhase("done");
            onResult(r);
          });
        }
      }
    },
  });

  const actors: ActorSpec[] = [
    ...others.map((o, k) => ({ key: `o${k}`, id: extraId(`${opponent}-${k}`, charId), at: o, back: true, kit: oppKit, number: NUMS[(hash(opponent) + k * 5) % NUMS.length] })),
    ...mates.map((m, k) => ({ key: `t${k}`, id: extraId(`${game.contract.team}-${k}`, charId), at: m, kit: myKit, pose: "defend" as Pose, number: NUMS[(hash(game.contract.team) + k * 3) % NUMS.length] })),
    {
      key: "handler",
      id: extraId(`${opponent}-h`, charId),
      at: hPos,
      back: true,
      kit: oppKit,
      number: NUMS[(hash(opponent) + 2) % NUMS.length],
      pose: hPose,
      jump: hJump,
      move: phase === "flying" ? 700 : 900,
    },
    { key: "me", id: charId, at: mPos, number: me.jerseyNumber, outfit: game.outfit, pose: mPose, jump: mJump },
  ];

  return (
    <div className="absolute inset-0 flex flex-col">
      <Stage stageRef={stageRef} swish={swish}>
        {stage.h > 0 && actors.map((a) => <Actor key={a.key} a={a} h={stage.h} />)}
        <div ref={ballEl} className="pointer-events-none absolute left-0 top-0 z-[150] will-change-transform" style={{ transform: "translate(-200px,-200px)" }}>
          <Ball size={Math.max(16, Math.round(stage.h * CHAR * 0.13))} />
        </div>
        {phase === "ring" && <RingAt at={target} win={win} ring={ring} size={Math.round(stage.h * 0.1)} tone="danger" />}
        <p className="absolute left-2 top-2 z-[160] rounded-full bg-[#1d1a16]/60 px-2.5 py-1 text-[12px] font-bold text-white">
          {action === "rubata" ? "Tocca quando il cerchio si chiude sul pallone" : "Salta quando il cerchio si chiude: stoppata!"}
        </p>
      </Stage>
      <div className="p-3">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            tap();
          }}
          disabled={phase !== "ring" || locked}
          className={clsx(
            "press sticker display h-20 w-full touch-none rounded-full bg-danger text-[28px] text-white disabled:opacity-40",
          )}
        >
          {action === "rubata" ? "Ruba!" : "Stoppa!"}
        </button>
      </div>
    </div>
  );
}

/**
 * Il tuo personaggio da solo che tira (tiro di prova, triple, tiri liberi): tieni
 * premuto, salta, il pallone parte dalle sue mani. Chi lo usa decide se è dentro.
 */
export function SoloShot({
  spot,
  sweep,
  zone,
  judge,
  onShot,
  disabled,
  fast = false,
  label,
  overlay,
}: {
  spot: P;
  sweep: number;
  zone: number;
  judge: (pos: number) => { made: boolean; outcome: "verde" | "buono" | "fuori" };
  onShot: (r: { made: boolean; outcome: "verde" | "buono" | "fuori"; pos: number }) => void;
  disabled?: boolean;
  /** Più svelto (gara delle triple). */
  fast?: boolean;
  label?: ReactNode;
  overlay?: ReactNode;
}) {
  const { me, charId, game } = useGame();
  const { ref: stageRef, ...stage } = useStage();
  const { el: ballEl, ...ball } = useSceneBall(stage);
  const [busy, setBusy] = useState(false);
  const [pose, setPose] = useState<Pose>("dribble");
  const [jump, setJump] = useState(false);
  const [swish, setSwish] = useState(false);
  const [flash, setFlash] = useState<"verde" | "buono" | "fuori" | null>(null);
  const backName = me.nickname ?? me.firstName;
  const sideBall = useCallback(
    (at: P): P => {
      const hp = CHAR * depth(at.y);
      const wPx = hp * stage.h * CHAR_RATIO;
      return { x: at.x - ((wPx * 0.38) / Math.max(1, stage.w)) * 100, y: at.y - hp * 100 * 0.26 };
    },
    [stage.h, stage.w],
  );
  // Il pallone torna in mano quando cambia la posizione o la scena prende le misure.
  useEffect(() => {
    if (!stage.h || busy) return;
    ball.place(sideBall(spot), depth(spot.y));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.h, stage.w, spot.x, spot.y]);

  const meter = useHoldMeter({
    sweep,
    disabled: disabled || busy,
    onRelease: (pos) => {
      const j = judge(pos);
      setBusy(true);
      setFlash(j.outcome);
      setPose("up");
      setJump(true);
      ball.place(handsAt(spot, "up"), depth(spot.y));
      play("whoosh");
      window.setTimeout(() => setJump(false), fast ? 300 : 420);
      const side = sideCoin();
      const ms = fast ? 560 : 780;
      const fl = j.made
        ? ball.fly(RIM, { arc: 0.2, ms, s: 0.62, then: [NET, { x: 50 + side * 3, y: 34 }] })
        : j.outcome === "fuori"
          ? ball.fly({ x: 50 + side * 9, y: RIM.y + 2 }, { arc: 0.18, ms, s: 0.62, then: [{ x: 50 + side * 22, y: 46 }] })
          : ball.fly({ x: 50 + side * 4, y: RIM.y - 1 }, { arc: 0.22, ms, s: 0.62, then: [{ x: 50 + side * 6, y: RIM.y - 9 }, { x: 50 + side * 16, y: 38 }] });
      void fl.then(() => {
        if (j.made) {
          setSwish(true);
          play("swish");
        } else play(j.outcome === "fuori" ? "board" : "rim");
        onShot({ ...j, pos });
        window.setTimeout(
          () => {
            setSwish(false);
            setPose("dribble");
            setFlash(null);
            meter.reset();
            ball.place(sideBall(spot), depth(spot.y));
            setBusy(false);
          },
          fast ? 120 : 380,
        );
      });
    },
  });

  return (
    <div className="absolute inset-0 flex flex-col">
      <Stage stageRef={stageRef} swish={swish}>
        {stage.h > 0 && (
          <Actor
            a={{ key: "me", id: charId, at: spot, back: true, backName, number: me.jerseyNumber, outfit: game.outfit, pose, jump, crouch: meter.holding, move: 700 }}
            h={stage.h}
          />
        )}
        <div ref={ballEl} className="pointer-events-none absolute left-0 top-0 z-[150] will-change-transform" style={{ transform: "translate(-200px,-200px)" }}>
          <Ball size={Math.max(16, Math.round(stage.h * CHAR * 0.13))} />
        </div>
        <div className="absolute right-2 top-[22%] z-[160]">
          <MeterBar fill={meter.fill} zone={zone} center={ZONE_CENTER} height={Math.min(190, Math.round(stage.h * 0.44))} flash={flash} />
        </div>
        {label && (
          <p className="absolute left-2 top-2 z-[160] rounded-full bg-[#1d1a16]/60 px-2.5 py-1 text-[12px] font-bold text-white">{label}</p>
        )}
        {overlay}
      </Stage>
      <div className="p-3">
        <HoldButton handlers={meter.handlers} holding={meter.holding} disabled={disabled || busy} className="w-full">
          {meter.holding ? "Lascia!" : "Tira"}
        </HoldButton>
      </div>
    </div>
  );
}

/** La schiacciata: rincorsa dal fondo, stacco, e su fino al ferro. */
export function DunkScene({
  phase,
  made = true,
  controls,
  children,
}: {
  phase: number;
  /** Chiusura sbagliata: il pallone non entra. */
  made?: boolean;
  controls?: ReactNode;
  children?: ReactNode;
}) {
  const { me, charId, game } = useGame();
  const { ref: stageRef, ...stage } = useStage();
  // 0 fermo, 1 rincorsa, 2 stacco, 3 schiacciata
  const at: P = phase >= 3 ? { x: 50, y: 50 } : phase === 2 ? { x: 50, y: 74 } : phase === 1 ? { x: 44, y: 86 } : { x: 34, y: 96 };
  return (
    <div className="absolute inset-0 flex flex-col">
      <Stage stageRef={stageRef} swish={phase >= 3 && made}>
        {stage.h > 0 && (
          <Actor
            a={{
              key: "me",
              id: charId,
              at,
              back: true,
              backName: me.nickname ?? me.firstName,
              number: me.jerseyNumber,
              outfit: game.outfit,
              pose: phase >= 2 ? "up" : "dribble",
              jump: phase >= 2,
              move: phase >= 3 ? 420 : 600,
            }}
            h={stage.h}
          />
        )}
        {children}
      </Stage>
      {controls && <div className="p-3">{controls}</div>}
    </div>
  );
}
