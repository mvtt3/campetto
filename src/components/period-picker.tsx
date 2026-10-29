"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { periodLabel, shiftMonth, shiftSeason, type Period } from "@/lib/periods";
import { haptic, Segmented } from "./ui/basics";

export function defaultPeriod(kind: Period["kind"], now = new Date()): Period {
  if (kind === "all") return { kind: "all" };
  if (kind === "month") return { kind: "month", year: now.getFullYear(), month: now.getMonth() };
  return { kind: "season", year: now.getFullYear(), quarter: Math.floor(now.getMonth() / 3) };
}

function shift(p: Period, d: number): Period {
  if (p.kind === "month") return { kind: "month", ...shiftMonth(p.year, p.month, d) };
  if (p.kind === "season") return { kind: "season", ...shiftSeason(p.year, p.quarter, d) };
  return p;
}

function isFuture(p: Period, now = new Date()): boolean {
  if (p.kind === "month") return p.year * 12 + p.month > now.getFullYear() * 12 + now.getMonth();
  if (p.kind === "season") return p.year * 4 + p.quarter > now.getFullYear() * 4 + Math.floor(now.getMonth() / 3);
  return false;
}

/** Month / season / all-time, with arrows and horizontal swipe to move between periods. */
export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const startX = useRef<number | null>(null);
  const go = (d: number) => {
    const n = shift(value, d);
    if (isFuture(n)) return;
    haptic(5);
    onChange(n);
  };
  return (
    <div className="flex flex-col gap-2">
      <Segmented
        value={value.kind}
        onChange={(k) => onChange(defaultPeriod(k))}
        options={[
          { value: "month", label: "Mese" },
          { value: "season", label: "Stagione" },
          { value: "all", label: "Sempre" },
        ]}
      />
      {value.kind !== "all" && (
        <div
          className="flex items-center justify-between"
          onTouchStart={(e) => (startX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (startX.current === null) return;
            const dx = e.changedTouches[0].clientX - startX.current;
            startX.current = null;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          }}
        >
          <button aria-label="Periodo precedente" onClick={() => go(-1)} className="grid h-10 w-10 place-items-center rounded-full active:bg-raised">
            <ChevronLeft size={20} />
          </button>
          <p className="title text-[17px]" aria-live="polite">
            {periodLabel(value)}
          </p>
          <button
            aria-label="Periodo successivo"
            onClick={() => go(1)}
            disabled={isFuture(shift(value, 1))}
            className="grid h-10 w-10 place-items-center rounded-full active:bg-raised disabled:opacity-25"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
