"use client";

import clsx from "clsx";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Pose } from "@/components/character";
import { AVATAR_PRESETS, KIT, type AvatarPresetId } from "@/components/avatar-presets";
import { jerseyOf } from "@/components/outfit-layer";
import { play } from "@/lib/sound";
import { hash } from "@/lib/game/economy";
import { COURT, actionCam, arcPoints, beside, dunkCam, floor, guardSpot, lineCam, projector, v3, wideCam, type Camera, type Projector, type V3 } from "@/lib/game/camera";
import {
  DIFF,
  SHOTS,
  ZONE_CENTER,
  defenseResult,
  foulResult,
  judgeRing,
  layupResult,
  judgeShot,
  passResult,
  ringWindow,
  shotResult,
  shotZone,
  type MomentResult,
  type Shot,
} from "@/lib/game/match";
import { shirtNumber, type FeedLine, type Rosters, type Side } from "@/lib/game/live";
import type { Difficulty, GameState } from "@/lib/game/types";
import { Actor3D, BallNodes, Stage, hands, useBall3D, useStage, type Actor } from "./arena";
import { HoldButton, MeterBar, ringScale, RING_START, useHoldMeter, useRing } from "./meters";
import { useGame } from "./store";

/**
 * Le azioni della partita nel palazzetto in 3D. La telecamera sta alle spalle di chi
 * attacca e guarda il canestro: in attacco vedi il tuo personaggio di schiena (nome e
 * numero), in difesa lo vedi in faccia. I giocatori stanno ai loro posti veri sul
 * campo, a metri di distanza: è la telecamera che si avvicina all'azione.
 */

export type XZ = { x: number; z: number };

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

export function useMyKit(game: GameState, charId: AvatarPresetId) {
  return useMemo(() => {
    const k = jerseyOf(game.outfit) ?? KIT[charId];
    return { jersey: k.jersey, trim: k.trim };
  }, [game.outfit, charId]);
}

/** Da che parte rimbalza il pallone: a caso. */
const sideCoin = () => (Math.random() < 0.5 ? -1 : 1);

// ———————————— Posizioni in campo (metri) ————————————

export const OFF3: XZ[] = [
  { x: 0, z: 8.4 },
  { x: -5.4, z: 5.0 },
  { x: 5.4, z: 5.2 },
];
export const OFF5: XZ[] = [
  { x: 0, z: 8.6 },
  { x: -5.6, z: 6.0 },
  { x: 5.6, z: 6.0 },
  { x: -2.6, z: 2.4 },
  { x: 2.4, z: 1.6 },
];

/** Da dove si tira: tante posizioni diverse, sempre vere sul campo. */
const SPOTS: Record<Shot, XZ[]> = {
  sotto: [
    { x: -1.2, z: 2.4 },
    { x: 1.3, z: 2.2 },
    { x: 0, z: 2.9 },
    { x: -2.0, z: 1.0 },
    { x: 2.0, z: 1.2 },
  ],
  media: [
    { x: -3.7, z: 4.7 },
    { x: 3.7, z: 4.7 },
    { x: 0, z: 6.0 },
    { x: -4.6, z: 1.6 },
    { x: 4.6, z: 1.8 },
    { x: -2.2, z: 5.6 },
    { x: 2.2, z: 5.6 },
  ],
  tripla: [
    { x: 0, z: 8.6 },
    { x: -5.5, z: 6.5 },
    { x: 5.5, z: 6.5 },
    { x: -6.4, z: 1.4 },
    { x: 6.4, z: 1.4 },
    { x: -3.6, z: 7.7 },
    { x: 3.6, z: 7.7 },
  ],
  // Il terzo tempo parte da qui e va a canestro.
  terzo: [
    { x: -4.4, z: 6.4 },
    { x: 4.4, z: 6.4 },
    { x: 0.6, z: 8.2 },
    { x: -5.6, z: 3.6 },
    { x: 5.6, z: 3.8 },
  ],
};

/** I cinque carrelli della gara delle triple, da un angolo all'altro. */
export const RACK_SPOTS: XZ[] = [
  { x: -6.4, z: 1.4 },
  { x: -5.2, z: 6.0 },
  { x: 0, z: 8.5 },
  { x: 5.2, z: 6.0 },
  { x: 6.4, z: 1.4 },
];
/** La lunetta del tiro libero. */
export const FT_SPOT: XZ = { x: 0, z: 5.8 };
/** Il tiro di prova del tutorial, dalla media. */
export const PRACTICE_SPOT: XZ = { x: -3.4, z: 4.8 };

const dist = (a: XZ, b: XZ) => Math.hypot(a.x - b.x, a.z - b.z);

/** Il punto del ferro dove arriva il pallone (un filo sopra il centro). */
const RIM_IN = v3(COURT.rim.x, COURT.rim.y + 0.08, COURT.rim.z);

/** Le traiettorie del tiro: dentro, sul ferro e fuori, corto o sul tabellone. */
export function shotPath(
  from: V3,
  made: boolean,
  outcome: "verde" | "buono" | "fuori",
  side: number,
  short: boolean,
  apexOver?: number,
): V3[] {
  const r = COURT.rim;
  const apex = apexOver ?? 1.5 + Math.min(1.1, Math.hypot(from.x - r.x, from.z - r.z) * 0.12);
  if (made) {
    const up = arcPoints(from, RIM_IN, apex, 26);
    return [
      ...up,
      v3(r.x, r.y - 0.35, r.z),
      v3(r.x + side * 0.05, r.y - 0.7, r.z + 0.05),
      v3(r.x + side * 0.3, 0.17, r.z + 0.6),
      v3(r.x + side * 0.5, 0.7, r.z + 1.1),
      v3(r.x + side * 0.7, 0.17, r.z + 1.6),
    ];
  }
  if (outcome === "buono") {
    const edge = v3(r.x + side * 0.24, r.y + 0.06, r.z + 0.12);
    const up = arcPoints(from, edge, apex, 26);
    return [...up, v3(r.x + side * 0.7, r.y + 0.55, r.z + 0.7), v3(r.x + side * 1.3, r.y - 0.4, r.z + 1.5), v3(r.x + side * 1.8, 0.17, r.z + 2.3)];
  }
  if (short) return arcPoints(from, v3(r.x + side * 0.2, 0.17, r.z + 1.2), apex + 0.6, 30);
  const board = v3(r.x + side * 0.35, r.y + 0.55, COURT.board.z + 0.12);
  const up = arcPoints(from, board, apex * 0.85, 26);
  return [...up, v3(r.x + side * 0.9, r.y - 0.2, r.z + 1.2), v3(r.x + side * 1.4, 0.17, r.z + 2.2)];
}

/** Il palleggio mentre si corre: il pallone rimbalza a terra da A a B. */
function dribblePath(a: XZ, b: XZ, bounces = 3): V3[] {
  const pts: V3[] = [];
  const n = bounces * 6;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(v3(a.x + (b.x - a.x) * t - 0.42, 0.17 + Math.abs(Math.sin(t * Math.PI * bounces)) * 0.6, a.z + (b.z - a.z) * t));
  }
  return pts;
}

/** La telecamera, ricreata solo quando cambiano le misure o il punto da inquadrare. */
function useCam(w: number, h: number, focus: XZ | null) {
  const fx = focus?.x ?? null;
  const fz = focus?.z ?? null;
  return useMemo<Camera | null>(() => {
    if (!w || !h) return null;
    return fx === null || fz === null ? wideCam(w, h) : actionCam({ x: fx, z: fz }, w, h);
  }, [w, h, fx, fz]);
}

/** Il cerchio a tempo attorno a un punto della scena (un compagno, il pallone). */
function RingAt({
  at,
  win,
  ring,
  size = 64,
  tone = "volt",
}: {
  at: { x: number; y: number };
  win: number;
  ring: React.RefObject<HTMLDivElement | null>;
  size?: number;
  tone?: "volt" | "danger";
}) {
  const color = tone === "danger" ? "var(--danger)" : "var(--volt)";
  const outer = ringScale(0.75 - win);
  const inner = ringScale(0.75 + win);
  return (
    <div className="pointer-events-none absolute left-0 top-0 z-[950]" style={{ transform: `translate(${at.x}px, ${at.y}px)` }}>
      <div className="relative -translate-x-1/2 -translate-y-1/2" style={{ width: size, height: size }}>
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: size * outer,
            height: size * outer,
            background: `radial-gradient(circle, transparent ${(inner / outer) * 70.7}%, color-mix(in srgb, ${color} 40%, transparent) ${(inner / outer) * 70.7}%)`,
          }}
        />
        <div className="absolute inset-0 rounded-full border-[3px] border-dashed border-white/85" />
        <div
          ref={ring}
          className="absolute inset-0 rounded-full border-[5px]"
          style={{ borderColor: color, transform: `scale(${RING_START})`, boxShadow: "0 0 0 2px #1d1a16, inset 0 0 0 2px #1d1a16" }}
        />
      </div>
    </div>
  );
}

/** Il compagno libero per il passaggio: uno di quelli che si vedono bene. */
function pickMate(P: Projector | null, me: XZ, mates: XZ[], seed: number): { mates: XZ[]; openMate: number } {
  const pick = (seed * 7 + 3) % mates.length;
  if (!P) return { mates, openMate: pick };
  const d0 = P.p(floor(me.x, me.z)).depth;
  const ok = mates
    .map((m, i) => ({ i, q: P.p(hands(m, "chest")) }))
    .filter(({ q }) => q.depth > d0 - 0.6 && q.x > 40 && q.x < P.cam.w - 40 && q.y > 50);
  if (ok.length) return { mates, openMate: ok[seed % ok.length].i };
  // Nessuno in quadro: il primo compagno taglia verso canestro, dal lato libero.
  const cut = beside(guardSpot(me, Math.min(3.2, Math.hypot(me.x - COURT.rim.x, me.z - COURT.rim.z) * 0.55)), -1.6);
  return { mates: [cut, ...mates.slice(1)], openMate: 0 };
}

/**
 * Chi sta tra la telecamera e l'azione non si disegna: sarebbe un gigante davanti a
 * tutto. Restano in scena solo i giocatori alla stessa distanza dell'azione o più in là.
 */
function onStage(P: Projector | null, focus: XZ, keep: string[]) {
  if (!P) return () => true;
  const d0 = P.p(floor(focus.x, focus.z)).depth;
  return (a: Actor) => keep.includes(a.key) || P.p(floor(a.at.x, a.at.z)).depth > d0 - 0.9;
}

function Label({ children }: { children: ReactNode }) {
  return <p className="absolute left-2 top-2 z-[960] max-w-[75%] rounded-full bg-[#1d1a16]/75 px-2.5 py-1 text-[12px] font-bold text-white">{children}</p>;
}

// ———————————— Attacco ————————————

export function AttackAction({
  seed,
  game,
  diff,
  size,
  opponent,
  shot,
  open,
  locked,
  onFire,
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
  /** Tre canestri di fila: il verde si allarga. */
  onFire?: boolean;
  onResult: (r: MomentResult) => void;
}) {
  const { me, charId } = useGame();
  const { ref: stageRef, ...stage } = useStage();
  const spots = SPOTS[shot];
  const meAt = spots[(seed + game.day) % spots.length];
  const cam = useCam(stage.w, stage.h, meAt);
  const P = useMemo(() => (cam ? projector(cam) : null), [cam]);
  const { el: ballRef, shadow: shadowRef, place, fly } = useBall3D(P);
  const myKit = useMyKit(game, charId);
  const oppKit = useMemo(() => teamKit(opponent, myKit.jersey), [opponent, myKit.jersey]);
  const set = size === 3 ? OFF3 : OFF5;
  const nearest = set.reduce((bi, p, i) => (dist(p, meAt) < dist(set[bi], meAt) ? i : bi), 0);
  const others = set.filter((_, i) => i !== nearest);
  const side = meAt.x <= 0 ? 1 : -1;
  const start: XZ = { x: meAt.x + side * 2.4, z: Math.min(12.5, meAt.z + 2.2) };
  // Marcato: il difensore ti sta davanti, un po' di lato (così lo vedi). Libero: è rimasto indietro.
  const markerEnd: XZ = open ? { x: meAt.x + side * 2.8, z: meAt.z + 0.7 } : beside(guardSpot(meAt, 0.95), 1.35);
  // Il compagno a cui passare deve essere in quadro: se nessuno lo è, uno taglia verso canestro.
  const { mates, openMate } = pickMate(P, meAt, others, seed);
  const mateAt = mates[openMate];
  const zone = Math.min(0.5, shotZone(game, diff, shot, open) * (onFire ? 1.25 : 1));
  const [phase, setPhase] = useState<"intro" | "ready" | "pass" | "flying" | "done">("intro");
  const [mePos, setMePos] = useState<XZ>(start);
  const [markerPos, setMarkerPos] = useState<XZ>(() => guardSpot(start, 1.1));
  const [mePose, setMePose] = useState<Pose>("dribble");
  const [meJump, setMeJump] = useState(false);
  const [markerJump, setMarkerJump] = useState(false);
  const [mate, setMate] = useState<{ jump: boolean; pose: Pose } | null>(null);
  const [swish, setSwish] = useState(false);
  const [flash, setFlash] = useState<"verde" | "buono" | "fuori" | null>(null);
  const backName = me.nickname ?? me.firstName;

  // L'azione parte: palleggi verso la tua posizione, il difensore ti segue (o resta indietro).
  useEffect(() => {
    if (!P) return;
    place(hands(start, "side"));
    play("dribble");
    const t1 = window.setTimeout(() => {
      setMePos(meAt);
      setMarkerPos(markerEnd);
      void fly(dribblePath(start, meAt, 3), 900);
      if (Math.random() < 0.6) window.setTimeout(() => play("squeak"), 380);
    }, 120);
    const t2 = window.setTimeout(() => setPhase("ready"), 1080);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // Solo all'inizio, appena la telecamera è pronta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [P !== null]);

  const shoot = (pos: number) => {
    const j = judgeShot(pos, zone, game.skills.tiro, Math.random);
    setFlash(j.outcome);
    setPhase("flying");
    setMePose("up");
    setMeJump(true);
    if (!open) setMarkerJump(true);
    const from = hands(meAt, "up");
    place(from);
    play("whoosh");
    window.setTimeout(() => {
      setMeJump(false);
      setMarkerJump(false);
    }, 430);
    window.setTimeout(() => {
      if (j.made) play("swish");
      else play(j.outcome === "fuori" ? "board" : "rim");
    }, 700);
    void fly(shotPath(from, j.made, j.outcome, sideCoin(), pos < ZONE_CENTER), 1250).then(() => {
      if (j.made) setSwish(true);
      setMePose(j.made ? "up" : "dribble");
      setPhase("done");
      onResult(shotResult(shot, j));
    });
  };

  const meter = useHoldMeter({ sweep: DIFF[diff].sweep, disabled: phase !== "ready" || locked, onRelease: shoot });

  const passWin = ringWindow(game, diff, "passaggio");
  const { ring, tap } = useRing({
    ms: DIFF[diff].ringMs,
    active: phase === "pass",
    delay: 200,
    onDone: (p) => {
      if (phase !== "pass") return;
      const hit = judgeRing(p, passWin);
      setPhase("flying");
      play("whoosh");
      const from = hands(meAt, "chest");
      place(from);
      const r = passResult(game, shot, open, hit, Math.random);
      if (r.kind !== "passaggio") return;
      if (!r.ok) {
        const thief = guardSpot(mateAt, 1.25);
        void fly(arcPoints(from, hands(thief, "chest"), 0.35, 14), 520).then(() => {
          setPhase("done");
          onResult(r);
        });
        return;
      }
      void fly(arcPoints(from, hands(mateAt, "chest"), 0.4, 14), 500).then(() => {
        setMate({ jump: true, pose: "up" });
        const up = hands(mateAt, "up");
        place(up);
        window.setTimeout(() => setMate({ jump: false, pose: r.made ? "up" : "dribble" }), 430);
        window.setTimeout(() => play(r.made ? "swish" : "rim"), 650);
        void fly(shotPath(up, r.made, r.made ? "verde" : "buono", sideCoin(), false), 1150).then(() => {
          if (r.made) setSwish(true);
          setPhase("done");
          onResult(r);
        });
      });
    },
  });

  const actors: Actor[] = [
    ...mates.map((m, k) => ({
      key: `o${k}`,
      id: extraId(`${opponent}-${k}`, charId),
      at: guardSpot(m, 1.25),
      kit: oppKit,
      number: shirtNumber(`${opponent}${k}`),
      pose: "defend" as Pose,
    })),
    {
      key: "marker",
      id: extraId(`${opponent}-m`, charId),
      at: markerPos,
      kit: oppKit,
      number: shirtNumber(`${opponent}m`),
      pose: (markerJump ? "up" : "defend") as Pose,
      jump: markerJump,
      move: open ? 1150 : 850,
    },
    ...mates.map((m, k) => ({
      key: `m${k}`,
      id: extraId(`${game.contract.team}-${k}`, charId),
      at: m,
      back: true,
      kit: myKit,
      number: shirtNumber(`${game.contract.team}${k}`),
      pose: (k === openMate && mate ? mate.pose : "dribble") as Pose,
      jump: k === openMate && !!mate?.jump,
      dim: phase === "pass" && k !== openMate,
      glow: phase === "pass" && k === openMate,
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
      glow: onFire,
      move: 900,
    },
  ];

  const ringPos = P ? P.p(hands(mateAt, "chest")) : null;

  return (
    <div className="absolute inset-0 flex flex-col">
      <Stage stageRef={stageRef} cam={cam} home={myKit.jersey} away={oppKit.jersey} seed={game.contract.team} swish={swish} hype={swish}>
        {P && actors.filter(onStage(P, meAt, ["me", "marker", `m${openMate}`])).map((a) => <Actor3D key={a.key} a={a} P={P} />)}
        <BallNodes ballRef={ballRef} shadowRef={shadowRef} />
        {phase === "pass" && ringPos && <RingAt at={ringPos} win={passWin} ring={ring} size={Math.max(52, Math.round(ringPos.s * 1.1))} />}
        {phase !== "pass" && (
          <div className="absolute right-2 top-[14%] z-[960]">
            <MeterBar fill={meter.fill} zone={zone} center={ZONE_CENTER} height={Math.min(200, Math.round(stage.h * 0.45))} flash={flash} />
          </div>
        )}
        <Label>
          {phase === "pass" ? "Tocca quando il cerchio si chiude sul compagno" : `${onFire ? "🔥 In fiamme · " : ""}${SHOTS[shot].label} · ${SHOTS[shot].pts} punti`}
        </Label>
      </Stage>
      <div className="flex gap-2 bg-[#0d1124] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
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

// ———————————— Terzo tempo ————————————

type Hit = "perfetto" | "buono" | "fuori";

/**
 * Il terzo tempo: parti in palleggio, due passi a ritmo (tocca quando il cerchio si
 * chiude sul punto dove appoggi il piede) e appoggio al ferro. Un passo fuori tempo
 * sono passi: palla persa.
 */
export function LayupAction({
  seed,
  game,
  diff,
  size,
  opponent,
  locked,
  onResult,
}: {
  seed: number;
  game: GameState;
  diff: Difficulty;
  size: 3 | 5;
  opponent: string;
  locked: boolean;
  onResult: (r: MomentResult) => void;
}) {
  const { me, charId } = useGame();
  const { ref: stageRef, ...stage } = useStage();
  const start = SPOTS.terzo[(seed + game.day) % SPOTS.terzo.length];
  const lean = start.x <= 0 ? -1 : 1;
  const finish: XZ = { x: start.x * 0.22 + lean * 0.3, z: 2.2 };
  const stepA: XZ = { x: (start.x + finish.x) / 2, z: (start.z + finish.z) / 2 };
  const steps = [stepA, finish];
  const back: XZ = { x: start.x + lean * 1.2, z: Math.min(12, start.z + 1.8) };
  const cam = useCam(stage.w, stage.h, start);
  const P = useMemo(() => (cam ? projector(cam) : null), [cam]);
  const { el: ballRef, shadow: shadowRef, place, fly } = useBall3D(P);
  const myKit = useMyKit(game, charId);
  const oppKit = useMemo(() => teamKit(opponent, myKit.jersey), [opponent, myKit.jersey]);
  const set = size === 3 ? OFF3 : OFF5;
  const others = set.filter((p) => dist(p, start) > 2.4 && dist(p, finish) > 1.8).slice(0, size - 1);
  const ms = DIFF[diff].ringMs * 0.85;
  const win = Math.min(0.3, ringWindow(game, diff, "fisico") * 1.15);
  const [phase, setPhase] = useState<"intro" | "ring" | "wait" | "flying" | "done">("intro");
  const [step, setStep] = useState(0);
  const [hits, setHits] = useState<Hit[]>([]);
  const [mePos, setMePos] = useState<XZ>(back);
  const [move, setMove] = useState(800);
  const [pose, setPose] = useState<Pose>("dribble");
  const [lift, setLift] = useState(0);
  const [swish, setSwish] = useState(false);
  const [chaser, setChaser] = useState<XZ>(() => beside(back, -1.4));

  /** Il passo k: corri al punto, il cerchio si chiude quando ci arrivi. */
  const goStep = (k: number) => {
    const from = k === 0 ? start : steps[k - 1];
    const dur = 200 + ms * 0.75;
    setStep(k);
    setMove(dur);
    setMePos(steps[k]);
    setChaser(beside(steps[k], -1.5));
    void fly(dribblePath(from, steps[k], 2), dur);
    play("squeak");
    setPhase("ring");
  };

  useEffect(() => {
    if (!P) return;
    place(hands(back, "side"));
    play("dribble");
    const t1 = window.setTimeout(() => {
      setMove(800);
      setMePos(start);
      setChaser(beside(start, -1.5));
      void fly(dribblePath(back, start, 3), 800);
    }, 120);
    const t2 = window.setTimeout(() => goStep(0), 1000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // Solo all'inizio, appena la telecamera è pronta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [P !== null]);

  const { ring, tap } = useRing({
    ms,
    active: phase === "ring",
    delay: 200,
    onDone: (p) => {
      if (phase !== "ring") return;
      const all = [...hits, judgeRing(p, win)];
      setHits(all);
      if (all.at(-1) === "fuori") {
        // Fuori tempo: passi.
        setPhase("flying");
        play("whistle");
        window.setTimeout(() => {
          setPhase("done");
          onResult(layupResult(all, game, Math.random));
        }, 700);
        return;
      }
      if (all.length < 2) {
        setPhase("wait");
        window.setTimeout(() => goStep(1), 60);
        return;
      }
      // Su, al ferro.
      setPhase("flying");
      const r = layupResult(all, game, Math.random);
      setPose("up");
      setLift(0.55);
      const from = hands(finish, "up");
      place(from);
      play("whoosh");
      window.setTimeout(() => setLift(0), 520);
      const made = r.kind === "tiro" && r.made;
      window.setTimeout(() => play(made ? "swish" : "rim"), 420);
      void fly(shotPath(from, made, "buono", sideCoin(), false, 0.45), 820).then(() => {
        if (made) setSwish(true);
        setPose("dribble");
        setPhase("done");
        onResult(r);
      });
    },
  });

  const actors: Actor[] = [
    ...others.map((o, k) => ({
      key: `m${k}`,
      id: extraId(`${game.contract.team}-${k}`, charId),
      at: o,
      back: true,
      kit: myKit,
      number: shirtNumber(`${game.contract.team}${k}`),
    })),
    ...others.map((o, k) => ({
      key: `o${k}`,
      id: extraId(`${opponent}-${k}`, charId),
      at: guardSpot(o, 1.25),
      kit: oppKit,
      pose: "defend" as Pose,
      number: shirtNumber(`${opponent}${k}`),
    })),
    {
      key: "chaser",
      id: extraId(`${opponent}-m`, charId),
      at: chaser,
      kit: oppKit,
      pose: "defend" as Pose,
      number: shirtNumber(`${opponent}m`),
      move: move + 120,
    },
    {
      key: "me",
      id: charId,
      at: mePos,
      back: true,
      backName: me.nickname ?? me.firstName,
      number: me.jerseyNumber,
      outfit: game.outfit,
      pose,
      lift,
      move: lift ? 420 : move,
    },
  ];
  const target = steps[Math.min(step, 1)];
  const ringPos = P ? P.p(v3(target.x, 0.05, target.z)) : null;
  const label =
    phase === "ring" || phase === "wait"
      ? step === 0
        ? "Primo passo: tocca quando il cerchio si chiude"
        : "Secondo passo: ancora a tempo!"
      : "Terzo tempo · 2 punti";

  return (
    <div className="absolute inset-0 flex flex-col">
      <Stage stageRef={stageRef} cam={cam} home={myKit.jersey} away={oppKit.jersey} seed={game.contract.team} swish={swish} hype={swish}>
        {P && actors.filter(onStage(P, start, ["me", "chaser"])).map((a) => <Actor3D key={a.key} a={a} P={P} />)}
        <BallNodes ballRef={ballRef} shadowRef={shadowRef} />
        {phase === "ring" && ringPos && <RingAt at={ringPos} win={win} ring={ring} size={Math.max(56, Math.round(ringPos.s * 1.2))} />}
        <Label>{label}</Label>
        <div className="absolute right-3 top-3 z-[960] flex gap-1.5" aria-label="I passi">
          {[0, 1].map((k) => (
            <span
              key={k}
              className={clsx(
                "h-3.5 w-3.5 rounded-full border-2 border-[#1d1a16]",
                hits[k] === "perfetto" ? "bg-ok" : hits[k] === "buono" ? "bg-volt" : hits[k] === "fuori" ? "bg-danger" : "bg-[#FFF8EA]/40",
              )}
            />
          ))}
        </div>
      </Stage>
      <div className="bg-[#0d1124] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            tap();
          }}
          disabled={phase !== "ring" || locked}
          className="press sticker display h-20 w-full touch-none rounded-full bg-court text-[28px] text-court-ink disabled:opacity-40"
        >
          Passo!
        </button>
      </div>
    </div>
  );
}

// ———————————— Difesa ————————————

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
  const set = size === 3 ? OFF3 : OFF5;
  const att = action === "stoppata" ? SPOTS.media[(seed + game.day) % 3] : set[(seed + game.day) % set.length];
  const cam = useCam(stage.w, stage.h, att);
  const P = useMemo(() => (cam ? projector(cam) : null), [cam]);
  const { el: ballRef, shadow: shadowRef, place, fly } = useBall3D(P);
  const myKit = useMyKit(game, charId);
  const oppKit = useMemo(() => teamKit(opponent, myKit.jersey), [opponent, myKit.jersey]);
  const side = att.x <= 0 ? 1 : -1;
  const attStart: XZ = { x: att.x + side * 2.2, z: Math.min(12.5, att.z + 2.4) };
  // Tu tra lui e il canestro, un passo di lato: si vedono tutti e due.
  const meAt = beside(guardSpot(att, 1.0), 1.35);
  const others = set.filter((p) => dist(p, att) > 1.5).slice(0, size - 1);
  const [hPos, setHPos] = useState<XZ>(attStart);
  const [mPos, setMPos] = useState<XZ>(() => guardSpot(attStart, 1.2));
  const [hPose, setHPose] = useState<Pose>("dribble");
  const [hJump, setHJump] = useState(false);
  const [mPose, setMPose] = useState<Pose>("defend");
  const [mJump, setMJump] = useState(false);
  const [phase, setPhase] = useState<"intro" | "ring" | "flying" | "done">("intro");
  const [swish, setSwish] = useState(false);
  const win = ringWindow(game, diff, action === "rubata" ? "difesa" : "fisico");

  useEffect(() => {
    if (!P) return;
    place(hands(attStart, "side"));
    play("dribble");
    const t1 = window.setTimeout(() => {
      setHPos(att);
      setMPos(meAt);
      void fly(dribblePath(attStart, att, 3), 900);
      window.setTimeout(() => play("squeak"), 300);
    }, 120);
    const t2 = window.setTimeout(() => {
      if (action === "stoppata") {
        setHPose("up");
        setHJump(true);
        place(hands(att, "up"));
      }
      setPhase("ring");
    }, 1060);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [P !== null]);

  const target = action === "stoppata" ? hands(att, "up") : hands(att, "side");
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
      const sd = sideCoin();
      if (action === "rubata") {
        if (r.ok) {
          setMPose("up");
          play("bounce");
          void fly(arcPoints(target, hands(meAt, "chest"), 0.2, 10), 360).then(() => {
            setPhase("done");
            onResult(r);
          });
          return;
        }
        // Ti salta: va dritto a canestro.
        const drive: XZ = { x: att.x * 0.25, z: 2.0 };
        setHPos(drive);
        play("squeak");
        void fly(dribblePath(att, drive, 3), 760)
          .then(() => {
            setHPose("up");
            setHJump(true);
            const up = hands(drive, "up");
            place(up);
            window.setTimeout(() => play("swish"), 380);
            return fly(shotPath(up, true, "verde", sd, false), 800);
          })
          .then(() => {
            setHJump(false);
            setSwish(true);
            setPhase("done");
            onResult(r);
          });
        return;
      }
      setMPose("up");
      setMJump(true);
      window.setTimeout(() => {
        setMJump(false);
        setHJump(false);
      }, 460);
      if (r.ok) {
        play("board");
        const hit3 = v3(target.x + sd * 0.3, target.y + 0.5, target.z - 0.6);
        void fly(arcPoints(target, hit3, 0.1, 6), 200)
          .then(() => fly(arcPoints(hit3, floor(att.x + sd * 3.5, att.z + 2.2), 0.6, 18), 650))
          .then(() => {
            setPhase("done");
            onResult(r);
          });
        return;
      }
      window.setTimeout(() => play("swish"), 700);
      void fly(shotPath(target, true, "verde", sd, false), 1200).then(() => {
        setSwish(true);
        setPhase("done");
        onResult(r);
      });
    },
  });

  const actors: Actor[] = [
    ...others.map((o, k) => ({
      key: `o${k}`,
      id: extraId(`${opponent}-${k}`, charId),
      at: o,
      back: true,
      kit: oppKit,
      number: shirtNumber(`${opponent}${k}`),
    })),
    ...others.map((o, k) => ({
      key: `t${k}`,
      id: extraId(`${game.contract.team}-${k}`, charId),
      at: guardSpot(o, 1.2),
      kit: myKit,
      pose: "defend" as Pose,
      number: shirtNumber(`${game.contract.team}${k}`),
    })),
    {
      key: "handler",
      id: extraId(`${opponent}-h`, charId),
      at: hPos,
      back: true,
      kit: oppKit,
      number: shirtNumber(`${opponent}h`),
      pose: hPose,
      jump: hJump,
      move: phase === "flying" ? 760 : 900,
    },
    { key: "me", id: charId, at: mPos, number: me.jerseyNumber, outfit: game.outfit, pose: mPose, jump: mJump, move: 900 },
  ];
  const ringPos = P ? P.p(target) : null;

  return (
    <div className="absolute inset-0 flex flex-col">
      <Stage stageRef={stageRef} cam={cam} home={myKit.jersey} away={oppKit.jersey} seed={game.contract.team} swish={swish}>
        {P && actors.filter(onStage(P, att, ["me", "handler"])).map((a) => <Actor3D key={a.key} a={a} P={P} />)}
        <BallNodes ballRef={ballRef} shadowRef={shadowRef} />
        {phase === "ring" && ringPos && <RingAt at={ringPos} win={win} ring={ring} size={Math.max(48, Math.round(ringPos.s * 0.85))} tone="danger" />}
        <Label>{action === "rubata" ? "Tocca quando il cerchio si chiude sul pallone" : "Salta quando il cerchio si chiude: stoppata!"}</Label>
      </Stage>
      <div className="bg-[#0d1124] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            tap();
          }}
          disabled={phase !== "ring" || locked}
          className={clsx("press sticker display h-20 w-full touch-none rounded-full bg-danger text-[28px] text-white disabled:opacity-40")}
        >
          {action === "rubata" ? "Ruba!" : "Stoppa!"}
        </button>
      </div>
    </div>
  );
}

// ———————————— Penetrazione: fallo o stoppata ————————————

/**
 * Lui parte in palleggio verso canestro. Puoi fare fallo subito (sicuro: va in
 * lunetta) o aspettare e stopparlo quando salta (rischioso: se arrivi tardi segna,
 * a volte anche col fallo).
 */
export function DriveDefense({
  seed,
  game,
  diff,
  size,
  opponent,
  locked,
  onResult,
}: {
  seed: number;
  game: GameState;
  diff: Difficulty;
  size: 3 | 5;
  opponent: string;
  locked: boolean;
  onResult: (r: MomentResult) => void;
}) {
  const { me, charId } = useGame();
  const { ref: stageRef, ...stage } = useStage();
  const set = size === 3 ? OFF3 : OFF5;
  const att = set[(seed + game.day) % set.length];
  const drive: XZ = { x: att.x * 0.2, z: 2.1 };
  const cam = useCam(stage.w, stage.h, att);
  const P = useMemo(() => (cam ? projector(cam) : null), [cam]);
  const { el: ballRef, shadow: shadowRef, place, fly } = useBall3D(P);
  const myKit = useMyKit(game, charId);
  const oppKit = useMemo(() => teamKit(opponent, myKit.jersey), [opponent, myKit.jersey]);
  const others = set.filter((p) => dist(p, att) > 1.5).slice(0, size - 1);
  const ms = DIFF[diff].ringMs * 1.15;
  const win = ringWindow(game, diff, "fisico");
  const meStart = beside(guardSpot(att, 1.0), 1.35);
  const meEnd = beside(guardSpot(drive, 0.6), 1.0);
  const [phase, setPhase] = useState<"intro" | "ring" | "flying" | "done">("intro");
  const [hPos, setHPos] = useState<XZ>(att);
  const [hMove, setHMove] = useState(900);
  const [hPose, setHPose] = useState<Pose>("dribble");
  const [hJump, setHJump] = useState(false);
  const [mPos, setMPos] = useState<XZ>(meStart);
  const [mPose, setMPose] = useState<Pose>("defend");
  const [mJump, setMJump] = useState(false);
  const [swish, setSwish] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const ringStart = useRef(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  useEffect(() => {
    if (!P) return;
    place(hands(att, "side"));
    play("dribble");
    const t = window.setTimeout(() => {
      // Parte: palleggio fino a canestro, e tu gli scivoli accanto.
      const dur = 200 + ms * 0.75;
      ringStart.current = performance.now();
      setHMove(dur);
      setHPos(drive);
      setMPos(meEnd);
      void fly(dribblePath(att, drive, 4), dur);
      play("squeak");
      setPhase("ring");
      timers.current.push(
        window.setTimeout(() => {
          setHPose("up");
          setHJump(true);
          place(hands(drive, "up"));
        }, dur - 140),
      );
    }, 700);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [P !== null]);

  const target = hands(drive, "up");
  const { ring, tap } = useRing({
    ms,
    active: phase === "ring",
    delay: 200,
    onDone: (p) => {
      if (phase !== "ring") return;
      timers.current.forEach((t) => window.clearTimeout(t));
      const r = defenseResult("penetrazione", judgeRing(p, win), Math.random);
      if (r.kind !== "difesa") return;
      setPhase("flying");
      setHPose("up");
      setHJump(true);
      setMPose("up");
      setMJump(true);
      window.setTimeout(() => {
        setMJump(false);
        setHJump(false);
      }, 460);
      const sd = sideCoin();
      if (r.ok) {
        play("board");
        const hit = v3(target.x + sd * 0.3, target.y + 0.5, target.z + 0.4);
        void fly(arcPoints(target, hit, 0.1, 6), 200)
          .then(() => fly(arcPoints(hit, floor(drive.x + sd * 3.5, drive.z + 3), 0.6, 18), 650))
          .then(() => {
            setPhase("done");
            onResult(r);
          });
        return;
      }
      window.setTimeout(() => play("swish"), 380);
      void fly(shotPath(target, true, "verde", sd, false, 0.4), 700).then(() => {
        setSwish(true);
        setPhase("done");
        onResult(r);
      });
    },
  });

  /** Fallo: fischio, lo fermi, e va in lunetta per due liberi. */
  const foul = () => {
    if (phase !== "ring" || locked) return;
    timers.current.forEach((t) => window.clearTimeout(t));
    setPhase("flying");
    play("whistle");
    const frac = Math.min(1, (performance.now() - ringStart.current) / (200 + ms * 0.75));
    const stop: XZ = { x: att.x + (drive.x - att.x) * frac, z: att.z + (drive.z - att.z) * frac };
    setHMove(220);
    setHPos(stop);
    setMPos(beside(guardSpot(stop, 0.7), 0.6));
    setHPose("dribble");
    setHJump(false);
    place(hands(stop, "chest"));
    const r = foulResult(Math.random);
    if (r.kind !== "fallo") return;
    setNote("Fallo! Due tiri liberi");
    // In lunetta: lui sulla linea, tu sul lato dell'area.
    const ft = FT_SPOT;
    timers.current.push(
      window.setTimeout(() => {
        setHMove(700);
        setHPos(ft);
        setMPos({ x: 2.7, z: 3.4 });
        setMPose("defend");
        void fly(arcPoints(hands(stop, "chest"), hands(ft, "side"), 0.6, 12), 700);
      }, 700),
    );
    const shoot = (i: number) =>
      new Promise<void>((done) => {
        const made = i < r.ftMade;
        setHPose("up");
        const from = hands(ft, "up");
        place(from);
        window.setTimeout(() => play(made ? "swish" : "rim"), 560);
        void fly(shotPath(from, made, "buono", sideCoin(), false), 950).then(() => {
          if (made) setSwish(true);
          setNote(`Libero ${i + 1}: ${made ? "dentro" : "sbagliato"}`);
          setHPose("dribble");
          window.setTimeout(() => {
            setSwish(false);
            place(hands(ft, "side"));
            done();
          }, 350);
        });
      });
    timers.current.push(
      window.setTimeout(() => {
        void shoot(0)
          .then(() => shoot(1))
          .then(() => {
            setPhase("done");
            onResult(r);
          });
      }, 1600),
    );
  };

  const actors: Actor[] = [
    ...others.map((o, k) => ({
      key: `o${k}`,
      id: extraId(`${opponent}-${k}`, charId),
      at: o,
      back: true,
      kit: oppKit,
      number: shirtNumber(`${opponent}${k}`),
    })),
    ...others.map((o, k) => ({
      key: `t${k}`,
      id: extraId(`${game.contract.team}-${k}`, charId),
      at: guardSpot(o, 1.2),
      kit: myKit,
      pose: "defend" as Pose,
      number: shirtNumber(`${game.contract.team}${k}`),
    })),
    {
      key: "handler",
      id: extraId(`${opponent}-h`, charId),
      at: hPos,
      back: true,
      kit: oppKit,
      number: shirtNumber(`${opponent}h`),
      pose: hPose,
      jump: hJump,
      move: hMove,
    },
    { key: "me", id: charId, at: mPos, number: me.jerseyNumber, outfit: game.outfit, pose: mPose, jump: mJump, move: hMove },
  ];
  const ringPos = P ? P.p(target) : null;

  return (
    <div className="absolute inset-0 flex flex-col">
      <Stage stageRef={stageRef} cam={cam} home={myKit.jersey} away={oppKit.jersey} seed={game.contract.team} swish={swish}>
        {P && actors.filter(onStage(P, att, ["me", "handler"])).map((a) => <Actor3D key={a.key} a={a} P={P} />)}
        <BallNodes ballRef={ballRef} shadowRef={shadowRef} />
        {phase === "ring" && ringPos && <RingAt at={ringPos} win={win} ring={ring} size={Math.max(48, Math.round(ringPos.s * 0.85))} tone="danger" />}
        <Label>{note ?? "Va a canestro: fallo subito, o stoppalo quando salta?"}</Label>
      </Stage>
      <div className="flex gap-2 bg-[#0d1124] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onClick={foul}
          disabled={phase !== "ring" || locked}
          className="press sticker display h-20 w-[38%] rounded-full bg-volt text-[24px] text-volt-ink disabled:opacity-40"
        >
          Fallo
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            tap();
          }}
          disabled={phase !== "ring" || locked}
          className="press sticker display h-20 flex-1 touch-none rounded-full bg-danger text-[26px] text-white disabled:opacity-40"
        >
          Stoppa!
        </button>
      </div>
    </div>
  );
}

// ———————————— Salvataggio sulla linea ————————————

/** Una palla vagante rotola verso la linea laterale: tuffati e salvala prima che esca. */
export function SaveAction({
  seed,
  game,
  diff,
  opponent,
  locked,
  onResult,
}: {
  seed: number;
  game: GameState;
  diff: Difficulty;
  size: 3 | 5;
  opponent: string;
  locked: boolean;
  onResult: (r: MomentResult) => void;
}) {
  const { me, charId } = useGame();
  const { ref: stageRef, ...stage } = useStage();
  const sd = (seed + game.day) % 2 ? 1 : -1;
  const from: XZ = { x: sd * 2.6, z: 5.6 };
  const line: XZ = { x: sd * 7.35, z: 6.6 };
  const out: XZ = { x: sd * 9.0, z: 7.0 };
  const mate: XZ = { x: sd * 2.8, z: 4.2 };
  const meStart: XZ = { x: sd * 1.2, z: 8.0 };
  const meEnd: XZ = { x: sd * 6.9, z: 6.9 };
  const cam = useMemo(() => (stage.w && stage.h ? lineCam(sd, stage.w, stage.h) : null), [stage.w, stage.h, sd]);
  const P = useMemo(() => (cam ? projector(cam) : null), [cam]);
  const { el: ballRef, shadow: shadowRef, place, fly } = useBall3D(P);
  const myKit = useMyKit(game, charId);
  const oppKit = useMemo(() => teamKit(opponent, myKit.jersey), [opponent, myKit.jersey]);
  const ms = DIFF[diff].ringMs;
  const win = Math.min(0.3, ringWindow(game, diff, "fisico") * 1.1);
  const [phase, setPhase] = useState<"intro" | "ring" | "flying" | "done">("intro");
  const [mPos, setMPos] = useState<XZ>(meStart);
  const [mMove, setMMove] = useState(800);
  const [mPose, setMPose] = useState<Pose>("dribble");
  const [lift, setLift] = useState(0);
  const [rival, setRival] = useState<XZ>({ x: sd * 3.4, z: 3.2 });
  const [catcher, setCatcher] = useState<Pose>("dribble");

  useEffect(() => {
    if (!P) return;
    // La palla schizza via da una deviazione…
    const start = v3(from.x - sd * 1.2, 1.4, from.z - 0.8);
    place(start);
    play("bounce");
    void fly(arcPoints(start, floor(from.x, from.z), 0.5, 12), 450);
    const t = window.setTimeout(() => {
      // …e rotola verso la linea: corri!
      const dur = 200 + ms * 0.75;
      const pts: V3[] = [];
      for (let i = 0; i <= 16; i++) {
        const k = i / 16;
        pts.push(v3(from.x + (line.x - from.x) * k, 0.17 + Math.abs(Math.sin(k * Math.PI * 2)) * 0.25 * (1 - k), from.z + (line.z - from.z) * k));
      }
      void fly(pts, dur);
      setMMove(dur);
      setMPos(meEnd);
      setRival({ x: sd * 5.2, z: 4.6 });
      play("squeak");
      setPhase("ring");
    }, 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [P !== null]);

  const target = v3(line.x, 0.25, line.z);
  const { ring, tap } = useRing({
    ms,
    active: phase === "ring",
    delay: 200,
    onDone: (p) => {
      if (phase !== "ring") return;
      const r = defenseResult("salvataggio", judgeRing(p, win), Math.random);
      if (r.kind !== "difesa") return;
      setPhase("flying");
      if (r.ok) {
        // Tuffo e palla rimessa in campo al compagno.
        setMPose("up");
        setLift(0.35);
        play("whoosh");
        window.setTimeout(() => setLift(0), 380);
        void fly(arcPoints(v3(line.x, 0.6, line.z), hands(mate, "chest"), 1.2, 18), 760).then(() => {
          setCatcher("up");
          play("bounce");
          setPhase("done");
          onResult(r);
        });
        return;
      }
      // Arrivi tardi: la palla esce.
      setMMove(500);
      setMPos({ x: sd * 7.6, z: 7.1 });
      void fly([floor(line.x, line.z), floor((line.x + out.x) / 2, (line.z + out.z) / 2), floor(out.x, out.z)].map((q) => v3(q.x, 0.17, q.z)), 520).then(() => {
        play("whistle");
        setPhase("done");
        onResult(r);
      });
    },
  });

  const actors: Actor[] = [
    { key: "mate", id: extraId(`${game.contract.team}-0`, charId), at: mate, kit: myKit, pose: catcher, number: shirtNumber(`${game.contract.team}0`) },
    { key: "rival", id: extraId(`${opponent}-h`, charId), at: rival, kit: oppKit, number: shirtNumber(`${opponent}h`), move: mMove + 200 },
    {
      key: "me",
      id: charId,
      at: mPos,
      back: true,
      backName: me.nickname ?? me.firstName,
      number: me.jerseyNumber,
      outfit: game.outfit,
      pose: mPose,
      lift,
      move: lift ? 380 : mMove,
    },
  ];
  const ringPos = P ? P.p(target) : null;

  return (
    <div className="absolute inset-0 flex flex-col">
      <Stage stageRef={stageRef} cam={cam} home={myKit.jersey} away={oppKit.jersey} seed={game.contract.team} swish={false}>
        {P && actors.map((a) => <Actor3D key={a.key} a={a} P={P} />)}
        <BallNodes ballRef={ballRef} shadowRef={shadowRef} />
        {phase === "ring" && ringPos && <RingAt at={ringPos} win={win} ring={ring} size={Math.max(52, Math.round(ringPos.s * 1.0))} />}
        <Label>Palla vagante! Tuffati quando il cerchio si chiude sulla linea</Label>
      </Stage>
      <div className="bg-[#0d1124] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            tap();
          }}
          disabled={phase !== "ring" || locked}
          className="press sticker display h-20 w-full touch-none rounded-full bg-court text-[28px] text-court-ink disabled:opacity-40"
        >
          Tuffati!
        </button>
      </div>
    </div>
  );
}

// ———————————— Da solo: tiro di prova, triple, liberi ————————————

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
  dyn,
}: {
  spot: XZ;
  sweep: number;
  zone: number;
  /** Il verde che si muove, il canestro che balla, il difensore (i liberi ai livelli alti). */
  dyn?: {
    zoneAt: (t: number) => { zone: number; center: number };
    sway?: (t: number) => number;
    defender?: boolean;
  };
  judge: (pos: number) => { made: boolean; outcome: "verde" | "buono" | "fuori" };
  onShot: (r: { made: boolean; outcome: "verde" | "buono" | "fuori"; pos: number }) => void;
  disabled?: boolean;
  fast?: boolean;
  label?: ReactNode;
  overlay?: ReactNode;
}) {
  const { me, charId, game } = useGame();
  const { ref: stageRef, ...stage } = useStage();
  const cam = useCam(stage.w, stage.h, spot);
  const P = useMemo(() => (cam ? projector(cam) : null), [cam]);
  const { el: ballRef, shadow: shadowRef, place, fly } = useBall3D(P);
  const myKit = useMyKit(game, charId);
  const [busy, setBusy] = useState(false);
  const [pose, setPose] = useState<Pose>("dribble");
  const [jump, setJump] = useState(false);
  const [swish, setSwish] = useState(false);
  const [flash, setFlash] = useState<"verde" | "buono" | "fuori" | null>(null);
  const backName = me.nickname ?? me.firstName;
  const busyRef = useRef(false);
  const greenRef = useRef<HTMLDivElement>(null);
  const nearRef = useRef<HTMLDivElement>(null);
  const [defJump, setDefJump] = useState(false);

  // Il verde che si muove e il canestro che balla: fuori da React, a ogni fotogramma.
  useEffect(() => {
    if (!dyn) {
      stageRef.current?.style.removeProperty("--sway");
      return;
    }
    let raf = 0;
    const loop = () => {
      if (!busyRef.current) {
        const now = performance.now();
        const { zone: z, center } = dyn.zoneAt(now);
        if (greenRef.current) {
          greenRef.current.style.bottom = `${(center - z / 2) * 100}%`;
          greenRef.current.style.height = `${z * 100}%`;
        }
        if (nearRef.current) {
          nearRef.current.style.bottom = `${(center - z) * 100}%`;
          nearRef.current.style.height = `${z * 200}%`;
        }
        if (P && dyn.sway) stageRef.current?.style.setProperty("--sway", `${(dyn.sway(now) * P.p(COURT.rim).s).toFixed(1)}px`);
        else stageRef.current?.style.removeProperty("--sway");
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [dyn, P, stageRef]);

  // Il difensore davanti salta e agita le braccia.
  useEffect(() => {
    if (!dyn?.defender) return;
    const id = window.setInterval(() => setDefJump((j) => !j), 620);
    return () => window.clearInterval(id);
  }, [dyn?.defender]);

  // Il pallone in mano, al posto giusto (anche quando si cambia carrello).
  useEffect(() => {
    if (!P || busyRef.current) return;
    place(hands(spot, "side"));
  }, [P, place, spot]);

  const meter = useHoldMeter({
    sweep,
    disabled: disabled || busy,
    onRelease: (pos) => {
      const j = judge(pos);
      busyRef.current = true;
      setBusy(true);
      setFlash(j.outcome);
      setPose("up");
      setJump(true);
      const from = hands(spot, "up");
      place(from);
      play("whoosh");
      window.setTimeout(() => setJump(false), fast ? 300 : 420);
      const ms = fast ? 850 : 1150;
      window.setTimeout(() => (j.made ? play("swish") : play(j.outcome === "fuori" ? "board" : "rim")), ms * 0.58);
      void fly(shotPath(from, j.made, j.outcome, sideCoin(), pos < ZONE_CENTER), ms).then(() => {
        if (j.made) setSwish(true);
        onShot({ ...j, pos });
        window.setTimeout(
          () => {
            setSwish(false);
            setPose("dribble");
            setFlash(null);
            meter.reset();
            busyRef.current = false;
            setBusy(false);
            place(hands(spot, "side"));
          },
          fast ? 120 : 380,
        );
      });
    },
  });

  return (
    <div className="absolute inset-0 flex flex-col">
      <Stage stageRef={stageRef} cam={cam} home={myKit.jersey} away="#FFC531" seed="sfide" swish={swish} hype={swish}>
        {P && dyn?.defender && (
          <Actor3D
            a={{ key: "def", id: extraId("liberi-difensore", charId), at: beside(guardSpot(spot, 1.1), 0.8), kit: { jersey: "#2B2724", trim: "#E8A80C" }, number: 13, pose: "up", jump: defJump, move: 300 }}
            P={P}
          />
        )}
        {P && (
          <Actor3D
            a={{ key: "me", id: charId, at: spot, back: true, backName, number: me.jerseyNumber, outfit: game.outfit, pose, jump, crouch: meter.holding, move: 700 }}
            P={P}
          />
        )}
        <BallNodes ballRef={ballRef} shadowRef={shadowRef} />
        <div className="absolute right-2 top-[14%] z-[960]">
          <MeterBar fill={meter.fill} zone={zone} center={ZONE_CENTER} height={Math.min(200, Math.round(stage.h * 0.45))} flash={flash} greenRef={greenRef} nearRef={nearRef} />
        </div>
        {label && <Label>{label}</Label>}
        {overlay}
      </Stage>
      <div className="bg-[#0d1124] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
        <HoldButton handlers={meter.handlers} holding={meter.holding} disabled={disabled || busy} className="w-full">
          {meter.holding ? "Lascia!" : "Tira"}
        </HoldButton>
      </div>
    </div>
  );
}

// ———————————— Schiacciata ————————————

const DUNK_PATH: XZ[] = [
  { x: -2.4, z: 6.8 },
  { x: -1.7, z: 5.2 },
  { x: -0.9, z: 3.5 },
  { x: -0.15, z: 2.0 },
];

/** La schiacciata: rincorsa dal fondo, stacco, e su fino al ferro. */
export function DunkScene({
  phase,
  made = true,
  controls,
  children,
}: {
  phase: number;
  made?: boolean;
  controls?: ReactNode;
  children?: ReactNode;
}) {
  const { me, charId, game } = useGame();
  const { ref: stageRef, ...stage } = useStage();
  const cam = useMemo(() => (stage.w && stage.h ? dunkCam(stage.w, stage.h) : null), [stage.w, stage.h]);
  const P = useMemo(() => (cam ? projector(cam) : null), [cam]);
  const myKit = useMyKit(game, charId);
  const step = Math.min(3, Math.max(0, phase));
  const up = step >= 3;
  useEffect(() => {
    if (step === 1) play("squeak");
    if (step === 2) play("whoosh");
    if (step === 3) play(made ? "roar" : "rim");
  }, [step, made]);
  return (
    <div className="absolute inset-0 flex flex-col">
      <Stage stageRef={stageRef} cam={cam} home={myKit.jersey} away="#FFC531" seed="sfide" swish={up && made} hype={up && made}>
        {P && (
          <Actor3D
            a={{
              key: "me",
              id: charId,
              at: DUNK_PATH[step],
              back: true,
              backName: me.nickname ?? me.firstName,
              number: me.jerseyNumber,
              outfit: game.outfit,
              pose: step >= 2 ? "up" : "dribble",
              lift: up ? 1.15 : step === 2 ? 0.45 : 0,
              move: up ? 420 : 650,
            }}
            P={P}
          />
        )}
        {children}
      </Stage>
      {controls && <div className="bg-[#0d1124] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">{controls}</div>}
    </div>
  );
}

// ———————————— La telecronaca in campo ————————————

/**
 * Mentre scorre la telecronaca: la metà campo dall'alto, le due squadre ai loro posti
 * (chi attacca di schiena, chi difende di fronte) e il pallone che va a canestro.
 */
export function CommentaryCourt({
  game,
  size,
  opponent,
  names,
  line,
  poss,
  hype,
}: {
  game: GameState;
  size: 3 | 5;
  opponent: string;
  names: Rosters;
  /** L'ultima riga di cronaca, da mettere in scena. */
  line: FeedLine | null;
  poss: Side;
  hype: boolean;
}) {
  const { me, charId } = useGame();
  const { ref: stageRef, ...stage } = useStage();
  const cam = useCam(stage.w, stage.h, null);
  const P = useMemo(() => (cam ? projector(cam) : null), [cam]);
  const { el: ballRef, shadow: shadowRef, place, fly } = useBall3D(P);
  const myKit = useMyKit(game, charId);
  const oppKit = useMemo(() => teamKit(opponent, myKit.jersey), [opponent, myKit.jersey]);
  const set = size === 3 ? OFF3 : OFF5;
  const [swish, setSwish] = useState(false);
  const side: Side = line?.side ?? poss;
  const usIds = useMemo(() => [names.me, ...names.us].slice(0, size), [names, size]);
  const themIds = useMemo(() => names.them.slice(0, size), [names, size]);
  const offense = side === "us" ? usIds : themIds;
  const handler = line?.who && offense.includes(line.who) ? line.who : offense[0];
  const scored = !!line && line.pts > 0 && line.side === side;
  const spotOf = (name: string, team: Side): XZ => {
    const list = team === "us" ? usIds : themIds;
    const raw = set[Math.max(0, list.indexOf(name)) % set.length];
    const base = { x: raw.x * 0.9, z: raw.z };
    return team === side ? base : guardSpot(base, 1.25);
  };

  useEffect(() => {
    if (!P || !line) return;
    const at = spotOf(handler, side);
    place(hands(at, "side"));
    let alive = true;
    const t = window.setTimeout(() => {
      if (!alive) return;
      const sd = sideCoin();
      const from = hands(at, "up");
      if (scored) {
        place(from);
        void fly(shotPath(from, true, "verde", sd, false), 950).then(() => {
          if (!alive) return;
          setSwish(true);
          window.setTimeout(() => alive && setSwish(false), 600);
        });
      } else if (line.kind === "miss") {
        place(from);
        void fly(shotPath(from, false, "buono", sd, false), 950);
      } else if (line.kind === "turnover") {
        void fly(arcPoints(hands(at, "chest"), hands(guardSpot(at, 1.25), "chest"), 0.3, 10), 450);
      }
    }, 650);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
    // Una volta per ogni riga nuova.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, P]);

  const actors: Actor[] = [
    ...themIds.map((n, k) => ({
      key: `t-${n}`,
      id: extraId(`${opponent}-${k}`, charId),
      at: spotOf(n, "them"),
      back: side === "them",
      kit: oppKit,
      number: shirtNumber(`${opponent}${n}`),
      pose: (side === "them" ? (n === handler && scored ? "up" : "dribble") : "defend") as Pose,
      tag: side === "them" && n === handler && scored ? `+${line?.pts} ${n}` : null,
      move: 1000,
    })),
    ...usIds.map((n, k) => {
      const mine = n === names.me;
      return {
        key: `u-${n}`,
        id: mine ? charId : extraId(`${game.contract.team}-${k - 1}`, charId),
        at: spotOf(n, "us"),
        back: side === "us",
        backName: mine && side === "us" ? me.nickname ?? me.firstName : undefined,
        kit: mine ? undefined : myKit,
        outfit: mine ? game.outfit : undefined,
        number: mine ? me.jerseyNumber : shirtNumber(`${game.contract.team}${n}`),
        pose: (side === "us" ? (n === handler && scored ? "up" : "dribble") : "defend") as Pose,
        tag: side === "us" && n === handler && scored ? `+${line?.pts} ${mine ? "Tu" : n}` : null,
        glow: mine,
        move: 1000,
      };
    }),
  ];

  return (
    <Stage stageRef={stageRef} cam={cam} home={myKit.jersey} away={oppKit.jersey} seed={game.contract.team} swish={swish} hype={hype || swish}>
      {P && actors.map((a) => <Actor3D key={a.key} a={a} P={P} />)}
      <BallNodes ballRef={ballRef} shadowRef={shadowRef} />
    </Stage>
  );
}
