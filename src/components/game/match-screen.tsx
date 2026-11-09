"use client";

import clsx from "clsx";
import { SkipForward } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Character } from "@/components/character";
import { Button } from "@/components/ui/basics";
import { crowdLevel, play, startCrowd, stopCrowd } from "@/lib/sound";
import { DAY_NAMES, LEVELS, dow, fmtEuro, teamStrength } from "@/lib/game/economy";
import { AttackAction, CommentaryCourt, DefenseAction, DriveDefense, LayupAction, SaveAction, teamKit, useMyKit } from "./action";
import { GameScreen, Stage, useStage } from "./arena";
import { wideCam } from "@/lib/game/camera";
import {
  DIFF,
  coachRel,
  commentary,
  finishMatch,
  planMatch,
  simMoment,
  type MatchOutcome,
  type MatchPlan,
  type MomentResult,
} from "@/lib/game/match";
import {
  applyMoment,
  clockLabel,
  nextStep,
  rosters,
  runToEnd,
  simulateMatch,
  startLive,
  type FeedLine,
  type LiveState,
  type Rosters,
} from "@/lib/game/live";
import { applyMatch, SKILL_NAMES } from "@/lib/game/state";
import { gapNote, standings, teamMood } from "@/lib/game/career";
import { unreadCount } from "@/lib/game/messages";
import type { Difficulty, GameState, Moment, Skill } from "@/lib/game/types";
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
  const { game, update, me } = useGame();
  const match = game.season.matches[index];
  const [diff, setDiff] = useState<Difficulty>(savedDiff);
  const [phase, setPhase] = useState<"pre" | "play" | "sim" | "end">(match?.result ? "end" : "pre");
  const [plan, setPlan] = useState<MatchPlan | null>(null);
  const [outcome, setOutcome] = useState<MatchOutcome | null>(null);
  // Lo stato com'era prima della partita: per il resoconto (abilità salite…).
  const [before, setBefore] = useState<GameState>(game);
  const myName = me.nickname ?? me.firstName;

  const start = (simulated: boolean) => {
    try {
      localStorage.setItem(DIFF_KEY, diff);
    } catch {
      /* niente */
    }
    setBefore(game);
    if (!simulated) setPlan(planMatch(game, match, diff, Math.random));
    play("whistle");
    setPhase(simulated ? "sim" : "play");
  };

  const finish = useCallback(
    (p: MatchPlan, results: MomentResult[], st: LiveState, simulated: boolean) => {
      const o = finishMatch(before, p, results, { us: st.us, them: st.them, ast: st.extra.ast, reb: st.extra.reb }, diff, simulated, Math.random);
      setOutcome(o);
      update((s) => applyMatch(s, index, o, Date.now(), Math.random));
      play(o.result.us > o.result.them ? "win" : "loss");
      setPhase("end");
    },
    [diff, update, index, before],
  );
  const onLiveEnd = useCallback(
    (results: MomentResult[], st: LiveState, simulated: boolean) => {
      if (plan) finish(plan, results, st, simulated);
    },
    [plan, finish],
  );
  const onSimEnd = useCallback((p: MatchPlan, results: MomentResult[], st: LiveState) => finish(p, results, st, true), [finish]);

  if (!match) return null;

  if (phase === "pre")
    return <PreMatch game={game} index={index} diff={diff} setDiff={setDiff} onPlay={() => start(false)} onSim={() => start(true)} onExit={onExit} />;
  if (phase === "play" && plan) return <LiveMatch game={before} plan={plan} diff={diff} myName={myName} onEnd={onLiveEnd} />;
  if (phase === "sim") return <SimMatch game={before} match={match} diff={diff} myName={myName} onEnd={onSimEnd} />;
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

/** Il palazzetto sullo sfondo, vuoto e in penombra: per le schermate prima e dopo la partita. */
function ArenaBackdrop({ home, away, seed }: { home: string; away: string; seed: string }) {
  const { ref: stageRef, ...stage } = useStage();
  const cam = useMemo(() => (stage.w && stage.h ? wideCam(stage.w, stage.h) : null), [stage.w, stage.h]);
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col opacity-60" aria-hidden>
      <Stage stageRef={stageRef} cam={cam} home={home} away={away} seed={seed} swish={false} />
    </div>
  );
}

function TeamLine({ name, kit, ours }: { name: string; kit: { jersey: string; trim: string }; ours: boolean }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <span className="h-10 w-8 shrink-0 rounded-[7px] border-[3px]" style={{ background: kit.jersey, borderColor: kit.trim, boxShadow: "2px 2px 0 #1d1a16" }} aria-hidden />
      <p className={clsx("display min-w-0 text-[27px] leading-tight", ours ? "text-[#FFF8EA]" : "text-[#FFF8EA]/85")} style={{ textShadow: "2px 2px 0 #1d1a16" }}>
        {name}
      </p>
    </div>
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
  const { charId } = useGame();
  const m = game.season.matches[index];
  const lv = LEVELS[game.contract.level];
  const us = game.contract.team;
  const usKit = useMyKit(game, charId);
  const themKit = useMemo(() => teamKit(m.opponent, usKit.jersey), [m.opponent, usKit.jersey]);
  const strength = teamStrength(m.opponent);
  const coach = coachRel(game);
  const warn: string[] = [];
  if (game.energy < 15) warn.push("Sei distrutto: parti dalla panchina e il verde è molto più stretto");
  else if (game.energy < 30) warn.push("Sei stanco: il verde è più stretto");
  if (game.happiness < 30) warn.push("Sei giù di morale: giochi peggio");
  if (coach <= -50) warn.push("Il coach ce l'ha con te: parti dalla panchina");
  else if (coach <= -20) warn.push("Il coach non si fida: giocherai meno palloni");
  const homeT = { name: m.home ? us : m.opponent, kit: m.home ? usKit : themKit, ours: m.home };
  const awayT = { name: m.home ? m.opponent : us, kit: m.home ? themKit : usKit, ours: !m.home };
  return (
    <GameScreen
      testId="pre-match"
      onClose={onExit}
      hud={
        <p className="truncate text-[13px] font-bold text-[#FFF8EA]/85">
          {lv.name} · giornata {index + 1} di {game.season.matches.length} · {DAY_NAMES[dow(m.day)]}
        </p>
      }
    >
      <ArenaBackdrop home={usKit.jersey} away={themKit.jersey} seed={us} />
      <div className="absolute inset-0 flex flex-col gap-4 overflow-y-auto bg-gradient-to-b from-[#0d1124]/40 via-[#0d1124]/30 to-[#0d1124] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-6 [&>*]:shrink-0">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <TeamLine {...homeT} />
          <p className="display text-[20px] text-volt" style={{ textShadow: "2px 2px 0 #1d1a16" }}>
            contro
          </p>
          <TeamLine {...awayT} />
          <p className="mt-2 rounded-full bg-[#1d1a16]/70 px-3 py-1 text-[13px] font-semibold text-[#FFF8EA]">
            {lv.format} · {strength > 1.07 ? "avversari forti" : strength < 0.93 ? "avversari alla portata" : "avversari normali"}
          </p>
        </div>

        <div className="flex-1" />

        {warn.length > 0 && (
          <div className="card flex flex-col gap-1 bg-gold-soft px-4 py-3 text-[14px] font-semibold text-text">
            {warn.map((w) => (
              <p key={w}>⚠️ {w}</p>
            ))}
          </div>
        )}

        <div>
          <p className="mb-2 px-1 text-[13px] font-bold text-[#FFF8EA]/80">Difficoltà</p>
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
                className={clsx("press sticker flex flex-col items-center rounded-2xl px-1 py-3", diff === d ? "bg-volt text-volt-ink" : "bg-surface text-text")}
              >
                <span className="display text-[clamp(16px,4.8vw,19px)]">{DIFF[d].name}</span>
                <span className="mt-1 text-[12px] font-semibold opacity-80">premi ×{String(DIFF[d].prize).replace(".", ",")}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 px-1 text-[13px] text-[#FFF8EA]/75">{DIFF[diff].line}</p>
        </div>

        <div className="flex flex-col gap-2">
          <Button variant="primary" size="lg" block className="!h-16 display !text-[24px]" onClick={onPlay}>
            Gioca
          </Button>
          <Button variant="secondary" block onClick={onSim} sound="tap">
            Simula
          </Button>
          <p className="text-center text-[12.5px] text-[#FFF8EA]/70">Simulando prendi metà premio e niente gettone per le sfide</p>
        </div>
      </div>
    </GameScreen>
  );
}

type Feedback = { big: string; line: string; good: boolean };

/** Il momento è andato bene? */
const isGood = (r: MomentResult) =>
  r.kind === "tiro" ? r.made : r.kind === "passaggio" ? r.ok && r.made : r.kind === "difesa" ? r.ok : false;

function feedbackOf(r: MomentResult): Feedback {
  const line = commentary(r, Math.random);
  switch (r.kind) {
    case "tiro":
      return {
        big: r.shot === "terzo" && r.outcome === "fuori" ? "PASSI!" : r.made ? (r.outcome === "verde" ? "CIUFF!" : "DENTRO!") : r.outcome === "fuori" ? "MATTONE" : "FERRO!",
        line,
        good: r.made,
      };
    case "passaggio":
      return { big: !r.ok ? "PALLA PERSA" : r.made ? "ASSIST!" : "SBAGLIA LUI", line, good: r.ok && r.made };
    case "difesa":
      return {
        big: r.ok ? (r.action === "rubata" ? "RUBATA!" : r.action === "salvataggio" ? "SALVATA!" : "STOPPATA!") : r.action === "salvataggio" ? "FUORI!" : "CANESTRO LORO",
        line,
        good: r.ok,
      };
    case "fallo":
      return { big: r.ftMade === 0 ? "0 SU 2!" : `${r.ftMade} SU 2`, line, good: r.ftMade === 0 };
    default:
      return { big: "", line, good: false };
  }
}

function situation(m: Moment): string {
  if (m.kind === "difesa")
    return m.action === "rubata"
      ? "Difesa: rubagli palla!"
      : m.action === "stoppata"
        ? "Difesa: stoppalo!"
        : m.action === "penetrazione"
          ? "Va a canestro: fallo o stoppata?"
          : "Palla vagante verso la linea!";
  if (m.shot === "terzo") return "Strada aperta: terzo tempo!";
  if (m.open) return m.shot === "tripla" ? "Sei libero da tre!" : m.shot === "sotto" ? "Strada libera fino a canestro!" : "Libero dalla media!";
  return m.shot === "tripla" ? "Marcato stretto, da tre" : m.shot === "sotto" ? "Sotto canestro, con l'uomo addosso" : "Marcato stretto, dalla media";
}

/** Le tue cifre durante la partita: i tuoi momenti più assist e rimbalzi raccontati. */
function myLine(results: MomentResult[], st: LiveState) {
  let pts = 0;
  let ast = st.extra.ast;
  let def = 0;
  for (const r of results) {
    if (r.kind === "tiro") pts += r.pts;
    if (r.kind === "passaggio" && r.ok && r.made) ast++;
    if (r.kind === "difesa" && r.ok) {
      def++;
      if (r.fastBreak) pts += 2;
    }
  }
  return { pts, ast, reb: st.extra.reb, def };
}

type Kit = { jersey: string; trim: string };

/** Il tabellone in alto: squadre, punteggio, tempo e inerzia. */
function Scoreboard({
  names,
  st,
  home,
  usKit,
  themKit,
  mine,
}: {
  names: Rosters;
  st: LiveState;
  home: boolean;
  usKit: Kit;
  themKit: Kit;
  mine: ReturnType<typeof myLine>;
}) {
  const us = { name: names.usTeam, pts: st.us, kit: usKit, ours: true };
  const them = { name: names.themTeam, pts: st.them, kit: themKit, ours: false };
  const [l, r] = home ? [us, them] : [them, us];
  // L'inerzia: verso la squadra che sta girando meglio.
  const lean = (home ? 1 : -1) * st.momentum;
  const cell = (t: typeof us, right: boolean) => (
    <div className={clsx("flex min-w-0 flex-1 items-center gap-2", right && "flex-row-reverse text-right")}>
      <span className="h-7 w-5 shrink-0 rounded-[5px] border-2" style={{ background: t.kit.jersey, borderColor: t.kit.trim }} aria-hidden />
      <p className={clsx("line-clamp-2 min-w-0 flex-1 text-[12px] font-bold leading-[1.15]", t.ours ? "text-[#FFF8EA]" : "text-[#FFF8EA]/70")}>{t.name}</p>
      <span key={t.pts} className="score game-pop shrink-0 text-center text-[30px] leading-none text-[#FFF8EA]" data-testid={t.ours ? "live-us" : "live-them"}>
        {t.pts}
      </span>
    </div>
  );
  return (
    <div className="shrink-0 bg-[#1d1a16] px-3 pb-2 pt-[max(8px,env(safe-area-inset-top))] text-[#FFF8EA]">
      <div className="flex items-center gap-2">
        {cell(l, false)}
        <span className="num shrink-0 rounded-full bg-volt px-2.5 py-1 text-[13px] text-volt-ink" data-testid="live-clock">
          {st.size === 3 ? "ai 21" : clockLabel(st)}
        </span>
        {cell(r, true)}
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[11.5px] font-semibold text-[#FFF8EA]/75">
        <span className="num truncate">
          Tu {mine.pts} pt · {mine.ast} ass · {mine.reb} rimb{mine.def ? ` · ${mine.def} dif` : ""}
          {st.onFire && <span className="ml-1 text-volt">🔥 in fiamme</span>}
          {st.benched && <span className="ml-1 text-danger">in panchina</span>}
        </span>
        <span className="flex-1" />
        <span className="shrink-0">Inerzia</span>
        <span className="relative h-2 w-20 shrink-0 overflow-hidden rounded-full bg-[#FFF8EA]/15" aria-hidden>
          <span className="absolute left-1/2 top-0 h-full w-px bg-[#FFF8EA]/50" />
          <span
            className="absolute top-0 h-full transition-all duration-700"
            style={{
              left: lean < 0 ? `${50 + (lean / 2) * 50}%` : "50%",
              width: `${(Math.abs(lean) / 2) * 50}%`,
              background: (lean < 0) === home ? themKit.jersey : usKit.jersey,
            }}
          />
        </span>
      </div>
    </div>
  );
}

function FeedList({ feed, max = 7 }: { feed: FeedLine[]; max?: number }) {
  const lines = feed.slice(-max).reverse();
  const first = feed.length - 1;
  return (
    <ol className="flex flex-col gap-1" aria-live="polite" data-testid="live-feed">
      {lines.map((f, k) => (
        <li
          key={first - k}
          className={clsx(
            "flex items-baseline gap-2 text-[13.5px] leading-snug",
            k === 0 ? "fade-in" : "opacity-70",
            f.kind === "period" || f.kind === "end" ? "font-bold text-volt" : f.mine ? "font-bold text-volt" : f.side === "us" && f.pts ? "text-[#FFF8EA]" : "text-[#FFF8EA]/80",
          )}
        >
          <span className="num w-[52px] shrink-0 text-[11px] text-[#FFF8EA]/55">{f.clock}</span>
          <span className="min-w-0 flex-1">
            {f.text}
            {f.pts > 0 && f.side && <span className={clsx("num ml-1.5 text-[12px]", f.side === "us" ? "text-ok" : "text-danger")}>+{f.pts}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

type Mode = "feed" | "intro" | "moment" | "feedback" | "end";
type Cur = { index: number; moment: Moment; clutch: boolean };

/**
 * La partita dal vivo: la telecronaca racconta le azioni degli altri nel palazzetto, e
 * quando tocca a te si torna in campo. Più giochi bene, più palloni ti arrivano.
 */
function LiveMatch({
  game,
  plan,
  diff,
  myName,
  onEnd,
}: {
  game: GameState;
  plan: MatchPlan;
  diff: Difficulty;
  myName: string;
  onEnd: (results: MomentResult[], st: LiveState, simulated: boolean) => void;
}) {
  const { charId } = useGame();
  const names = useMemo(() => rosters(game, myName, plan.opponent, plan.size), [game, myName, plan]);
  const usKit = useMyKit(game, charId);
  const themKit = useMemo(() => teamKit(plan.opponent, usKit.jersey), [plan.opponent, usKit.jersey]);
  const [st, setSt] = useState<LiveState>(() => startLive(plan, Math.random));
  const [mode, setMode] = useState<Mode>("feed");
  const [cur, setCur] = useState<Cur | null>(null);
  const [line, setLine] = useState<FeedLine | null>(null);
  const [results, setResults] = useState<MomentResult[]>([]);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [speed, setSpeed] = useState<1 | 3>(1);
  const [confirmSim, setConfirmSim] = useState(false);
  const mine = myLine(results, st);
  const moreForMe = !st.benched && st.done < st.planned;

  // Il pubblico in sottofondo per tutta la partita.
  useEffect(() => {
    startCrowd(0.3);
    return () => stopCrowd();
  }, []);
  useEffect(() => {
    const hot = mode === "intro" || mode === "moment" ? (cur?.clutch ? 0.45 : 0.15) : 0;
    crowdLevel(mode === "end" ? 0.9 : 0.3 + Math.abs(st.momentum) * 0.12 + hot);
  }, [st.momentum, mode, cur]);

  /** Una riga nuova: in campo e nei suoni. */
  const show = useCallback((f: FeedLine) => {
    setLine(f);
    if (f.kind === "score") play(f.side === "us" ? (f.pts >= 3 ? "roar" : "cheer") : "swish");
    else if (f.kind === "miss") play(f.mine ? "cheer" : "rim");
    else if (f.kind === "turnover") play("squeak");
    else if (f.kind === "period") play("buzzer");
  }, []);

  const toMoment = useCallback((c: Cur) => {
    setCur(c);
    setMode("intro");
    play(c.clutch ? "heartbeat" : "whistle");
  }, []);

  // La cronaca va avanti da sola, riga dopo riga.
  useEffect(() => {
    if (mode !== "feed" || st.over) return;
    const last = st.feed.at(-1);
    const wait = !last ? 1000 : (last.kind === "period" || last.big ? 2600 : last.pts >= 3 ? 2000 : 1650) / speed;
    const t = window.setTimeout(() => {
      const n = nextStep(st, plan, names, Math.random);
      setSt(n.st);
      if (n.step.kind === "line") {
        show(n.step.line);
        if (n.st.over) setMode("end");
      } else if (n.step.kind === "moment") toMoment(n.step);
      else setMode("end");
    }, wait);
    return () => window.clearTimeout(t);
  }, [mode, st, speed, plan, names, show, toMoment]);

  // "Tocca a te": un attimo per prepararsi, poi in campo.
  useEffect(() => {
    if (mode !== "intro") return;
    const t = window.setTimeout(() => setMode("moment"), cur?.clutch ? 2100 : 1600);
    return () => window.clearTimeout(t);
  }, [mode, cur]);

  // Il resoconto della tua giocata resta un attimo, poi riprende la cronaca.
  const resume = useCallback(() => {
    setFb(null);
    setMode(st.over ? "end" : "feed");
  }, [st.over]);
  useEffect(() => {
    if (mode !== "feedback") return;
    const t = window.setTimeout(resume, 1700);
    return () => window.clearTimeout(t);
  }, [mode, resume]);

  // Fine partita: sirena, il pubblico, poi il resoconto.
  const final = useRef<{ results: MomentResult[]; st: LiveState }>({ results, st });
  useEffect(() => {
    final.current = { results: st.benched ? [...results, { kind: "panchina" }] : results, st };
  }, [results, st]);
  useEffect(() => {
    if (mode !== "end") return;
    play("buzzer");
    const t = window.setTimeout(() => onEnd(final.current.results, final.current.st, false), 2600);
    return () => window.clearTimeout(t);
  }, [mode, onEnd]);

  const onResult = (r: MomentResult) => {
    const s2 = applyMoment(st, plan, names, r, Math.random);
    setResults((rs) => [...rs, r]);
    setSt(s2);
    setLine(s2.feed.at(-1) ?? null);
    setFb(feedbackOf(r));
    setMode("feedback");
    play(isGood(r) ? (r.kind === "tiro" && r.pts === 3 ? "roar" : "cheer") : "groan");
    if (s2.benched) setSpeed(3);
  };

  /** Salta la cronaca fino al tuo prossimo momento (o alla fine). */
  const skip = () => {
    if (mode !== "feed") return;
    play("tap");
    let s = st;
    let last: FeedLine | null = null;
    for (let guard = 0; guard < 600 && !s.over; guard++) {
      const n = nextStep(s, plan, names, Math.random);
      if (n.step.kind === "line") {
        s = n.st;
        last = n.step.line;
        continue;
      }
      if (n.step.kind === "moment") {
        setSt(n.st);
        if (last) setLine(last);
        toMoment(n.step);
        return;
      }
      s = { ...n.st, over: true };
    }
    setSt(s);
    if (last) setLine(last);
    setMode("end");
  };

  /** Esci: il resto lo gioca il computer (metà premio, come Simula). */
  const simRest = () => {
    if (!confirmSim) {
      setConfirmSim(true);
      window.setTimeout(() => setConfirmSim(false), 3500);
      return;
    }
    const run = runToEnd(st, plan, names, (m) => simMoment(game, m, diff, Math.random), Math.random);
    const all = [...results, ...run.results];
    onEnd(run.st.benched ? [...all, { kind: "panchina" }] : all, run.st, true);
  };

  const inAction = (mode === "moment" || mode === "feedback") && cur;
  const m = cur?.moment;

  return (
    <div className="fixed inset-0 z-[66] bg-[#0d1124]" data-testid="live-match">
      <div className="mx-auto flex h-full max-w-lg flex-col">
        <Scoreboard names={names} st={st} home={plan.home} usKit={usKit} themKit={themKit} mine={mine} />

        <div className="relative min-h-0 flex-1" onClick={mode === "feedback" ? resume : mode === "intro" ? () => setMode("moment") : undefined}>
          {inAction && m ? (
            m.kind === "attacco" && m.shot === "terzo" ? (
              <LayupAction
                key={`l${cur.index}`}
                seed={cur.index + st.seed}
                game={game}
                diff={diff}
                size={plan.size}
                opponent={plan.opponent}
                locked={mode === "feedback"}
                onResult={onResult}
              />
            ) : m.kind === "difesa" && (m.action === "penetrazione" || m.action === "salvataggio") ? (
              (() => {
                const Scene = m.action === "penetrazione" ? DriveDefense : SaveAction;
                return (
                  <Scene
                    key={`${m.action}${cur.index}`}
                    seed={cur.index + st.seed}
                    game={game}
                    diff={diff}
                    size={plan.size}
                    opponent={plan.opponent}
                    locked={mode === "feedback"}
                    onResult={onResult}
                  />
                );
              })()
            ) : m.kind === "attacco" ? (
              <AttackAction
                key={`a${cur.index}`}
                seed={cur.index + st.seed}
                game={game}
                diff={diff}
                size={plan.size}
                opponent={plan.opponent}
                shot={m.shot}
                open={m.open}
                onFire={st.onFire}
                locked={mode === "feedback"}
                onResult={onResult}
              />
            ) : (
              <DefenseAction
                key={`d${cur.index}`}
                seed={cur.index + st.seed}
                game={game}
                diff={diff}
                size={plan.size}
                opponent={plan.opponent}
                action={m.action === "stoppata" ? "stoppata" : "rubata"}
                locked={mode === "feedback"}
                onResult={onResult}
              />
            )
          ) : (
            <div className="absolute inset-0 flex flex-col">
              <CommentaryCourt
                game={game}
                size={plan.size}
                opponent={plan.opponent}
                names={names}
                line={line}
                poss={st.poss}
                hype={mode === "end" ? st.us > st.them : false}
              />
              {/* la riga di cronaca in sovrimpressione, come in tv */}
              {line && mode !== "intro" && (
                <div key={st.feed.length} className="toast-in pointer-events-none absolute inset-x-3 bottom-3 z-[970] flex items-center gap-2 rounded-2xl border-[2.5px] border-[#1d1a16] bg-[#FFF8EA] px-3 py-2 text-[#1d1a16] shadow-[3px_3px_0_#1d1a16]">
                  {line.side && line.pts > 0 && (
                    <span
                      className="num grid h-9 min-w-9 shrink-0 place-items-center rounded-lg border-2 border-[#1d1a16] px-1 text-[17px]"
                      style={{ background: (line.side === "us" ? usKit : themKit).jersey, color: (line.side === "us" ? usKit : themKit).trim }}
                    >
                      +{line.pts}
                    </span>
                  )}
                  <p className={clsx("min-w-0 flex-1 text-[14.5px] leading-snug", line.mine || line.big ? "font-bold" : "font-semibold")}>{line.text}</p>
                </div>
              )}
              {mode === "intro" && m && (
                <div className="absolute inset-0 z-[980] grid place-items-center bg-[#0d1124]/70 px-6 text-center" data-testid="live-intro">
                  <div>
                    {cur?.clutch && <p className="num mx-auto mb-2 w-fit rounded-full bg-danger px-3 py-1 text-[14px] text-white">Palla decisiva</p>}
                    <p className="display game-pop text-[54px] leading-none text-volt" style={{ WebkitTextStroke: "2px #1d1a16", textShadow: "4px 4px 0 #1d1a16" }}>
                      Tocca a te!
                    </p>
                    <p className="mt-3 text-[18px] font-bold text-[#FFF8EA]">{situation(m)}</p>
                    <p className="num mt-1 text-[13px] text-[#FFF8EA]/70">{m.clock}</p>
                    <p className="mt-4 text-[13.5px] font-semibold text-[#FFF8EA]/85">
                      {m.kind === "attacco"
                        ? m.shot === "terzo"
                          ? "Due passi a ritmo: tocca Passo quando il cerchio si chiude"
                          : "Tieni premuto Tira e lascia sul verde, oppure Passa"
                        : m.action === "penetrazione"
                          ? "Fallo subito (va in lunetta) o Stoppa quando salta"
                          : m.action === "salvataggio"
                            ? "Tocca Tuffati quando il cerchio si chiude sulla linea"
                            : "Tocca quando il cerchio si chiude sul pallone"}
                    </p>
                  </div>
                </div>
              )}
              {mode === "end" && (
                <div className="absolute inset-0 z-[980] grid place-items-center bg-[#0d1124]/55 px-6 text-center">
                  <p className="display game-pop text-[50px] leading-none text-[#FFF8EA]" style={{ WebkitTextStroke: "2px #1d1a16", textShadow: "4px 4px 0 #1d1a16" }}>
                    {st.us > st.them ? "Vittoria!" : "Sconfitta"}
                  </p>
                </div>
              )}
            </div>
          )}
          {fb && (
            <div className="pointer-events-none absolute inset-x-0 top-[30%] z-[990] flex flex-col items-center px-4 text-center">
              <p
                className={clsx("display game-pop text-[48px] leading-none", fb.good ? "text-volt" : "text-white")}
                style={{ WebkitTextStroke: "2px #1d1a16", textShadow: "3px 3px 0 #1d1a16" }}
              >
                {fb.big}
              </p>
              <p className="mt-2 rounded-full bg-[#1d1a16]/75 px-3 py-1 text-[14px] font-semibold text-white">{fb.line}</p>
              {st.onFire && fb.good && <p className="num mt-2 rounded-full bg-volt px-3 py-1 text-[14px] text-volt-ink">🔥 In fiamme: verde più largo</p>}
            </div>
          )}
        </div>

        {!inAction && (
          <>
            <div className="h-[118px] shrink-0 overflow-hidden bg-[#141936] px-3 py-2 [mask-image:linear-gradient(#000_70%,transparent)]">
              <FeedList feed={st.feed} />
            </div>
            <div className="flex shrink-0 gap-2 bg-[#0d1124] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
              <button
                type="button"
                onClick={() => {
                  play("select");
                  setSpeed((v) => (v === 1 ? 3 : 1));
                }}
                aria-label={speed === 1 ? "Cronaca veloce" : "Cronaca normale"}
                aria-pressed={speed === 3}
                className={clsx("press sticker-sm num grid h-14 w-14 shrink-0 place-items-center rounded-full text-[17px]", speed === 3 ? "bg-volt text-volt-ink" : "bg-surface")}
                data-testid="live-speed"
              >
                ×{speed}
              </button>
              <button
                type="button"
                onClick={skip}
                disabled={mode !== "feed"}
                className="press sticker-sm display flex h-14 min-w-0 flex-1 items-center justify-center gap-1 rounded-full bg-court px-2 text-[15.5px] text-court-ink disabled:opacity-50"
                data-testid="live-skip"
              >
                <SkipForward size={18} className="shrink-0" />
                <span className="truncate">{moreForMe ? "Al tuo turno" : "Vai al finale"}</span>
              </button>
              <button
                type="button"
                onClick={simRest}
                disabled={mode === "end"}
                className={clsx(
                  "press sticker-sm h-14 w-[92px] shrink-0 rounded-full px-2 text-[12.5px] font-bold leading-tight disabled:opacity-50",
                  confirmSim ? "bg-danger text-white" : "bg-surface",
                )}
                data-testid="live-sim-rest"
              >
                {confirmSim ? "Metà premio: ok?" : "Simula il resto"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Simula: la cronaca scorre veloce fino al risultato. */
function SimMatch({
  game,
  match,
  diff,
  myName,
  onEnd,
}: {
  game: GameState;
  match: { opponent: string; home: boolean };
  diff: Difficulty;
  myName: string;
  onEnd: (plan: MatchPlan, results: MomentResult[], st: LiveState) => void;
}) {
  const { charId } = useGame();
  const [sim] = useState(() => {
    const r = simulateMatch(game, match, diff, myName, Math.random);
    return { ...r, results: r.st.benched ? [...r.results, { kind: "panchina" } as MomentResult] : r.results };
  });
  const usKit = useMyKit(game, charId);
  const themKit = useMemo(() => teamKit(match.opponent, usKit.jersey), [match.opponent, usKit.jersey]);
  const [shown, setShown] = useState(0);
  const all = sim.st.feed;
  const done = shown >= all.length;
  useEffect(() => {
    if (done) {
      const t = window.setTimeout(() => onEnd(sim.plan, sim.results, sim.st), 900);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      setShown((n) => n + 1);
      const f = all[shown];
      if (f.kind === "score" && f.side === "us") play("tick");
    }, 110);
    return () => window.clearTimeout(t);
  }, [shown, done, all, sim, onEnd]);
  const last = all[Math.max(0, Math.min(shown, all.length) - 1)];
  const st: LiveState = { ...sim.st, us: last?.us ?? 0, them: last?.them ?? 0, feed: all.slice(0, shown), onFire: false, benched: false };
  return (
    <div className="fixed inset-0 z-[66] bg-[#0d1124]" onClick={() => setShown(all.length)} data-testid="sim-match">
      <div className="mx-auto flex h-full max-w-lg flex-col">
        <Scoreboard names={sim.names} st={st} home={match.home} usKit={usKit} themKit={themKit} mine={myLine(sim.results, sim.st)} />
        <div className="min-h-0 flex-1 overflow-hidden px-3 py-3">
          <p className="display pb-2 text-[22px] text-[#FFF8EA]">Simulazione</p>
          <FeedList feed={st.feed} max={18} />
        </div>
        <p className="shrink-0 pb-[max(14px,env(safe-area-inset-bottom))] text-center text-[13px] text-[#FFF8EA]/70">Tocca per arrivare al risultato</p>
      </div>
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
    <GameScreen testId="match-summary" onClose={onExit} hud={<p className="display truncate text-[19px]">Fine partita</p>}>
    <div className="absolute inset-0 flex flex-col gap-3 overflow-y-auto px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 text-text [&>*]:shrink-0">
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
        {teamMood(after) !== teamMood(before) && (
          <p>
            🤝 Morale della squadra: <b>{teamMood(after) > teamMood(before) ? "+" : ""}{teamMood(after) - teamMood(before)}</b>
          </p>
        )}
        {after.club !== before.club && (
          <p>
            🏢 Società: <b>{after.club > before.club ? "+" : ""}{after.club - before.club}</b>
          </p>
        )}
        {(() => {
          const t = standings(after);
          const i = t.findIndex((r) => r.me);
          return t[i]?.played ? <p>📊 In classifica: <b>{i + 1}°</b> · {gapNote(t)}</p> : null;
        })()}
        {newMsgs > 0 && <p>📱 {newMsgs === 1 ? "Un messaggio nuovo" : `${newMsgs} messaggi nuovi`} sul telefono</p>}
        {after.offers.length > 0 && before.offers.length === 0 && <p>📑 Fine stagione: guarda le offerte in Contratti</p>}
      </div>

      <Tip id="partita-fatta" text="Dopo la partita, dall'hub vai al giorno dopo: allenati, riposa o esci." />
      <Button variant="primary" size="lg" block className="mt-auto !h-16" onClick={onExit}>
        Continua
      </Button>
    </div>
    </GameScreen>
  );
}
