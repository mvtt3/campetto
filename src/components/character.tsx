"use client";

import clsx from "clsx";
import { useId } from "react";
import { AVATAR_PRESETS, Figure, GOALS, KIT, type AvatarPresetId } from "@/components/avatar-presets";
import { BADGE_BY_KEY, BADGES, TIER_NAMES, type BadgeState } from "@/lib/badges";
import type { Player } from "@/lib/types";

const INK = "#1D1A16";
const CREAM = "#FFF8EA";
const RED = "#E5412D";

const BASE_IDS = AVATAR_PRESETS.filter((p) => p.rarity === "base").map((p) => p.id);

/** Il personaggio del giocatore: quello scelto, altrimenti uno di base fisso per ognuno. */
export function characterOf(p: Pick<Player, "id" | "character">): AvatarPresetId {
  if (p.character && AVATAR_PRESETS.some((x) => x.id === p.character)) return p.character as AvatarPresetId;
  let h = 0;
  for (const c of p.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return BASE_IDS[h % BASE_IDS.length];
}

export interface CharacterProgress {
  unlocked: boolean;
  /** Cosa serve, in breve: "Dalla distanza bronzo". */
  goal: string;
  /** Il dettaglio: "Tiri da tre segnati in carriera". */
  detail: string;
  have: number;
  need: number;
  unit: string;
}

/** Il traguardo di un personaggio e quanto manca, dai badge del giocatore. */
export function characterProgress(id: AvatarPresetId, states: BadgeState[]): CharacterProgress {
  const g = GOALS[id];
  if (!g) return { unlocked: true, goal: "Di tutti", detail: "Disponibile da subito", have: 1, need: 1, unit: "" };
  if ("allTier" in g) {
    const have = states.filter((s) => s.tier >= g.allTier).length;
    return {
      unlocked: have >= BADGES.length,
      goal: `Tutti i badge ${TIER_NAMES[g.allTier].toLowerCase()}`,
      detail: `Ogni badge dell'app almeno ${TIER_NAMES[g.allTier].toLowerCase()}: il traguardo più difficile`,
      have,
      need: BADGES.length,
      unit: "badge",
    };
  }
  const def = BADGE_BY_KEY.get(g.badge)!;
  const st = states.find((s) => s.def.key === g.badge);
  const need = def.thresholds[g.tier - 1];
  const have = Math.min(st?.value ?? 0, need);
  return {
    unlocked: (st?.tier ?? 0) >= g.tier,
    goal: `${def.name} ${TIER_NAMES[g.tier].toLowerCase()}`,
    detail: def.description,
    have,
    need,
    unit: def.unit,
  };
}

/**
 * Il personaggino a figura intera, nello stile di Spicchio: testa a palla con i
 * suoi accessori, canotta col numero, pantaloncini, gambe "a tubo" e scarpe alte.
 * `idle`: respira e palleggia piano (solo nel proprio profilo).
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
}: {
  id: AvatarPresetId;
  /** Visto da dietro: nome e numero sulla canotta. */
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
  const leg = 26 + (kit.legs ?? 0);
  const hip = 146;
  const foot = hip + leg;
  const arm = kit.arms === "big" ? 7.5 : 5;
  const h = foot + 12;
  return (
    <svg
      viewBox={`0 0 100 ${h}`}
      height={height}
      width={(height * 100) / h}
      className={clsx("character overflow-visible", idle && "character-idle", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <ellipse cx="50" cy={foot + 6} rx="26" ry="4" fill={INK} opacity="0.16" className="character-shadow" />
      <g className="character-body">
        {/* gambe, calzini e scarpe */}
        <path d={`M40 ${hip} Q39 ${hip + leg / 2} 37 ${foot}`} fill="none" stroke={INK} strokeWidth="4.6" strokeLinecap="round" />
        <path d={`M60 ${hip} Q61 ${hip + leg / 2} 63 ${foot}`} fill="none" stroke={INK} strokeWidth="4.6" strokeLinecap="round" />
        <path d={`M37.4 ${foot - 9} L37 ${foot - 1} M62.6 ${foot - 9} L63 ${foot - 1}`} stroke={CREAM} strokeWidth="5.6" strokeLinecap="round" />
        <path d={`M37.4 ${foot - 7} L37.2 ${foot - 4.5} M62.6 ${foot - 7} L62.8 ${foot - 4.5}`} stroke={kit.trim === INK ? RED : kit.trim} strokeWidth="5.6" />
        {[{ x: 37, s: -1 }, { x: 63, s: 1 }].map(({ x, s }) => (
          <g key={x} transform={`translate(${x} ${foot}) scale(${s} 1)`}>
            <path d="M-5 -3 Q-5 -7 0 -7 L3 -7 Q10 -5 11 0 L11 3 L-6 3 Z" fill={RED} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M-6.5 3 L11.5 3 L11.5 5.6 L-6.5 5.6 Z" fill={CREAM} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          </g>
        ))}
        {/* braccia: una lungo il fianco, l'altra col pallone */}
        <path d="M27 82 Q16 100 18 117" fill="none" stroke={INK} strokeWidth={arm} strokeLinecap="round" />
        <circle cx="18" cy="119" r="5.6" fill={CREAM} stroke={INK} strokeWidth="2.2" />
        <path d="M73 82 Q86 92 87 108" fill="none" stroke={INK} strokeWidth={arm} strokeLinecap="round" />
        <g className="character-ball">
          <circle cx="88" cy="128" r="7.5" fill="#F26A1B" stroke={INK} strokeWidth="2" />
          <path d="M88 120.5 V135.5 M80.5 128 H95.5" stroke={INK} strokeWidth="1.3" />
        </g>
        <circle cx="87.5" cy="110" r="5.6" fill={CREAM} stroke={INK} strokeWidth="2.2" />
        {/* pantaloncini */}
        <path d={`M28 118 L72 118 L75 ${hip + 2} L54 ${hip + 2} L50 ${hip - 6} L46 ${hip + 2} L25 ${hip + 2} Z`} fill={kit.jersey === CREAM ? kit.trim : kit.jersey} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
        <path d={`M27 ${hip - 3} L45 ${hip - 3} M55 ${hip - 3} L73 ${hip - 3}`} stroke={kit.jersey === CREAM ? CREAM : kit.trim} strokeWidth="2" opacity="0.9" />
        {/* canotta */}
        <path d="M31 72 Q50 82 69 72 L74 78 Q77 99 72 121 L28 121 Q23 99 26 78 Z" fill={kit.jersey} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
        <path d="M36 74 Q50 88 64 74" fill="none" stroke={kit.trim} strokeWidth="3" strokeLinecap="round" />
        <path d="M27.5 84 Q25.8 100 29 118 M72.5 84 Q74.2 100 71 118" fill="none" stroke={kit.trim} strokeWidth="2.2" strokeLinecap="round" opacity="0.85" />
        {!back && number !== null && number !== undefined && (
          <text x="50" y="112" textAnchor="middle" fontFamily="var(--font-ultra), Georgia, serif" fontSize="17" fill={kit.trim} stroke={INK} strokeWidth="0.7" paintOrder="stroke">
            {number}
          </text>
        )}
        {back ? (
          <>
            {backName && (
              <text x="50" y="93" textAnchor="middle" fontFamily="var(--font-archivo), sans-serif" fontWeight="800" fontSize="7.5" letterSpacing="0.6" fill={kit.trim} stroke={INK} strokeWidth="0.4" paintOrder="stroke">
                {backName.toUpperCase().slice(0, 12)}
              </text>
            )}
            <text x="50" y="116" textAnchor="middle" fontFamily="var(--font-ultra), Georgia, serif" fontSize="22" fill={kit.trim} stroke={INK} strokeWidth="0.8" paintOrder="stroke">
              {number ?? ""}
            </text>
            {/* la nuca: solo la palla con le cuciture */}
            <circle cx="50" cy="48" r="26" fill={kit.head ?? "#F26A1B"} stroke={INK} strokeWidth="3" />
            <path d="M50 22 V74 M24 48 H76 M31.8 29.4 Q43.5 48 31.8 66.6 M68.2 29.4 Q56.5 48 68.2 66.6" stroke={INK} strokeWidth="2" fill="none" opacity="0.8" />
          </>
        ) : (
          /* testa e accessori della figurina */
          <Figure id={id} uid={`c${uid}`} bust={false} />
        )}
      </g>
    </svg>
  );
}
