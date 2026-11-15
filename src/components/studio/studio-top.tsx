"use client";

import clsx from "clsx";
import { memo, useEffect, useRef, type RefObject } from "react";
import type { StudioShow } from "@/lib/studio";

/** Il riquadro del video (3:4) nello schermo del telefono: in alto solo un po' d'aria, sotto lo spazio dei sottotitoli. */
export const TOP_VIDEO = { top: 0.09, ratio: 3 / 4 };

/**
 * La sezione "i migliori della giornata" a tutto schermo: un solo video montato (le azioni una dopo
 * l'altra, col misuratore di tiro dentro), tenuto a tempo con l'audio dal player, e sopra la
 * niente: solo l'azione, pulita. Chi e che cosa lo dicono i conduttori, con i sottotitoli sotto.
 */
export const TopStage = memo(function TopStage({
  show,
  videoRef,
  on,
  src,
}: {
  show: StudioShow;
  videoRef: RefObject<HTMLVideoElement | null>;
  on: boolean;
  /** Da dove si legge il video: già scaricato per intero (di solito) o dalla rete; null = non ancora. */
  src: string | null;
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
        <video ref={videoRef} src={src ?? undefined} muted playsInline preload="auto" disablePictureInPicture className="h-full w-full bg-[#0c1736] object-cover" style={{ opacity: 0 }} />
      </div>
    </div>
  );
});

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
