"use client";

import clsx from "clsx";
import { useId } from "react";
import {
  CalendarCheck,
  Crown,
  Crosshair,
  Flame,
  Footprints,
  Hand,
  Layers,
  Lock,
  Medal,
  Orbit,
  RefreshCcw,
  Rocket,
  Shield,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Eye,
  Undo2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { TIER_NAMES, type BadgeIcon, type BadgeState, type Tier } from "@/lib/badges";

const ICONS: Record<BadgeIcon, LucideIcon> = {
  points: Target,
  assist: Orbit,
  rebound: RefreshCcw,
  steal: Hand,
  block: Shield,
  three: Crosshair,
  win: Medal,
  streak: Zap,
  presence: Footprints,
  hot: Flame,
  vision: Eye,
  paint: Layers,
  clean: ShieldCheck,
  allround: Sparkles,
  crown: Crown,
  trophy: Trophy,
  comeback: Undo2,
  duel: Swords,
  calendar: CalendarCheck,
  shutout: Rocket,
  clutch: Timer,
  opener: TrendingUp,
  sniper: Crosshair,
};

/** Fill (two stops) and ink for each tier. */
export const TIER_STYLE: Record<Tier, { a: string; b: string; ink: string; label: string }> = {
  0: { a: "var(--raised)", b: "var(--raised)", ink: "var(--faint)", label: TIER_NAMES[0] },
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
  const Icon = tier === 0 ? Lock : ICONS[icon];
  // Unique per instance: a hidden copy of the same medal must not own the gradient.
  const id = `g-${useId().replace(/:/g, "")}`;
  return (
    <span
      className={clsx("relative inline-grid shrink-0 place-items-center overflow-hidden", className)}
      style={{ width: size, height: size * 1.08, animation: animate ? "badge-reveal 700ms cubic-bezier(.2,.9,.3,1.2)" : undefined }}
      aria-label={`${s.label}`}
    >
      <svg viewBox="0 0 100 108" className="absolute inset-0 h-full w-full" aria-hidden>
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
          stroke={tier === 0 ? "var(--line-strong)" : "rgb(255 255 255 / 0.35)"}
          strokeWidth={tier === 0 ? 2 : 1.5}
          strokeDasharray={tier === 0 ? "5 4" : undefined}
        />
        {tier >= 4 && (
          <path d="M50 12 L84 28 L84 70 L50 92 L16 70 L16 28 Z" fill="none" stroke="rgb(255 255 255 / 0.4)" strokeWidth="1.2" />
        )}
      </svg>
      <Icon size={size * 0.42} color={s.ink} strokeWidth={2.2} className="relative" aria-hidden />
      {animate && (
        <span
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/40"
          style={{ animation: "shine 1.1s 0.5s ease-out both" }}
        />
      )}
    </span>
  );
}

export function BadgeTile({ state, onClick, selected }: { state: BadgeState; onClick?: () => void; selected?: boolean }) {
  const { def, tier, value, next, prev } = state;
  const progress = next ? Math.min(1, (value - prev) / (next - prev)) : 1;
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex flex-col items-center rounded-[18px] px-1.5 pb-2.5 pt-3 text-center transition-colors",
        selected ? "bg-ball-soft ring-2 ring-ball" : "bg-surface ring-1 ring-line ring-inset",
      )}
      aria-label={`${def.name}, ${TIER_STYLE[tier].label}`}
    >
      <BadgeMedal icon={def.icon} tier={tier} size={44} />
      <span className={clsx("mt-2 line-clamp-2 text-[12px] font-semibold leading-tight", tier === 0 && "text-muted")}>
        {def.name}
      </span>
      <span className="mt-0.5 text-[11px] text-muted">{TIER_STYLE[tier].label}</span>
      {next && (
        <span className="mt-1.5 h-1 w-10/12 overflow-hidden rounded-full bg-raised">
          <span className="block h-full rounded-full bg-ball" style={{ width: `${progress * 100}%` }} />
        </span>
      )}
    </button>
  );
}
