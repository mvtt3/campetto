"use client";

import clsx from "clsx";
import { IconBallBasketball, IconChevronRight, IconHandMove, IconPlayerPlayFilled, IconRefresh } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import type { StudioRateState } from "@/lib/data/backend";
import { fmtAvg, rateStats, type StudioShow } from "@/lib/studio";
import { haptic } from "../ui/basics";

const SCORES = [1, 2, 3, 4, 5] as const;

/** Un numero con la virgola che sale fino al valore (per la media). */
function useEase(target: number | null, ms = 750): number | null {
  const [v, setV] = useState<number | null>(target === null ? null : 0);
  useEffect(() => {
    if (target === null) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const u = Math.min(1, (performance.now() - t0) / ms);
      setV(u >= 1 ? target : target * (1 - Math.pow(1 - u, 3)));
      if (u < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return target === null ? null : v;
}

/**
 * Il voto di un'azione, a show fermo: cinque numeri, un tocco e via (uno solo: il numero si blocca
 * subito e il database non ne accetta un secondo). Poi com'è andata: la media, quanti hanno dato
 * ogni voto e il proprio segnato. Chi l'aveva già votata vede subito i risultati. "Salta" lascia
 * perdere; "Avanti" fa ripartire lo show con l'azione dopo.
 */
export function RateSheet({
  show,
  item,
  state,
  failed,
  last,
  onRate,
  onRetry,
  onDone,
}: {
  show: StudioShow;
  item: number;
  state: StudioRateState | null;
  failed: boolean;
  /** L'ultima azione da votare della puntata: il bottone dice "Continua lo show". */
  last: boolean;
  onRate: (item: number, score: number) => Promise<void>;
  onRetry: () => void;
  onDone: () => void;
}) {
  const items = show.top?.items ?? [];
  const it = items[item];
  const kind = it?.kind ?? "canestro";
  const ofKind = items.filter((x) => x.kind === kind).length;
  const nth = items.slice(0, item + 1).filter((x) => x.kind === kind).length;
  const [pending, setPending] = useState<number | null>(null);
  const [err, setErr] = useState(false);
  const [votedHere, setVotedHere] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => void (alive.current = false);
  }, []);

  const cur = state?.[item] ?? null;
  const mine = cur?.mine ?? null;
  const results = mine !== null;
  const counts = SCORES.map((s) => cur?.counts[s - 1] ?? 0);
  const { n, avg } = rateStats(counts);
  // Ogni percentuale arrotondata per conto suo: a voti uguali, percentuali uguali (anche se la somma fa 99 o 101).
  const pct = counts.map((c) => (n ? Math.round((c * 100) / n) : 0));
  const top = Math.max(...counts);
  const shownAvg = useEase(results ? avg : null);

  const choose = (score: number) => {
    if (pending !== null || results || !state) return;
    setPending(score); // da qui nessun altro tocco conta
    setErr(false);
    haptic(12);
    onRate(item, score)
      .then(() => {
        if (!alive.current) return;
        setVotedHere(true);
        setPending(null);
        haptic([8, 40, 14]);
      })
      .catch(() => {
        if (!alive.current) return;
        setPending(null);
        setErr(true);
      });
  };

  const assist = kind === "assist";
  return (
    <div className="studio-rate absolute inset-0 z-30 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={assist ? "Vota l'assist" : "Vota il canestro"}>
      <div className="absolute inset-0 bg-gradient-to-t from-[#0c1736]/85 via-[#0c1736]/35 to-transparent" />
      <div className="studio-rate-sheet relative mx-3 rounded-[32px] bg-[#16306f]/55 px-5 pb-5 pt-4 text-white shadow-[0_24px_60px_-22px_rgb(0_0_0/0.7)] backdrop-blur-2xl" style={{ marginBottom: "max(12px, calc(var(--sab) + 8px))" }}>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/14 py-1 pl-1.5 pr-3 text-[12.5px] font-semibold text-white/90">
            <span className={clsx("grid h-5 w-5 place-items-center rounded-full text-[#1d1a16]", assist ? "bg-[#4dff9f]" : "bg-volt")}>
              {assist ? <IconHandMove size={12} stroke={2.6} /> : <IconBallBasketball size={12} stroke={2.6} />}
            </span>
            {assist ? "Assist" : "Canestro"} {nth} di {ofKind}
          </span>
          {!results && (
            <button type="button" className="studio-rate-skip press -mr-2 rounded-full px-3 py-1.5 text-[13px] font-semibold text-white/75" onClick={onDone}>
              Salta
            </button>
          )}
        </div>

        {results ? (
          <div key="r" className="studio-rate-in mt-3 flex items-end gap-3">
            <span className="display tnum text-[44px] leading-[0.9]">{fmtAvg(shownAvg)}</span>
            <span className="pb-1 text-[13px] leading-tight text-white/70">
              di media
              <br />
              {n} {n === 1 ? "voto" : "voti"}
            </span>
            <span className="studio-rate-mine ml-auto mb-0.5 rounded-full bg-volt px-3 py-1 text-[12.5px] font-bold text-volt-ink">Il tuo: {mine}</span>
          </div>
        ) : (
          <div key="q" className="mt-3">
            <h2 className="display text-[24px] leading-[1.1]">{assist ? "Quanto vale questo assist?" : "Quanto vale questo canestro?"}</h2>
            <p className="mt-1 text-[13px] text-white/65">Da 1 a 5. Un voto solo, non si cambia.</p>
          </div>
        )}
        {results && <p className="studio-rate-in mt-2 text-[13px] text-white/70">{votedHere ? "Fatto! Ecco come stanno votando gli altri." : "L'hai già votata: ecco com'è andata."}</p>}

        {failed && !state ? (
          <div className="mt-4 rounded-[22px] bg-white/10 px-4 py-4 text-center">
            <p className="text-[14.5px] font-semibold">I voti non si caricano</p>
            <p className="mt-0.5 text-[12.5px] text-white/65">Controlla la connessione e riprova.</p>
            <button type="button" className="studio-rate-retry press mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[14px] font-semibold text-[#1f45b8]" onClick={onRetry}>
              <IconRefresh size={17} /> Riprova
            </button>
          </div>
        ) : (
          <div className={clsx("mt-4 grid grid-cols-5 gap-2", !state && "opacity-60")}>
            {SCORES.map((s, i) =>
              results ? (
                <div key={`r${s}`} className="studio-rate-col flex flex-col items-center" style={{ ["--i" as string]: i }} aria-label={`Voto ${s}: ${counts[i]} ${counts[i] === 1 ? "voto" : "voti"}, ${pct[i]} per cento`}>
                  <span className={clsx("tnum text-[14px] font-bold", counts[i] === top && top > 0 ? "text-[#4dff9f]" : "text-white/90")}>{pct[i]}%</span>
                  <span className="relative mt-1.5 h-[76px] w-full max-w-[38px] overflow-hidden rounded-full bg-white/12">
                    <span
                      className={clsx("studio-rate-fill absolute inset-x-0 bottom-0 origin-bottom rounded-full", counts[i] === top && top > 0 ? "bg-[#4dff9f]" : mine === s ? "bg-volt" : "bg-white/70")}
                      style={{ height: counts[i] > 0 ? `max(${(counts[i] * 100) / (n || 1)}%, 12px)` : 0 }}
                    />
                  </span>
                  <span className={clsx("mt-2 grid h-8 w-8 place-items-center rounded-full text-[15px] font-black", mine === s ? "bg-volt text-volt-ink" : "bg-white/14 text-white")}>{s}</span>
                  <span className="tnum mt-1 text-[11px] text-white/55">
                    {counts[i]} {counts[i] === 1 ? "voto" : "voti"}
                  </span>
                </div>
              ) : (
                <button
                  key={`b${s}`}
                  type="button"
                  disabled={!state || pending !== null}
                  aria-label={`Voto ${s}`}
                  onClick={() => choose(s)}
                  className={clsx(
                    "studio-rate-btn press grid aspect-square w-full place-items-center rounded-full text-[24px] font-black",
                    pending === s ? "is-pending bg-volt text-volt-ink" : "bg-white/14 text-white",
                    pending !== null && pending !== s && "opacity-40",
                  )}
                  style={{ ["--i" as string]: i }}
                >
                  {s}
                </button>
              ),
            )}
          </div>
        )}

        {!results && !(failed && !state) && (
          <div className="mt-2 flex justify-between px-1 text-[11.5px] font-medium text-white/55">
            <span>1 · normale</span>
            <span>5 · spettacolo</span>
          </div>
        )}

        {err && (
          <p role="alert" className="studio-rate-err mt-3 rounded-2xl bg-ball px-4 py-2.5 text-center text-[13px] font-semibold text-white">
            Il voto non è partito. Tocca di nuovo un numero.
          </p>
        )}

        {results && (
          <button type="button" className="studio-rate-next press mt-4 flex w-full items-center justify-center gap-1.5 rounded-full bg-white py-3.5 text-[15.5px] font-bold text-[#1f45b8]" onClick={onDone}>
            {last ? (
              <>
                Continua lo show <IconPlayerPlayFilled size={16} />
              </>
            ) : (
              <>
                Avanti <IconChevronRight size={18} stroke={2.5} />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
