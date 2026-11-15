"use client";

import clsx from "clsx";
import { IconBallBasketball, IconHandMove } from "@tabler/icons-react";
import { memo, useEffect, useRef, type RefObject } from "react";
import { useData } from "@/lib/data/provider";
import type { StudioRateState } from "@/lib/data/backend";
import { fmtAvg, rateStats, type StudioShow, type StudioTopItem } from "@/lib/studio";
import { shortName } from "@/lib/types";
import { Avatar } from "../ui/avatar";

/** Il riquadro del video (3:4) nello schermo del telefono: in alto resta spazio per la scheda, sotto per i sottotitoli. */
export const TOP_VIDEO = { top: 0.14, ratio: 3 / 4 };

/**
 * La sezione "i migliori della giornata" a tutto schermo: un solo video montato (le azioni una dopo
 * l'altra, col misuratore di tiro dentro), tenuto a tempo con l'audio dal player, e sopra la
 * scheda dell'azione in onda: che cos'è, chi, in che partita, e a che punto siamo.
 */
export const TopStage = memo(function TopStage({
  show,
  videoRef,
  cardRef,
  dotsRef,
  on,
  ratings = null,
}: {
  show: StudioShow;
  videoRef: RefObject<HTMLVideoElement | null>;
  cardRef: RefObject<HTMLDivElement | null>;
  dotsRef: RefObject<HTMLDivElement | null>;
  on: boolean;
  /** I voti da 1 a 5 delle azioni: chi ha già votato vede il suo voto e la media sulla scheda. */
  ratings?: StudioRateState | null;
}) {
  const top = show.top!;
  const items = top.items;
  // Lo sfondo: la prima locandina, sfocata e scura (come i reel coi video non a tutto schermo).
  const bg = items[0]?.poster;
  return (
    <div className={clsx("absolute inset-0 overflow-hidden transition-opacity duration-200", on ? "opacity-100" : "pointer-events-none opacity-0")} aria-hidden={!on}>
      <div className="absolute inset-0 bg-[#0c1736]">
        {bg && <span aria-hidden className="absolute inset-0 bg-cover bg-center opacity-35 blur-2xl" style={{ backgroundImage: `url(${bg})`, transform: "scale(1.3)" }} />}
        <span className="absolute inset-0 bg-gradient-to-b from-[#0c1736]/70 via-[#0c1736]/20 to-[#0c1736]/80" />
      </div>
      {/* Il video, 3:4, largo quanto lo schermo. */}
      <div className="absolute inset-x-0 overflow-hidden" style={{ top: `${TOP_VIDEO.top * 100}%`, aspectRatio: "3 / 4" }}>
        <video ref={videoRef} src={top.src} muted playsInline preload="auto" disablePictureInPicture className="h-full w-full bg-[#0c1736] object-cover" style={{ opacity: 0 }} />
        {/* I puntini: quale azione è in onda. */}
        <div ref={dotsRef} className="absolute left-3 top-3 flex gap-1.5" data-i="-1">
          {items.map((it, i) => (
            <span key={i} data-k={it.kind} className="studio-top-dot h-1.5 w-1.5 rounded-full bg-white/45" />
          ))}
        </div>
      </div>
      {/* La scheda dell'azione in onda (la riempie il player quando cambia azione). */}
      <div ref={cardRef} className="studio-top-cards absolute inset-x-0 top-0 h-24 px-4 pt-[max(56px,calc(var(--sat)+46px))]">
        {items.map((it, i) => (
          <TopCard key={i} item={it} i={i} nKind={items.filter((x) => x.kind === it.kind).length} kIndex={items.slice(0, i + 1).filter((x) => x.kind === it.kind).length} rating={ratings?.[i]} />
        ))}
      </div>
    </div>
  );
});

function TopCard({ item, i, nKind, kIndex, rating }: { item: StudioTopItem; i: number; nKind: number; kIndex: number; rating?: { counts: number[]; mine: number | null } }) {
  const { data } = useData();
  const find = (id?: string) => (id ? (data.players.find((p) => p.id === id) ?? data.guests?.find((p) => p.id === id)) : undefined);
  const scorer = find(item.playerId);
  const passer = item.kind === "assist" ? find(item.assistId) : undefined;
  const main = passer ?? scorer;
  const assist = item.kind === "assist";
  return (
    <div className="studio-top-card absolute inset-x-4 flex items-center gap-3" data-i={i}>
      <div className="relative">
        <Avatar player={main} size={46} href={false} ring="none" />
        <span className={clsx("absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full text-[#1d1a16] shadow", assist ? "bg-[#4dff9f]" : "bg-volt")}>
          {assist ? <IconHandMove size={14} stroke={2.4} /> : <IconBallBasketball size={14} stroke={2.4} />}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-volt">
          {assist ? "Assist" : "Canestro"} · {kIndex} di {nKind}
        </p>
        <p className="truncate text-[20px] font-extrabold leading-tight text-white">
          {shortName(main, data.players)}
          {passer && <span className="font-semibold text-white/70"> per {shortName(scorer, data.players)}</span>}
        </p>
        <p className="truncate text-[12.5px] text-white/70">
          Partita {item.game} · {item.label}
        </p>
      </div>
      {/* Già votata: il mio voto e la media, senza fermare lo show. */}
      {rating && rating.mine !== null && (
        <div className="studio-top-rated shrink-0 rounded-[18px] bg-white/14 px-3 py-1.5 text-center backdrop-blur-md">
          <p className="tnum text-[18px] font-black leading-none text-white">{fmtAvg(rateStats(rating.counts).avg)}</p>
          <p className="mt-0.5 text-[10.5px] font-semibold leading-none text-white/70">media · tu {rating.mine}</p>
        </div>
      )}
    </div>
  );
}

/** Tiene sincronizzato un video con il tempo della puntata: salti grandi a scatti, piccoli con la velocità. */
export function syncVideo(v: HTMLVideoElement, want: number, running: boolean, visible: boolean): boolean {
  const len = Number.isFinite(v.duration) ? v.duration : Infinity;
  const inside = want > -0.05 && want < len - 0.05;
  const lag = want - v.currentTime;
  if (inside && running && visible) {
    if (Math.abs(lag) > 0.35) {
      if (v.readyState >= 1 && !v.seeking) v.currentTime = Math.max(0, want + 0.1);
    } else {
      const rate = Math.abs(lag) < 0.04 ? 1 : Math.min(1.12, Math.max(0.88, 1 + lag * 0.8));
      if (Math.abs(v.playbackRate - rate) > 0.005) v.playbackRate = rate;
    }
    if (v.paused) void v.play().catch(() => {});
  } else if (!v.paused) v.pause();
  const was = v.style.opacity === "1";
  const off = Math.abs(lag);
  const ok = visible && inside && !v.seeking && (was ? v.readyState >= 2 && off < 0.6 : v.readyState >= 3 && off < 0.4);
  const op = ok ? "1" : "0";
  if (v.style.opacity !== op) v.style.opacity = op;
  return ok;
}

/** Precarica il video della sezione poco prima che serva (una volta sola). */
export function useWarm(ref: RefObject<HTMLVideoElement | null>, when: boolean) {
  const done = useRef(false);
  useEffect(() => {
    if (!when || done.current) return;
    done.current = true;
    const v = ref.current;
    if (v && v.preload !== "auto") v.preload = "auto";
    v?.load();
  }, [when, ref]);
}
