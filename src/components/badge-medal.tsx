"use client";

import clsx from "clsx";
import { NewTag } from "./new-dot";
import { useEffect, useId, useRef } from "react";
import { haptic } from "./ui/basics";
import {
  IconArrowBackUp,
  IconAward,
  IconBolt,
  IconCalendarCheck,
  IconCrosshair,
  IconCrown,
  IconEye,
  IconFlame,
  IconFocus2,
  IconHandGrab,
  IconHandStop,
  IconHeartHandshake,
  IconLock,
  IconMedal,
  IconPlanet,
  IconRefresh,
  IconRepeat,
  IconRocket,
  IconShield,
  IconShieldCheck,
  IconShieldOff,
  IconShoe,
  IconSparkles,
  IconStack,
  IconStack2,
  IconStack3,
  IconStopwatch,
  IconSwords,
  IconTarget,
  IconTrendingUp,
  IconTrophy,
  type Icon,
} from "@tabler/icons-react";
import {
  TIER_NAMES,
  type BadgeIcon,
  type BadgeState,
  type Tier,
} from "@/lib/badges";

const ICONS: Record<BadgeIcon, Icon> = {
  points: IconTarget,
  assist: IconPlanet,
  rebound: IconRefresh,
  steal: IconHandStop,
  block: IconShield,
  three: IconCrosshair,
  win: IconMedal,
  streak: IconBolt,
  presence: IconShoe,
  hot: IconFlame,
  vision: IconEye,
  paint: IconStack,
  clean: IconShieldCheck,
  allround: IconSparkles,
  crown: IconCrown,
  trophy: IconTrophy,
  comeback: IconArrowBackUp,
  duel: IconSwords,
  calendar: IconCalendarCheck,
  shutout: IconRocket,
  clutch: IconStopwatch,
  opener: IconTrendingUp,
  sniper: IconCrosshair,
  thief: IconHandGrab,
  swat: IconShieldOff,
  double: IconStack2,
  triple: IconStack3,
  aim: IconFocus2,
  fair: IconHeartHandshake,
  star: IconAward,
  putback: IconRepeat,
};

/** Fill (two stops) and ink for each tier. */
export const TIER_STYLE: Record<
  Tier,
  { a: string; b: string; ink: string; label: string }
> = {
  0: {
    a: "var(--raised)",
    b: "var(--raised)",
    ink: "var(--faint)",
    label: TIER_NAMES[0],
  },
  1: { a: "#d6996b", b: "#8f5631", ink: "#2a160a", label: TIER_NAMES[1] },
  2: { a: "#e4e8ec", b: "#8d98a3", ink: "#1d232a", label: TIER_NAMES[2] },
  3: { a: "#f7dc87", b: "#c18d26", ink: "#2b1d03", label: TIER_NAMES[3] },
  4: { a: "#c3a8f2", b: "#6b46b8", ink: "#160a2e", label: TIER_NAMES[4] },
  5: { a: "#ff9a4d", b: "#b0124f", ink: "#fff6ee", label: TIER_NAMES[5] },
};

export function BadgeMedal({
  icon,
  tier,
  size = 56,
  className,
  animate,
}: {
  icon: BadgeIcon;
  tier: Tier;
  size?: number;
  className?: string;
  animate?: boolean;
}) {
  const s = TIER_STYLE[tier];
  const Icon = tier === 0 ? IconLock : ICONS[icon];
  // Unique per instance: a hidden copy of the same medal must not own the gradient.
  const id = `g-${useId().replace(/:/g, "")}`;
  return (
    <span
      className={clsx(
        "relative inline-grid shrink-0 place-items-center overflow-hidden",
        className,
      )}
      style={{
        width: size,
        height: size * 1.08,
        animation: animate
          ? "badge-reveal 700ms cubic-bezier(.2,.9,.3,1.2)"
          : undefined,
      }}
      role="img"
      aria-label={`${s.label}`}
    >
      <svg
        viewBox="0 0 100 108"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0" stopColor={s.a} />
            <stop offset="1" stopColor={s.b} />
          </linearGradient>
        </defs>
        {/* Scudo a sei lati con angoli morbidi */}
        <path
          d="M50 3 L90 22 Q95 25 95 31 L95 72 Q95 78 90 81 L50 105 L10 81 Q5 78 5 72 L5 31 Q5 25 10 22 Z"
          fill={`url(#${id})`}
          stroke={tier === 0 ? "var(--line-strong)" : "#1d1a16"}
          strokeWidth={tier === 0 ? 2.5 : 5}
          strokeDasharray={tier === 0 ? "5 4" : undefined}
        />
        {tier >= 4 && (
          <path
            d="M50 12 L84 28 L84 70 L50 92 L16 70 L16 28 Z"
            fill="none"
            stroke="rgb(255 255 255 / 0.4)"
            strokeWidth="1.2"
          />
        )}
      </svg>
      <Icon
        size={size * 0.42}
        color={s.ink}
        strokeWidth={2.2}
        className="relative"
        aria-hidden
      />
      {animate && (
        <span
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/40"
          style={{ animation: "shine 1.1s 0.5s ease-out both" }}
        />
      )}
    </span>
  );
}

/**
 * Il badge grande della scheda: si trascina e gira come una moneta, segue il dito,
 * continua con lo slancio e si ferma su una faccia. Dietro: livello e numero.
 * Un tocco lo fa girare una volta. Solo rotazione 3D di un livello già disegnato.
 */
export function SpinMedal({
  icon,
  tier,
  size = 104,
  value,
  unit,
}: {
  icon: BadgeIcon;
  tier: Tier;
  size?: number;
  value: number;
  unit: string;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const gid = `s-${useId().replace(/:/g, "")}`;
  const s = TIER_STYLE[tier];
  useEffect(() => {
    const el = host.current;
    const card = inner.current;
    if (!el || !card) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let a = 0;
    let v = 0;
    let raf = 0;
    let prev = 0;
    let face = 0;
    let settle: { x: number; v: number; t: number } | null = null;
    let drag: { x: number; a: number; last: number; t: number; v: number; moved: number } | null = null;
    const paint = () => (card.style.transform = `rotateY(${a.toFixed(2)}deg)`);
    const frame = (now: number) => {
      const dt = Math.min(0.033, (now - prev) / 1000 || 0.016);
      prev = now;
      if (!drag) {
        if (!settle && Math.abs(v) < 160)
          settle = { x: a, v, t: Math.round((a + Math.sign(v) * 40) / 180) * 180 };
        if (settle) {
          const acc = -120 * (settle.x - settle.t) - 13 * settle.v;
          settle.v += acc * dt;
          settle.x += settle.v * dt;
          a = settle.x;
        } else {
          v *= Math.pow(0.32, dt);
          a += v * dt;
        }
      }
      const f = Math.round(a / 180);
      if (f !== face) {
        face = f;
        haptic(5);
      }
      paint();
      const done =
        !drag && settle && Math.abs(settle.x - settle.t) < 0.05 && Math.abs(settle.v) < 0.5;
      if (done) {
        a = settle!.t;
        paint();
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (raf) return;
      prev = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const down = (e: PointerEvent) => {
      drag = { x: e.clientX, a, last: e.clientX, t: performance.now(), v: 0, moved: 0 };
      settle = null;
      v = 0;
      el.setPointerCapture?.(e.pointerId);
      wake();
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const now = performance.now();
      drag.v = ((e.clientX - drag.last) / Math.max(1, now - drag.t)) * 1000 * 0.9;
      drag.last = e.clientX;
      drag.t = now;
      drag.moved = Math.max(drag.moved, Math.abs(e.clientX - drag.x));
      a = drag.a + (e.clientX - drag.x) * 0.9;
    };
    const up = () => {
      if (!drag) return;
      const tap = drag.moved < 6;
      v = tap ? 900 : Math.max(-2600, Math.min(2600, drag.v));
      drag = null;
      if (reduce && tap) {
        a = Math.round(a / 180) * 180 + 180;
        v = 0;
        settle = { x: a, v: 0, t: a };
      }
      wake();
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, []);
  return (
    <span
      ref={host}
      className="spin-medal inline-block"
      data-no-swipe
      data-vaul-no-drag
      data-testid="spin-medal"
    >
      <span
        ref={inner}
        className="spin-medal-inner block"
        style={{ width: size, height: size * 1.08 }}
      >
        <BadgeMedal icon={icon} tier={tier} size={size} className="spin-medal-face" />
        <span className="spin-medal-face spin-medal-back grid place-items-center" aria-hidden>
          <svg viewBox="0 0 100 108" className="absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id={gid} x1="1" y1="0" x2="0.4" y2="1">
                <stop offset="0" stopColor={s.a} />
                <stop offset="1" stopColor={s.b} />
              </linearGradient>
            </defs>
            <path
              d="M50 3 L90 22 Q95 25 95 31 L95 72 Q95 78 90 81 L50 105 L10 81 Q5 78 5 72 L5 31 Q5 25 10 22 Z"
              fill={`url(#${gid})`}
              stroke={tier === 0 ? "var(--line-strong)" : "#1d1a16"}
              strokeWidth={tier === 0 ? 2.5 : 5}
            />
          </svg>
          <span
            className="relative flex flex-col items-center leading-none"
            style={{ color: tier === 0 ? "var(--muted)" : s.ink }}
          >
            <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] opacity-80">
              {tier === 0 ? "Da sbloccare" : s.label}
            </span>
            <span className="num mt-1 text-[28px]">{value}</span>
            <span className="mt-1 max-w-[80px] text-center text-[11px] font-semibold opacity-85">
              {unit}
            </span>
          </span>
        </span>
      </span>
    </span>
  );
}

export function BadgeTile({
  state,
  onClick,
  selected,
  fresh,
  popped,
  shine,
}: {
  state: BadgeState;
  onClick?: () => void;
  selected?: boolean;
  /** Appena guadagnato e non ancora aperto: "Nuovo". */
  fresh?: boolean;
  /** Appena riscattato: un piccolo salto. */
  popped?: boolean;
  /** Riscattato con "Riscatta tutti": una striscia di luce che lo attraversa. */
  shine?: boolean;
}) {
  const { def, tier, value, next } = state;
  const progress = next ? Math.min(1, value / next) : 1;
  return (
    <button
      onClick={onClick}
      aria-label={fresh ? `${def.name}, nuovo` : undefined}
      className={clsx(
        "relative flex flex-col items-center rounded-2xl px-1.5 pb-2.5 pt-3 text-center transition-colors",
        selected ? "bg-ball-soft ring-2 ring-ball" : "card",
        fresh && "!border-danger ring-2 ring-danger/40",
        popped && "claim-pop",
      )}
    >
      {fresh && <NewTag className="-left-1 -top-1.5" />}
      {shine && (
        <span
          className="claim-shine pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
          aria-hidden
        />
      )}
      <BadgeMedal icon={def.icon} tier={tier} size={44} />
      <span
        className={clsx(
          "mt-2 line-clamp-3 text-[12px] font-semibold leading-tight [hyphens:auto]",
          tier === 0 && "text-muted",
        )}
      >
        {def.name}
      </span>
      <span className="mt-0.5 text-[11px] text-muted">
        {TIER_STYLE[tier].label}
      </span>
      {next && (
        <span className="mt-1.5 h-1 w-10/12 overflow-hidden rounded-full bg-raised">
          <span
            className="block h-full rounded-full bg-ball"
            style={{ width: `${progress * 100}%` }}
          />
        </span>
      )}
    </button>
  );
}
