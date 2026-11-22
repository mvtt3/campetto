"use client";

import { IconArrowsMinimize } from "@tabler/icons-react";
import { useCallback, useEffect, useState, type RefObject } from "react";

/**
 * Schermo intero per i video orizzontali, come su TikTok e Instagram: il video si gira di
 * traverso a tutto schermo e il telefono si ruota in mano. L'app resta in verticale (così il feed
 * non si rimescola), il video è girato da noi: funziona anche nell'app installata, che è bloccata
 * in verticale. Dove si può, si va a schermo intero vero (via le barre del telefono).
 */
export function useLandscape(stage: RefObject<HTMLElement | null>) {
  const [land, setLand] = useState(false);

  const enter = useCallback(async () => {
    setLand(true);
    const el = stage.current;
    try {
      if (el?.requestFullscreen && !document.fullscreenElement)
        await el.requestFullscreen({ navigationUI: "hide" });
      // A schermo intero si può tenere l'app in verticale anche se il telefono ruota:
      // il video è già girato, se ruotasse anche la pagina tornerebbe storto.
      const o = screen.orientation as ScreenOrientation & {
        lock?: (o: string) => Promise<void>;
      };
      if (document.fullscreenElement && o?.lock)
        await o.lock("portrait").catch(() => {});
    } catch {
      /* niente schermo intero (iPhone): il video girato riempie lo stesso la schermata */
    }
  }, [stage]);

  const exit = useCallback(() => {
    setLand(false);
    try {
      screen.orientation?.unlock?.();
    } catch {
      /* non era bloccato */
    }
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
  }, []);

  // Il tasto indietro del telefono esce dallo schermo intero: si esce anche da qui.
  useEffect(() => {
    if (!land) return;
    const onChange = () => {
      if (!document.fullscreenElement) exit();
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [land, exit]);

  return { land, enter, exit };
}

/**
 * Il punto toccato, nel verso in cui lo vede chi guarda: a schermo intero il video è girato di
 * 90°, quindi "a destra" per chi guarda è "in basso" sullo schermo.
 */
export function tapInView(
  e: { clientX: number; clientY: number },
  box: DOMRect,
  turned: boolean,
): { x: number; y: number; fx: number } {
  const sx = e.clientX - box.left;
  const sy = e.clientY - box.top;
  if (!turned) return { x: sx, y: sy, fx: sx / Math.max(1, box.width) };
  return { x: sy, y: box.width - sx, fx: sy / Math.max(1, box.height) };
}

/** Il telefono che si gira di traverso, disegnato da noi. */
export function TurnIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <g className="hl-turn-phone">
        <rect x="7" y="3" width="10" height="18" rx="2.4" />
        <path d="M11 17.5h2" />
      </g>
      <path
        className="hl-turn-arrow"
        d="M3.5 9.5a8.5 8.5 0 0 1 4-5.2M2.8 6.6l.7 2.9 2.9-.6"
      />
    </svg>
  );
}

/** Sotto il video orizzontale: il segno per vederlo a tutto schermo girando il telefono. */
export function TurnHint({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className="hl-turn-hint absolute left-1/2 z-[6] flex h-9 items-center gap-1.5 rounded-full border border-[#f6eedc]/20 bg-[#17130f]/55 pl-2.5 pr-3.5 text-[13px] font-bold text-[#f6eedc] backdrop-blur-md"
      data-testid="hl-turn"
    >
      <span className="hl-turn-icon grid h-6 w-6 place-items-center rounded-full bg-[#ef7d2d] text-[#fffaf0]">
        <TurnIcon size={15} />
      </span>
      Schermo intero
    </button>
  );
}

/** A schermo intero: il tasto per tornare indietro (già nel verso del video). */
export function LandExit({ onExit }: { onExit: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onExit();
      }}
      aria-label="Esci dallo schermo intero"
      className="hl-land-exit press absolute left-3 top-3 z-[8] grid h-11 w-11 place-items-center rounded-full bg-[#17130f]/55 text-[#f6eedc] backdrop-blur-md"
      data-testid="hl-land-exit"
    >
      <IconArrowsMinimize size={20} strokeWidth={2.2} aria-hidden />
    </button>
  );
}
