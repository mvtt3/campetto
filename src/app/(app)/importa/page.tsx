"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, ScreenHeader, Stepper } from "@/components/ui/basics";
import { useToast } from "@/components/ui/toast";
import { useData } from "@/lib/data/provider";
import { parseImport, type ImportRow } from "@/lib/importer";
import { normalizeBox } from "@/lib/stats/player";
import {
  FORMATS,
  adminName,
  maxPerTeam,
  withSubs,
  type Format,
  type Team,
} from "@/lib/types";
import { DateTimeField, Menu } from "@/components/ui/pickers";
import { APP_START } from "@/lib/periods";
import { say } from "@/lib/voice";

const EXAMPLE = `Giocatore;Squadra;Punti;Triple;Rimbalzi;Assist;Rubate;Stoppate;Perse
Valerio Semeraro;A;9;1;4;3;1;0;1
Mattia;A;12;2;2;5;0;0;2
Simone Falbo;B;10;0;7;1;0;2;1
Matteo Mocciaro;B;8;0;6;2;1;1;0`;

function toLocalInput(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
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
    const ptsA = res.rows
      .filter((r) => r.team === "A")
      .reduce((s, r) => s + normalizeBox(r.box).pts, 0);
    const ptsB = res.rows
      .filter((r) => r.team === "B")
      .reduce((s, r) => s + normalizeBox(r.box).pts, 0);
    setScoreA(res.scoreA ?? ptsA);
    setScoreB(res.scoreB ?? ptsB);
  };

  const ready = rows ?? [];
  const a = ready.filter((r) => r.team === "A");
  const b = ready.filter((r) => r.team === "B");
  // Il formato lo dà la squadra più corta; chi è in più nell'altra (fino a due) è un cambio.
  const format = useMemo<Format | null>(() => {
    const n = Math.min(a.length, b.length);
    if (!n) return null;
    const f = `${n}v${n}` as Format;
    if (!FORMATS.includes(f) || Math.max(a.length, b.length) > maxPerTeam(f))
      return null;
    return f;
  }, [a.length, b.length]);
  const subCount = format ? a.length + b.length - Number(format[0]) * 2 : 0;
  const allMatched =
    ready.every((r) => r.playerId) &&
    new Set(ready.map((r) => r.playerId)).size === ready.length;
  const canSave = ready.length > 0 && allMatched && format && scoreA !== scoreB;

  const update = (i: number, patch: Partial<ImportRow>) =>
    setRows((rs) => rs!.map((r, k) => (k === i ? { ...r, ...patch } : r)));

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
        players: withSubs(
          format,
          ready.map((r) => ({
            playerId: r.playerId!,
            team: r.team!,
            hasStats: true,
            box: normalizeBox(r.box),
          })),
        ),
        events: [],
      });
      void backend.notify({ type: "match_saved", matchId: id, isNew: true });
      await refresh();
      toast("Ho importato le statistiche");
      router.replace(`/partite?m=${id}`);
    } catch (e) {
      toast(say(e), "error");
      setBusy(false);
    }
  };

  return (
    <>
      <ScreenHeader
        title="Importa"
        back="/partite"
        subtitle="Statistiche da un'app video o da un foglio"
      />
      <main className="scroll-area min-h-0 flex-1 px-4 pb-4">
        {!rows ? (
          <div className="flex flex-col gap-3">
            <p className="text-[14px] text-muted">
              Incolla una tabella (CSV, separata da virgole, punti e virgola o
              tab) oppure un JSON. Servono il nome del giocatore e la squadra, A
              o B; le altre colonne sono facoltative.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="Dati da importare"
              placeholder="Incolla qui"
              rows={9}
              className="tnum w-full resize-none rounded-2xl bg-surface p-3.5 font-mono text-[13px] outline-none placeholder:text-faint"
            />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setText(EXAMPLE)}>
                Usa un esempio
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={analyze}
                disabled={!text.trim()}
              >
                Controlla
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {errors.length > 0 && (
              <ul className="rounded-2xl bg-ball-soft px-4 py-3 text-[13.5px] text-ball">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-2">
              {ready.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-2xl card px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <Menu
                      label={`Giocatore per ${r.rawName}`}
                      align="start"
                      className="w-full max-w-full justify-between"
                      value={r.playerId ?? ""}
                      onChange={(v) => update(i, { playerId: v || null })}
                      trigger={
                        <span className="min-w-0 flex-1 truncate text-left">
                          {r.playerId
                            ? adminName(active.find((p) => p.id === r.playerId))
                            : `Scegli per “${r.rawName}”`}
                        </span>
                      }
                      options={[
                        { value: "", label: `Nessuno` },
                        ...active.map((p) => ({
                          value: p.id,
                          label: adminName(p),
                        })),
                      ]}
                    />
                    <p className="tnum mt-1 truncate text-[12px] text-muted">
                      {normalizeBox(r.box).pts} pt, {r.box.oreb + r.box.dreb}{" "}
                      rimb, {r.box.ast} ass, {r.box.stl} rub, {r.box.blk} stop
                    </p>
                  </div>
                  <div
                    className="flex shrink-0 gap-1"
                    role="group"
                    aria-label="Squadra"
                  >
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
                <Stepper
                  value={scoreA}
                  onChange={setScoreA}
                  label="punti"
                  max={200}
                />
              </div>
              <div>
                <p className="mb-1.5 text-[13px] font-semibold">Squadra B</p>
                <Stepper
                  value={scoreB}
                  onChange={setScoreB}
                  label="punti"
                  max={200}
                />
              </div>
            </div>
            <DateTimeField
              value={playedAt}
              onChange={setPlayedAt}
              min={APP_START}
              max={new Date()}
              label="Data della partita"
            />
            <p className="text-[13px] text-muted">
              {[
                format
                  ? `Formato ${format}${subCount ? `, con ${subCount === 1 ? "un cambio" : `${subCount} cambi`}` : ""}`
                  : "Da 1 a 4 giocatori per squadra, al massimo due cambi in più",
                !allMatched && "abbina ogni riga a un giocatore diverso",
                scoreA === scoreB && "il risultato non può essere un pareggio",
              ]
                .filter(Boolean)
                .join(" · ")}
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
            <Button
              variant="primary"
              className="flex-1"
              onClick={save}
              disabled={!canSave || busy}
            >
              {busy ? "Salvataggio…" : "Salva partita"}
            </Button>
          </div>
        </footer>
      )}
    </>
  );
}
