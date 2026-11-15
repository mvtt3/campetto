"use client";

import clsx from "clsx";
import { IconCheck, IconChevronRight, IconPlayerPlayFilled, IconRefresh } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useData } from "@/lib/data/provider";
import type { StudioVoteState } from "@/lib/data/backend";
import { votesOf, type StudioShow, type StudioTopItem, type StudioVote, type StudioVoteKind } from "@/lib/studio";
import { shortName } from "@/lib/types";
import { Avatar } from "../ui/avatar";
import { haptic } from "../ui/basics";

const KINDS: StudioVoteKind[] = ["canestro", "assist"];
const TITLE: Record<StudioVoteKind, string> = { canestro: "Il canestro della giornata", assist: "L'assist della giornata" };
const ASK: Record<StudioVoteKind, string> = { canestro: "Tocca quello che ti ha fatto alzare dalla sedia", assist: "Tocca il passaggio più bello" };

/**
 * Percentuali intere che sommano sempre a 100 (metodo del resto più grande): niente 33+33+33.
 */
export function percentages(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total <= 0) return counts.map(() => 0);
  const raw = counts.map((c) => (c * 100) / total);
  const base = raw.map((x) => Math.floor(x));
  let left = 100 - base.reduce((a, b) => a + b, 0);
  const order = raw.map((x, i) => [x - base[i], i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) {
    if (left <= 0) break;
    base[i] += 1;
    left -= 1;
  }
  return base;
}

/** Un numero che sale fino al valore e ci arriva esatto, anche se il valore cambia a metà. */
function useCountUp(target: number, ms = 700): number {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const u = Math.min(1, (performance.now() - t0) / ms);
      const e = 1 - Math.pow(1 - u, 3);
      const cur = u >= 1 ? target : Math.round(start + (target - start) * e);
      setV(cur);
      if (u < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = target;
    };
  }, [target, ms]);
  return v;
}

/**
 * Il voto del pubblico, a show fermo: prima il canestro, poi l'assist. Un tocco vota (uno solo:
 * la scelta si blocca subito e il database non ne accetta un secondo); poi le percentuali, con il
 * proprio voto segnato. Chi aveva già votato vede subito le percentuali e non può toccare. "Salta"
 * lascia perdere e fa ripartire lo show.
 */
export function VoteOverlay({ show, vote, onDone }: { show: StudioShow; vote: StudioVote; onDone: (voted: boolean) => void }) {
  const { data, me: meP, backend } = useData();
  const items = show.top?.items ?? [];
  // Le categorie di questo momento del voto (di solito una: prima i canestri, poi gli assist).
  const steps = useMemo(() => KINDS.filter((k) => (vote.options[k]?.length ?? 0) > 0), [vote.options]);
  // Il database conta le scelte su un numero fisso di opzioni: il massimo tra tutte le categorie della puntata.
  const nOptions = Math.max(1, ...votesOf(show).flatMap((v) => KINDS.map((k) => v.options[k]?.length ?? 0)));
  const [state, setState] = useState<StudioVoteState | null>(null);
  const [failed, setFailed] = useState<null | "load" | "vote">(null);
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState<number | null>(null);
  const [votedHere, setVotedHere] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => void (alive.current = false);
  }, []);

  const fetchState = useCallback(
    () =>
      backend
        .studioVoteState(show.id, nOptions)
        .then((s) => alive.current && setState(s))
        .catch(() => alive.current && setFailed("load")),
    [backend, show.id, nOptions],
  );
  useEffect(() => {
    void fetchState();
  }, [fetchState]);
  const load = () => {
    setFailed(null);
    void fetchState();
  };

  const kind = steps[step];
  const options = useMemo(() => (kind ? (vote.options[kind] ?? []) : []), [kind, vote.options]);
  const cat = state && kind ? state[kind] : null;
  const mine = cat?.mine ?? null;
  const counts = useMemo(() => (cat ? options.map((_, i) => cat.counts[i] ?? 0) : options.map(() => 0)), [cat, options]);
  const pct = useMemo(() => percentages(counts), [counts]);
  const total = counts.reduce((a, b) => a + b, 0);
  const results = mine !== null;

  const choose = (i: number) => {
    if (!kind || pending !== null || results || !state) return;
    setPending(i); // da qui nessun altro tocco conta
    setFailed(null);
    haptic(12);
    backend
      .studioVote(show.id, kind, i, nOptions)
      .then((s) => {
        if (!alive.current) return;
        setVotedHere(true);
        setState(s);
        setPending(null);
        haptic([8, 40, 14]);
      })
      .catch(() => {
        if (!alive.current) return;
        setPending(null);
        setFailed("vote");
      });
  };
  // "Fatto" per il player: ho votato adesso, oppure avevo già votato tutte le categorie di questo momento.
  const done = () => votedHere || steps.every((k) => (state?.[k]?.mine ?? null) !== null);
  const next = () => {
    haptic(6);
    if (step + 1 < steps.length) setStep(step + 1);
    else onDone(done());
  };

  const me = meP?.id;
  return (
    <div className="studio-vote absolute inset-0 z-30 flex flex-col" role="dialog" aria-modal="true" aria-label="Il voto del pubblico">
      <div className="absolute inset-0 bg-[#0c1736]/72 backdrop-blur-[6px]" />
      <div className="relative flex flex-1 flex-col px-4 pt-[max(14px,var(--sat))]" style={{ paddingBottom: "max(18px, calc(var(--sab) + 12px))" }}>
        <div className="studio-vote-head flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/14 px-3 py-1 text-[12px] font-semibold text-white/90">
            <span className="h-1.5 w-1.5 rounded-full bg-volt" />
            Il voto del pubblico{steps.length > 1 ? ` · ${step + 1} di ${steps.length}` : kind === "assist" ? " · Assist" : " · Canestro"}
          </span>
          <button type="button" className="press rounded-full px-3 py-1.5 text-[13px] font-semibold text-white/80" onClick={() => onDone(done())}>
            Salta
          </button>
        </div>
        <div className="studio-vote-title mt-5">
          <h2 className="display text-[30px] leading-[1.05] text-white">{kind ? TITLE[kind] : ""}</h2>
          <p className="mt-1.5 text-[14px] text-white/75">{results ? (votedHere ? "Fatto! Ecco come stanno andando i voti." : "Hai già votato: ecco come sta andando.") : kind ? ASK[kind] : ""}</p>
        </div>

        {failed === "load" || !state ? (
          <div className="grid flex-1 place-items-center">
            {failed === "load" ? (
              <div className="text-center">
                <p className="text-[15px] font-semibold text-white">Il voto non si carica</p>
                <p className="mt-1 text-[13px] text-white/70">Controlla la connessione e riprova.</p>
                <button type="button" className="press mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[14px] font-semibold text-[#1f45b8]" onClick={load}>
                  <IconRefresh size={18} /> Riprova
                </button>
              </div>
            ) : (
              <div className="studio-vote-dots" aria-label="Caricamento">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
        ) : (
          <div key={kind} className="studio-vote-grid mt-5 grid min-h-0 flex-1 content-start gap-3 overflow-y-auto overscroll-contain pb-2" style={{ gridTemplateColumns: options.length === 1 ? "1fr" : "1fr 1fr" }}>
            {options.map((idx, i) => {
              const it = items[idx];
              if (!it) return null;
              const isMine = mine === i;
              const isPending = pending === i;
              const lead = results && pct[i] === Math.max(...pct) && total > 0;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={results || pending !== null}
                  aria-pressed={isMine}
                  aria-label={`${i + 1}. ${label(it, data.players, data.guests)}${results ? `, ${pct[i]} per cento` : ""}`}
                  onClick={() => choose(i)}
                  className={clsx(
                    "studio-vote-card press relative overflow-hidden rounded-[22px] text-left",
                    isMine && "is-mine",
                    isPending && "is-pending",
                    results && !isMine && "is-other",
                  )}
                  style={{ ["--i" as string]: i, aspectRatio: options.length > 4 ? "3 / 2.75" : "3 / 3.6" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- locandina statica della puntata */}
                  <img src={it.poster} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
                  <span className="absolute inset-0 bg-gradient-to-t from-[#0c1736]/92 via-[#0c1736]/25 to-transparent" />
                  <span className="absolute left-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-volt text-[15px] font-black text-volt-ink shadow-[0_4px_12px_rgb(0_0_0/0.35)]">{i + 1}</span>
                  {isMine && (
                    <span className="studio-vote-mine absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-[#1f45b8]">
                      <IconCheck size={13} stroke={3} /> Il tuo
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 p-2.5">
                    <Who item={it} players={data.players} guests={data.guests} me={me} />
                    {results ? (
                      <Bar pct={pct[i]} n={counts[i]} lead={lead} />
                    ) : (
                      <span className="mt-1.5 block text-[11.5px] text-white/70">
                        Partita {it.game} · {it.label}
                      </span>
                    )}
                  </span>
                  {isPending && <span className="studio-vote-spin absolute inset-0" aria-hidden />}
                </button>
              );
            })}
          </div>
        )}

        {failed === "vote" && (
          <p role="alert" className="studio-vote-err mt-3 rounded-2xl bg-[#F26A1B] px-4 py-2.5 text-center text-[13px] font-semibold text-white">
            Il voto non è partito. Tocca di nuovo per riprovare.
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-[12.5px] text-white/60">{results ? `${total} ${total === 1 ? "voto" : "voti"} finora` : "Un voto solo, e vale per sempre."}</span>
          {results && (
            <button type="button" className="studio-vote-next press inline-flex items-center gap-1.5 rounded-full bg-white py-3 pl-5 pr-4 text-[15px] font-bold text-[#1f45b8]" onClick={next}>
              {step + 1 < steps.length ? (
                <>
                  Avanti <IconChevronRight size={18} stroke={2.5} />
                </>
              ) : (
                <>
                  Continua lo show <IconPlayerPlayFilled size={16} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type P = { id: string; firstName: string; lastName: string | null; nickname: string | null };
function find(id: string, players: P[], guests?: P[]) {
  return players.find((p) => p.id === id) ?? guests?.find((p) => p.id === id);
}
function label(it: StudioTopItem, players: P[], guests?: P[]) {
  const a = shortName(find(it.playerId, players, guests), players);
  if (it.kind === "assist" && it.assistId) return `${shortName(find(it.assistId, players, guests), players)} per ${a}`;
  return a;
}

function Who({ item, players, guests, me }: { item: StudioTopItem; players: P[]; guests?: P[]; me?: string }) {
  const scorer = find(item.playerId, players, guests);
  const passer = item.kind === "assist" && item.assistId ? find(item.assistId, players, guests) : undefined;
  const main = passer ?? scorer;
  const mineAction = me && (item.playerId === me || item.assistId === me);
  return (
    <span className="flex items-center gap-2">
      <Avatar player={main as never} size={30} href={false} ring="none" />
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-bold leading-tight text-white">
          {shortName(main, players)}
          {passer && <span className="font-medium text-white/70"> → {shortName(scorer, players)}</span>}
        </span>
        {mineAction && <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-volt">la tua azione</span>}
      </span>
    </span>
  );
}

function Bar({ pct, n, lead }: { pct: number; n: number; lead: boolean }) {
  const v = useCountUp(pct);
  return (
    <span className="mt-2 block">
      <span className="flex items-end justify-between">
        <span className={clsx("tnum text-[22px] font-black leading-none", lead ? "text-[#4dff9f]" : "text-white")}>{v}%</span>
        <span className="tnum text-[11px] text-white/65">{n}</span>
      </span>
      <span className="mt-1.5 block h-[5px] overflow-hidden rounded-full bg-white/22">
        <span className={clsx("studio-vote-fill block h-full origin-left rounded-full", lead ? "bg-[#4dff9f]" : "bg-white/85")} style={{ transform: `scaleX(${pct / 100})` }} />
      </span>
    </span>
  );
}
