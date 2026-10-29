"use client";

import { play } from "@/lib/sound";
import clsx from "clsx";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw, X } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { BoxEditor } from "@/components/box-editor";
import { autoBalance, subsOf, teamIds, TeamPicker, teamsReady, type Assignment } from "@/components/team-picker";
import { Avatar } from "@/components/ui/avatar";
import { Button, haptic, Stepper } from "@/components/ui/basics";
import { useToast } from "@/components/ui/toast";
import type { SaveMatchInput } from "@/lib/data/backend";
import { useData } from "@/lib/data/provider";
import { teamBoxPoints } from "@/lib/stats/player";
import { emptyBox, FORMATS, maxPerTeam, shortName, TEAM_SIZE, withSubs, type Box, type Format, type Team } from "@/lib/types";
import { DateTimeField } from "@/components/ui/pickers";
import { APP_START } from "@/lib/periods";
import { say } from "@/lib/voice";

const STEPS = ["Formato", "Squadre", "Risultato", "Tabellino"] as const;

function toLocalInput(d: Date): string {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

function ScoreSide({
  team,
  value,
  onChange,
  names,
  target,
}: {
  team: Team;
  value: number;
  onChange: (v: number) => void;
  names: string;
  target: number;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-3">
      <p className="flex max-w-full items-center gap-1.5 truncate text-[14px] font-semibold">
        <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", team === "A" ? "bg-ball" : "bg-text")} />
        <span className="truncate">{names}</span>
      </p>
      <input
        inputMode="numeric"
        aria-label={`Punti squadra ${team}`}
        value={String(value)}
        onChange={(e) => onChange(Math.max(0, Math.min(200, Number(e.target.value.replace(/\D/g, "")) || 0)))}
        onFocus={(e) => e.target.select()}
        className="num w-full bg-transparent text-center text-[84px] outline-none"
      />
      <div className="flex w-full gap-2">
        <button
          aria-label={`Togli un punto alla squadra ${team}`}
          onClick={() => {
            haptic(5);
            onChange(Math.max(0, value - 1));
          }}
          className="h-12 flex-1 rounded-2xl bg-raised text-[22px]"
        >
          −
        </button>
        <button
          aria-label={`Aggiungi un punto alla squadra ${team}`}
          onClick={() => {
            haptic(5);
            onChange(Math.min(200, value + 1));
          }}
          className="h-12 flex-1 rounded-2xl bg-raised text-[22px]"
        >
          +
        </button>
      </div>
      <button
        onClick={() => onChange(target)}
        className="h-10 w-full rounded-2xl text-[14px] font-semibold text-ball ring-1 ring-ball/40 ring-inset"
      >
        {target}
      </button>
    </div>
  );
}

function NewMatchInner() {
  const { data, me, engine, backend, refresh, mutate } = useData();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const editId = params.get("edit");
  const editing = useMemo(() => data.matches.find((m) => m.id === editId) ?? null, [data.matches, editId]);

  const [step, setStep] = useState(0);
  const [format, setFormat] = useState<Format>("3v3");
  const [playedAt, setPlayedAt] = useState(() => toLocalInput(new Date()));
  const [target, setTarget] = useState(21);
  const [assign, setAssign] = useState<Assignment>({});
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [withBox, setWithBox] = useState(false);
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const [current, setCurrent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [maxDate] = useState(() => new Date());
  const init = useRef(false);

  // Prefill: from an existing match (edit) or from the players who said yes.
  useEffect(() => {
    if (init.current || !data.players.length) return;
    if (editId && !editing) return;
    init.current = true;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (editing) {
      setFormat(editing.format);
      setPlayedAt(toLocalInput(new Date(editing.playedAt)));
      setTarget(editing.targetPoints);
      // Prima chi era in campo, poi i cambi: l'ordine dice chi è il cambio.
      setAssign(Object.fromEntries([...editing.players].sort((x, y) => Number(!!x.sub) - Number(!!y.sub)).map((p) => [p.playerId, p.team])));
      setScoreA(editing.scoreA);
      setScoreB(editing.scoreB);
      const has = editing.players.some((p) => p.hasStats);
      setWithBox(has);
      setBoxes(Object.fromEntries(editing.players.map((p) => [p.playerId, p.box])));
      setStep(2);
      return;
    }
    const ids = (params.get("players") ?? "").split(",").filter((id) => data.players.some((p) => p.id === id));
    const f = params.get("format") as Format | null;
    // Dalle squadre già fatte (con i cambi in fondo a ogni squadra).
    const fromA = (params.get("a") ?? "").split(",").filter((id) => data.players.some((p) => p.id === id));
    const fromB = (params.get("b") ?? "").split(",").filter((id) => data.players.some((p) => p.id === id));
    if (f && FORMATS.includes(f) && fromA.length && fromB.length) {
      setFormat(f);
      setAssign(Object.fromEntries([...fromA.map((id) => [id, "A"]), ...fromB.map((id) => [id, "B"])]));
      setStep(1);
      return;
    }
    const fmt: Format | null = f && FORMATS.includes(f) ? f : ids.length >= 2 ? (`${Math.min(4, Math.floor(ids.length / 2))}v${Math.min(4, Math.floor(ids.length / 2))}` as Format) : null;
    if (fmt) setFormat(fmt);
    if (fmt && ids.length >= TEAM_SIZE[fmt] * 2) {
      const res = autoBalance(ids.slice(0, maxPerTeam(fmt) * 2), engine.elo.ratings, fmt);
      if (res) {
        setAssign(res);
        setStep(1);
      }
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [data.players, editId, editing, params, engine.elo.ratings]);

  const size = TEAM_SIZE[format];
  const a = teamIds(assign, "A");
  const b = teamIds(assign, "B");
  const teamsOk = teamsReady(assign, format);
  const subs = subsOf(assign, format);
  const name = (id: string) => shortName(data.players.find((p) => p.id === id), data.players);
  const teamNames = (ids: string[]) =>
    ids.length ? ids.map((id) => (subs.has(id) ? `${name(id)} (cambio)` : name(id))).join(", ") : null;
  const namesA = teamNames(a) ?? "Squadra A";
  const namesB = teamNames(b) ?? "Squadra B";
  const scoreOk = scoreA !== scoreB;
  const ordered = useMemo(() => [...teamIds(assign, "A"), ...teamIds(assign, "B")], [assign]);
  const cur = current && ordered.includes(current) ? current : ordered[0];

  const changeFormat = (f: Format) => {
    setFormat(f);
    // Keep only as many players per team as the new format allows (cambi compresi).
    const n = maxPerTeam(f);
    const next: Assignment = {};
    teamIds(assign, "A").slice(0, n).forEach((id) => (next[id] = "A"));
    teamIds(assign, "B").slice(0, n).forEach((id) => (next[id] = "B"));
    setAssign(next);
  };

  const pointsCheck = useMemo(() => {
    if (!withBox) return null;
    const lines = ordered.map((id) => ({ team: assign[id], hasStats: true, box: boxes[id] ?? emptyBox() }));
    const pa = teamBoxPoints({ players: lines.filter((l) => l.team === "A").map((l) => ({ ...l, matchId: "", playerId: "" })) }, "A");
    const pb = teamBoxPoints({ players: lines.filter((l) => l.team === "B").map((l) => ({ ...l, matchId: "", playerId: "" })) }, "B");
    return { pa: pa ?? 0, pb: pb ?? 0 };
  }, [withBox, ordered, assign, boxes]);

  const save = async () => {
    if (!me || !teamsOk || !scoreOk) return;
    setBusy(true);
    const sameRoster =
      editing && editing.players.length === ordered.length && editing.players.every((p) => assign[p.playerId] === p.team);
    const input: SaveMatchInput = {
      id: editing?.id,
      playedAt: new Date(playedAt).toISOString(),
      format,
      targetPoints: target,
      scoreA,
      scoreB,
      statsSource: withBox
        ? editing && editing.statsSource !== "solo_risultato" && editing.statsSource !== "tabellino"
          ? editing.statsSource
          : "tabellino"
        : "solo_risultato",
      notes: editing?.notes ?? null,
      players: withSubs(
        format,
        ordered.map((id) => ({
          playerId: id,
          team: assign[id],
          hasStats: withBox,
          box: withBox ? { ...(boxes[id] ?? emptyBox()), pts: (boxes[id]?.fg2m ?? 0) * 2 + (boxes[id]?.fg3m ?? 0) * 3 || boxes[id]?.pts || 0 } : emptyBox(),
        })),
      ),
      events: sameRoster && withBox ? editing!.events.map((e) => ({ playerId: e.playerId, kind: e.kind, targetPlayerId: e.targetPlayerId, videoTs: e.videoTs })) : [],
    };
    try {
      const id = await backend.saveMatch(input);
      void backend.notify({ type: "match_saved", matchId: id, isNew: !editing });
      await refresh();
      play("whistle");
      toast(editing ? "Ho aggiornato la partita" : "Ho salvato la partita");
      router.replace(`/partite?m=${id}`);
    } catch (e) {
      toast(say(e), "error");
      setBusy(false);
    }
    void mutate;
  };

  const next = () => {
    if (step === 1 && !teamsOk)
      return toast(a.length > maxPerTeam(format) || b.length > maxPerTeam(format) ? "Al massimo due cambi per squadra: togline uno" : `Mi servono ${size} giocatori per squadra`, "error");
    if (step === 2 && !scoreOk) return toast("Al campetto non si pareggia: controlla il punteggio", "error");
    setStep((s) => Math.min(3, s + 1));
  };

  return (
    <>
      <header className="safe-top shrink-0 px-4">
        <div className="flex h-14 items-center gap-2">
          <button
            onClick={() => (step > 0 && !(editing && step === 2) ? setStep(step - 1) : router.back())}
            aria-label={step > 0 ? "Passo precedente" : "Chiudi"}
            className="-ml-2 grid h-11 w-11 place-items-center rounded-full active:bg-raised"
          >
            <X size={22} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="title truncate text-[22px]">{editing ? "Modifica partita" : "Nuova partita"}</h1>
            <p className="text-[12.5px] text-muted">
              Passo {step + 1} di 4: {STEPS[step]}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5 pb-3" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s} className={clsx("h-1 flex-1 rounded-full", i <= step ? "bg-ball" : "bg-line")} />
          ))}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col px-4 pb-3">
        {step === 0 && (
          <div className="flex flex-col gap-6">
            <section>
              <h2 className="mb-2 text-[13px] font-semibold text-muted">Formato</h2>
              <div className="grid grid-cols-4 gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      haptic(6);
                      changeFormat(f);
                    }}
                    aria-pressed={format === f}
                    className={clsx(
                      "num h-20 rounded-2xl text-[28px]",
                      format === f ? "bg-ball text-ball-ink" : "bg-raised",
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <h2 className="mb-2 text-[13px] font-semibold text-muted">Quando</h2>
              <DateTimeField value={playedAt} onChange={setPlayedAt} min={APP_START} max={maxDate} />
            </section>
            <section>
              <h2 className="mb-2 text-[13px] font-semibold text-muted">Si gioca fino a</h2>
              <Stepper value={target} onChange={setTarget} label="punti" min={5} max={50} />
            </section>
          </div>
        )}

        {step === 1 && <TeamPicker format={format} value={assign} onChange={setAssign} />}

        {step === 2 && (
          <div className="flex flex-1 flex-col justify-center">
            <div className="flex items-start gap-4">
              <ScoreSide team="A" value={scoreA} onChange={setScoreA} names={namesA} target={target} />
              <ScoreSide team="B" value={scoreB} onChange={setScoreB} names={namesB} target={target} />
            </div>
            {!scoreOk && (scoreA > 0 || scoreB > 0) && (
              <p className="mt-4 text-center text-[13px] text-danger">Il risultato non può essere un pareggio</p>
            )}
            {scoreOk && Math.max(scoreA, scoreB) < target && (
              <p className="mt-4 text-center text-[13px] text-muted">Nessuno è arrivato a {target}: va bene lo stesso se avete smesso prima.</p>
            )}
          </div>
        )}

        {step === 3 && !withBox && (
          <div className="flex flex-1 flex-col justify-center gap-4 text-center">
            <p className="title text-[22px]">Vuoi aggiungere il tabellino?</p>
            <p className="mx-auto max-w-[30ch] text-balance text-[14.5px] text-muted">
              Punti, rimbalzi e assist di ognuno, anche più tardi o dal video
            </p>
            <Button className="mx-auto mt-2 w-full max-w-xs" onClick={() => setWithBox(true)}>
              Aggiungi il tabellino
            </Button>
          </div>
        )}

        {step === 3 && withBox && cur && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="scroll-x -mx-4 flex shrink-0 gap-2 px-4 py-1">
              {ordered.map((id) => (
                <button
                  key={id}
                  onClick={() => setCurrent(id)}
                  aria-pressed={id === cur}
                  className={clsx(
                    "flex h-11 shrink-0 items-center gap-2 rounded-full pl-1 pr-3 text-[13.5px] font-semibold",
                    id === cur ? (assign[id] === "A" ? "bg-ball text-ball-ink" : "bg-text text-bg") : "bg-raised",
                  )}
                >
                  <Avatar player={data.players.find((p) => p.id === id)} size={32} href={false} ring="none" />
                  {name(id)}
                  {subs.has(id) && <RefreshCw size={12} aria-label="cambio" className="opacity-70" />}
                  <span className="tnum text-[12px] opacity-70">{(boxes[id]?.fg2m ?? 0) * 2 + (boxes[id]?.fg3m ?? 0) * 3}</span>
                </button>
              ))}
            </div>
            <div className="scroll-area min-h-0 flex-1">
              <BoxEditor box={boxes[cur] ?? emptyBox()} onChange={(bx) => setBoxes((x) => ({ ...x, [cur]: bx }))} />
            </div>
            {pointsCheck && (
              <p className={clsx("shrink-0 text-center text-[12.5px]", pointsCheck.pa === scoreA && pointsCheck.pb === scoreB ? "text-ok" : "text-muted")}>
                Dal tabellino: A {pointsCheck.pa} su {scoreA}, B {pointsCheck.pb} su {scoreB}
                {pointsCheck.pa === scoreA && pointsCheck.pb === scoreB ? " · tutto torna" : ""}
              </p>
            )}
          </div>
        )}
      </main>

      <footer className="shrink-0 border-t border-line px-4 py-3">
        {step < 3 ? (
          <div className="flex gap-2">
            {step === 2 && editing && (
              <Button className="flex-1" onClick={() => setStep(1)}>
                Squadre
              </Button>
            )}
            <Button variant="primary" className="flex-1" onClick={next} disabled={(step === 1 && !teamsOk) || (step === 2 && !scoreOk)}>
              Avanti
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            {withBox ? (
              <Button className="flex-1" onClick={() => setWithBox(false)}>
                Senza tabellino
              </Button>
            ) : null}
            <Button variant="primary" className="flex-1" onClick={save} disabled={busy || !teamsOk || !scoreOk}>
              {busy ? "Salvataggio…" : withBox ? "Salva partita" : "Salva solo il risultato"}
            </Button>
          </div>
        )}
      </footer>
    </>
  );
}

export default function NewMatchPage() {
  return (
    <Suspense>
      <NewMatchInner />
    </Suspense>
  );
}
