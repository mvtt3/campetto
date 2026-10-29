"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { FileVideo, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { teamIds, TeamPicker, teamsReady, type Assignment } from "@/components/team-picker";
import { Avatar } from "@/components/ui/avatar";
import { Button, haptic, ScreenHeader, Segmented, Stepper } from "@/components/ui/basics";
import { useToast } from "@/components/ui/toast";
import { useData } from "@/lib/data/provider";
import { boxesFromEvents } from "@/lib/stats/player";
import { FORMATS, shortName, TEAM_SIZE, withSubs, type EventKind, type Format } from "@/lib/types";
import { say } from "@/lib/voice";

interface TagEvent {
  playerId: string;
  kind: EventKind;
  targetPlayerId: string | null;
  videoTs: number | null;
}

const DRAFT = "campetto:video-draft";

const ACTIONS: { kind: EventKind; label: string; strong?: boolean }[] = [
  { kind: "2pt", label: "+2", strong: true },
  { kind: "3pt", label: "+3", strong: true },
  { kind: "miss2", label: "Sbagliato da 2" },
  { kind: "miss3", label: "Sbagliato da 3" },
  { kind: "oreb", label: "Rimb. offensivo" },
  { kind: "dreb", label: "Rimb. difensivo" },
  { kind: "stl", label: "Rubata" },
  { kind: "blk", label: "Stoppata" },
  { kind: "tov", label: "Persa" },
  { kind: "foul", label: "Fallo" },
  { kind: "ast", label: "Assist" },
];

const LABEL: Record<EventKind, string> = {
  "2pt": "canestro da 2",
  "3pt": "tripla",
  miss2: "errore da 2",
  miss3: "errore da 3",
  oreb: "rimbalzo offensivo",
  dreb: "rimbalzo difensivo",
  ast: "assist",
  stl: "rubata",
  blk: "stoppata",
  tov: "palla persa",
  foul: "fallo",
};

export default function VideoPage() {
  const { data, backend, refresh } = useData();
  const router = useRouter();
  const toast = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stage, setStage] = useState<"setup" | "tag" | "review">("setup");
  const [file, setFile] = useState<{ url: string; name: string } | null>(null);
  const [format, setFormat] = useState<Format>("3v3");
  const [assign, setAssign] = useState<Assignment>({});
  const [events, setEvents] = useState<TagEvent[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [assistFor, setAssistFor] = useState<number | null>(null);
  const [speed, setSpeed] = useState("1");
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(0);

  // Recupera una sessione interrotta (gli eventi, il video va riaperto).
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT) ?? "null");
      if (d?.events?.length) {
        /* eslint-disable react-hooks/set-state-in-effect */
        setFormat(d.format);
        setAssign(d.assign);
        setEvents(d.events);
        /* eslint-enable react-hooks/set-state-in-effect */
        toast("Ho ripreso le azioni che avevi segnato: riapri il video per continuare");
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      if (events.length) localStorage.setItem(DRAFT, JSON.stringify({ format, assign, events }));
    } catch {
      /* ignore */
    }
  }, [events, format, assign]);

  useEffect(() => () => {
    if (file) URL.revokeObjectURL(file.url);
  }, [file]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = Number(speed);
  }, [speed, stage]);

  const size = TEAM_SIZE[format];
  const a = teamIds(assign, "A");
  const b = teamIds(assign, "B");
  const ids = [...a, ...b];
  const teamsOk = teamsReady(assign, format);
  const live = useMemo(() => {
    let sa = 0;
    let sb = 0;
    for (const e of events) {
      const pts = e.kind === "2pt" ? 2 : e.kind === "3pt" ? 3 : 0;
      if (assign[e.playerId] === "A") sa += pts;
      else sb += pts;
    }
    return { a: sa, b: sb };
  }, [events, assign]);
  const name = (id: string) => shortName(data.players.find((p) => p.id === id), data.players);

  const add = (kind: EventKind) => {
    if (!current) return toast("Dimmi prima chi ha fatto l'azione", "error");
    if (kind === "ast") {
      const mates = ids.filter((id) => id !== current && assign[id] === assign[current]);
      if (!mates.length) {
        toast("Nel 1v1 non ci sono assist da segnare", "error");
        return;
      }
    }
    haptic(10);
    const ev: TagEvent = { playerId: current, kind, targetPlayerId: null, videoTs: videoRef.current?.currentTime ?? null };
    setEvents((xs) => [...xs, ev]);
    setFlash((f) => f + 1);
    // Dopo un canestro chiedi chi ha fatto l'assist.
    if ((kind === "2pt" || kind === "3pt") && size > 1) setAssistFor(events.length);
    else setAssistFor(null);
  };

  const giveAssist = (from: string) => {
    if (assistFor === null) return;
    const scored = events[assistFor];
    haptic(8);
    setEvents((xs) => [...xs, { playerId: from, kind: "ast", targetPlayerId: scored.playerId, videoTs: scored.videoTs }]);
    setAssistFor(null);
  };

  const save = async () => {
    if (scoreA === scoreB) return toast("Al campetto non si pareggia: controlla il punteggio", "error");
    setBusy(true);
    const boxes = boxesFromEvents(events, ids);
    try {
      const id = await backend.saveMatch({
        playedAt: new Date().toISOString(),
        format,
        targetPoints: 21,
        scoreA,
        scoreB,
        statsSource: "video",
        players: withSubs(
          format,
          ids.map((pid) => ({ playerId: pid, team: assign[pid], hasStats: true, box: boxes[pid] })),
        ),
        events,
      });
      localStorage.removeItem(DRAFT);
      void backend.notify({ type: "match_saved", matchId: id, isNew: true });
      await refresh();
      toast("Ho salvato la partita con il tabellino del video");
      router.replace(`/partite?m=${id}`);
    } catch (e) {
      toast(say(e), "error");
      setBusy(false);
    }
  };

  if (stage === "setup") {
    return (
      <>
        <ScreenHeader title="Segna dal video" back="/partite" subtitle="Il video resta sul telefono, non viene caricato" />
        <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-3">
          <label className="flex h-16 shrink-0 cursor-pointer items-center gap-3 rounded-2xl bg-surface px-4">
            <FileVideo size={24} className="shrink-0 text-ball" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">{file ? file.name : "Scegli il video della partita"}</span>
              <span className="block text-[12.5px] text-muted">{file ? "Tocca per cambiarlo" : "Dalla galleria del telefono"}</span>
            </span>
            <input
              type="file"
              accept="video/*"
              className="sr-only"
              data-testid="video-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (file) URL.revokeObjectURL(file.url);
                setFile({ url: URL.createObjectURL(f), name: f.name });
              }}
            />
          </label>
          <Segmented
            value={format}
            onChange={(f) => {
              setFormat(f);
              setAssign({});
            }}
            options={FORMATS.map((f) => ({ value: f, label: f }))}
          />
          <div className="min-h-0 flex-1">
            <TeamPicker format={format} value={assign} onChange={setAssign} />
          </div>
        </main>
        <footer className="shrink-0 border-t border-line px-4 py-3">
          <Button variant="primary" block disabled={!file || !teamsOk} onClick={() => setStage("tag")}>
            {events.length ? `Continua (${events.length} azioni)` : "Inizia a segnare"}
          </Button>
        </footer>
      </>
    );
  }

  if (stage === "review") {
    const boxes = boxesFromEvents(events, ids);
    return (
      <>
        <ScreenHeader title="Risultato finale" back={() => setStage("tag")} subtitle="Controlla il punteggio, poi salva" />
        <main className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-3">
          <div className="grid shrink-0 grid-cols-2 gap-3">
            <div>
              <p className="mb-1.5 truncate text-[13px] font-semibold">A: {a.map(name).join(", ")}</p>
              <Stepper value={scoreA} onChange={setScoreA} label="punti" max={200} />
            </div>
            <div>
              <p className="mb-1.5 truncate text-[13px] font-semibold">B: {b.map(name).join(", ")}</p>
              <Stepper value={scoreB} onChange={setScoreB} label="punti" max={200} />
            </div>
          </div>
          {(scoreA !== live.a || scoreB !== live.b) && (
            <p className="text-[13px] text-muted">
              Dalle azioni segnate risulta {live.a}–{live.b}: va bene anche diverso, se qualche canestro è fuori dal video
            </p>
          )}
          <div className="scroll-area min-h-0 flex-1">
            <table className="tnum w-full text-[13.5px]">
              <thead>
                <tr className="text-left text-[11.5px] text-muted">
                  <th className="py-1.5 font-semibold">Giocatore</th>
                  {["Punti", "Rimb.", "Ass.", "Rub.", "Stop.", "Perse"].map((h) => (
                    <th key={h} className="px-1 text-right font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ids.map((id) => (
                  <tr key={id} className="border-t border-line">
                    <td className="max-w-[110px] truncate py-2 font-semibold">{name(id)}</td>
                    <td className="px-1 text-right font-bold">{boxes[id].pts}</td>
                    <td className="px-1 text-right">{boxes[id].oreb + boxes[id].dreb}</td>
                    <td className="px-1 text-right">{boxes[id].ast}</td>
                    <td className="px-1 text-right">{boxes[id].stl}</td>
                    <td className="px-1 text-right">{boxes[id].blk}</td>
                    <td className="px-1 text-right">{boxes[id].tov}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
        <footer className="shrink-0 border-t border-line px-4 py-3">
          <Button variant="primary" block onClick={save} disabled={busy || scoreA === scoreB}>
            {busy ? "Salvataggio…" : "Salva partita"}
          </Button>
        </footer>
      </>
    );
  }

  const last = events[events.length - 1];
  const mates = assistFor !== null ? ids.filter((id) => id !== events[assistFor].playerId && assign[id] === assign[events[assistFor].playerId]) : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="safe-top shrink-0 bg-black">
        <video ref={videoRef} src={file?.url} controls playsInline className="mx-auto max-h-[34dvh] w-full" />
      </div>
      <div className="flex shrink-0 items-center gap-2 px-4 py-2">
        <Segmented
          size="sm"
          className="w-36"
          value={speed}
          onChange={setSpeed}
          options={[
            { value: "1", label: "1x" },
            { value: "1.5", label: "1,5x" },
            { value: "2", label: "2x" },
          ]}
        />
        <p className="num flex-1 text-center text-[26px]" aria-live="polite">
          <span key={`a${flash}`} className="inline-block animate-pop text-ball">
            {live.a}
          </span>
          <span className="text-faint">–</span>
          <span key={`b${flash}`} className="inline-block animate-pop">
            {live.b}
          </span>
        </p>
        <button
          aria-label="Annulla l'ultima azione"
          disabled={!events.length}
          onClick={() => {
            haptic(10);
            setEvents((xs) => xs.slice(0, -1));
            setAssistFor(null);
          }}
          className="grid h-10 w-10 place-items-center rounded-full bg-raised disabled:opacity-30"
        >
          <Undo2 size={18} />
        </button>
      </div>
      <p className="shrink-0 truncate px-4 text-[12.5px] text-muted" aria-live="polite">
        {last ? `Ultima: ${LABEL[last.kind]} di ${name(last.playerId)}${last.targetPlayerId ? ` per ${name(last.targetPlayerId)}` : ""}` : "Scegli un giocatore e tocca l'azione"}
      </p>

      <div className="scroll-x flex shrink-0 gap-2 px-4 py-2">
        {ids.map((id) => (
          <button
            key={id}
            onClick={() => {
              haptic(5);
              setCurrent(id);
            }}
            aria-pressed={current === id}
            className={clsx(
              "flex h-11 shrink-0 items-center gap-1.5 rounded-full pl-1 pr-3 text-[13.5px] font-semibold",
              current === id ? (assign[id] === "A" ? "bg-ball text-ball-ink" : "bg-text text-bg") : "bg-raised",
            )}
          >
            <Avatar player={data.players.find((p) => p.id === id)} size={32} href={false} ring="none" />
            {name(id)}
          </button>
        ))}
      </div>

      {assistFor !== null && mates.length > 0 && (
        <div className="mx-4 mb-2 flex shrink-0 items-center gap-2 rounded-2xl bg-ball-soft px-3 py-2">
          <span className="text-[13px] font-semibold text-ball">Assist di</span>
          <div className="scroll-x flex flex-1 gap-1.5">
            {mates.map((id) => (
              <button key={id} onClick={() => giveAssist(id)} className="h-9 shrink-0 rounded-full bg-surface px-3 text-[13px] font-semibold ring-1 ring-line">
                {name(id)}
              </button>
            ))}
            <button onClick={() => setAssistFor(null)} className="h-9 shrink-0 rounded-full px-3 text-[13px] text-muted">
              Nessuno
            </button>
          </div>
        </div>
      )}

      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-4 gap-1.5 px-4 pb-2">
        {ACTIONS.map((x) => (
          <button
            key={x.kind}
            onClick={() => add(x.kind)}
            className={clsx(
              "rounded-2xl px-1 text-center font-semibold leading-tight active:scale-95",
              x.strong ? "num col-span-2 bg-ball text-[30px] text-ball-ink" : "bg-raised text-[12.5px]",
            )}
          >
            {x.label}
          </button>
        ))}
        <button
          onClick={() => {
            setScoreA(live.a);
            setScoreB(live.b);
            videoRef.current?.pause();
            setStage("review");
          }}
          className="rounded-2xl bg-text text-[13px] font-semibold text-bg"
        >
          Fine
        </button>
      </div>
    </div>
  );
}
