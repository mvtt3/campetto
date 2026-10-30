"use client";

import clsx from "clsx";
import { useId } from "react";
import {
  AVATAR_PRESETS,
  Figure,
  GOALS,
  HEAD_SHAPE,
  KIT,
  type AvatarPresetId,
  type BadgeGoal,
} from "@/components/avatar-presets";
import {
  BADGE_BY_KEY,
  BADGES,
  TIER_NAMES,
  type BadgeState,
} from "@/lib/badges";
import type { Player } from "@/lib/types";

const INK = "#1D1A16";
const CREAM = "#FFF8EA";
const RED = "#E5412D";

const BASE_IDS = AVATAR_PRESETS.filter((p) => p.rarity === "base").map(
  (p) => p.id,
);

/** Il personaggio del giocatore: quello scelto, altrimenti uno di base fisso per ognuno. */
export function characterOf(
  p: Pick<Player, "id" | "character">,
): AvatarPresetId {
  if (p.character && AVATAR_PRESETS.some((x) => x.id === p.character))
    return p.character as AvatarPresetId;
  let h = 0;
  for (const c of p.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return BASE_IDS[h % BASE_IDS.length];
}

export interface GoalStep {
  /** Cosa fare: "Palle rubate in una sola partita". */
  label: string;
  /** Il badge che serve: "Ladro di palloni argento". */
  detail: string;
  have: number;
  need: number;
  unit: string;
  done: boolean;
}

export interface CharacterProgress {
  unlocked: boolean;
  /** Cosa serve, in breve. */
  goal: string;
  /** Una riga di spiegazione. */
  detail: string;
  /** I traguardi: uno, oppure più insieme. */
  steps: GoalStep[];
  /** Quanto manca, da 0 a 1. */
  pct: number;
}

/** "bronzo", "argento", "oro", ma "Hall of Fame" e "Leggenda" restano come sono. */
export function tierWord(tier: number): string {
  const t = TIER_NAMES[tier];
  return tier >= 4 ? t : t.toLowerCase();
}

function badgeStep(g: BadgeGoal, states: BadgeState[]): GoalStep {
  const def = BADGE_BY_KEY.get(g.badge)!;
  const st = states.find((s) => s.def.key === g.badge);
  const need = def.thresholds[g.tier - 1];
  const value = st?.value ?? 0;
  return {
    label: def.description,
    detail: `Badge ${def.name} ${tierWord(g.tier)}`,
    have: Math.min(value, need),
    need,
    unit: def.unit,
    done: (st?.tier ?? 0) >= g.tier,
  };
}

/** Il traguardo di un personaggio e quanto manca, dai badge del giocatore. */
export function characterProgress(
  id: AvatarPresetId,
  states: BadgeState[],
): CharacterProgress {
  const g = GOALS[id];
  if (!g)
    return {
      unlocked: true,
      goal: "Comune",
      detail: "Disponibile da subito",
      steps: [],
      pct: 1,
    };
  if ("allTier" in g) {
    const pool = BADGES.filter((b) => !g.category || b.category === g.category);
    const have = pool.filter(
      (b) => (states.find((s) => s.def.key === b.key)?.tier ?? 0) >= g.allTier,
    ).length;
    const tier = TIER_NAMES[g.allTier];
    const label = g.category
      ? `Tutti i badge di ${g.category} ${tier}`
      : `Tutti i badge ${tier}`;
    const step: GoalStep = {
      label,
      detail: g.category
        ? `Ogni badge di ${g.category} al livello più alto`
        : "Ogni badge al livello più alto: il traguardo più difficile",
      have,
      need: pool.length,
      unit: "badge",
      done: have >= pool.length,
    };
    return {
      unlocked: step.done,
      goal: label,
      detail: step.detail,
      steps: [step],
      pct: have / pool.length,
    };
  }
  const steps = ("all" in g ? g.all : [g]).map((x) => badgeStep(x, states));
  const pct =
    steps.reduce((a, s) => a + Math.min(1, s.have / s.need), 0) / steps.length;
  return {
    unlocked: steps.every((s) => s.done),
    goal:
      steps.length > 1
        ? steps.map((x) => x.detail.replace(/^Badge /, "")).join(" e ")
        : steps[0].detail.replace(/^Badge /, ""),
    detail:
      steps.length > 1 ? steps.map((x) => x.label).join(", ") : steps[0].label,
    steps,
    pct,
  };
}

/** Il personaggio bloccato più vicino a sbloccarsi (esclusi i leggendari). */
export function nextCharacter(
  states: BadgeState[],
): { id: AvatarPresetId; progress: CharacterProgress } | null {
  let best: { id: AvatarPresetId; progress: CharacterProgress } | null = null;
  for (const p of AVATAR_PRESETS) {
    if (p.rarity === "base" || p.rarity === "leggendaria") continue;
    const progress = characterProgress(p.id, states);
    if (progress.unlocked) continue;
    if (!best || progress.pct > best.progress.pct)
      best = { id: p.id, progress };
  }
  return best;
}

/**
 * Il personaggino a figura intera, nello stile di Spicchio: testa a palla con i
 * suoi accessori, canotta col numero, pantaloncini, gambe "a tubo" belle piene e
 * scarpe alte. Le ombre sui fianchi gli danno volume.
 * `idle`: respira e palleggia piano (solo nel proprio profilo).
 * `back`: visto da dietro, con il nome e il numero sulla canotta.
 */
export function Character({
  id,
  number,
  height = 120,
  idle = false,
  flip = false,
  className,
  title,
  back = false,
  backName,
  noBall = false,
}: {
  id: AvatarPresetId;
  /** Senza pallone: per gli strati interni della scheda 3D. */
  noBall?: boolean;
  back?: boolean;
  backName?: string;
  number?: number | null;
  height?: number;
  idle?: boolean;
  flip?: boolean;
  className?: string;
  title?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const kit = KIT[id];
  const head = HEAD_SHAPE[id];
  const leg = 24 + (kit.legs ?? 0);
  const hip = 147;
  const foot = hip + leg;
  const arm = kit.arms === "big" ? 11.5 : 8.6;
  const h = foot + 14;
  const shorts = kit.jersey === CREAM ? kit.trim : kit.jersey;
  const sockStripe = kit.trim === INK ? RED : kit.trim;
  const torso =
    "M28 71 Q50 80 72 71 L78.5 78 Q83 100 77.5 123 L22.5 123 Q17 100 21.5 78 Z";
  const pants = `M24.5 119 L75.5 119 L80 ${hip + 3} L55 ${hip + 3} L50 ${hip - 6} L45 ${hip + 3} L20 ${hip + 3} Z`;
  const name = backName?.trim().toUpperCase() ?? "";
  // Visto da dietro tutto è a specchio (il pallone passa a sinistra), le scritte no.
  const mirror = back ? "translate(100 0) scale(-1 1)" : undefined;
  return (
    <svg
      viewBox={`0 0 100 ${h}`}
      height={height}
      width={(height * 100) / h}
      className={clsx(
        "character overflow-visible",
        idle && "character-idle",
        className,
      )}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <defs>
        <linearGradient id={`v${uid}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity={back ? 0 : 0.26} />
          <stop offset="0.38" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.62" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.24" />
        </linearGradient>
      </defs>
      <ellipse
        cx="50"
        cy={foot + 8}
        rx="31"
        ry="4.6"
        fill={INK}
        opacity="0.16"
        className="character-shadow"
      />
      <g className="character-body">
        <g transform={mirror}>
          {/* gambe, calzini e scarpe */}
          {[
            { x0: 40, x1: 36.5, s: -1 },
            { x0: 60, x1: 63.5, s: 1 },
          ].map(({ x0, x1, s }) => (
            <g key={x0}>
              <path
                d={`M${x0} ${hip} Q${x0 - s} ${hip + leg / 2} ${x1} ${foot}`}
                fill="none"
                stroke={INK}
                strokeWidth="8.6"
                strokeLinecap="round"
              />
              <path
                d={`M${x0 - 1.6} ${hip + 2} Q${x0 - s - 1.6} ${hip + leg / 2} ${x1 - 1.6} ${foot - 8}`}
                fill="none"
                stroke="#fff"
                strokeOpacity="0.16"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <path
                d={`M${x1 + 0.3 * s * -1} ${foot - 11} L${x1} ${foot - 1}`}
                stroke={INK}
                strokeWidth="12.6"
                strokeLinecap="round"
              />
              <path
                d={`M${x1 + 0.3 * s * -1} ${foot - 11} L${x1} ${foot - 1}`}
                stroke={CREAM}
                strokeWidth="9"
                strokeLinecap="round"
              />
              <path
                d={`M${x1 + 0.2 * s * -1} ${foot - 8.4} L${x1 + 0.1 * s * -1} ${foot - 5.4}`}
                stroke={sockStripe}
                strokeWidth="9"
              />
              <g transform={`translate(${x1} ${foot}) scale(${s * 1.32} 1.32)`}>
                <path
                  d="M-5 -3 Q-5 -7 0 -7 L3 -7 Q10 -5 11 0 L11 3 L-6 3 Z"
                  fill={RED}
                  stroke={INK}
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path
                  d="M-2 -6 Q2 -6.4 5 -5"
                  fill="none"
                  stroke="#fff"
                  strokeOpacity="0.45"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
                <path
                  d="M-6.5 3 L11.5 3 L11.5 5.6 L-6.5 5.6 Z"
                  fill={CREAM}
                  stroke={INK}
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </g>
            </g>
          ))}
          {/* braccia: una lungo il fianco, l'altra che palleggia */}
          <path
            d="M26 81 Q12.5 100 15.5 118"
            fill="none"
            stroke={INK}
            strokeWidth={arm}
            strokeLinecap="round"
          />
          <path
            d="M23.8 84 Q12.4 100 13.6 112"
            fill="none"
            stroke="#fff"
            strokeOpacity="0.15"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle
            cx="15.5"
            cy="120.5"
            r="7.4"
            fill={CREAM}
            stroke={INK}
            strokeWidth="2.4"
          />
          <path
            d="M10.6 116 Q15.5 113.6 20.4 116"
            fill="none"
            stroke={INK}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M74 81 Q88.5 92 88.5 107"
            fill="none"
            stroke={INK}
            strokeWidth={arm}
            strokeLinecap="round"
          />
          <path
            d="M75.4 85.4 Q86 93 86.6 103"
            fill="none"
            stroke="#fff"
            strokeOpacity="0.15"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <g className="character-ball" display={noBall ? "none" : undefined}>
            <circle
              cx="89"
              cy="130"
              r="9.6"
              fill="#F26A1B"
              stroke={INK}
              strokeWidth="2.2"
            />
            <path
              d="M89 120.4 V139.6 M79.4 130 H98.6 M82.6 123.2 Q87 130 82.6 136.8 M95.4 123.2 Q91 130 95.4 136.8"
              fill="none"
              stroke={INK}
              strokeWidth="1.3"
            />
            <path
              d="M83.4 125 Q85 122.6 88 122"
              fill="none"
              stroke={CREAM}
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity="0.8"
            />
          </g>
          <circle
            cx="88.4"
            cy="110"
            r="7.4"
            fill={CREAM}
            stroke={INK}
            strokeWidth="2.4"
          />
          {/* pantaloncini */}
          <path
            d={pants}
            fill={shorts}
            stroke={INK}
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          <path d={pants} fill={`url(#v${uid})`} />
          <path
            d={`M21.4 ${hip - 0.5} L44.6 ${hip - 0.5} M55.4 ${hip - 0.5} L78.6 ${hip - 0.5}`}
            stroke={kit.jersey === CREAM ? CREAM : kit.trim}
            strokeWidth="2.2"
            opacity="0.9"
          />
          {/* canotta */}
          <path
            d={torso}
            fill={kit.jersey}
            stroke={INK}
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          <path d={torso} fill={`url(#v${uid})`} />
          <path
            d={back ? "M37 73.6 Q50 79 63 73.6" : "M35.5 73 Q50 88 64.5 73"}
            fill="none"
            stroke={kit.trim}
            strokeWidth="3.4"
            strokeLinecap="round"
          />
          <path
            d="M25.6 84 Q23.6 101 27.4 120 M74.4 84 Q76.4 101 72.6 120"
            fill="none"
            stroke={kit.trim}
            strokeWidth="2.4"
            strokeLinecap="round"
            opacity="0.9"
          />
        </g>
        {!back && number !== null && number !== undefined && (
          <text
            x="50"
            y="114"
            textAnchor="middle"
            fontFamily="var(--font-ultra), Georgia, serif"
            fontSize="19"
            fill={kit.trim}
            stroke={INK}
            strokeWidth="0.8"
            paintOrder="stroke"
          >
            {number}
          </text>
        )}
        {back ? (
          <>
            {name && (
              <text
                x="50"
                y="93"
                textAnchor="middle"
                fontFamily="var(--font-archivo), sans-serif"
                fontWeight="800"
                fontSize="8"
                letterSpacing="0.6"
                fill={kit.trim}
                stroke={INK}
                strokeWidth="0.45"
                paintOrder="stroke"
                textLength={name.length > 8 ? 46 : undefined}
                lengthAdjust="spacingAndGlyphs"
              >
                {name}
              </text>
            )}
            <text
              x="50"
              y="118"
              textAnchor="middle"
              fontFamily="var(--font-ultra), Georgia, serif"
              fontSize="24"
              fill={kit.trim}
              stroke={INK}
              strokeWidth="0.9"
              paintOrder="stroke"
            >
              {number ?? ""}
            </text>
            {/* Di spalle: cappelli, corna e capelli che escono dalla testa restano, il viso no. */}
            <mask id={`m${uid}`}>
              <rect x="-20" y="-20" width="140" height="120" fill="#fff" />
              <ellipse
                cx={head.cx}
                cy={head.cy}
                rx={head.rx + 1.4}
                ry={head.ry + 1.4}
                fill="#000"
              />
              <rect x="-20" y="72" width="140" height="60" fill="#000" />
            </mask>
            <g mask={`url(#m${uid})`}>
              <g transform="translate(100 0) scale(-1 1)">
                <Figure id={id} uid={`b${uid}`} bust={false} />
              </g>
            </g>
            <ellipse
              cx={head.cx}
              cy={head.cy}
              rx={head.rx}
              ry={head.ry}
              fill={kit.head ?? "#F26A1B"}
              stroke={INK}
              strokeWidth="3"
            />
            <path
              d={`M${head.cx} ${head.cy - head.ry} V${head.cy + head.ry} M${head.cx - head.rx} ${head.cy} H${head.cx + head.rx} M${head.cx - head.rx * 0.7} ${head.cy - head.ry * 0.71} Q${head.cx - head.rx * 0.25} ${head.cy} ${head.cx - head.rx * 0.7} ${head.cy + head.ry * 0.71} M${head.cx + head.rx * 0.7} ${head.cy - head.ry * 0.71} Q${head.cx + head.rx * 0.25} ${head.cy} ${head.cx + head.rx * 0.7} ${head.cy + head.ry * 0.71}`}
              stroke={INK}
              strokeWidth="2"
              fill="none"
              opacity="0.8"
            />
            <path
              d={`M${head.cx - head.rx * 0.62} ${head.cy - head.ry * 0.55} Q${head.cx - head.rx * 0.4} ${head.cy - head.ry * 0.82} ${head.cx - head.rx * 0.1} ${head.cy - head.ry * 0.86}`}
              stroke={CREAM}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              opacity="0.6"
            />
          </>
        ) : (
          /* testa e accessori della figurina */
          <Figure id={id} uid={`c${uid}`} bust={false} />
        )}
      </g>
    </svg>
  );
}
