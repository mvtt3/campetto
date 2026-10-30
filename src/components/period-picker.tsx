"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import {
  isBeforeStart,
  periodLabel,
  shiftMonth,
  shiftSeason,
  type FormatFilter,
  type Period,
} from "@/lib/periods";
import { FORMATS } from "@/lib/types";
import { haptic, Segmented } from "./ui/basics";
import { Menu } from "./ui/pickers";

export function defaultPeriod(kind: Period["kind"], now = new Date()): Period {
  if (kind === "all") return { kind: "all" };
  if (kind === "month")
    return { kind: "month", year: now.getFullYear(), month: now.getMonth() };
  return {
    kind: "season",
    year: now.getFullYear(),
    quarter: Math.floor(now.getMonth() / 3),
  };
}

function shift(p: Period, d: number): Period {
  if (p.kind === "month")
    return { kind: "month", ...shiftMonth(p.year, p.month, d) };
  if (p.kind === "season")
    return { kind: "season", ...shiftSeason(p.year, p.quarter, d) };
  return p;
}

function isFuture(p: Period, now = new Date()): boolean {
  if (p.kind === "month")
    return p.year * 12 + p.month > now.getFullYear() * 12 + now.getMonth();
  if (p.kind === "season")
    return (
      p.year * 4 + p.quarter >
      now.getFullYear() * 4 + Math.floor(now.getMonth() / 3)
    );
  return false;
}

/** Mese / stagione / sempre, frecce o swipe per spostarsi, formato come menu compatto. */
export function PeriodPicker({
  value,
  onChange,
  format,
  onFormat,
}: {
  value: Period;
  onChange: (p: Period) => void;
  format?: FormatFilter;
  onFormat?: (f: FormatFilter) => void;
}) {
  const startX = useRef<number | null>(null);
  const go = (d: number) => {
    const n = shift(value, d);
    if (isFuture(n) || isBeforeStart(n)) return;
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
      <div
        data-no-swipe
        className="flex h-10 items-center gap-1"
        onTouchStart={(e) => (startX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (startX.current === null) return;
          const dx = e.changedTouches[0].clientX - startX.current;
          startX.current = null;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        }}
      >
        {value.kind !== "all" ? (
          <>
            <button
              aria-label="Periodo precedente"
              onClick={() => go(-1)}
              disabled={isBeforeStart(shift(value, -1))}
              className="press grid h-10 w-10 place-items-center rounded-full disabled:opacity-25"
            >
              <ChevronLeft size={20} />
            </button>
            <p
              className="title min-w-0 flex-1 truncate text-center text-[16px]"
              aria-live="polite"
            >
              {periodLabel(value).replace("Stagione ", "")}
            </p>
            <button
              aria-label="Periodo successivo"
              onClick={() => go(1)}
              disabled={isFuture(shift(value, 1))}
              className="press grid h-10 w-10 place-items-center rounded-full disabled:opacity-25"
            >
              <ChevronRight size={20} />
            </button>
          </>
        ) : (
          <p className="title flex-1 pl-2 text-[16px]">Da ottobre 2026</p>
        )}
        {onFormat && (
          <Menu<FormatFilter>
            label="Formato"
            className="ml-1"
            value={format ?? "all"}
            onChange={onFormat}
            trigger={
              <span>{format === "all" || !format ? "Tutti" : format}</span>
            }
            options={[
              { value: "all", label: "Tutti i formati" },
              ...FORMATS.map((f) => ({
                value: f as FormatFilter,
                label: f,
                hint: `${f[0]} contro ${f[0]}`,
              })),
            ]}
          />
        )}
      </div>
    </div>
  );
}
