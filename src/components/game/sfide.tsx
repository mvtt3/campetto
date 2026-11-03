"use client";

import clsx from "clsx";
import { Crown } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button, haptic } from "@/components/ui/basics";
import { useData } from "@/lib/data/provider";
import type { GameKing } from "@/lib/data/backend";
import { play } from "@/lib/sound";
import { KING_PRIZE, LEVELS, TOKENS_MAX, TOKEN_MS, fmtEuro, miniReadyAt, startMini } from "@/lib/game/economy";
import { ZONE_CENTER } from "@/lib/game/match";
import {
  DUNKS,
  DUNK_STEPS,
  MINI,
  PER_RACK,
  RACKS,
  TRIPLE_SECONDS,
  TRIPLE_SWEEP,
  dunkScore,
  isMoneyBall,
  dunkStep,
  liberiLevel,
  liberiZone,
  liberiZoneAt,
  swayAt,
  tapQuality,
  tripleShot,
  tripleValue,
  tripleZone,
  type Dunk,
} from "@/lib/game/minigames";
import { MINIGAMES, type BoardRow, type MiniGame } from "@/lib/game/types";
import { shortName, type Player } from "@/lib/types";
import { DunkScene, FT_SPOT, RACK_SPOTS, SoloShot } from "./action";
import { GameScreen } from "./arena";
import { Ball } from "./scene";
import { useGame } from "./store";
import { Sheet, Tip, clockNow, useClock, useToast } from "./ui";

/** Le classifiche restano in memoria: riaprendo le sfide si vedono subito. */
let boardsCache: { rows: BoardRow[]; kings: GameKing[] } | null = null;

function useBoards() {
  const { backend } = useData();
  const [boards, setBoards] = useState(boardsCache);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    backend.loadGameBoards().then(
      (b) => {
        boardsCache = b;
        setBoards(b);
        setError(null);
      },
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    );
  }, [backend]);
  useEffect(load, [load]);
  const setMine = useCallback((game: MiniGame, playerId: string, best: number) => {
    setBoards((b) => {
      const rows = [...(b?.rows ?? [])];
      const i = rows.findIndex((r) => r.game === game && r.playerId === playerId);
      if (i < 0) rows.push({ game, playerId, best, at: new Date().toISOString() });
      else if (best > rows[i].best) rows[i] = { ...rows[i], best, at: new Date().toISOString() };
      const next = { rows, kings: b?.kings ?? [] };
      boardsCache = next;
      return next;
    });
  }, []);
  return { boards, error, reload: load, setMine };
}

/** Classifica di una sfida: record più alto, a pari punti chi ci è arrivato prima. */
export function ranking(rows: BoardRow[], game: MiniGame): BoardRow[] {
  return rows
    .filter((r) => r.game === game)
    .sort((a, b) => b.best - a.best || Date.parse(a.at) - Date.parse(b.at));
}

const EMOJI: Record<MiniGame, string> = { triple: "🏀", liberi: "🎯", schiacciate: "💥" };

export function Sfide({ playing, setPlaying }: { playing: MiniGame | null; setPlaying: (g: MiniGame | null) => void }) {
  const { game, update, me } = useGame();
  const { data } = useData();
  const toast = useToast();
  const { boards, error, setMine } = useBoards();
  const [full, setFull] = useState<MiniGame | null>(null);
  // Il prossimo gettone arriva 2 ore dopo l'ultimo conteggio.
  const until = game.tokens >= TOKENS_MAX ? null : Date.parse(game.tokensAt) + TOKEN_MS;
  const clock = useClock(until);
  const prize = KING_PRIZE * LEVELS[game.contract.level].mult;
  const players = useMemo(() => new Map(data.players.map((p) => [p.id, p])), [data.players]);

  const start = (g: MiniGame) => {
    const now = clockNow();
    if (miniReadyAt(game, g, now) !== null) {
      toast("Questa sfida l'hai già fatta: aspetta che finisca il conto alla rovescia", "bad");
      return;
    }
    const r = startMini(game, g, now);
    if (!r) {
      toast("Niente gettoni: se ne ricarica uno ogni 2 ore", "bad");
      return;
    }
    update(() => r);
    play("whistle");
    setPlaying(g);
  };

  if (playing)
    return (
      <MiniPlay
        g={playing}
        onExit={() => setPlaying(null)}
        onAgain={() => start(playing)}
        rows={boards?.rows ?? []}
        onBest={(best) => setMine(playing, me.id, best)}
        players={players}
      />
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto [&>*]:shrink-0 px-4 pb-6">
      <div className="card flex items-center gap-3 bg-volt px-4 py-3 text-volt-ink">
        <span className="text-[30px]">🎟️</span>
        <div className="min-w-0 flex-1">
          <p className="num text-[26px] leading-none" data-testid="tokens">
            {game.tokens}/{TOKENS_MAX}
          </p>
          <p className="text-[13px] font-semibold">
            {game.tokens >= TOKENS_MAX ? "Gettoni pieni" : `Il prossimo tra ${clock}`} · +1 per ogni partita giocata
          </p>
        </div>
      </div>
      <Tip id="sfide" />
      <p className="px-1 text-[13.5px] text-muted">
        A mezzanotte chi è primo in una classifica vince <b>{fmtEuro(prize)}</b>. Primo in tutte e tre: anche la corona.
      </p>
      {error && !boards && <p className="card px-4 py-3 text-[14px] text-danger">Classifiche non raggiungibili: {error}</p>}
      {MINIGAMES.map((g) => {
        const rank = ranking(boards?.rows ?? [], g);
        const myPos = rank.findIndex((r) => r.playerId === me.id);
        const king = boards?.kings.find((k) => k.game === g);
        return (
          <div key={g} className="card overflow-hidden" data-testid={`sfida-${g}`}>
            <div className="flex items-start gap-3 px-4 pb-2 pt-3">
              <span className="text-[34px] leading-none">{EMOJI[g]}</span>
              <div className="min-w-0 flex-1">
                <p className="display text-[22px] leading-tight">{MINI[g].name}</p>
                <p className="text-[13px] text-muted">{MINI[g].line}</p>
              </div>
              <div className="text-right">
                <p className="text-[11.5px] font-bold uppercase text-muted">Tuo record</p>
                <p className="num text-[24px]">{myPos >= 0 ? rank[myPos].best : "—"}</p>
                {myPos >= 0 && <p className="text-[12px] font-semibold text-muted">{myPos + 1}° posto</p>}
              </div>
            </div>
            <button onClick={() => setFull(g)} className="flex w-full flex-col gap-1 border-y-2 border-line bg-raised/50 px-4 py-2 text-left">
              {rank.slice(0, 3).map((r, k) => (
                <BoardLine key={r.playerId} pos={k + 1} row={r} p={players.get(r.playerId)} me={r.playerId === me.id} king={king?.playerId === r.playerId} />
              ))}
              {!rank.length && <p className="py-1 text-[13.5px] text-muted">Nessuno ha ancora giocato: il primo posto è libero</p>}
              {rank.length > 3 && <p className="text-[12.5px] font-semibold text-court">Tutta la classifica →</p>}
            </button>
            <div className="px-4 py-3">
              <PlayButton g={g} onPlay={() => start(g)} />
            </div>
          </div>
        );
      })}
      <Sheet open={!!full} onClose={() => setFull(null)} title={full ? MINI[full].name : ""}>
        {full && (
          <div className="flex flex-col gap-1">
            {ranking(boards?.rows ?? [], full).map((r, k) => (
              <BoardLine key={r.playerId} pos={k + 1} row={r} p={players.get(r.playerId)} me={r.playerId === me.id} king={boards?.kings.find((x) => x.game === full)?.playerId === r.playerId} />
            ))}
          </div>
        )}
      </Sheet>
    </div>
  );
}

/** Gioca, oppure il conto alla rovescia: ogni sfida si gioca una volta ogni 2 ore. */
function PlayButton({ g, onPlay, again = false }: { g: MiniGame; onPlay: () => void; again?: boolean }) {
  const { game } = useGame();
  const until = miniReadyAt(game, g, clockNow());
  const clock = useClock(until);
  const cooling = until !== null && clock !== "0:00";
  return (
    <Button
      variant={cooling ? "secondary" : "primary"}
      block
      size="lg"
      disabled={cooling || game.tokens <= 0}
      onClick={onPlay}
      data-testid={`play-${g}`}
    >
      {cooling ? (
        <span className="flex items-center gap-2">
          ⏳ Di nuovo tra <span className="num" data-testid={`cooldown-${g}`}>{clock}</span>
        </span>
      ) : again ? (
        `Ancora · 🎟️ 1 (${game.tokens} rimasti)`
      ) : (
        "Gioca · 🎟️ 1"
      )}
    </Button>
  );
}

function BoardLine({ pos, row, p, me, king }: { pos: number; row: BoardRow; p?: Player; me: boolean; king: boolean }) {
  return (
    <div className={clsx("flex items-center gap-2 rounded-xl px-1 py-1", me && "bg-volt/40")}>
      <span className="num w-6 text-center text-[16px]">{pos}</span>
      <Avatar player={p} size={30} href={false} ring="none" />
      <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">
        {p ? shortName(p) : "—"}
        {me && " (tu)"}
      </span>
      {king && (
        <span className="flex items-center gap-0.5 text-[11.5px] font-bold text-gold" title="Re di ieri">
          <Crown size={15} /> ieri
        </span>
      )}
      <span className="num text-[18px]">{row.best}</span>
    </div>
  );
}

function MiniPlay({
  g,
  onExit,
  onAgain,
  rows,
  onBest,
  players,
}: {
  g: MiniGame;
  onExit: () => void;
  onAgain: () => void;
  rows: BoardRow[];
  onBest: (best: number) => void;
  players: Map<string, Player>;
}) {
  const { backend } = useData();
  const { me } = useGame();
  const [score, setScore] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [saved, setSaved] = useState<"saving" | "ok" | "err">("saving");
  // Il record com'era prima di questo tentativo (la classifica si aggiorna subito dopo).
  const [before, setBefore] = useState<number | null>(null);
  const end = useCallback(
    (s: number) => {
      const prev = ranking(rows, g).find((r) => r.playerId === me.id)?.best ?? null;
      setBefore(prev);
      setScore(s);
      setSaved("saving");
      const isRecord = prev === null || s > prev;
      play(isRecord && s > 0 ? "win" : "success");
      backend.submitGameScore(g, s).then(
        (best) => {
          onBest(best);
          setSaved("ok");
        },
        () => setSaved("err"),
      );
    },
    [backend, g, rows, me.id, onBest],
  );
  if (score === null) {
    if (g === "triple") return <TripleGame key={round} onEnd={end} onQuit={onExit} />;
    if (g === "liberi") return <LiberiGame key={round} onEnd={end} onQuit={onExit} />;
    return <DunkGame key={round} onEnd={end} onQuit={onExit} />;
  }
  const rank = ranking(rows, g);
  const pos = rank.findIndex((r) => r.playerId === me.id);
  const record = before === null || score > before;
  const leader = rank[0];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto [&>*]:shrink-0 px-4 pb-6">
      <div className={clsx("card px-4 py-5 text-center", record && score > 0 ? "bg-ok text-white" : "bg-surface")}>
        <p className="text-[13px] font-bold uppercase tracking-wide opacity-80">{MINI[g].name}</p>
        <p className="score mt-1 text-[72px]" data-testid="mini-score">{score}</p>
        <p className="text-[15px] font-semibold">{MINI[g].unit}</p>
        <p className="display mt-2 text-[22px]">{record && score > 0 ? "Nuovo record!" : `Record: ${before}`}</p>
        {saved === "ok" && pos >= 0 && <p className="mt-1 text-[14.5px]">Sei {pos + 1}° in classifica</p>}
        {saved === "err" && <p className="mt-1 text-[14px]">Non sono riuscito a mandarlo in classifica</p>}
      </div>
      {leader && leader.playerId !== me.id && (
        <p className="px-1 text-center text-[14px] text-muted">
          In testa {shortName(players.get(leader.playerId))} con {leader.best}
        </p>
      )}
      <div className="mt-auto flex flex-col gap-2">
        <PlayButton
          g={g}
          again
          onPlay={() => {
            setScore(null);
            setRound((r) => r + 1);
            onAgain();
          }}
        />
        <p className="text-center text-[12.5px] text-muted">Ogni sfida si gioca una volta ogni 2 ore</p>
        <Button variant="secondary" block onClick={onExit}>
          Torna alle sfide
        </Button>
      </div>
    </div>
  );
}

function Countdown({ onGo, hint }: { onGo: () => void; hint?: string }) {
  const [n, setN] = useState(3);
  useEffect(() => {
    if (n === 0) {
      onGo();
      return;
    }
    const t = window.setTimeout(() => {
      setN((x) => x - 1);
      play("tick");
    }, 600);
    return () => window.clearTimeout(t);
  }, [n, onGo]);
  return (
    <div className="pointer-events-none absolute inset-0 z-[980] flex flex-col items-center justify-center bg-[#0d1124]/55 px-8 text-center">
      <p key={n} className="display game-pop text-[90px] text-volt" style={{ WebkitTextStroke: "3px #1d1a16" }}>
        {n || "Via!"}
      </p>
      {hint && <p className="mt-2 text-[15px] font-semibold text-[#FFF8EA]">{hint}</p>}
    </div>
  );
}

function TripleGame({ onEnd, onQuit }: { onEnd: (score: number) => void; onQuit: () => void }) {
  const { game } = useGame();
  const zone = tripleZone(game);
  const [ball, setBall] = useState(0);
  const [score, setScore] = useState(0);
  const [made, setMade] = useState<(boolean | null)[]>(() => Array(RACKS * PER_RACK).fill(null));
  const [go, setGo] = useState(false);
  const [left, setLeft] = useState(TRIPLE_SECONDS);
  const [over, setOver] = useState(false);
  const scoreRef = useRef(0);
  const finish = useCallback(() => {
    setOver((o) => {
      if (!o) window.setTimeout(() => onEnd(scoreRef.current), 400);
      return true;
    });
  }, [onEnd]);
  useEffect(() => {
    if (!go) return;
    const t0 = Date.now();
    const id = window.setInterval(() => {
      const l = TRIPLE_SECONDS - Math.floor((Date.now() - t0) / 1000);
      setLeft(Math.max(0, l));
      if (l <= 0) {
        window.clearInterval(id);
        finish();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [go, finish]);
  const judge = useCallback(
    (pos: number) => {
      const r = tripleShot(pos, ZONE_CENTER, zone, Math.random);
      const d = Math.abs(pos - ZONE_CENTER);
      return { made: r.made, outcome: (d <= zone / 2 ? "verde" : d <= zone ? "buono" : "fuori") as "verde" | "buono" | "fuori" };
    },
    [zone],
  );
  return (
    <GameScreen
      testId="mini-triple"
      onClose={onQuit}
      hud={
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <p className="flex items-baseline gap-1.5">
              <span className="score text-[30px] leading-none" data-testid="triple-score">{score}</span>
              <span className="text-[12px] font-semibold text-[#FFF8EA]/70">punti</span>
            </p>
            <p className={clsx("num rounded-full px-2.5 py-1 text-[16px]", left <= 10 ? "bg-danger text-white" : "bg-volt text-volt-ink")}>{left}&quot;</p>
          </div>
          <div className="grid grid-cols-5 gap-1" aria-label="I carrelli">
        {Array.from({ length: RACKS }, (_, r) => (
          <div key={r} className="flex justify-center gap-0.5 rounded-full border border-[#FFF8EA]/25 bg-[#FFF8EA]/10 px-1 py-1">
            {Array.from({ length: PER_RACK }, (_, k) => {
              const i = r * PER_RACK + k;
              return (
                <span
                  key={k}
                  className={clsx(
                    "h-2.5 w-2.5 rounded-full border border-[#1d1a16]",
                    made[i] === true ? "bg-ok" : made[i] === false ? "bg-[#FFF8EA]/30" : isMoneyBall(i) ? "bg-volt" : "bg-ball",
                    i === ball && go && "ring-2 ring-[#FFF8EA]",
                  )}
                />
              );
            })}
          </div>
        ))}
          </div>
        </div>
      }
    >
        <SoloShot
          spot={RACK_SPOTS[Math.floor(ball / PER_RACK)]}
          sweep={TRIPLE_SWEEP}
          zone={zone}
          fast
          disabled={!go || over}
          judge={judge}
          label={isMoneyBall(ball) ? "Vale doppio!" : `Carrello ${Math.floor(ball / PER_RACK) + 1} di ${RACKS}`}
          onShot={(r) => {
            const i = ball;
            scoreRef.current += tripleValue(i, r.made);
            setScore(scoreRef.current);
            setMade((m) => m.map((x, k) => (k === i ? r.made : x)));
            if (i + 1 >= RACKS * PER_RACK) finish();
            else setBall(i + 1);
          }}
          overlay={!go && <Countdown onGo={() => setGo(true)} hint={MINI.triple.how} />}
        />
    </GameScreen>
  );
}

function LiberiGame({ onEnd, onQuit }: { onEnd: (score: number) => void; onQuit: () => void }) {
  const { game } = useGame();
  const [streak, setStreak] = useState(0);
  const [go, setGo] = useState(false);
  const [over, setOver] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const base = liberiZone(game, streak);
  const { n, lv } = liberiLevel(streak);
  // Dal secondo livello in poi il verde si muove, respira, arriva il difensore, balla il canestro.
  const dyn = useMemo(
    () =>
      lv.move || lv.pulse || lv.defender || lv.sway
        ? {
            zoneAt: (t: number) => liberiZoneAt(base, lv, t),
            sway: lv.sway ? (t: number) => swayAt(lv, t) : undefined,
            defender: lv.defender,
          }
        : undefined,
    [base, lv],
  );
  const judge = useCallback(
    (pos: number) => {
      const { zone, center } = liberiZoneAt(base, lv, performance.now());
      const d = Math.abs(pos - center);
      const ok = d <= zone / 2;
      return { made: ok, outcome: (ok ? "verde" : d <= zone ? "buono" : "fuori") as "verde" | "buono" | "fuori" };
    },
    [base, lv],
  );
  return (
    <GameScreen
      testId="mini-liberi"
      onClose={onQuit}
      hud={
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="display text-[19px] leading-tight">Tiri liberi</p>
            <p className="truncate text-[12.5px] font-semibold text-volt" data-testid="liberi-level">
              Livello {n} · {lv.name}
            </p>
          </div>
          <p className="flex items-baseline gap-1.5">
            <span className="text-[12px] font-semibold text-[#FFF8EA]/70">di fila</span>
            <span className="score text-[32px] leading-none" data-testid="liberi-streak">{streak}</span>
          </p>
        </div>
      }
    >
      <SoloShot
        spot={FT_SPOT}
        sweep={lv.sweep}
        zone={base}
        dyn={dyn}
        disabled={!go || over}
        judge={judge}
        label="Tiro libero · 1 punto"
        onShot={(r) => {
          if (!r.made) {
            setOver(true);
            window.setTimeout(() => onEnd(streak), 500);
            return;
          }
          const next = liberiLevel(streak + 1);
          if (next.n > n) {
            setBanner(`Livello ${next.n}: ${next.lv.name}`);
            play("unlock");
            window.setTimeout(() => setBanner(null), 1800);
          }
          setStreak((s) => s + 1);
        }}
        overlay={
          <>
            {!go && <Countdown onGo={() => setGo(true)} hint={MINI.liberi.how} />}
            {banner && (
              <div className="pointer-events-none absolute inset-x-0 top-[22%] z-[985] flex justify-center px-6">
                <p
                  className="display game-pop rounded-2xl border-[3px] border-[#1d1a16] bg-volt px-4 py-2 text-center text-[24px] leading-tight text-volt-ink"
                  style={{ boxShadow: "4px 4px 0 #1d1a16" }}
                >
                  {banner}
                </p>
              </div>
            )}
          </>
        }
      />
    </GameScreen>
  );
}

function DunkGame({ onEnd, onQuit }: { onEnd: (score: number) => void; onQuit: () => void }) {
  const [dunk, setDunk] = useState<Dunk | null>(null);
  const [step, setStep] = useState(0);
  const [q, setQ] = useState<number[]>([]);
  const [judges, setJudges] = useState<number[] | null>(null);
  const [shown, setShown] = useState(0);
  const dot = useRef<HTMLDivElement>(null);
  const t0 = useRef<number | null>(null);
  const raf = useRef(0);
  const doneStep = useRef(false);

  const record = useCallback(
    (p: number | null) => {
      if (!dunk || doneStep.current) return;
      doneStep.current = true;
      cancelAnimationFrame(raf.current);
      const quality = tapQuality(p, dunkStep(dunk, q.length).win);
      play(quality > 0.6 ? "swish" : quality > 0 ? "bounce" : "error");
      const all = [...q, quality];
      setQ(all);
      if (all.length >= 3) {
        const r = dunkScore(all, dunk, Math.random);
        window.setTimeout(() => setJudges(r.judges), 500);
      } else window.setTimeout(() => setStep((s) => s + 1), 450);
    },
    [dunk, q],
  );

  useEffect(() => {
    if (!dunk || judges || step >= 3) return;
    doneStep.current = false;
    const startAt = performance.now() + 500;
    t0.current = null;
    const loop = () => {
      const now = performance.now();
      if (now >= startAt) {
        if (t0.current === null) t0.current = startAt;
        const p = (now - t0.current) / dunkStep(dunk, step).ms;
        if (p >= 1) {
          record(null);
          return;
        }
        if (dot.current) dot.current.style.left = `${p * 100}%`;
      } else if (dot.current) dot.current.style.left = "0%";
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [dunk, step, judges, record]);

  // I giudici alzano i cartelli uno alla volta.
  useEffect(() => {
    if (!judges) return;
    if (shown >= judges.length) {
      const t = window.setTimeout(() => onEnd(judges.reduce((a, b) => a + b, 0)), 900);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      setShown((n) => n + 1);
      play("tick");
    }, 380);
    return () => window.clearTimeout(t);
  }, [judges, shown, onEnd]);

  const tap = () => {
    if (t0.current === null) return;
    haptic(10);
    record((performance.now() - t0.current) / (dunk ? dunkStep(dunk, step).ms : 1));
  };

  if (!dunk)
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
        <p className="display text-[24px]">Che schiacciata fai?</p>
        <p className="text-[14px] text-muted">{MINI.schiacciate.how}</p>
        {DUNKS.map((d, k) => (
          <button
            key={d.id}
            onClick={() => {
              play("select");
              setDunk(d);
            }}
            className="press sticker flex items-center gap-3 rounded-2xl bg-surface px-4 py-4 text-left"
            data-testid={`dunk-${d.id}`}
          >
            <span className="text-[30px]">{["💪", "🌪️", "🌀"][k]}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-bold">{d.name}</span>
              <span className="block text-[13px] text-muted">
                Fino a {d.max} punti · {k === 0 ? "facile" : k === 1 ? "media" : "difficile"}
              </span>
            </span>
          </button>
        ))}
      </div>
    );

  return (
    <GameScreen
      testId="mini-schiacciate"
      onClose={onQuit}
      hud={
        <div className="flex flex-col gap-1.5">
          <p className="display truncate text-[19px]">{dunk.name}</p>
          <div className="flex gap-1.5">
            {DUNK_STEPS.map((s, k) => (
              <span
                key={s}
                className={clsx(
                  "flex-1 rounded-full border-2 border-[#1d1a16] py-0.5 text-center text-[12.5px] font-bold",
                  k < q.length
                    ? q[k] > 0.6
                      ? "bg-ok text-white"
                      : q[k] > 0
                        ? "bg-volt text-volt-ink"
                        : "bg-danger text-white"
                    : k === step
                      ? "bg-court text-court-ink"
                      : "bg-[#FFF8EA]/15 text-[#FFF8EA]/80",
                )}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      }
    >
        <DunkScene
          phase={judges ? 3 : q.length}
          made={(q[2] ?? 1) > 0.05}
          controls={
            !judges && (
              <>
              <p className="mb-2 text-center text-[14px] font-bold text-[#FFF8EA]">
                {DUNK_STEPS[Math.min(step, 2)]}: tocca quando il pallone è nel cerchio
              </p>
              <div className="relative mb-3 h-14 rounded-full border-[2.5px] border-[#1d1a16] bg-[#FFF8EA]">
                <div
                  className="absolute top-1/2 h-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#1d1a16] bg-ok/40"
                  style={{ left: "50%", width: `${dunkStep(dunk, step).win * 200}%` }}
                />
                <div ref={dot} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: "0%" }}>
                  <Ball size={38} />
                </div>
              </div>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  tap();
                }}
                className="press sticker display h-20 w-full touch-none rounded-full bg-ball text-[28px] text-ball-ink"
              >
                {["Corri", "Salta", "Schiaccia"][Math.min(step, 2)]}
              </button>
              </>
            )
          }
        >
          {judges && shown >= judges.length && (
            <p className="display game-pop absolute inset-x-0 top-[18%] z-[990] text-center text-[40px] leading-none text-volt" style={{ WebkitTextStroke: "2px #1d1a16", textShadow: "3px 3px 0 #1d1a16" }}>
              Totale {judges.reduce((a, b) => a + b, 0)}
            </p>
          )}
          {judges ? (
            <div className="absolute inset-x-0 bottom-6 z-[990] flex justify-center gap-2 px-3">
              {judges.map((j, k) => (
                <span
                  key={k}
                  className={clsx(
                    "num grid h-16 w-12 place-items-center rounded-lg border-[2.5px] border-[#1d1a16] bg-[#FFF8EA] text-[30px] text-[#1d1a16] transition-transform",
                    k < shown ? "game-pop" : "opacity-0",
                  )}
                >
                  {j}
                </span>
              ))}
            </div>
          ) : null}
        </DunkScene>
    </GameScreen>
  );
}
