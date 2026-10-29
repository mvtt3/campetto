"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { periodLabel, shiftMonth, shiftSeason, type FormatFilter, type Period } from "@/lib/periods";
import { FORMATS } from "@/lib/types";
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
      <div
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
            <button aria-label="Periodo precedente" onClick={() => go(-1)} className="press grid h-10 w-10 place-items-center rounded-full">
              <ChevronLeft size={20} />
            </button>
            <p className="title min-w-0 flex-1 truncate text-center text-[16px]" aria-live="polite">
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
          <p className="title flex-1 pl-2 text-[16px]">Da quando si gioca</p>
        )}
        {onFormat && (
          <label className="relative ml-1 flex h-9 shrink-0 items-center gap-1 rounded-full bg-surface pl-3.5 pr-2.5 text-[13.5px] font-semibold sticker-sm">
            <span>{format === "all" || !format ? "Tutti" : format}</span>
            <ChevronDown size={15} className="text-muted" />
            <select
              aria-label="Formato"
              value={format ?? "all"}
              onChange={(e) => onFormat(e.target.value as FormatFilter)}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              <option value="all">Tutti i formati</option>
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}
