"use client";

import { play, type SoundName } from "@/lib/sound";
import clsx from "clsx";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { animate, motion, useReducedMotion } from "motion/react";
import {
  startTransition,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { Mascot, type MascotPose } from "../mascot";

export function haptic(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* non supportato */
  }
}

type Variant = "primary" | "court" | "secondary" | "ghost" | "danger" | "light";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  block,
  sound,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  block?: boolean;
  /** Il suono al tocco: i tasti principali fanno un "tic" morbido, gli altri niente. */
  sound?: SoundName | false;
}) {
  const tone =
    sound === undefined
      ? variant === "court" || variant === "primary"
        ? "tap"
        : false
      : sound;
  return (
    <button
      {...rest}
      onClick={(e) => {
        haptic();
        if (tone) play(tone);
        rest.onClick?.(e);
      }}
      className={clsx(
        "press inline-flex items-center justify-center gap-2 rounded-full font-semibold disabled:pointer-events-none disabled:opacity-40",
        size === "sm" && "h-9 px-4 text-[13.5px]",
        size === "md" && "h-12 px-5 text-[15px]",
        size === "lg" && "h-14 px-6 text-[16px]",
        variant !== "ghost" && "sticker",
        variant === "primary" && "bg-ball text-ball-ink",
        variant === "court" && "bg-court text-court-ink",
        variant === "secondary" && "bg-surface text-text",
        variant === "ghost" &&
          "text-text active:!shadow-none active:!translate-x-0 active:!translate-y-0",
        variant === "danger" && "bg-surface text-danger",
        // Su superfici blu: bianco, il colore del testo lo decide chi lo usa.
        variant === "light" && "bg-white",
        block && "w-full",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={clsx("card", className)}>
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
  const backCls =
    "sticker-sm press -ml-1 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface";
  return (
    <header className="safe-top shrink-0 px-5">
      <div className="flex min-h-16 items-center gap-3 pt-2">
        {back &&
          (typeof back === "string" ? (
            <Link href={back} aria-label="Indietro" className={backCls}>
              <ChevronLeft size={22} />
            </Link>
          ) : (
            <button onClick={back} aria-label="Indietro" className={backCls}>
              <ChevronLeft size={22} />
            </button>
          ))}
        <div className="min-w-0 flex-1">
          <h1
            className={clsx(
              "display truncate pb-0.5",
              back ? "text-[24px]" : "text-[31px]",
            )}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 truncate text-[13px] text-muted">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
    </header>
  );
}

/** Tab con indicatore che scorre sotto l'opzione scelta. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  size = "md",
  tone = "default",
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
  tone?: "default" | "court";
}) {
  // Si accende subito sotto il dito; quello che cambia sotto arriva un attimo dopo, senza bloccare il tocco.
  const [shown, setShown] = useOptimistic(value);
  const pick = (v: T) => {
    haptic(5);
    startTransition(() => {
      setShown(v);
      onChange(v);
    });
  };
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === shown),
  );
  return (
    <div
      role="tablist"
      className={clsx(
        "relative flex rounded-full p-1",
        tone === "court" ? "bg-white/15" : "sticker-sm bg-surface",
        className,
      )}
    >
      {/* Indicatore che scorre: solo transform, nessun ricalcolo dell'impaginazione. */}
      <span
        aria-hidden
        className={clsx(
          "absolute inset-y-1 left-1 rounded-full border-2 border-edge transition-transform duration-200 ease-out",
          tone === "court" ? "bg-white" : "bg-court",
        )}
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((o) => {
        const active = o.value === shown;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => pick(o.value)}
            className={clsx(
              "relative min-w-0 flex-1 truncate rounded-full px-2 font-semibold transition-colors",
              size === "md" ? "h-10 text-[14px]" : "h-8 text-[13px]",
              active
                ? tone === "court"
                  ? "text-court"
                  : "text-court-ink"
                : tone === "court"
                  ? "text-white/80"
                  : "text-muted",
            )}
          >
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Chips<T extends string>({
  value,
  options,
  onChange,
  className,
  scroll,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
  /**
   * Una riga sola che scorre di lato, come i filtri delle app di oggi: occupa meno spazio e
   * c'è posto per tutte. Quella scelta resta sempre in vista.
   */
  scroll?: boolean;
}) {
  // Come Segmented: la tessera si accende subito, la classifica si ridisegna subito dopo.
  const [shown, setShown] = useOptimistic(value);
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scroll) return;
    const el = row.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    const box = row.current;
    if (!el || !box) return;
    const left = el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2;
    box.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [scroll, value]);
  return (
    // Tessere della stessa larghezza, quattro per riga e centrate: ordinate anche quando vanno a capo.
    <div
      ref={row}
      className={clsx(
        scroll
          ? "scroll-x -mx-5 flex snap-x gap-2 px-5 pb-1.5 pt-0.5 [-webkit-mask-image:linear-gradient(to_right,transparent_0,#000_14px,#000_calc(100%-28px),transparent)] [mask-image:linear-gradient(to_right,transparent_0,#000_14px,#000_calc(100%-28px),transparent)]"
          : "flex flex-wrap justify-center gap-2 pb-0.5 pr-0.5",
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          aria-pressed={o.value === shown}
          onClick={() => {
            haptic(5);
            startTransition(() => {
              setShown(o.value);
              onChange(o.value);
            });
          }}
          className={clsx(
            "press h-9 shrink-0 rounded-full text-[13.5px] font-bold transition-colors duration-300",
            scroll ? "snap-start px-4" : "basis-[calc((100%-1.5rem)/4)] px-1",
            o.value === shown
              ? "sticker-sm bg-volt text-volt-ink"
              : "sticker-sm bg-surface text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Caricamento: una palla che rimbalza. */
export function Spinner({ size = 22 }: { size?: number }) {
  return (
    <span
      role="status"
      aria-label="Caricamento"
      className="inline-flex flex-col items-center"
      style={{ height: size * 2 }}
    >
      <svg
        viewBox="0 0 40 40"
        width={size}
        height={size}
        style={{
          animation: "bounce-ball 0.8s cubic-bezier(0.3, 0.7, 0.4, 1) infinite",
          transformOrigin: "50% 100%",
        }}
        className="mt-auto"
      >
        <circle
          cx="20"
          cy="20"
          r="18"
          fill="#F26A1B"
          stroke="#1D1A16"
          strokeWidth="3"
        />
        <path
          d="M20 2 V38 M2 20 H38 M8 7 Q20 20 8 33 M32 7 Q20 20 32 33"
          stroke="#1D1A16"
          strokeWidth="2.4"
          fill="none"
        />
      </svg>
    </span>
  );
}

/** Linee del campo (arco dei tre punti, area, lunetta) per le superfici blu. */
export function CourtLines({
  className,
  draw,
}: {
  className?: string;
  draw?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 360 220"
      preserveAspectRatio="xMidYMax slice"
      className={clsx("court-lines", draw && "draw", className)}
      aria-hidden
    >
      <path d="M24 220 V150 A156 156 0 0 1 336 150 V220" />
      <rect x="120" y="128" width="120" height="92" />
      <path d="M140 128 A40 40 0 0 1 220 128" />
      <circle cx="180" cy="196" r="9" />
    </svg>
  );
}

/** Schermata vuota: Spicchio fa "boh" e c'è sempre un invito a fare qualcosa. */
export function EmptyState({
  title,
  text,
  action,
  pose = "boh",
  size = 104,
}: {
  title: string;
  text?: string;
  action?: ReactNode;
  pose?: MascotPose;
  size?: number;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-6 text-center">
      <Mascot pose={pose} size={size} />
      <p className="title mt-3 text-[19px]">{title}</p>
      {text && (
        <p className="mt-1.5 max-w-[30ch] text-[14.5px] text-muted">{text}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Numero che conta fino al valore la prima volta che compare. */
export function CountUp({
  value,
  decimals = 0,
  className,
  suffix = "",
}: {
  value: number;
  decimals?: number;
  className?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const last = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmtv = (v: number) =>
      (decimals
        ? v.toFixed(decimals).replace(".", ",")
        : String(Math.round(v))) + suffix;
    if (reduce) {
      el.textContent = fmtv(value);
      return;
    }
    const c = animate(last.current, value, {
      duration: 0.9,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => (el.textContent = fmtv(v)),
    });
    last.current = value;
    return () => c.stop();
  }, [value, decimals, reduce, suffix]);
  return (
    <span
      ref={ref}
      className={className}
      aria-label={`${decimals ? value.toFixed(decimals) : value}${suffix}`}
    >
      {decimals ? (0).toFixed(decimals) : "0"}
      {suffix}
    </span>
  );
}

/** Anello di avanzamento stile Fitness: si riempie con un'animazione. */
export function Ring({
  value,
  size = 64,
  stroke = 8,
  color = "var(--volt)",
  track = "rgb(255 255 255 / 0.18)",
  children,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <span
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1], delay: 0.2 }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center">
        {children}
      </span>
    </span>
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
      <div className={clsx("num", big ? "text-[40px]" : "text-[28px]")}>
        {value}
      </div>
      <div className="mt-1 truncate text-[12.5px] text-muted">{label}</div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        haptic(5);
        play(checked ? "toggleOff" : "toggleOn");
        onChange(!checked);
      }}
      className={clsx(
        "relative h-8 w-[54px] shrink-0 rounded-full border-2 border-edge transition-colors",
        checked ? "bg-ok" : "bg-raised",
      )}
    >
      <motion.span
        className="absolute left-[2px] top-[2px] h-6 w-6 rounded-full border-2 border-edge bg-surface"
        animate={{ x: checked ? 22 : 0 }}
        transition={{ type: "spring", stiffness: 600, damping: 32 }}
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
    <div
      className={clsx(
        "sticker-sm flex items-center rounded-2xl bg-surface",
        compact ? "h-12" : "h-14",
      )}
    >
      <button
        aria-label={`Togli ${label}`}
        onClick={() => {
          haptic(5);
          onChange(Math.max(min, value - 1));
        }}
        className="press grid h-full w-12 place-items-center text-[24px] text-muted"
      >
        −
      </button>
      <div className="min-w-0 flex-1 text-center">
        <div className="num text-[22px]" aria-live="polite">
          {value}
        </div>
        <div className="truncate text-[10.5px] leading-tight text-muted">
          {label}
        </div>
      </div>
      <button
        aria-label={`Aggiungi ${label}`}
        onClick={() => {
          haptic(5);
          onChange(Math.min(max, value + 1));
        }}
        className="press grid h-full w-12 place-items-center text-[24px] text-court"
      >
        +
      </button>
    </div>
  );
}

/** Stato locale che si azzera quando cambia la chiave (es. il mese mostrato). */
export function useKeyed<T>(key: string, initial: T): [T, (v: T) => void] {
  const [s, set] = useState<{ k: string; v: T }>({ k: key, v: initial });
  return [s.k === key ? s.v : initial, (v: T) => set({ k: key, v })];
}

export function pct(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function fmt(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return (
    Number.isInteger(v) && digits <= 1 ? String(v) : v.toFixed(digits)
  ).replace(".", ",");
}

export function signed(v: number, digits = 0): string {
  const s = v.toFixed(digits).replace(".", ",");
  return v > 0 ? `+${s}` : v < 0 ? s.replace("-", "−") : s;
}
