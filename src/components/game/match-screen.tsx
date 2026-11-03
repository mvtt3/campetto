"use client";

import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Character } from "@/components/character";
import { Button } from "@/components/ui/basics";
import { play } from "@/lib/sound";
import { DAY_NAMES, LEVELS, dow, fmtEuro, teamStrength } from "@/lib/game/economy";
import {
  DIFF,
  SHOTS,
  ZONE_CENTER,
  coachRel,
  commentary,
  defenseResult,
  finishMatch,
  judgeRing,
  judgeShot,
  passResult,
  planMatch,
  ringWindow,
  shotResult,
  shotZone,
  shouldBench,
  simulateMoments,
  type MatchOutcome,
  type MatchPlan,
  type MomentResult,
} from "@/lib/game/match";
import { applyMatch, SKILL_NAMES } from "@/lib/game/state";
import { unreadCount } from "@/lib/game/messages";
import type { Difficulty, GameState, Skill } from "@/lib/game/types";
import { HoldButton, MeterBar, RingTarget, useHoldMeter, useRing, useShotFlight } from "./meters";
import { Ball, CourtScene, Dot, Hoop } from "./scene";
import { useGame } from "./store";
import { Tip } from "./ui";

const DIFF_KEY = "campetto:gioco:difficolta";

function savedDiff(): Difficulty {
  try {
    const v = localStorage.getItem(DIFF_KEY);
    return v === "facile" || v === "difficile" ? v : "normale";
  } catch {
    return "normale";
  }
}

export function ratingWord(r: number): string {
  return r >= 9.5 ? "Leggendario" : r >= 9 ? "Da MVP" : r >= 8 ? "Partitone" : r >= 7 ? "Bella partita" : r >= 6 ? "Sufficiente" : r >= 5 ? "Così così" : "Da dimenticare";
}

const fmtVote = (r: number) => r.toLocaleString("it-IT", { maximumFractionDigits: 1 });

/** La partita: prima la scelta della difficoltà, poi i momenti chiave, poi il resoconto. */
export function MatchScreen({ index, onExit }: { index: number; onExit: () => void }) {
  const { game, update } = useGame();
  const match = game.season.matches[index];
  const [diff, setDiff] = useState<Difficulty>(savedDiff);
  const [phase, setPhase] = useState<"pre" | "play" | "sim" | "end">(match?.result ? "end" : "pre");
  const [plan, setPlan] = useState<MatchPlan | null>(null);
  const [outcome, setOutcome] = useState<MatchOutcome | null>(null);
  // Lo stato com'era prima della partita: per il resoconto (abilità salite…).
  const [before, setBefore] = useState<GameState>(game);

  const start = (simulated: boolean) => {
    try {
      localStorage.setItem(DIFF_KEY, diff);
    } catch {
      /* niente */
    }
    setBefore(game);
    const p = planMatch(game, match, diff, Math.random);
    setPlan(p);
    play("whistle");
    setPhase(simulated ? "sim" : "play");
  };

  const finish = useCallback(
    (results: MomentResult[], simulated: boolean) => {
      if (!plan) return;
      const o = finishMatch(before, plan, results, diff, simulated, Math.random);
      setOutcome(o);
      update((s) => applyMatch(s, index, o, Date.now(), Math.random));
      play(o.result.us > o.result.them ? "win" : "loss");
      setPhase("end");
    },
    [plan, diff, update, index, before],
  );

  if (!match) return null;

  if (phase === "pre")
    return <PreMatch game={game} index={index} diff={diff} setDiff={setDiff} onPlay={() => start(false)} onSim={() => start(true)} onExit={onExit} />;
  if (phase === "play" && plan)
    return <LiveMatch game={before} plan={plan} diff={diff} onEnd={(r) => finish(r, false)} />;
  if (phase === "sim" && plan)
    return <SimMatch game={before} plan={plan} diff={diff} onEnd={(r) => finish(r, true)} />;
  const result = outcome?.result ?? match.result;
  if (!result) return null;
  return (
    <Summary
      before={before}
      after={game}
      opponent={match.opponent}
      home={match.home}
      result={result}
      outcome={outcome}
      onExit={onExit}
    />
  );
}

function PreMatch({
  game,
  index,
  diff,
  setDiff,
  onPlay,
  onSim,
  onExit,
}: {
  game: GameState;
  index: number;
  diff: Difficulty;
  setDiff: (d: Difficulty) => void;
  onPlay: () => void;
  onSim: () => void;
  onExit: () => void;
}) {
  const m = game.season.matches[index];
  const lv = LEVELS[game.contract.level];
  const us = game.contract.team;
  const strength = teamStrength(m.opponent);
  const coach = coachRel(game);
  const warn: string[] = [];
  if (game.energy < 15) warn.push("Sei distrutto: parti dalla panchina e il verde è molto più stretto");
  else if (game.energy < 30) warn.push("Sei stanco: il verde è più stretto");
  if (game.happiness < 30) warn.push("Sei giù di morale: giochi peggio");
  if (coach <= -50) warn.push("Il coach ce l'ha con te: parti dalla panchina");
  else if (coach <= -20) warn.push("Il coach non si fida: giocherai meno palloni");
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto [&>*]:shrink-0 px-4 pb-6 pt-2">
      <div className="card overflow-hidden">
        <div className="court px-4 pb-4 pt-3 !shadow-none !border-0">
          <p className="text-[12.5px] font-bold uppercase tracking-wide text-court-ink/80">
            {lv.name} · giornata {index + 1} di {game.season.matches.length} · {DAY_NAMES[dow(m.day)]}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="display text-[23px] leading-tight">{m.home ? us : m.opponent}</p>
              <p className="my-1 text-[13px] font-bold text-court-ink/70">contro</p>
              <p className="display text-[23px] leading-tight">{m.home ? m.opponent : us}</p>
            </div>
          </div>
          <p className="mt-2 text-[13px] text-court-ink/85">
            {lv.format} ·{" "}
            {strength > 1.07 ? "avversari forti" : strength < 0.93 ? "avversari alla portata" : "avversari normali"}
          </p>
        </div>
      </div>

      {warn.length > 0 && (
        <div className="card flex flex-col gap-1 bg-gold-soft px-4 py-3 text-[14px] font-semibold">
          {warn.map((w) => (
            <p key={w}>⚠️ {w}</p>
          ))}
        </div>
      )}

      <div>
        <p className="mb-2 px-1 text-[13px] font-bold uppercase tracking-wide text-muted">Difficoltà</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Difficoltà">
          {(["facile", "normale", "difficile"] as Difficulty[]).map((d) => (
            <button
              key={d}
              role="radio"
              aria-checked={diff === d}
              onClick={() => {
                play("select");
                setDiff(d);
              }}
              className={clsx(
                "press sticker flex flex-col items-center rounded-2xl px-1 py-3",
                diff === d ? "bg-court text-court-ink" : "bg-surface",
              )}
            >
              <span className="display text-[clamp(16px,4.8vw,19px)]">{DIFF[d].name}</span>
              <span className={clsx("mt-1 text-[12px] font-semibold", diff === d ? "text-court-ink/85" : "text-muted")}>
                premi ×{String(DIFF[d].prize).replace(".", ",")}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 px-1 text-[13px] text-muted">{DIFF[diff].line}</p>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <Button variant="primary" size="lg" block className="!h-16 display !text-[24px]" onClick={onPlay}>
          Gioca
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onSim} sound="tap">
            Simula
          </Button>
          <Button variant="ghost" onClick={onExit}>
            Dopo
          </Button>
        </div>
        <p className="text-center text-[12.5px] text-muted">Simulando prendi metà premio e niente gettone per le sfide</p>
      </div>
    </div>
  );
}

type Feedback = { big: string; line: string; good: boolean };

/** Il momento è andato bene? (per i pallini in alto) */
const isGood = (r: MomentResult) =>
  r.kind === "tiro" ? r.made : r.kind === "passaggio" ? r.ok && r.made : r.kind === "difesa" ? r.ok : false;

function feedbackOf(r: MomentResult): Feedback {
  const line = commentary(r, Math.random);
  switch (r.kind) {
    case "tiro":
      return {
        big: r.made ? (r.outcome === "verde" ? "CIUFF!" : "DENTRO!") : r.outcome === "fuori" ? "MATTONE" : "FERRO!",
        line,
        good: r.made,
      };
    case "passaggio":
      return { big: !r.ok ? "PALLA PERSA" : r.made ? "ASSIST!" : "SBAGLIA LUI", line, good: r.ok && r.made };
    case "difesa":
      return {
        big: r.ok ? (r.action === "rubata" ? "RUBATA!" : "STOPPATA!") : "CANESTRO LORO",
        line,
        good: r.ok,
      };
    default:
      return { big: "", line, good: false };
  }
}

function LiveMatch({
  game,
  plan,
  diff,
  onEnd,
}: {
  game: GameState;
  plan: MatchPlan;
  diff: Difficulty;
  onEnd: (r: MomentResult[]) => void;
}) {
  const [results, setResults] = useState<MomentResult[]>([]);
  const [mode, setMode] = useState<"choose" | "pass" | "defense" | "feedback" | "bench">(() =>
    plan.moments[0].kind === "difesa" ? "defense" : "choose",
  );
  const [fb, setFb] = useState<Feedback | null>(null);
  const [flash, setFlash] = useState<"verde" | "buono" | "fuori" | null>(null);
  const i = results.length;
  // Durante il resoconto si vede ancora il momento appena giocato.
  const cur = Math.min(mode === "feedback" ? i - 1 : i, plan.moments.length - 1);
  const m = plan.moments[cur];
  const stat = useMemo(() => {
    let pts = 0, ast = 0, def = 0;
    for (const r of results) {
      if (r.kind === "tiro") pts += r.pts;
      if (r.kind === "passaggio" && r.made) ast++;
      if (r.kind === "difesa" && r.ok) {
        def++;
        if (r.fastBreak) pts += 2;
      }
    }
    return { pts, ast, def };
  }, [results]);

  const next = useCallback(
    (all: MomentResult[]) => {
      setFb(null);
      setFlash(null);
      if (all.length >= plan.moments.length) {
        onEnd(all);
        return;
      }
      if (shouldBench(plan, all)) {
        setMode("bench");
        return;
      }
      setMode(plan.moments[all.length].kind === "difesa" ? "defense" : "choose");
    },
    [plan, onEnd],
  );

  // Il resoconto del momento resta un attimo, poi si va avanti (un tocco lo salta).
  const pending = useRef<MomentResult[] | null>(null);
  const timer = useRef<number | null>(null);
  const record = useCallback(
    (r: MomentResult) => {
      const all = [...results, r];
      setResults(all);
      const f = feedbackOf(r);
      setFb(f);
      setMode("feedback");
      pending.current = all;
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        pending.current = null;
        next(all);
      }, 1500);
    },
    [results, next],
  );
  const skip = () => {
    if (!pending.current) return;
    if (timer.current) window.clearTimeout(timer.current);
    const all = pending.current;
    pending.current = null;
    next(all);
  };
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const benchOut = () => {
    const rest: MomentResult[] = plan.moments.slice(results.length).map(() => ({ kind: "panchina" }));
    onEnd([...results, ...rest]);
  };

  const situation =
    m.kind === "difesa"
      ? m.action === "rubata"
        ? "Difesa: rubagli palla!"
        : "Difesa: stoppalo!"
      : m.open
        ? m.shot === "tripla"
          ? "Sei libero da tre!"
          : m.shot === "sotto"
            ? "Strada libera fino a canestro!"
            : "Libero dalla media!"
        : m.shot === "tripla"
          ? "Marcato stretto, da tre"
          : m.shot === "sotto"
            ? "Sotto canestro, con l'uomo addosso"
            : "Marcato stretto, dalla media";

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-4" onClick={mode === "feedback" ? skip : undefined}>
      <div className="flex items-center justify-between gap-2 pb-2">
        <div className="flex gap-1" aria-label={`Momento ${Math.min(i + 1, plan.moments.length)} di ${plan.moments.length}`}>
          {plan.moments.map((_, k) => {
            const r = results[k];
            return (
              <span
                key={k}
                className={clsx(
                  "h-3 w-3 rounded-full border-2 border-edge",
                  !r ? (k === cur ? "bg-volt" : "bg-surface") : r.kind === "panchina" ? "bg-line" : isGood(r) ? "bg-ok" : "bg-danger",
                )}
              />
            );
          })}
        </div>
        <p className="num text-[15px]">
          {stat.pts} pt · {stat.ast} ass · {stat.def} dif
        </p>
      </div>
      <p className="text-[12.5px] font-bold uppercase tracking-wide text-muted">{m.clock}</p>
      <h2 className="display pb-2 text-[24px] leading-tight">{mode === "bench" ? "Il coach ti chiama" : situation}</h2>

      <CourtScene className="min-h-0 flex-1">
        {mode === "bench" ? (
          <div className="absolute inset-0 grid place-items-center bg-[#1d1a16]/55 p-6 text-center text-court-ink">
            <div>
              <p className="display text-[26px]">In panchina</p>
              <p className="mt-2 text-[15px]">Troppi errori di fila: il coach ti fa sedere per il resto della partita.</p>
            </div>
          </div>
        ) : m.kind === "attacco" && (mode === "choose" || (mode === "feedback" && results.at(-1)?.kind === "tiro")) ? (
          <ShotPlay key={cur} game={game} diff={diff} shot={m.shot} open={m.open} flash={flash} onShot={(r, out) => {
            setFlash(out);
            record(r);
          }} onPass={() => setMode("pass")} disabled={mode !== "choose"} />
        ) : m.kind === "attacco" && (mode === "pass" || mode === "feedback") ? (
          <PassPlay key={`p${cur}`} seed={cur} game={game} diff={diff} size={plan.size} done={mode === "feedback"} onPass={(hit) => record(passResult(game, m.shot, m.open, hit, Math.random))} />
        ) : m.kind === "difesa" ? (
          <DefensePlay key={`d${cur}`} game={game} diff={diff} action={m.action} done={mode === "feedback"} onDone={(hit) => record(defenseResult(m.action, hit, Math.random))} />
        ) : null}
        {fb && (
          <div className="pointer-events-none absolute inset-x-0 top-[38%] flex flex-col items-center px-4 text-center">
            <p
              className={clsx("display game-pop text-[46px] leading-none", fb.good ? "text-volt" : "text-white")}
              style={{ WebkitTextStroke: "2px #1d1a16", textShadow: "3px 3px 0 #1d1a16" }}
            >
              {fb.big}
            </p>
            <p className="mt-2 rounded-full bg-[#1d1a16]/70 px-3 py-1 text-[14px] font-semibold text-white">{fb.line}</p>
          </div>
        )}
      </CourtScene>
      {mode === "bench" && (
        <Button variant="primary" size="lg" block className="mt-3 !h-16" onClick={benchOut}>
          Vai al risultato
        </Button>
      )}
      {mode === "feedback" && <p className="pt-3 text-center text-[13px] text-muted">Tocca per andare avanti</p>}
    </div>
  );
}

function ShotPlay({
  game,
  diff,
  shot,
  open,
  flash,
  onShot,
  onPass,
  disabled,
}: {
  game: GameState;
  diff: Difficulty;
  shot: keyof typeof SHOTS;
  open: boolean;
  flash: "verde" | "buono" | "fuori" | null;
  onShot: (r: MomentResult, out: "verde" | "buono" | "fuori") => void;
  onPass: () => void;
  disabled: boolean;
}) {
  const zone = shotZone(game, diff, shot, open);
  const { ball, fly } = useShotFlight();
  const [swish, setSwish] = useState(false);
  const [busy, setBusy] = useState(false);
  const meter = useHoldMeter({
    sweep: DIFF[diff].sweep,
    disabled: disabled || busy,
    onRelease: (pos) => {
      setBusy(true);
      const j = judgeShot(pos, zone, game.skills.tiro, Math.random);
      play("whoosh");
      void fly(j.made, j.outcome).then(() => {
        if (j.made) {
          setSwish(true);
          play("swish");
        } else play(j.outcome === "fuori" ? "board" : "rim");
        onShot(shotResult(shot, j), j.outcome);
      });
    },
  });
  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex justify-center pt-3">
        <Hoop swish={swish} />
      </div>
      <div className="relative flex-1">
        <div ref={ball} className="absolute bottom-[96px] left-1/2 -ml-[22px]">
          <Ball />
        </div>
        <div className="absolute right-3 top-0">
          <MeterBar fill={meter.fill} zone={zone} center={ZONE_CENTER} height={170} flash={flash} />
        </div>
        <p className="absolute left-3 top-0 rounded-full bg-[#1d1a16]/55 px-2.5 py-1 text-[12.5px] font-bold text-white">
          {SHOTS[shot].label} · {SHOTS[shot].pts} punti
        </p>
      </div>
      <div className="flex gap-2 p-3">
        <button
          type="button"
          onClick={onPass}
          disabled={disabled || busy || meter.holding}
          className="press sticker display h-20 w-[34%] rounded-full bg-surface text-[21px] disabled:opacity-40"
        >
          Passa
        </button>
        <HoldButton handlers={meter.handlers} holding={meter.holding} disabled={disabled || busy} className="flex-1">
          {meter.holding ? "Lascia!" : "Tira"}
        </HoldButton>
      </div>
    </div>
  );
}

function PassPlay({
  seed,
  game,
  diff,
  size,
  done,
  onPass,
}: {
  seed: number;
  game: GameState;
  diff: Difficulty;
  size: 3 | 5;
  done: boolean;
  onPass: (hit: "perfetto" | "buono" | "fuori") => void;
}) {
  const win = ringWindow(game, diff, "passaggio");
  const mates = useMemo(() => {
    const nums = [4, 7, 11, 15, 23, 33, 8, 21, 6, 13];
    return Array.from({ length: size - 1 }, (_, k) => nums[(k * 3 + game.day) % nums.length]);
  }, [size, game.day]);
  // Il compagno libero cambia da un'azione all'altra.
  const target = (seed * 7 + game.day * 3) % mates.length;
  const { ring, tap } = useRing({
    ms: DIFF[diff].ringMs,
    onDone: (p) => {
      const hit = judgeRing(p, win);
      play(hit === "fuori" ? "error" : "swish");
      onPass(hit);
    },
  });
  return (
    <div className="absolute inset-0 flex flex-col">
      <p className="px-4 pt-3 text-center text-[14px] font-semibold text-white">Tocca quando il cerchio si chiude sul compagno libero</p>
      <div className="relative flex flex-1 items-center justify-around px-2">
        {mates.map((n, k) =>
          k === target ? (
            <RingTarget key={k} ring={ring} win={win} size={78}>
              <Dot n={n} tone="us" size={70} label="Compagno libero" />
            </RingTarget>
          ) : (
            <div key={k} className="flex flex-col items-center gap-1 opacity-80">
              <Dot n={n} tone="us" size={48} />
              <Dot n="×" tone="them" size={30} label="Marcato" />
            </div>
          ),
        )}
      </div>
      <div className="p-3">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            tap();
          }}
          disabled={done}
          className="press sticker display h-20 w-full touch-none rounded-full bg-volt text-[28px] text-volt-ink disabled:opacity-40"
        >
          Passa ora
        </button>
      </div>
    </div>
  );
}

function DefensePlay({
  game,
  diff,
  action,
  done,
  onDone,
}: {
  game: GameState;
  diff: Difficulty;
  action: "rubata" | "stoppata";
  done: boolean;
  onDone: (hit: "perfetto" | "buono" | "fuori") => void;
}) {
  const skill: Skill = action === "rubata" ? "difesa" : "fisico";
  const win = ringWindow(game, diff, skill);
  const { ring, tap } = useRing({
    ms: DIFF[diff].ringMs * (action === "stoppata" ? 0.9 : 1),
    onDone: (p) => {
      const hit = judgeRing(p, win);
      play(hit === "fuori" ? "error" : action === "stoppata" ? "board" : "bounce");
      onDone(hit);
    },
  });
  return (
    <div className="absolute inset-0 flex flex-col">
      {action === "stoppata" && (
        <div className="flex justify-center pt-3 opacity-90">
          <Hoop className="w-[110px]" />
        </div>
      )}
      <p className="px-4 pt-3 text-center text-[14px] font-semibold text-white">
        {action === "rubata" ? "Tocca quando il cerchio si chiude sul pallone" : "Salta quando il cerchio si chiude: stoppata!"}
      </p>
      <div className="grid flex-1 place-items-center">
        <RingTarget ring={ring} win={win} size={96} tone="danger">
          <div className="relative grid place-items-center">
            <Dot n={pickNumber(game.day)} tone="them" size={74} label="Avversario col pallone" />
            <Ball size={30} className="absolute -bottom-2 -right-3" />
          </div>
        </RingTarget>
      </div>
      <div className="p-3">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            tap();
          }}
          disabled={done}
          className="press sticker display h-20 w-full touch-none rounded-full bg-danger text-[28px] text-white disabled:opacity-40"
        >
          {action === "rubata" ? "Ruba!" : "Stoppa!"}
        </button>
      </div>
    </div>
  );
}

const pickNumber = (d: number) => [3, 9, 12, 24, 30, 0, 5][d % 7];

/** Simula: la cronaca scorre veloce, momento per momento. */
function SimMatch({
  game,
  plan,
  diff,
  onEnd,
}: {
  game: GameState;
  plan: MatchPlan;
  diff: Difficulty;
  onEnd: (r: MomentResult[]) => void;
}) {
  const [{ results, lines }] = useState(() => {
    const results = simulateMoments(game, plan, diff, Math.random);
    return { results, lines: results.map((r) => ({ r, f: feedbackOf(r) })) };
  });
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= lines.length) {
      const t = window.setTimeout(() => onEnd(results), 600);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      setShown((n) => n + 1);
      play(lines[shown].f.good ? "tick" : "bounce");
    }, 420);
    return () => window.clearTimeout(t);
  }, [shown, lines, results, onEnd]);
  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-4" onClick={() => setShown(lines.length)}>
      <h2 className="display pb-3 text-[24px]">Simulazione</h2>
      <div className="card flex-1 overflow-y-auto p-3">
        <ol className="flex flex-col gap-2">
          {lines.slice(0, shown).map(({ r, f }, k) => (
            <li key={k} className="fade-in flex items-start gap-2 text-[15px]">
              <span className={clsx("mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-edge", r.kind === "panchina" ? "bg-line" : f.good ? "bg-ok" : "bg-danger")} />
              <span>
                <span className="text-[12px] font-bold uppercase text-muted">{plan.moments[k].clock}</span>
                <br />
                {f.line}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <p className="pt-3 text-center text-[13px] text-muted">Tocca per arrivare al risultato</p>
    </div>
  );
}

function Summary({
  before,
  after,
  opponent,
  home,
  result,
  outcome,
  onExit,
}: {
  before: GameState;
  after: GameState;
  opponent: string;
  home: boolean;
  result: NonNullable<GameState["season"]["matches"][number]["result"]>;
  outcome: MatchOutcome | null;
  onExit: () => void;
}) {
  const { me, charId } = useGame();
  const won = result.us > result.them;
  const team = after.contract.team === before.contract.team ? after.contract.team : before.contract.team;
  const ups = (Object.keys(after.skills) as Skill[]).filter((k) => after.skills[k] > before.skills[k]);
  const newMsgs = Math.max(0, unreadCount(after) - unreadCount(before));
  const left = home ? { name: team, pts: result.us } : { name: opponent, pts: result.them };
  const right = home ? { name: opponent, pts: result.them } : { name: team, pts: result.us };
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto [&>*]:shrink-0 px-4 pb-6 pt-1">
      <div className={clsx("card relative overflow-hidden px-4 pb-4 pt-3", won ? "bg-ok text-white" : "bg-surface")}>
        <p className="display text-[34px] leading-none">{won ? "Vittoria!" : "Sconfitta"}</p>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-semibold">{left.name}</p>
            <p className="score text-[52px]">{left.pts}</p>
          </div>
          <p className="score pb-3 text-[30px] opacity-60">–</p>
          <div className="min-w-0 flex-1 text-right">
            <p className="truncate text-[13.5px] font-semibold">{right.name}</p>
            <p className="score text-[52px]">{right.pts}</p>
          </div>
        </div>
        {result.simulated && <p className="mt-1 text-[12.5px] font-semibold opacity-80">Partita simulata</p>}
      </div>

      <div className="card flex items-center gap-3 px-4 py-3">
        <Character id={charId} outfit={after.outfit} number={me.jerseyNumber} height={92} />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-bold uppercase tracking-wide text-muted">Il tuo voto</p>
          <p className="score text-[46px] text-ball">{fmtVote(result.rating)}</p>
          <p className="text-[14px] font-semibold">{ratingWord(result.rating)}</p>
          {result.benched && <p className="mt-1 text-[13px] text-danger">Il coach ti ha tolto prima della fine</p>}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {[
          ["Punti", result.pts],
          ["Assist", result.ast],
          ["Rimb.", result.reb],
          ["Rubate", result.stl],
          ["Stopp.", result.blk],
        ].map(([l, v]) => (
          <div key={l} className="sticker-sm flex flex-col items-center rounded-2xl bg-surface py-2">
            <span className="num text-[24px]">{v}</span>
            <span className="text-[11.5px] font-semibold text-muted">{l}</span>
          </div>
        ))}
      </div>

      <div className="card flex flex-col gap-1.5 px-4 py-3 text-[15px]">
        {outcome && outcome.money > 0 && <p>💶 Premio vittoria: <b>+{fmtEuro(outcome.money)}</b></p>}
        {outcome && outcome.fame !== 0 && (
          <p>⭐ Fama: <b>{outcome.fame > 0 ? `+${outcome.fame}` : outcome.fame}</b></p>
        )}
        {outcome && !result.simulated && <p>🎟️ Un gettone in più per le sfide</p>}
        {ups.map((k) => (
          <p key={k}>
            📈 {SKILL_NAMES[k]} sale a <b>{after.skills[k]}</b>
          </p>
        ))}
        {newMsgs > 0 && <p>📱 {newMsgs === 1 ? "Un messaggio nuovo" : `${newMsgs} messaggi nuovi`} sul telefono</p>}
        {after.offers.length > 0 && before.offers.length === 0 && <p>📑 Fine stagione: guarda le offerte in Contratti</p>}
      </div>

      <Tip id="partita-fatta" text="Dopo la partita, dall'hub vai al giorno dopo: allenati, riposa o esci." />
      <Button variant="primary" size="lg" block className="mt-auto !h-16" onClick={onExit}>
        Continua
      </Button>
    </div>
  );
}
