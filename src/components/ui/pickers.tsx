"use client";

import clsx from "clsx";
import { CalendarDays, Check, ChevronDown, Clock3 } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button, haptic } from "./basics";
import { Sheet } from "./sheet";

/* ------------------------------------------------------------------ */
/* Menu a tendina disegnato dall'app (al posto del selettore del telefono) */
/* ------------------------------------------------------------------ */

export interface MenuOption<T extends string> {
  value: T;
  label: ReactNode;
  hint?: ReactNode;
}

export function Menu<T extends string>({
  value,
  options,
  onChange,
  label,
  trigger,
  className,
  align = "end",
}: {
  value: T;
  options: MenuOption<T>[];
  onChange: (v: T) => void;
  /** Nome accessibile del menu. */
  label: string;
  /** Contenuto del pulsante; di base l'etichetta dell'opzione scelta. */
  trigger?: ReactNode;
  className?: string;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left?: number; right?: number; origin: string } | null>(null);
  const current = options.find((o) => o.value === value);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const below = vh - r.bottom;
    const up = below < Math.min(320, options.length * 46 + 24) && r.top > below;
    const horiz = align === "end" ? { right: Math.max(8, vw - r.right) } : { left: Math.max(8, r.left) };
    setPos({
      ...(up ? { bottom: vh - r.top + 8 } : { top: r.bottom + 8 }),
      ...horiz,
      origin: `${up ? "bottom" : "top"} ${align === "end" ? "right" : "left"}`,
    });
  }, [open, align, options.length]);

  useEffect(() => {
    if (!open) return;
    const sel = list.current?.querySelector<HTMLElement>('[aria-selected="true"]') ?? list.current?.querySelector<HTMLElement>('[role="option"]');
    sel?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = [...(list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
        const i = items.indexOf(document.activeElement as HTMLElement);
        items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
      }
    };
    const close = () => setOpen(false);
    window.addEventListener("keydown", key);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => {
          haptic(5);
          setOpen((o) => !o);
        }}
        className={clsx(
          "press flex h-9 shrink-0 items-center gap-1 rounded-full bg-surface pl-3.5 pr-2.5 text-[13.5px] font-semibold sticker-sm",
          className,
        )}
      >
        {trigger ?? <span className="truncate">{current?.label}</span>}
        <ChevronDown size={15} className={clsx("text-muted transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </button>
      {open &&
        pos &&
        createPortal(
          <div className="fixed inset-0 z-[60]" onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}>
            <div
              ref={list}
              role="listbox"
              aria-label={label}
              className="menu-pop fixed min-w-[176px] max-w-[min(92vw,320px)] overflow-hidden rounded-[20px] border-[2.5px] border-edge bg-surface p-1.5"
              style={{ top: pos.top, bottom: pos.bottom, left: pos.left, right: pos.right, transformOrigin: pos.origin, boxShadow: "4px 4px 0 var(--edge)" }}
            >
              <div className="max-h-[min(60vh,360px)] overflow-y-auto overscroll-contain">
                {options.map((o) => {
                  const on = o.value === value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="option"
                      aria-selected={on}
                      onClick={() => {
                        haptic(6);
                        onChange(o.value);
                        setOpen(false);
                        btn.current?.focus();
                      }}
                      className={clsx(
                        "flex min-h-11 w-full items-center gap-3 rounded-[14px] px-3 text-left text-[15px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-court",
                        on ? "bg-volt text-volt-ink" : "active:bg-raised",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{o.label}</span>
                        {o.hint && <span className={clsx("block truncate text-[12px] font-medium", on ? "opacity-75" : "text-muted")}>{o.hint}</span>}
                      </span>
                      <Check size={17} strokeWidth={3} className={on ? "" : "invisible"} aria-hidden />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Orologio: quadrante rétro, prima l'ora poi i minuti                  */
/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, "0");
const C = 120;
const R_OUT = 84;
const R_IN = 54;

function polar(i: number, r: number) {
  const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
}

export function ClockDial({ value, onChange, onDone }: { value: string; onChange: (v: string) => void; onDone?: () => void }) {
  const [h, m] = value.split(":").map(Number);
  const [mode, setMode] = useState<"h" | "m">("h");
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const last = useRef(value);

  const pick = (clientX: number, clientY: number) => {
    const r = svg.current!.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * 240 - C;
    const y = ((clientY - r.top) / r.height) * 240 - C;
    let idx = Math.round(((Math.atan2(y, x) + Math.PI / 2) / (Math.PI * 2)) * 12);
    idx = ((idx % 12) + 12) % 12;
    let next: string;
    if (mode === "h") {
      const inner = Math.hypot(x, y) < (R_IN + R_OUT) / 2;
      // anello esterno: 13–00 (pomeriggio e sera), anello interno: 1–12
      const hour = inner ? (idx === 0 ? 12 : idx) : idx === 0 ? 0 : idx + 12;
      next = `${pad(hour)}:${pad(m)}`;
    } else {
      const fine = Math.round(((Math.atan2(y, x) + Math.PI / 2) / (Math.PI * 2)) * 60);
      const min = (Math.round(fine / 5) * 5 + 60) % 60;
      next = `${pad(h)}:${pad(min)}`;
    }
    if (next !== last.current) {
      last.current = next;
      haptic(3);
      onChange(next);
    }
  };

  const sel = mode === "h" ? (h === 0 ? { i: 0, r: R_OUT } : h > 12 ? { i: h - 12, r: R_OUT } : { i: h % 12, r: R_IN }) : { i: m / 5, r: R_OUT };
  const hand = polar(sel.i, sel.r);

  return (
    <div className="flex flex-col items-center">
      <div className="mb-3 flex items-center gap-1" role="group" aria-label="Orario scelto">
        {(["h", "m"] as const).map((k, i) => (
          <span key={k} className="flex items-center">
            {i === 1 && <span className="display mx-1 text-[34px] leading-none">:</span>}
            <button
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              aria-label={k === "h" ? "Scegli l'ora" : "Scegli i minuti"}
              className={clsx(
                "score press grid h-14 w-[76px] place-items-center rounded-[18px] border-[2.5px] border-edge text-[34px] leading-none",
                mode === k ? "bg-court text-court-ink sticker-sm" : "bg-surface",
              )}
            >
              {pad(k === "h" ? h : m)}
            </button>
          </span>
        ))}
      </div>
      <svg
        ref={svg}
        viewBox="0 0 240 240"
        className="aspect-square w-full max-w-[248px] short:max-w-[200px] touch-none select-none rounded-full outline-none focus-visible:ring-4 focus-visible:ring-court/40"
        role="slider"
        aria-label={mode === "h" ? "Ora" : "Minuti"}
        aria-valuetext={value}
        aria-valuenow={mode === "h" ? h : m}
        aria-valuemin={0}
        aria-valuemax={mode === "h" ? 23 : 55}
        tabIndex={0}
        onKeyDown={(e) => {
          const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
          if (!d) return;
          e.preventDefault();
          onChange(mode === "h" ? `${pad((h + d + 24) % 24)}:${pad(m)}` : `${pad(h)}:${pad((m + d * 5 + 60) % 60)}`);
        }}
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          pick(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => dragging.current && pick(e.clientX, e.clientY)}
        onPointerUp={() => {
          dragging.current = false;
          if (mode === "h") window.setTimeout(() => setMode("m"), 180);
          else onDone?.();
        }}
        onPointerCancel={() => (dragging.current = false)}
      >
        <circle cx={C} cy={C} r="116" fill="var(--edge)" />
        <circle cx={C - 3} cy={C - 3} r="114" fill="var(--surface)" stroke="var(--edge)" strokeWidth="3" />
        {Array.from({ length: 60 }, (_, i) => {
          const a = (i / 60) * Math.PI * 2;
          const r1 = i % 5 ? 108 : 104;
          return (
            <line
              key={i}
              x1={C - 3 + r1 * Math.cos(a)}
              y1={C - 3 + r1 * Math.sin(a)}
              x2={C - 3 + 111 * Math.cos(a)}
              y2={C - 3 + 111 * Math.sin(a)}
              stroke="var(--edge)"
              strokeWidth={i % 5 ? 1 : 2.4}
              opacity={i % 5 ? 0.35 : 0.8}
            />
          );
        })}
        <g transform="translate(-3 -3)">
          <line x1={C} y1={C} x2={hand.x} y2={hand.y} stroke="var(--edge)" strokeWidth="7" strokeLinecap="round" />
          <line x1={C} y1={C} x2={hand.x} y2={hand.y} stroke="var(--ball)" strokeWidth="3.6" strokeLinecap="round" />
          <circle cx={hand.x} cy={hand.y} r="17" fill="var(--ball)" stroke="var(--edge)" strokeWidth="2.8" />
          <circle cx={C} cy={C} r="7" fill="var(--volt)" stroke="var(--edge)" strokeWidth="2.6" />
          {mode === "h" ? (
            <>
              {Array.from({ length: 12 }, (_, i) => {
                const hour = i === 0 ? 0 : i + 12;
                const p = polar(i, R_OUT);
                const on = hour === h;
                return (
                  <text key={`o${i}`} x={p.x} y={p.y} dy="0.36em" textAnchor="middle" className="num" fontSize="17" fill={on ? "var(--ball-ink)" : "var(--text)"}>
                    {pad(hour)}
                  </text>
                );
              })}
              {Array.from({ length: 12 }, (_, i) => {
                const hour = i === 0 ? 12 : i;
                const p = polar(i, R_IN);
                const on = hour === h;
                return (
                  <text key={`i${i}`} x={p.x} y={p.y} dy="0.36em" textAnchor="middle" fontSize="13" fontWeight="700" fill={on ? "var(--ball-ink)" : "var(--muted)"}>
                    {hour}
                  </text>
                );
              })}
            </>
          ) : (
            Array.from({ length: 12 }, (_, i) => {
              const p = polar(i, R_OUT);
              const on = i * 5 === m;
              return (
                <text key={i} x={p.x} y={p.y} dy="0.36em" textAnchor="middle" className="num" fontSize={i % 3 ? 14 : 17} fill={on ? "var(--ball-ink)" : i % 3 ? "var(--muted)" : "var(--text)"}>
                  {pad(i * 5)}
                </text>
              );
            })
          )}
        </g>
      </svg>
      <p className="mt-2 text-[12.5px] font-semibold text-muted">{mode === "h" ? "Tocca o trascina l'ora" : "Ora i minuti"}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ora: orari rapidi + orologio per gli altri                            */
/* ------------------------------------------------------------------ */

export const QUICK_TIMES = ["15:00", "16:00", "17:00", "17:30", "18:00", "18:30", "19:00"];

export function TimeField({ value, onChange, quick = QUICK_TIMES }: { value: string; onChange: (v: string) => void; quick?: string[] }) {
  const custom = !quick.includes(value);
  const [dial, setDial] = useState(false);
  const dialRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (dial) dialRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [dial]);
  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {quick.map((t) => {
          const on = t === value && !dial;
          return (
            <button
              key={t}
              type="button"
              onClick={() => {
                haptic(5);
                setDial(false);
                onChange(t);
              }}
              aria-pressed={on}
              className={clsx("score press h-11 rounded-full text-[17px]", on ? "sticker-sm bg-court text-court-ink" : "border-2 border-line-strong bg-surface")}
            >
              {t}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            haptic(5);
            setDial((d) => !d);
          }}
          aria-pressed={dial || custom}
          aria-expanded={dial}
          aria-label={custom ? `Altro orario: ${value}` : "Altro orario"}
          className={clsx(
            "press flex h-11 items-center justify-center gap-1 rounded-full text-[14px] font-bold",
            dial || custom ? "sticker-sm bg-ball text-ball-ink" : "border-2 border-line-strong bg-surface",
          )}
        >
          <Clock3 size={15} aria-hidden />
          {custom ? <span className="score text-[16px]">{value}</span> : "Altro"}
        </button>
      </div>
      {dial && (
        <div className="dial-in mt-4" ref={dialRef}>
          <ClockDial value={value} onChange={onChange} onDone={() => window.setTimeout(() => setDial(false), 350)} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Data e ora (formato "AAAA-MM-GGTHH:MM") in un pannello dell'app      */
/* ------------------------------------------------------------------ */

const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEKDAY = new Intl.DateTimeFormat("it-IT", { weekday: "short" });
const MONTH = new Intl.DateTimeFormat("it-IT", { month: "short" });
const LONG = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" });

export function dayLabel(day: string, today = new Date()): string {
  const [y, mo, d] = day.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((date.getTime() - t.getTime()) / 86_400_000);
  if (diff === 0) return "Oggi";
  if (diff === -1) return "Ieri";
  if (diff === 1) return "Domani";
  const s = LONG.format(date);
  return s[0].toUpperCase() + s.slice(1);
}

export function DayStrip({ value, onChange, min, max, newestFirst = true }: { value: string; onChange: (d: string) => void; min: Date; max: Date; newestFirst?: boolean }) {
  const days = useMemo(() => {
    const out: Date[] = [];
    const a = new Date(min.getFullYear(), min.getMonth(), min.getDate());
    const b = new Date(max.getFullYear(), max.getMonth(), max.getDate());
    for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) out.push(new Date(d));
    return newestFirst ? out.reverse() : out;
  }, [min, max, newestFirst]);
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  // Il giorno scelto sta sempre al centro, già all'apertura.
  useEffect(() => {
    const strip = ref.current;
    const sel = strip?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!strip || !sel) return;
    const left = sel.offsetLeft - (strip.clientWidth - sel.offsetWidth) / 2;
    strip.scrollTo({ left, behavior: first.current ? "instant" : "smooth" });
    first.current = false;
  }, [value, days]);
  const today = isoDay(new Date());
  return (
    <div ref={ref} className="scroll-x relative -mx-5 flex gap-2 px-5 pb-2 pt-1" role="group" aria-label="Giorno">
      {days.map((d) => {
        const iso = isoDay(d);
        const on = iso === value;
        return (
          <button
            key={iso}
            type="button"
            onClick={() => {
              haptic(5);
              onChange(iso);
            }}
            aria-pressed={on}
            aria-label={dayLabel(iso)}
            className={clsx(
              "press flex h-[70px] w-[58px] shrink-0 flex-col items-center justify-center rounded-[18px] border-[2.5px] border-edge",
              on ? "sticker-sm bg-ball text-ball-ink" : "bg-surface",
            )}
          >
            <span className="text-[11px] font-bold uppercase opacity-80">{iso === today ? "oggi" : WEEKDAY.format(d)}</span>
            <span className="num text-[22px] leading-none">{d.getDate()}</span>
            <span className="text-[10.5px] font-semibold opacity-70">{MONTH.format(d)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function DateTimeField({
  value,
  onChange,
  min,
  max,
  label = "Quando",
  title = "Quando si è giocato?",
}: {
  value: string;
  onChange: (v: string) => void;
  min: Date;
  max: Date;
  label?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [day, time] = value.split("T");
  const [dDay, setDDay] = useState(day);
  const [dTime, setDTime] = useState(time?.slice(0, 5) ?? "18:00");
  return (
    <>
      <button
        type="button"
        aria-label={`${label}: ${dayLabel(day)}, ${time?.slice(0, 5)}`}
        onClick={() => {
          setDDay(day);
          setDTime(time?.slice(0, 5) ?? "18:00");
          setOpen(true);
        }}
        className="press flex h-14 w-full items-center gap-3 rounded-[18px] border-[2.5px] border-edge bg-surface px-4 text-left sticker-sm"
      >
        <CalendarDays size={20} className="shrink-0 text-court" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[15.5px] font-bold">{dayLabel(day)}</span>
        <span className="score text-[20px]">{time?.slice(0, 5)}</span>
      </button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={title}
        footer={
          <Button
            variant="court"
            block
            onClick={() => {
              onChange(`${dDay}T${dTime}`);
              setOpen(false);
            }}
          >
            Fatto · {dayLabel(dDay)}, {dTime}
          </Button>
        }
      >
        <div className="flex flex-col gap-4 pb-2">
          <DayStrip value={dDay} onChange={setDDay} min={min} max={max} />
          <TimeField value={dTime} onChange={setDTime} />
        </div>
      </Sheet>
    </>
  );
}
