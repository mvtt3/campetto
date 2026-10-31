"use client";

import clsx from "clsx";
import { Clapperboard, Play } from "lucide-react";
import { NewDot } from "@/components/new-dot";
import type { Highlight } from "@/lib/types";
import { useHighlights } from "./provider";

function length(h: Highlight): string {
  const s = Math.round(h.duration);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function baskets(h: Highlight): string {
  const n = h.clips.length;
  if (!n) return "I canestri della partita";
  return n === 1 ? "1 canestro" : `${n} canestri`;
}

/** Nella scheda della partita: l'anteprima del video, grande e da toccare. */
export function HighlightCard({
  matchId,
  onOpen,
}: {
  matchId: string;
  /** Prima di aprire (es. chiudere la scheda partita). Riceve se l'indirizzo va sostituito. */
  onOpen?: (replace: boolean) => void;
}) {
  const hl = useHighlights();
  const h = hl.forMatch(matchId);
  if (!h) return null;
  return (
    <button
      onClick={() => {
        // La scheda partita aperta da indirizzo (?m=) lascia il posto al video: indietro torna alla lista.
        const replace = new URLSearchParams(window.location.search).has("m");
        onOpen?.(replace);
        hl.open(matchId, { replace });
      }}
      className="sticker press relative flex w-full items-center gap-3 overflow-hidden rounded-[20px] bg-surface p-1.5 pr-3 text-left text-text"
      data-testid="hl-open"
      data-tour="match-highlights"
    >
      <span className="relative aspect-video w-[104px] shrink-0 overflow-hidden rounded-[14px] border-2 border-edge bg-[#17130f]">
        {h.posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={h.posterUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover opacity-90"
          />
        )}
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#1d1a16] bg-ball text-ball-ink">
            <Play size={15} fill="currentColor" className="ml-0.5" />
          </span>
        </span>
        <span className="absolute bottom-1 right-1 rounded-md bg-[#17130f]/80 px-1 text-[10.5px] font-bold text-[#f6eedc] tnum">
          {length(h)}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="title block text-[16px] leading-tight">
          Guarda gli highlights
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] text-muted">
          {baskets(h)}
        </span>
      </span>
      {hl.unseen(matchId) && <NewDot className="shrink-0" />}
    </button>
  );
}

/** In fondo a una serata: i video di quella sera, dal primo. */
export function NightHighlightsButton({ matchIds }: { matchIds: string[] }) {
  const hl = useHighlights();
  const withVideo = matchIds.filter((id) => hl.forMatch(id));
  if (!withVideo.length) return null;
  const fresh = withVideo.some((id) => hl.unseen(id));
  return (
    <button
      onClick={() => hl.open(withVideo[0])}
      className="sticker press relative flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ball text-[14px] font-bold text-ball-ink"
      data-testid="hl-night"
      data-tour="matches-highlights"
    >
      <span className="grid h-6 w-6 place-items-center rounded-full bg-ball-ink text-ball">
        <Play size={12} fill="currentColor" className="ml-px" />
      </span>
      {withVideo.length === 1
        ? "Guarda gli highlights"
        : `Highlights della serata · ${withVideo.length} video`}
      {fresh && <NewDot className="absolute -right-1 -top-1" />}
    </button>
  );
}

/**
 * Il bollino ▶ dentro una scheda che è già un link (es. "Ultima partita" nella Home): non è un
 * pulsante a parte (niente controlli uno dentro l'altro), è la scheda a riconoscere il tocco
 * su [data-hl-badge] e ad aprire il video.
 */
export function PlayBadge({
  matchId,
  className,
}: {
  matchId: string;
  className?: string;
}) {
  const hl = useHighlights();
  if (!hl.forMatch(matchId)) return null;
  return (
    <span
      data-hl-badge
      title="Guarda gli highlights"
      className={clsx(
        "sticker-sm press relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ball text-ball-ink",
        className,
      )}
      data-testid="hl-badge"
    >
      <Play size={14} fill="currentColor" className="ml-0.5" aria-hidden />
      <span className="sr-only">, con gli highlights</span>
      {hl.unseen(matchId) && (
        <NewDot className="absolute -right-1 -top-1 !h-3 !w-3" />
      )}
    </span>
  );
}

/**
 * Il tasto degli highlights nella barra della Home, accanto alle notizie (come era IGTV su
 * Instagram): secondario, sempre lì, apre il video più recente. Pallino finché c'è da vedere.
 */
export function HighlightsHomeButton() {
  const hl = useHighlights();
  if (!hl.latest) return null;
  return (
    <button
      onClick={() => hl.latest && hl.open(hl.latest)}
      aria-label={
        hl.unseenCount
          ? `Highlights, ${hl.unseenCount} da vedere`
          : "Highlights"
      }
      className="sticker-sm press relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface"
      data-testid="hl-home"
      data-tour="home-highlights"
    >
      <Clapperboard size={20} aria-hidden />
      {hl.unseenCount > 0 && (
        <NewDot className="absolute -right-0.5 -top-0.5 !border-surface" />
      )}
    </button>
  );
}
