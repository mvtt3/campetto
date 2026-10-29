"use client";

import clsx from "clsx";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function haptic(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* non supportato */
  }
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  block,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg"; block?: boolean }) {
  return (
    <button
      {...rest}
      onClick={(e) => {
        haptic();
        rest.onClick?.(e);
      }}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold transition-[transform,background-color,opacity] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
        size === "sm" && "h-9 px-3 text-[13px]",
        size === "md" && "h-12 px-4 text-[15px]",
        size === "lg" && "h-14 px-5 text-base",
        variant === "primary" && "bg-ball text-ball-ink",
        variant === "secondary" && "bg-raised text-text ring-1 ring-line ring-inset",
        variant === "ghost" && "text-text hover:bg-raised",
        variant === "danger" && "bg-raised text-danger ring-1 ring-line ring-inset",
        block && "w-full",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={clsx("rounded-[var(--radius-card)] bg-surface ring-1 ring-line ring-inset", className)}
      style={{ boxShadow: "var(--shadow)", ...rest.style }}
    >
      {children}
    </div>
  );
}

export function ScreenHeader({
  title,
  back,
  action,
  subtitle,
}: {
  title: ReactNode;
  back?: string | (() => void);
  action?: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <header className="safe-top shrink-0 px-4">
      <div className="flex h-14 items-center gap-2">
        {back &&
          (typeof back === "string" ? (
            <Link href={back} aria-label="Indietro" className="-ml-2 grid h-11 w-11 place-items-center rounded-full active:bg-raised">
              <ChevronLeft size={24} />
            </Link>
          ) : (
            <button onClick={back} aria-label="Indietro" className="-ml-2 grid h-11 w-11 place-items-center rounded-full active:bg-raised">
              <ChevronLeft size={24} />
            </button>
          ))}
        <div className="min-w-0 flex-1">
          <h1 className="title truncate text-[24px]">{title}</h1>
          {subtitle && <p className="truncate text-[13px] text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  size = "md",
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="tablist" className={clsx("flex rounded-[14px] bg-raised p-1 ring-1 ring-line ring-inset", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => {
            haptic(5);
            onChange(o.value);
          }}
          className={clsx(
            "min-w-0 flex-1 truncate rounded-[10px] px-2 font-semibold transition-colors",
            size === "md" ? "h-9 text-[14px]" : "h-8 text-[13px]",
            o.value === value ? "bg-surface text-text shadow-[0_1px_2px_rgb(0_0_0/0.12)] ring-1 ring-line" : "text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={clsx("scroll-x -mx-4 flex gap-2 px-4", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          aria-pressed={o.value === value}
          onClick={() => {
            haptic(5);
            onChange(o.value);
          }}
          className={clsx(
            "h-9 shrink-0 rounded-full px-3.5 text-[14px] font-semibold transition-colors",
            o.value === value ? "bg-text text-bg" : "bg-raised text-muted ring-1 ring-line ring-inset",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <span
      role="status"
      aria-label="Caricamento"
      className="inline-block rounded-full border-2 border-line-strong border-t-ball"
      style={{ width: size, height: size, animation: "spin 0.8s linear infinite" }}
    />
  );
}

/** The three-point arc of the playground, the app's recurring motif. */
export function CourtArc({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden fill="none">
      <path d="M8 120 V96 A92 92 0 0 1 192 96 V120" stroke="currentColor" strokeWidth="1.5" />
      <rect x="70" y="72" width="60" height="48" stroke="currentColor" strokeWidth="1.5" />
      <path d="M78 72 A22 22 0 0 1 122 72" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="relative flex flex-col items-center justify-center px-6 py-8 text-center">
      <CourtArc className="mb-4 w-40 text-court" />
      <p className="title text-[19px]">{title}</p>
      {text && <p className="mt-1 max-w-[30ch] text-[14px] text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatBlock({
  value,
  label,
  className,
  big,
}: {
  value: ReactNode;
  label: ReactNode;
  className?: string;
  big?: boolean;
}) {
  return (
    <div className={clsx("min-w-0", className)}>
      <div className={clsx("num", big ? "text-[40px]" : "text-[28px]")}>{value}</div>
      <div className="mt-1 truncate text-[12px] text-muted">{label}</div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        haptic(5);
        onChange(!checked);
      }}
      className={clsx(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors",
        checked ? "bg-ball" : "bg-line-strong",
      )}
    >
      <span
        className={clsx(
          "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function Stepper({
  value,
  onChange,
  label,
  min = 0,
  max = 99,
  compact,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  min?: number;
  max?: number;
  compact?: boolean;
}) {
  return (
    <div className={clsx("flex items-center rounded-[14px] bg-raised ring-1 ring-line ring-inset", compact ? "h-11" : "h-12")}>
      <button
        aria-label={`Togli ${label}`}
        onClick={() => {
          haptic(5);
          onChange(Math.max(min, value - 1));
        }}
        className="grid h-full w-11 place-items-center text-[22px] text-muted active:text-text"
      >
        −
      </button>
      <div className="min-w-0 flex-1 text-center">
        <div className="num text-[22px]" aria-live="polite">
          {value}
        </div>
        <div className="truncate text-[10.5px] leading-tight text-muted">{label}</div>
      </div>
      <button
        aria-label={`Aggiungi ${label}`}
        onClick={() => {
          haptic(5);
          onChange(Math.min(max, value + 1));
        }}
        className="grid h-full w-11 place-items-center text-[22px] text-text"
      >
        +
      </button>
    </div>
  );
}

export function pct(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function fmt(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Number.isInteger(v) && digits <= 1 ? String(v) : v.toFixed(digits);
}

export function signed(v: number, digits = 0): string {
  const s = v.toFixed(digits);
  return v > 0 ? `+${s}` : v < 0 ? s.replace("-", "−") : s;
}
