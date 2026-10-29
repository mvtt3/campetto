"use client";

import clsx from "clsx";
import { RefreshCw } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { useData } from "@/lib/data/provider";
import { haptic } from "./basics";

const THRESHOLD = 72;

/**
 * Scroll container with pull-to-refresh. Installed PWAs have no browser refresh,
 * so dragging down at the top reloads the data.
 */
export function PullToRefresh({
  children,
  className,
  scroll = true,
}: {
  children: ReactNode;
  className?: string;
  /** false for static screens: the gesture still works, but the content doesn't scroll. */
  scroll?: boolean;
}) {
  const { refresh } = useData();
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      ref={ref}
      data-testid="scroll-container"
      className={clsx("relative min-h-0 flex-1", scroll ? "scroll-area" : "overflow-hidden", className)}
      onTouchStart={(e) => {
        if ((ref.current?.scrollTop ?? 0) <= 0 && !busy) {
          start.current = e.touches[0].clientY;
          setDragging(true);
        }
      }}
      onTouchMove={(e) => {
        if (start.current === null) return;
        const d = e.touches[0].clientY - start.current;
        if (d > 0) setPull(Math.min(110, d * 0.5));
        else {
          start.current = null;
          setDragging(false);
          setPull(0);
        }
      }}
      onTouchEnd={async () => {
        const go = pull >= THRESHOLD * 0.75;
        start.current = null;
        setDragging(false);
        if (go) {
          haptic(12);
          setBusy(true);
          setPull(48);
          await refresh();
          setBusy(false);
        }
        setPull(0);
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center"
        style={{ transform: `translateY(${pull - 36}px)`, opacity: pull > 8 ? 1 : 0, transition: dragging ? undefined : "all 200ms" }}
        aria-hidden={!busy}
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-surface shadow ring-1 ring-line">
          <RefreshCw
            size={18}
            className="text-ball"
            style={{ transform: `rotate(${pull * 3}deg)`, animation: busy ? "spin 0.8s linear infinite" : undefined }}
          />
        </span>
      </div>
      <div style={{ transform: pull ? `translateY(${pull * 0.6}px)` : undefined, transition: dragging ? undefined : "transform 200ms" }} className={clsx(!scroll && "h-full")}>
        {children}
      </div>
    </div>
  );
}
