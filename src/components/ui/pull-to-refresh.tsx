"use client";

import { play } from "@/lib/sound";
import clsx from "clsx";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Mascot } from "@/components/mascot";
import { useData } from "@/lib/data/provider";
import { haptic } from "./basics";

const MAX = 128;
const TRIGGER = 74;
const REST = 64;

type Phase = "idle" | "pull" | "ready" | "loading" | "done";

/** La faccia di Spicchio, ritagliata dalla mascotte. */
export function SpicchioFace({
  size = 34,
  pose = "ciao",
}: {
  size?: number;
  pose?: "ciao" | "boh";
}) {
  return (
    <svg
      viewBox="31 33 98 98"
      width={size}
      height={size}
      aria-hidden
      className="overflow-hidden rounded-full"
    >
      <Mascot pose={pose} size={160} animate={false} />
    </svg>
  );
}

/**
 * Contenitore con "tira giù per aggiornare": Spicchio scende dall'alto girando
 * come una palla, al rilascio ricarica i dati e compare il cartellino
 * "Aggiornato alle HH:MM". Il trascinamento aggiorna direttamente lo stile
 * (niente ridisegni di React a ogni movimento), così resta fluido anche sui
 * telefoni economici.
 */
export function PullToRefresh({
  children,
  className,
  scroll = true,
}: {
  children: ReactNode;
  className?: string;
  /** false per le schermate fisse: il gesto funziona, ma il contenuto non scorre. */
  scroll?: boolean;
}) {
  const { refresh } = useData();
  const box = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const ind = useRef<HTMLDivElement>(null);
  const ball = useRef<HTMLSpanElement>(null);
  const phaseRef = useRef<Phase>("idle");
  const [phase, setPhaseState] = useState<Phase>("idle");
  const [stamp, setStamp] = useState("");
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    const el = box.current!;
    const setPhase = (p: Phase) => {
      if (phaseRef.current === p) return;
      phaseRef.current = p;
      setPhaseState(p);
    };
    let sx = 0;
    let sy = 0;
    let tracking = false;
    let decided = false;
    let dist = 0;
    let doneTimer = 0;

    const paint = (d: number, animate: boolean) => {
      dist = d;
      const ease = "cubic-bezier(0.2, 0.9, 0.3, 1.12)";
      const c = content.current!;
      const i = ind.current!;
      c.style.transition = animate ? `transform 320ms ${ease}` : "none";
      c.style.transform = d ? `translate3d(0, ${d}px, 0)` : "";
      i.style.transition = animate
        ? `transform 320ms ${ease}, opacity 200ms`
        : "none";
      i.style.transform = `translate3d(-50%, ${d - 60}px, 0)`;
      i.style.opacity = d > 6 ? "1" : "0";
      if (phaseRef.current !== "loading") {
        const k = Math.min(1, d / TRIGGER);
        ball.current!.style.transform = `rotate(${d * 3}deg) scale(${0.55 + k * 0.45})`;
      }
    };

    const start = (e: TouchEvent) => {
      if (
        phaseRef.current === "loading" ||
        el.scrollTop > 0 ||
        e.touches.length > 1
      )
        return;
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      tracking = true;
      decided = false;
    };
    const move = (e: TouchEvent) => {
      if (!tracking) return;
      const dx = e.touches[0].clientX - sx;
      const dy = e.touches[0].clientY - sy;
      if (!decided) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        // Solo verso il basso, e solo se il gesto è più verticale che orizzontale.
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || el.scrollTop > 0) {
          tracking = false;
          return;
        }
        decided = true;
        window.clearTimeout(doneTimer);
      }
      if (e.cancelable) e.preventDefault();
      const d = MAX * (1 - Math.exp(-Math.max(0, dy) / 210));
      paint(d, false);
      const next = d >= TRIGGER ? "ready" : "pull";
      if (next === "ready" && phaseRef.current !== "ready") haptic(8);
      setPhase(next);
    };
    const end = async () => {
      if (!tracking || !decided) {
        tracking = false;
        return;
      }
      tracking = false;
      if (dist < TRIGGER) {
        paint(0, true);
        setPhase("idle");
        return;
      }
      haptic(14);
      setPhase("loading");
      paint(REST, true);
      ball.current!.style.transform = "";
      await Promise.all([
        refreshRef.current().catch(() => {}),
        new Promise((r) => setTimeout(r, 700)),
      ]);
      const now = new Date();
      play("refresh");
      setStamp(
        `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      );
      setPhase("done");
      paint(0, true);
      doneTimer = window.setTimeout(() => setPhase("idle"), 2200);
    };

    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
      window.clearTimeout(doneTimer);
    };
  }, []);

  return (
    <main
      ref={box}
      data-testid="scroll-container"
      className={clsx(
        "relative min-h-0 flex-1",
        scroll ? "scroll-area" : "overflow-hidden",
        className,
      )}
    >
      <div
        ref={ind}
        className="pointer-events-none absolute left-1/2 top-0 z-20 flex flex-col items-center"
        style={{ transform: "translate3d(-50%, -60px, 0)", opacity: 0 }}
        aria-hidden
      >
        <span
          className="grid h-12 w-12 place-items-center overflow-hidden rounded-full border-[2.5px] border-edge bg-volt"
          style={{ boxShadow: "2px 2px 0 var(--edge)" }}
        >
          <span
            ref={ball}
            className={clsx(
              "grid place-items-center",
              phase === "loading" && "ptr-spin",
            )}
          >
            <SpicchioFace size={40} />
          </span>
        </span>
        <span
          className={clsx(
            "mt-1.5 whitespace-nowrap rounded-full border-2 border-edge bg-surface px-2.5 py-0.5 text-[11.5px] font-bold transition-opacity duration-150",
            phase === "pull" || phase === "ready" ? "opacity-100" : "opacity-0",
          )}
        >
          {phase === "ready" ? "Lascia e aggiorno!" : "Tira giù"}
        </span>
      </div>
      {phase === "done" && (
        <div
          className="pointer-events-none absolute inset-x-0 top-1 z-20 flex justify-center"
          role="status"
        >
          <span
            className="ptr-done flex items-center gap-2 rounded-full border-[2.5px] border-edge bg-volt py-1 pl-1 pr-3.5 text-[13px] font-bold text-volt-ink"
            style={{ boxShadow: "3px 3px 0 var(--edge)" }}
          >
            <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full border-2 border-[#1d1a16] bg-court">
              <SpicchioFace size={24} />
            </span>
            Aggiornato alle {stamp}
          </span>
        </div>
      )}
      <div ref={content} className={clsx(!scroll && "h-full")}>
        {children}
      </div>
    </main>
  );
}
