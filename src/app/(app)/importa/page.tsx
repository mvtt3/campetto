"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, ScreenHeader, Stepper } from "@/components/ui/basics";
import { useToast } from "@/components/ui/toast";
import { useData } from "@/lib/data/provider";
import { parseImport, type ImportRow } from "@/lib/importer";
import { normalizeBox } from "@/lib/stats/player";
import { FORMATS, playerName, type Format, type Team } from "@/lib/types";

const EXAMPLE = `Giocatore;Squadra;Punti;Triple;Rimbalzi;Assist;Rubate;Stoppate;Perse
Valerio Semeraro;A;9;1;4;3;1;0;1
Mattia;A;12;2;2;5;0;0;2
Simone Falbo;B;10;0;7;1;0;2;1
Matteo Mocciaro;B;8;0;6;2;1;1;0`;

function toLocalInput(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function ImportPage() {
  const { data, backend, refresh } = useData();
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [scoreA, setScoreA] = useState(21);
  const [scoreB, setScoreB] = useState(0);
  const [playedAt, setPlayedAt] = useState(() => toLocalInput(new Date()));
  const [busy, setBusy] = useState(false);

  const active = data.players.filter((p) => !p.archived);

  const analyze = () => {
    const res = parseImport(text, active);
    setRows(res.rows);
    setErrors(res.errors);
    const ptsA = res.rows.filter((r) => r.team === "A").reduce((s, r) => s + normalizeBox(r.box).pts, 0);
    const ptsB = res.rows.filter((r) => r.team === "B").reduce((s, r) => s + normalizeBox(r.box).pts, 0);
    setScoreA(res.scoreA ?? ptsA);
    setScoreB(res.scoreB ?? ptsB);
  };

  const ready = rows ?? [];
  const a = ready.filter((r) => r.team === "A");
  const b = ready.filter((r) => r.team === "B");
  const format = useMemo<Format | null>(() => {
    if (!a.length || a.length !== b.length) return null;
    const f = `${a.length}v${a.length}` as Format;
    return FORMATS.includes(f) ? f : null;
  }, [a.length, b.length]);
  const allMatched = ready.every((r) => r.playerId) && new Set(ready.map((r) => r.playerId)).size === ready.length;
  const canSave = ready.length > 0 && allMatched && format && scoreA !== scoreB;

  const update = (i: number, patch: Partial<ImportRow>) => setRows((rs) => rs!.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const save = async () => {
    if (!canSave || !format) return;
    setBusy(true);
    try {
      const id = await backend.saveMatch({
        playedAt: new Date(playedAt).toISOString(),
        format,
        targetPoints: 21,
        scoreA,
        scoreB,
        statsSource: "importata",
        players: ready.map((r) => ({ playerId: r.playerId!, team: r.team!, hasStats: true, box: normalizeBox(r.box) })),
        events: [],
      });
      void backend.notify({ type: "match_saved", matchId: id, isNew: true });
      await refresh();
      toast("Statistiche importate");
      router.replace(`/partite?m=${id}`);
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(false);
    }
  };

  return (
    <>
      <ScreenHeader title="Importa statistiche" back="/partite" subtitle="Da un'app di analisi video o da un foglio" />
      <main className="scroll-area min-h-0 flex-1 px-4 pb-4">
        {!rows ? (
          <div className="flex flex-col gap-3">
            <p className="text-[14px] text-muted">
              Incolla una tabella (CSV, separata da virgole, punti e virgola o tab) oppure un JSON. Servono il nome del giocatore e la squadra, A o B; le altre colonne sono facoltative.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="Dati da importare"
              placeholder="Incolla qui"
              rows={9}
              className="num-wide w-full resize-none rounded-[16px] bg-surface p-3.5 font-mono text-[13px] ring-1 ring-line ring-inset outline-none placeholder:text-faint"
            />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setText(EXAMPLE)}>
                Usa un esempio
              </Button>
              <Button variant="primary" className="flex-1" onClick={analyze} disabled={!text.trim()}>
                Controlla
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {errors.length > 0 && (
              <ul className="rounded-[16px] bg-ball-soft px-4 py-3 text-[13.5px] text-ball">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-2">
              {ready.map((r, i) => (
                <div key={i} className="flex items-center gap-2 rounded-[16px] bg-surface px-3 py-2.5 ring-1 ring-line ring-inset">
                  <div className="min-w-0 flex-1">
                    <select
                      value={r.playerId ?? ""}
                      aria-label={`Giocatore per ${r.rawName}`}
                      onChange={(e) => update(i, { playerId: e.target.value || null })}
                      className="h-9 w-full truncate rounded-[10px] bg-raised px-2 text-[14px] font-semibold outline-none"
                    >
                      <option value="">Scegli per “{r.rawName}”</option>
                      {active.map((p) => (
                        <option key={p.id} value={p.id}>
                          {playerName(p)}
                        </option>
                      ))}
                    </select>
                    <p className="num-wide mt-1 truncate text-[12px] text-muted">
                      {normalizeBox(r.box).pts} pt, {r.box.oreb + r.box.dreb} rimb, {r.box.ast} ass, {r.box.stl} rub, {r.box.blk} stop
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1" role="group" aria-label="Squadra">
                    {(["A", "B"] as Team[]).map((t) => (
                      <button
                        key={t}
                        aria-pressed={r.team === t}
                        onClick={() => update(i, { team: t })}
                        className={`num h-9 w-9 rounded-[10px] text-[16px] ${r.team === t ? (t === "A" ? "bg-ball text-ball-ink" : "bg-text text-bg") : "bg-raised"}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1.5 text-[13px] font-semibold">Squadra A</p>
                <Stepper value={scoreA} onChange={setScoreA} label="punti" max={200} />
              </div>
              <div>
                <p className="mb-1.5 text-[13px] font-semibold">Squadra B</p>
                <Stepper value={scoreB} onChange={setScoreB} label="punti" max={200} />
              </div>
            </div>
            <input
              type="datetime-local"
              aria-label="Data della partita"
              value={playedAt}
              onChange={(e) => setPlayedAt(e.target.value)}
              className="h-12 w-full rounded-[14px] bg-raised px-4 text-[15px] ring-1 ring-line ring-inset outline-none"
            />
            <p className="text-[13px] text-muted">
              {format ? `Formato ${format}.` : "Le due squadre devono avere lo stesso numero di giocatori (da 1 a 4)."}
              {!allMatched && " Abbina ogni riga a un giocatore diverso."}
              {scoreA === scoreB && " Il risultato non può essere un pareggio."}
            </p>
          </div>
        )}
      </main>
      {rows && (
        <footer className="shrink-0 border-t border-line px-4 py-3">
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => setRows(null)}>
              Modifica testo
            </Button>
            <Button variant="primary" className="flex-1" onClick={save} disabled={!canSave || busy}>
              {busy ? "Salvataggio…" : "Salva partita"}
            </Button>
          </div>
        </footer>
      )}
    </>
  );
}
