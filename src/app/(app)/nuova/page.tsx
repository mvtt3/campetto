"use client";

import { play } from "@/lib/sound";
import clsx from "clsx";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconChevronLeft,
  IconClipboardList,
  IconRefresh,
  IconX,
} from "@tabler/icons-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoxEditor } from "@/components/box-editor";
import {
  autoBalance,
  subsOf,
  teamIds,
  TeamPicker,
  teamsReady,
  type Assignment,
} from "@/components/team-picker";
import { Avatar } from "@/components/ui/avatar";
import { Button, haptic, Segmented, Stepper } from "@/components/ui/basics";
import { useToast } from "@/components/ui/toast";
import type { SaveMatchInput } from "@/lib/data/backend";
import { useData } from "@/lib/data/provider";
import { teamBoxPoints } from "@/lib/stats/player";
import {
  DEFAULT_NOTIFY_PREFS,
  emptyBox,
  FORMATS,
  maxPerTeam,
  shortName,
  TEAM_SIZE,
  withSubs,
  type Box,
  type Format,
  type Player,
  type Team,
} from "@/lib/types";
import { DateTimeField } from "@/components/ui/pickers";
import { APP_START } from "@/lib/periods";
import { say } from "@/lib/voice";

const STEPS = ["Formato", "Squadre", "Risultato", "Tabellino"] as const;

const LABEL =
  "mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted";

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
  const step = (d: number) => {
    haptic(5);
    onChange(Math.max(0, Math.min(200, value + d)));
  };
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center rounded-[22px] bg-surface px-3 pb-3 pt-4 shadow-[var(--shadow)]">
      <span
        className={clsx(
          "h-1.5 w-7 rounded-full",
          team === "A" ? "bg-court" : "bg-ball",
        )}
      />
      <p className="mt-2 line-clamp-2 min-h-[2.5em] w-full text-center text-[13px] font-semibold leading-tight [text-wrap:balance]">
        {names}
      </p>
      <input
        inputMode="numeric"
        aria-label={`Punti squadra ${team}`}
        value={String(value)}
        onChange={(e) =>
          onChange(
            Math.max(
              0,
              Math.min(200, Number(e.target.value.replace(/\D/g, "")) || 0),
            ),
          )
        }
        onFocus={(e) => e.target.select()}
        className="score w-full bg-transparent text-center text-[72px] leading-none outline-none"
      />
      <div className="mt-2 flex w-full gap-2">
        <button
          aria-label={`Togli un punto alla squadra ${team}`}
          onClick={() => step(-1)}
          className="press h-11 flex-1 rounded-full bg-raised text-[22px]"
        >
          −
        </button>
        <button
          aria-label={`Aggiungi un punto alla squadra ${team}`}
          onClick={() => step(1)}
          className="press h-11 flex-1 rounded-full bg-raised text-[22px]"
        >
          +
        </button>
      </div>
      <button
        onClick={() => onChange(target)}
        className="press mt-2 h-9 w-full rounded-full bg-ball-soft text-[13px] font-semibold text-ball"
      >
        Metti {target}
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
  const editing = useMemo(
    () => data.matches.find((m) => m.id === editId) ?? null,
    [data.matches, editId],
  );

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
  // Gli ospiti di questa partita: quelli nuovi hanno un id provvisorio finché non si salva.
  const [guests, setGuests] = useState<Player[]>([]);
  // Il gruppo, gli extra (senza app) e gli ospiti di questa partita.
  const allPlayers = useMemo(
    () => [...data.players, ...(data.extras ?? []), ...guests],
    [data.players, data.extras, guests],
  );
  const known = useCallback(
    (id: string) =>
      data.players.some((p) => p.id === id) || (data.extras ?? []).some((p) => p.id === id),
    [data.players, data.extras],
  );
  const addGuest = () => {
    const n = guests.length + 1;
    const id = `nuovo-ospite-${Date.now()}-${n}`;
    setGuests((g) => [
      ...g,
      {
        id,
        firstName: n === 1 ? "Ospite" : `Ospite ${n}`,
        lastName: null,
        nickname: null,
        roles: [],
        jerseyNumber: null,
        cardColor: null,
        avatarUrl: null,
        character: null,
        userId: null,
        isAdmin: false,
        showcase: [],
        notifyPrefs: DEFAULT_NOTIFY_PREFS,
        archived: false,
        createdAt: new Date().toISOString(),
        guest: true,
      },
    ]);
    return id;
  };
  const init = useRef(false);

  // Prefill: from an existing match (edit) or from the players who said yes.
  useEffect(() => {
    if (init.current || !data.players.length) return;
    if (editId && !editing) return;
    init.current = true;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (editing) {
      // Gli ospiti tornano nella partita, con il loro tabellino.
      const lines = [...editing.players, ...(editing.guests ?? [])];
      // (gli extra no: sono già tra i giocatori da scegliere)
      setGuests(
        (data.guests ?? []).filter(
          (g) => !g.extra && editing.guests?.some((l) => l.playerId === g.id),
        ),
      );
      setFormat(editing.format);
      setPlayedAt(toLocalInput(new Date(editing.playedAt)));
      setTarget(editing.targetPoints);
      // Prima chi era in campo, poi i cambi: l'ordine dice chi è il cambio.
      setAssign(
        Object.fromEntries(
          [...lines]
            .sort((x, y) => Number(!!x.sub) - Number(!!y.sub))
            .map((p) => [p.playerId, p.team]),
        ),
      );
      setScoreA(editing.scoreA);
      setScoreB(editing.scoreB);
      const has = lines.some((p) => p.hasStats);
      setWithBox(has);
      setBoxes(Object.fromEntries(lines.map((p) => [p.playerId, p.box])));
      setStep(2);
      return;
    }
    const ids = (params.get("players") ?? "")
      .split(",")
      .filter(known);
    const f = params.get("format") as Format | null;
    // Dalle squadre già fatte (con i cambi in fondo a ogni squadra).
    const fromA = (params.get("a") ?? "")
      .split(",")
      .filter(known);
    const fromB = (params.get("b") ?? "")
      .split(",")
      .filter(known);
    if (f && FORMATS.includes(f) && fromA.length && fromB.length) {
      setFormat(f);
      setAssign(
        Object.fromEntries([
          ...fromA.map((id) => [id, "A"]),
          ...fromB.map((id) => [id, "B"]),
        ]),
      );
      setStep(1);
      return;
    }
    const fmt: Format | null =
      f && FORMATS.includes(f)
        ? f
        : ids.length >= 2
          ? (`${Math.min(4, Math.floor(ids.length / 2))}v${Math.min(4, Math.floor(ids.length / 2))}` as Format)
          : null;
    if (fmt) setFormat(fmt);
    if (fmt && ids.length >= TEAM_SIZE[fmt] * 2) {
      const res = autoBalance(
        ids.slice(0, maxPerTeam(fmt) * 2),
        engine.elo.ratings,
        fmt,
      );
      if (res) {
        setAssign(res);
        setStep(1);
      }
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [data.players, data.guests, known, editId, editing, params, engine.elo.ratings]);

  const size = TEAM_SIZE[format];
  const a = teamIds(assign, "A");
  const b = teamIds(assign, "B");
  const teamsOk = teamsReady(assign, format);
  const subs = subsOf(assign, format);
  const name = (id: string) =>
    shortName(
      allPlayers.find((p) => p.id === id),
      data.players,
    );
  const teamNames = (ids: string[]) =>
    ids.length
      ? ids
          .map((id) => (subs.has(id) ? `${name(id)} (cambio)` : name(id)))
          .join(", ")
      : null;
  const namesA = teamNames(a) ?? "Squadra A";
  const namesB = teamNames(b) ?? "Squadra B";
  const scoreOk = scoreA !== scoreB;
  const ordered = useMemo(
    () => [...teamIds(assign, "A"), ...teamIds(assign, "B")],
    [assign],
  );
  const cur = current && ordered.includes(current) ? current : ordered[0];

  const changeFormat = (f: Format) => {
    setFormat(f);
    // Keep only as many players per team as the new format allows (cambi compresi).
    const n = maxPerTeam(f);
    const next: Assignment = {};
    teamIds(assign, "A")
      .slice(0, n)
      .forEach((id) => (next[id] = "A"));
    teamIds(assign, "B")
      .slice(0, n)
      .forEach((id) => (next[id] = "B"));
    setAssign(next);
  };

  const pointsCheck = useMemo(() => {
    if (!withBox) return null;
    const lines = ordered.map((id) => ({
      team: assign[id],
      hasStats: true,
      box: boxes[id] ?? emptyBox(),
    }));
    const pa = teamBoxPoints(
      {
        players: lines
          .filter((l) => l.team === "A")
          .map((l) => ({ ...l, matchId: "", playerId: "" })),
      },
      "A",
    );
    const pb = teamBoxPoints(
      {
        players: lines
          .filter((l) => l.team === "B")
          .map((l) => ({ ...l, matchId: "", playerId: "" })),
      },
      "B",
    );
    return { pa: pa ?? 0, pb: pb ?? 0 };
  }, [withBox, ordered, assign, boxes]);

  // Il tabellino deve tornare col risultato: niente squadre che fanno più (o meno) punti del finale.
  const pointsBad =
    !!pointsCheck && (pointsCheck.pa !== scoreA || pointsCheck.pb !== scoreB);

  const save = async () => {
    if (!me || !teamsOk || !scoreOk || pointsBad) return;
    setBusy(true);
    const editLines = editing
      ? [...editing.players, ...(editing.guests ?? [])]
      : [];
    const sameRoster =
      editing &&
      editLines.length === ordered.length &&
      editLines.every((p) => assign[p.playerId] === p.team);
    // Gli ospiti nuovi diventano veri solo adesso (se si annulla, non restano in giro).
    const realId = new Map<string, string>();
    try {
      for (const g of guests)
        if (g.id.startsWith("nuovo-ospite-") && assign[g.id])
          realId.set(g.id, await backend.createGuest(g.firstName));
    } catch (e) {
      toast(say(e), "error");
      setBusy(false);
      return;
    }
    const idOf = (id: string) => realId.get(id) ?? id;
    const input: SaveMatchInput = {
      id: editing?.id,
      playedAt: new Date(playedAt).toISOString(),
      format,
      targetPoints: target,
      scoreA,
      scoreB,
      statsSource: withBox
        ? editing &&
          editing.statsSource !== "solo_risultato" &&
          editing.statsSource !== "tabellino"
          ? editing.statsSource
          : "tabellino"
        : "solo_risultato",
      notes: editing?.notes ?? null,
      players: withSubs(
        format,
        ordered.map((id) => ({
          playerId: idOf(id),
          team: assign[id],
          hasStats: withBox,
          box: withBox
            ? {
                ...(boxes[id] ?? emptyBox()),
                pts:
                  (boxes[id]?.fg2m ?? 0) * 2 + (boxes[id]?.fg3m ?? 0) * 3 ||
                  boxes[id]?.pts ||
                  0,
              }
            : emptyBox(),
        })),
      ),
      events:
        sameRoster && withBox
          ? editing!.events.map((e) => ({
              playerId: e.playerId,
              kind: e.kind,
              targetPlayerId: e.targetPlayerId,
              videoTs: e.videoTs,
            }))
          : [],
    };
    try {
      const id = await backend.saveMatch(input);
      void backend.notify({
        type: "match_saved",
        matchId: id,
        isNew: !editing,
      });
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

  const blocked = (to: number) => {
    if (to > 1 && !teamsOk)
      return a.length > maxPerTeam(format) || b.length > maxPerTeam(format)
        ? "Al massimo due cambi per squadra: togline uno"
        : `Mi servono ${size} giocatori per squadra`;
    if (to > 2 && !scoreOk)
      return "Al campetto non si pareggia: controlla il punteggio";
    return null;
  };
  const goTo = (to: number) => {
    const why = blocked(to);
    if (why) return toast(why, "error");
    setStep(to);
  };

  const next = () => goTo(Math.min(3, step + 1));

  return (
    <>
      <header className="safe-top shrink-0 px-5">
        <div className="flex min-h-16 items-center gap-3 pt-5">
          <button
            onClick={() =>
              step > 0 && !editing ? setStep(step - 1) : router.back()
            }
            aria-label={step > 0 && !editing ? "Passo precedente" : "Chiudi"}
            className="press -ml-1 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface shadow-[var(--shadow)]"
          >
            {step > 0 && !editing ? (
              <IconChevronLeft size={22} />
            ) : (
              <IconX size={20} />
            )}
          </button>
          <h1 className="display min-w-0 flex-1 truncate pb-0.5 text-[24px]">
            {editing ? "Modifica partita" : "Nuova partita"}
          </h1>
        </div>
        <nav
          aria-label="Passi"
          className="mb-4 mt-3 flex rounded-full bg-raised p-1"
        >
          {STEPS.map((s, i) => {
            const reachable = i <= step || (!!editing && !blocked(i));
            return (
              <button
                key={s}
                disabled={!reachable}
                onClick={() => goTo(i)}
                aria-current={i === step ? "step" : undefined}
                className={clsx(
                  "min-w-0 flex-1 truncate rounded-full px-1 text-[12.5px] font-semibold transition-colors disabled:cursor-default",
                  i === step
                    ? "h-9 bg-text text-bg"
                    : reachable
                      ? "h-9 text-text"
                      : "h-9 text-faint",
                )}
              >
                {s}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="flex min-h-0 flex-1 flex-col px-5 pb-3">
        {step === 0 && (
          <div className="flex flex-col gap-6">
            <section>
              <h2 className={LABEL}>Formato</h2>
              <Segmented
                value={format}
                onChange={changeFormat}
                options={FORMATS.map((f) => ({ value: f, label: f }))}
              />
            </section>
            <section>
              <h2 className={LABEL}>Quando</h2>
              <DateTimeField
                value={playedAt}
                onChange={setPlayedAt}
                min={APP_START}
                max={maxDate}
              />
            </section>
            <section>
              <h2 className={LABEL}>Si gioca fino a</h2>
              <Stepper
                value={target}
                onChange={setTarget}
                label="punti"
                min={5}
                max={50}
              />
            </section>
          </div>
        )}

        {step === 1 && (
          <TeamPicker
            format={format}
            value={assign}
            onChange={setAssign}
            guests={guests}
            onAddGuest={addGuest}
            onRemoveGuest={(id) =>
              setGuests((g) => g.filter((x) => x.id !== id))
            }
          />
        )}

        {step === 2 && (
          <div className="flex flex-1 flex-col justify-center">
            <div className="flex items-stretch gap-2.5">
              <ScoreSide
                team="A"
                value={scoreA}
                onChange={setScoreA}
                names={namesA}
                target={target}
              />
              <ScoreSide
                team="B"
                value={scoreB}
                onChange={setScoreB}
                names={namesB}
                target={target}
              />
            </div>
            {!scoreOk && (scoreA > 0 || scoreB > 0) && (
              <p className="mt-4 text-center text-[13px] font-semibold text-danger">
                Il risultato non può essere un pareggio
              </p>
            )}
            {scoreOk && Math.max(scoreA, scoreB) < target && (
              <p className="mt-4 text-center text-[13px] text-muted">
                Nessuno è arrivato a {target}: va bene lo stesso se avete smesso
                prima
              </p>
            )}
          </div>
        )}

        {step === 3 && !withBox && (
          <div className="flex flex-1 flex-col justify-center">
            <div className="flex flex-col items-center gap-3 rounded-[22px] bg-surface px-5 pb-5 pt-6 text-center shadow-[var(--shadow)]">
              <span className="grid h-14 w-14 place-items-center rounded-[18px] bg-ball-soft text-ball">
                <IconClipboardList size={28} aria-hidden />
              </span>
              <p className="title text-[20px]">Vuoi aggiungere il tabellino?</p>
              <p className="max-w-[30ch] text-balance text-[14px] text-muted">
                Punti, rimbalzi e assist di ognuno, anche più tardi o dal video
              </p>
              <Button className="mt-1 w-full" onClick={() => setWithBox(true)}>
                Aggiungi il tabellino
              </Button>
            </div>
          </div>
        )}

        {step === 3 && withBox && cur && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="scroll-x -mx-5 flex shrink-0 gap-2 px-5 py-1">
              {ordered.map((id) => (
                <button
                  key={id}
                  onClick={() => setCurrent(id)}
                  aria-pressed={id === cur}
                  className={clsx(
                    "press flex h-11 shrink-0 items-center gap-2 rounded-full pl-1 pr-3 text-[13.5px] font-semibold transition-colors",
                    id === cur
                      ? assign[id] === "A"
                        ? "bg-court text-court-ink"
                        : "bg-ball text-ball-ink"
                      : "bg-surface shadow-[var(--shadow)]",
                  )}
                >
                  <Avatar
                    player={allPlayers.find((p) => p.id === id)}
                    size={32}
                    href={false}
                    ring="none"
                  />
                  {name(id)}
                  {subs.has(id) && (
                    <IconRefresh
                      size={12}
                      aria-label="cambio"
                      className="opacity-70"
                    />
                  )}
                  <span className="tnum text-[12px] opacity-70">
                    {(boxes[id]?.fg2m ?? 0) * 2 + (boxes[id]?.fg3m ?? 0) * 3}
                  </span>
                </button>
              ))}
            </div>
            <div className="scroll-area min-h-0 flex-1">
              <BoxEditor
                box={boxes[cur] ?? emptyBox()}
                onChange={(bx) => setBoxes((x) => ({ ...x, [cur]: bx }))}
              />
            </div>
            {pointsCheck && (
              <div
                className="flex shrink-0 flex-col items-center gap-2"
                role={pointsBad ? "alert" : undefined}
                data-testid="points-check"
              >
                <div className="flex w-full gap-2">
                  {(
                    [
                      ["A", pointsCheck.pa, scoreA],
                      ["B", pointsCheck.pb, scoreB],
                    ] as const
                  ).map(([t, got, want]) => (
                    <p
                      key={t}
                      className={clsx(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold",
                        got === want
                          ? "bg-ok/12 text-ok"
                          : "bg-danger/12 text-danger",
                      )}
                    >
                      <span
                        className={clsx(
                          "h-2 w-2 rounded-full",
                          t === "A" ? "bg-court" : "bg-ball",
                        )}
                      />
                      <span className="num text-[14px]">
                        {got} su {want}
                      </span>
                      punti
                    </p>
                  ))}
                </div>
                <p
                  className={clsx(
                    "text-center text-[12.5px]",
                    pointsBad ? "text-danger" : "text-muted",
                  )}
                >
                  {pointsBad
                    ? "I punti del tabellino devono tornare con il risultato"
                    : "I punti del tabellino tornano con il risultato"}
                </p>
                {pointsBad &&
                  pointsCheck.pa !== pointsCheck.pb &&
                  pointsCheck.pa + pointsCheck.pb > 0 && (
                    <button
                      onClick={() => {
                        setScoreA(pointsCheck.pa);
                        setScoreB(pointsCheck.pb);
                      }}
                      className="press rounded-full bg-surface px-3.5 py-1.5 text-[12.5px] font-semibold shadow-[var(--shadow)]"
                    >
                      Usa {pointsCheck.pa}–{pointsCheck.pb} come risultato
                    </button>
                  )}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="shrink-0 px-5 pb-4 pt-2">
        {step < 3 ? (
          <div className="flex gap-2">
            <Button
              variant="primary"
              className="flex-1"
              onClick={next}
              disabled={(step === 1 && !teamsOk) || (step === 2 && !scoreOk)}
            >
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
            <Button
              variant="primary"
              className="flex-1"
              onClick={save}
              disabled={busy || !teamsOk || !scoreOk || (withBox && pointsBad)}
            >
              {busy
                ? "Salvataggio…"
                : withBox
                  ? "Salva partita"
                  : "Salva solo il risultato"}
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
