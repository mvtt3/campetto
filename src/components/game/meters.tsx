"use client";

import clsx from "clsx";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { haptic } from "@/components/ui/basics";
import { barPos } from "@/lib/game/match";

/**
 * Le due meccaniche del gioco, disegnate a mano e mosse fuori da React (niente
 * ridisegni a ogni fotogramma: fluido anche sui telefoni economici).
 *  - La barra del tiro: tieni premuto, la barra sale e scende; lasci sul verde.
 *  - Il cerchio a tempo: si stringe sul bersaglio; tocchi quando ci combacia.
 */

export function useHoldMeter({
  sweep,
  onRelease,
  disabled,
}: {
  sweep: number;
  onRelease: (pos: number) => void;
  disabled?: boolean;
}) {
  const fill = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);
  const raf = useRef(0);
  const [holding, setHolding] = useState(false);
  const cb = useRef(onRelease);
  useEffect(() => {
    cb.current = onRelease;
  }, [onRelease]);

  const down = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || start.current !== null) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      haptic(6);
      start.current = performance.now();
      setHolding(true);
      const frame = () => {
        if (start.current === null) return;
        const p = barPos(performance.now() - start.current, sweep);
        if (fill.current) fill.current.style.transform = `scaleY(${p})`;
        raf.current = requestAnimationFrame(frame);
      };
      raf.current = requestAnimationFrame(frame);
    },
    [disabled, sweep],
  );

  const up = useCallback(() => {
    if (start.current === null) return;
    const p = barPos(performance.now() - start.current, sweep);
    start.current = null;
    cancelAnimationFrame(raf.current);
    if (fill.current) fill.current.style.transform = `scaleY(${p})`;
    setHolding(false);
    cb.current(p);
  }, [sweep]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const reset = useCallback(() => {
    if (fill.current) fill.current.style.transform = "scaleY(0)";
  }, []);

  return {
    fill,
    holding,
    reset,
    handlers: {
      onPointerDown: down,
      onPointerUp: up,
      onPointerCancel: up,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
  };
}

/** La barra verticale del tiro, con la zona verde. */
export function MeterBar({
  fill,
  zone,
  center,
  height = 200,
  className,
  flash,
}: {
  fill: React.RefObject<HTMLDivElement | null>;
  zone: number;
  center: number;
  height?: number;
  className?: string;
  /** Dopo il tiro: colora la barra (verde, giallo, rosso). */
  flash?: "verde" | "buono" | "fuori" | null;
}) {
  return (
    <div
      className={clsx("relative w-9 shrink-0 overflow-hidden rounded-full border-[2.5px] border-edge bg-surface", className)}
      style={{ height, boxShadow: "var(--shadow)" }}
      aria-hidden
    >
      {/* vicino al verde */}
      <div
        className="absolute inset-x-0 bg-volt/45"
        style={{ bottom: `${(center - zone) * 100}%`, height: `${zone * 200}%` }}
      />
      {/* il verde */}
      <div
        className="absolute inset-x-0 border-y-2 border-edge bg-ok"
        style={{ bottom: `${(center - zone / 2) * 100}%`, height: `${zone * 100}%` }}
      />
      <div
        ref={fill}
        className={clsx(
          "absolute inset-x-1.5 bottom-0 top-0 origin-bottom rounded-t-full",
          flash === "verde" ? "bg-ok" : flash === "buono" ? "bg-volt" : flash === "fuori" ? "bg-danger" : "bg-ball",
        )}
        style={{ transform: "scaleY(0)", opacity: 0.88 }}
      />
    </div>
  );
}

/** Il bottone grande da tenere premuto. */
export function HoldButton({
  handlers,
  holding,
  disabled,
  children,
  className,
}: {
  handlers: ReturnType<typeof useHoldMeter>["handlers"];
  holding: boolean;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      {...handlers}
      disabled={disabled}
      className={clsx(
        "sticker display flex h-20 touch-none select-none items-center justify-center rounded-full bg-ball text-[28px] text-ball-ink transition-transform disabled:opacity-40",
        holding && "translate-x-[2px] translate-y-[2px] !shadow-[1px_1px_0_var(--edge)]",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Il cerchio parte grande così (rispetto al bersaglio) e combacia a 0,75 del tempo. */
export const RING_START = 2.8;
const RING_K = (RING_START - 1) / 0.75;
/** Quanto è grande il cerchio al tempo p: 1 = combacia col bersaglio. */
export const ringScale = (p: number) => Math.max(0, 1 + RING_K * (0.75 - p));

/**
 * Il cerchio a tempo: parte grande e si stringe sul bersaglio. `tap()` ferma il
 * tempo e restituisce dove era (0–1); se non tocchi, a 1 è finita (null).
 */
export function useRing({
  ms,
  onDone,
  delay = 450,
  active = true,
}: {
  ms: number;
  onDone: (p: number | null) => void;
  delay?: number;
  /** Finché è false il cerchio aspetta (non parte il tempo). */
  active?: boolean;
}) {
  const ring = useRef<HTMLDivElement>(null);
  const t0 = useRef<number | null>(null);
  const done = useRef(false);
  const raf = useRef(0);
  const cb = useRef(onDone);
  useEffect(() => {
    cb.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!active) return;
    done.current = false;
    const startAt = performance.now() + delay;
    const loop = () => {
      const now = performance.now();
      if (now < startAt) {
        if (ring.current) ring.current.style.transform = `scale(${RING_START})`;
        raf.current = requestAnimationFrame(loop);
        return;
      }
      if (t0.current === null) t0.current = startAt;
      const p = (now - t0.current) / ms;
      if (p >= 1) {
        if (ring.current) ring.current.style.transform = `scale(${ringScale(1)})`;
        if (!done.current) {
          done.current = true;
          cb.current(null);
        }
        return;
      }
      if (ring.current) ring.current.style.transform = `scale(${ringScale(p)})`;
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf.current);
      t0.current = null;
    };
  }, [ms, delay, active]);

  const tap = useCallback(() => {
    if (done.current || !active) return;
    if (t0.current === null) return; // ancora in partenza: il tocco non conta
    done.current = true;
    cancelAnimationFrame(raf.current);
    const p = (performance.now() - t0.current) / ms;
    haptic(10);
    cb.current(Math.min(1, p));
  }, [ms, active]);

  return { ring, tap };
}

/** Il bersaglio del cerchio: al centro il compagno, il pallone o l'avversario. */
export function RingTarget({
  ring,
  win,
  size = 92,
  tone = "court",
  children,
}: {
  ring: React.RefObject<HTMLDivElement | null>;
  win: number;
  size?: number;
  tone?: "court" | "ball" | "danger";
  children: ReactNode;
}) {
  const color = tone === "ball" ? "var(--ball)" : tone === "danger" ? "var(--danger)" : "var(--volt)";
  // La fascia buona: da quanto è grande il cerchio a (0,75 − win) a (0,75 + win).
  const outer = ringScale(0.75 - win);
  const inner = ringScale(0.75 + win);
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          width: size * outer,
          height: size * outer,
          background: `radial-gradient(circle, transparent ${(inner / outer) * 70.7}%, color-mix(in srgb, ${color} 30%, transparent) ${(inner / outer) * 70.7}%)`,
        }}
      />
      <div
        ref={ring}
        className="pointer-events-none absolute rounded-full border-[5px]"
        style={{ width: size, height: size, borderColor: color, transform: `scale(${RING_START})`, boxShadow: "0 0 0 2px var(--edge), inset 0 0 0 2px var(--edge)" }}
      />
      <div className="relative grid h-full w-full place-items-center overflow-hidden rounded-full border-[2.5px] border-edge bg-surface" style={{ boxShadow: "var(--shadow)" }}>
        {children}
      </div>
    </div>
  );
}

/** Il pallone che vola verso il canestro (dentro, sul ferro, fuori). */
export function useShotFlight() {
  const ball = useRef<HTMLDivElement>(null);
  const fly = useCallback((made: boolean, outcome: "verde" | "buono" | "fuori") => {
    const el = ball.current;
    if (!el || !el.animate) return Promise.resolve();
    el.style.opacity = "1";
    const miss = !made;
    const side = Math.random() < 0.5 ? -1 : 1;
    const frames: Keyframe[] = [
      { transform: "translate(0px, 0px) scale(1)", offset: 0 },
      { transform: "translate(0px, -230px) scale(0.78)", offset: 0.5 },
      { transform: "translate(0px, -168px) scale(0.6)", offset: 0.82 },
    ];
    if (miss)
      frames.push(
        outcome === "fuori"
          ? { transform: `translate(${side * 60}px, -110px) scale(0.62)`, offset: 1 }
          : { transform: `translate(${side * 34}px, -200px) scale(0.6)`, offset: 1 },
      );
    else frames.push({ transform: "translate(0px, -128px) scale(0.56)", offset: 1 });
    const a = el.animate(frames, { duration: 760, easing: "cubic-bezier(.3,.6,.4,1)", fill: "forwards" });
    return a.finished.then(() => undefined, () => undefined);
  }, []);
  const reset = useCallback(() => {
    const el = ball.current;
    if (!el) return;
    el.getAnimations?.().forEach((a) => a.cancel());
    el.style.opacity = "1";
  }, []);
  return { ball, fly, reset };
}
