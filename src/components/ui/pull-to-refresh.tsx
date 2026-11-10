"use client";

import { play } from "@/lib/sound";
import clsx from "clsx";
import { IconBallBasketball } from "@tabler/icons-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useData } from "@/lib/data/provider";
import { haptic } from "./basics";

const MAX = 128;
const TRIGGER = 74;
const REST = 60;

type Phase = "idle" | "pull" | "ready" | "loading" | "done";

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
      i.style.transform = `translate3d(-50%, ${d - 50}px, 0)`;
      i.style.opacity = d > 6 ? "1" : "0";
      if (phaseRef.current !== "loading") {
        const k = Math.min(1, d / TRIGGER);
        ball.current!.style.transform = `rotate(${d * 3}deg) scale(${0.6 + k * 0.4})`;
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
      doneTimer = window.setTimeout(() => setPhase("idle"), 1500);
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
        className="pointer-events-none absolute left-1/2 top-0 z-20"
        style={{ transform: "translate3d(-50%, -50px, 0)", opacity: 0 }}
        aria-hidden
      >
        <span className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-[var(--shadow)]">
          <span
            ref={ball}
            className={clsx(
              "grid place-items-center text-ball",
              phase === "loading" && "ptr-spin",
            )}
          >
            <IconBallBasketball size={24} strokeWidth={2} />
          </span>
        </span>
      </div>
      {phase === "done" && (
        <p className="sr-only" role="status">
          Aggiornato alle {stamp}
        </p>
      )}
      <div ref={content} className={clsx(!scroll && "h-full")}>
        {children}
      </div>
    </main>
  );
}
