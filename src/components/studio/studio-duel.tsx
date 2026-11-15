"use client";

import clsx from "clsx";
import { IconBallBasketball, IconCheck, IconChevronRight, IconHandMove, IconPlayerPlayFilled, IconRefresh } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { useData } from "@/lib/data/provider";
import { duelChampion, duelMine, duelPair, itemsOfKind, type StudioDuelPoint, type StudioDuelState, type StudioShow, type StudioTopItem } from "@/lib/studio";
import { shortName } from "@/lib/types";
import { Avatar } from "../ui/avatar";
import { haptic } from "../ui/basics";

/** Dopo la scelta i risultati restano un attimo, poi lo show riparte da solo (o subito, col bottone). */
const AUTO_MS = 3200;
const AUTO_LAST_MS = 4200;

type P = { id: string; firstName: string; lastName: string | null; nickname: string | null };

/** Un numero intero che sale fino al valore. */
function useCount(target: number, ms = 650): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const u = Math.min(1, (performance.now() - t0) / ms);
      setV(u >= 1 ? target : Math.round(target * (1 - Math.pow(1 - u, 3))));
      if (u < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

/**
 * La sfida a due, a show fermo: a sinistra la preferita di prima, a destra l'azione appena vista.
 * Un tocco sceglie (uno solo: la scelta si blocca subito e il database non ne accetta un'altra);
 * chi vince resta in gara per la sfida dopo. Poi come hanno scelto gli altri, e lo show riparte.
 * All'ultima sfida, la preferita rimasta è il proprio canestro (o assist) della giornata.
 */
export function DuelSheet({
  show,
  point,
  state,
  failed,
  onPick,
  onRetry,
  onDone,
}: {
  show: StudioShow;
  point: StudioDuelPoint;
  state: StudioDuelState | null;
  failed: boolean;
  onPick: (point: StudioDuelPoint, a: number, b: number, choice: number) => Promise<void>;
  onRetry: () => void;
  onDone: () => void;
}) {
  const { data } = useData();
  const items = show.top?.items ?? [];
  const kind = point.kind;
  const assist = kind === "assist";
  const rounds = Math.max(1, itemsOfKind(show, kind).length - 1);
  const last = point.round >= rounds;
  const [pending, setPending] = useState<number | null>(null);
  const [err, setErr] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => void (alive.current = false);
  }, []);

  // La coppia: fissata la prima volta che si conosce lo stato (dopo la scelta non deve cambiare).
  const [pair, setPair] = useState<{ a: number; b: number } | null>(null);
  if (!pair && state) {
    const mine = state.mine.find((m) => m.c === kind && m.r === point.round);
    const a = mine ? mine.a : duelChampion(show, state, kind, point.round);
    if (a !== null) setPair({ a, b: mine ? mine.b : point.item });
  }
  const choice = duelMine(state, kind, point.round);
  const results = choice !== null && pair !== null;
  const stats = pair ? duelPair(state, kind, pair.a, pair.b) : { na: 0, nb: 0, pa: 0, pb: 0 };
  // La prima sfida è tra due azioni appena viste; dalla seconda a sinistra c'è la mia preferita.
  const hasFav = (state?.mine ?? []).some((m) => m.c === kind && m.r < point.round);

  // Dopo la scelta lo show riparte da solo.
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);
  const autoMs = last ? AUTO_LAST_MS : AUTO_MS;
  useEffect(() => {
    if (!results) return;
    const t = window.setTimeout(() => doneRef.current(), autoMs);
    return () => window.clearTimeout(t);
  }, [results, autoMs]);

  const pick = (x: number) => {
    if (!pair || pending !== null || results || !state) return;
    setPending(x); // da qui nessun altro tocco conta
    setErr(false);
    haptic(12);
    onPick(point, pair.a, pair.b, x)
      .then(() => {
        if (!alive.current) return;
        setPending(null);
        haptic([8, 40, 14]);
      })
      .catch(() => {
        if (!alive.current) return;
        setPending(null);
        setErr(true);
      });
  };

  const find = (id?: string) => (id ? ((data.players.find((p) => p.id === id) ?? data.guests?.find((p) => p.id === id)) as P | undefined) : undefined);
  const who = (it: StudioTopItem) => {
    const scorer = find(it.playerId);
    const passer = it.kind === "assist" ? find(it.assistId) : undefined;
    return { main: passer ?? scorer, to: passer ? scorer : undefined };
  };
  const nameOf = (i: number) => {
    const it = items[i];
    if (!it) return "";
    const w = who(it);
    return shortName(w.main, data.players);
  };
  const loadFailed = failed && !state;

  return (
    <div className="studio-duel absolute inset-0 z-30 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={assist ? "Sfida tra due assist" : "Sfida tra due canestri"}>
      <div className="absolute inset-0 bg-[#0c1736]/55 backdrop-blur-[3px]" />
      <div className="studio-duel-sheet relative mx-3 rounded-[32px] bg-[#16306f]/60 px-4 pb-4 pt-4 text-white shadow-[0_24px_60px_-22px_rgb(0_0_0/0.7)] backdrop-blur-2xl" style={{ marginBottom: "max(12px, calc(var(--sab) + 8px))" }}>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/14 py-1 pl-1.5 pr-3 text-[12.5px] font-semibold text-white/90">
            <span className={clsx("grid h-5 w-5 place-items-center rounded-full text-[#1d1a16]", assist ? "bg-[#4dff9f]" : "bg-volt")}>
              {assist ? <IconHandMove size={12} stroke={2.6} /> : <IconBallBasketball size={12} stroke={2.6} />}
            </span>
            {assist ? "Assist" : "Canestri"} · sfida {point.round} di {rounds}
          </span>
          {!results && (
            <button type="button" className="studio-duel-skip press -mr-1 rounded-full px-3 py-1.5 text-[13px] font-semibold text-white/75" onClick={onDone}>
              Salta
            </button>
          )}
        </div>

        <div key={results ? "r" : "q"} className="studio-duel-in mt-3 min-h-[52px]">
          {results && last ? (
            <>
              <p className="text-[13px] font-semibold text-volt">{assist ? "Il tuo assist della giornata" : "Il tuo canestro della giornata"}</p>
              <h2 className="display text-[25px] leading-[1.1]">{nameOf(choice!)}</h2>
            </>
          ) : results ? (
            <>
              <h2 className="display text-[23px] leading-[1.1]">{nameOf(choice!)} resta in gara</h2>
              <p className="mt-1 text-[13px] text-white/65">Ecco come hanno scelto gli altri.</p>
            </>
          ) : (
            <>
              <h2 className="display text-[23px] leading-[1.1]">Quale ti è piaciuto di più?</h2>
              <p className="mt-1 text-[13px] text-white/65">Tocca il tuo preferito: resta in gara.</p>
            </>
          )}
        </div>

        {loadFailed || !pair ? (
          <div className="mt-3 grid min-h-[200px] place-items-center rounded-[24px] bg-white/10 px-4 py-6 text-center">
            {loadFailed ? (
              <div>
                <p className="text-[14.5px] font-semibold">La sfida non si carica</p>
                <p className="mt-0.5 text-[12.5px] text-white/65">Controlla la connessione e riprova.</p>
                <button type="button" className="studio-duel-retry press mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[14px] font-semibold text-[#1f45b8]" onClick={onRetry}>
                  <IconRefresh size={17} /> Riprova
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
          <div className="relative mt-3 grid grid-cols-2 gap-2.5">
            {[pair.a, pair.b].map((idx, side) => {
              const it = items[idx];
              if (!it) return null;
              const w = who(it);
              const chosen = choice === idx;
              const pct = side === 0 ? stats.pa : stats.pb;
              const n = side === 0 ? stats.na : stats.nb;
              const tag = side === 0 ? (hasFav ? "Il tuo preferito" : "Prima") : "Appena visto";
              const label = `${shortName(w.main, data.players)}${w.to ? ` per ${shortName(w.to, data.players)}` : ""}`;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={results || pending !== null || !state}
                  aria-pressed={chosen}
                  aria-label={`${tag}: ${label}${results ? `, ${pct} per cento` : ""}`}
                  onClick={() => pick(idx)}
                  className={clsx("studio-duel-card press relative overflow-hidden rounded-[24px] text-left", chosen && "is-chosen", results && !chosen && "is-out", pending === idx && "is-pending", pending !== null && pending !== idx && "is-out")}
                  style={{ aspectRatio: "3 / 3.9", ["--i" as string]: side }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- locandina statica della puntata */}
                  <img src={it.poster} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
                  <span className="absolute inset-0 bg-gradient-to-t from-[#0c1736]/95 via-[#0c1736]/20 to-[#0c1736]/35" />
                  <span className={clsx("absolute left-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-bold backdrop-blur-md", side === 0 && hasFav ? "bg-volt text-volt-ink" : "bg-white/22 text-white")}>{tag}</span>
                  {chosen && (
                    <span className="studio-duel-check absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-volt text-volt-ink">
                      <IconCheck size={16} stroke={3} />
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 p-2.5">
                    <span className="flex items-center gap-2">
                      <Avatar player={w.main as never} size={28} href={false} ring="none" />
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-bold leading-tight">{shortName(w.main, data.players)}</span>
                        {w.to && <span className="block truncate text-[11.5px] font-medium leading-tight text-white/70">per {shortName(w.to, data.players)}</span>}
                      </span>
                    </span>
                    {results ? (
                      <Result pct={pct} n={n} lead={pct >= 50 && n > 0 && pct === Math.max(stats.pa, stats.pb)} />
                    ) : (
                      <span className="mt-1.5 block truncate text-[11.5px] text-white/70">
                        Partita {it.game} · {it.label}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
            {!results && (
              <span className="studio-duel-vs pointer-events-none absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-[11px] font-black text-[#1f45b8] shadow-[0_6px_16px_rgb(0_0_0/0.4)]" aria-hidden>
                VS
              </span>
            )}
          </div>
        )}

        {err && (
          <p role="alert" className="studio-duel-err mt-3 rounded-2xl bg-ball px-4 py-2.5 text-center text-[13px] font-semibold text-white">
            La scelta non è partita. Tocca di nuovo.
          </p>
        )}

        {results ? (
          <button type="button" className="studio-duel-next press relative mt-3.5 flex w-full items-center justify-center gap-1.5 overflow-hidden rounded-full bg-white/16 py-3.5 text-[15.5px] font-bold text-white" onClick={onDone}>
            {/* Il tempo che resta prima di ripartire da soli. */}
            <span className="studio-duel-timer absolute inset-0 origin-left bg-white/22" style={{ animationDuration: `${autoMs}ms` }} aria-hidden />
            <span className="relative inline-flex items-center gap-1.5">
              {last ? (
                <>
                  Continua lo show <IconPlayerPlayFilled size={16} />
                </>
              ) : (
                <>
                  Avanti <IconChevronRight size={18} stroke={2.5} />
                </>
              )}
            </span>
          </button>
        ) : (
          !loadFailed && <p className="mt-3 text-center text-[12px] text-white/55">Una scelta sola, non si cambia.</p>
        )}
      </div>
    </div>
  );
}

function Result({ pct, n, lead }: { pct: number; n: number; lead: boolean }) {
  const v = useCount(pct);
  return (
    <span className="studio-duel-res mt-2 block">
      <span className="flex items-end justify-between">
        <span className={clsx("tnum text-[26px] font-black leading-none", lead ? "text-[#4dff9f]" : "text-white")}>{v}%</span>
        <span className="tnum text-[11px] text-white/65">
          {n} {n === 1 ? "voto" : "voti"}
        </span>
      </span>
      <span className="mt-1.5 block h-[5px] overflow-hidden rounded-full bg-white/22">
        <span className={clsx("studio-duel-fill block h-full origin-left rounded-full", lead ? "bg-[#4dff9f]" : "bg-white/85")} style={{ transform: `scaleX(${pct / 100})` }} />
      </span>
    </span>
  );
}
