"use client";

import { createContext } from "react";
import { ITEM_BY_ID, type Look } from "@/lib/game/catalog";

/**
 * Quello che si indossa in Campetto Star, disegnato sopra al personaggio: cappellini,
 * occhiali, orecchini, catene, orologio. Le coordinate sono quelle della testa di ogni
 * figurina (HEAD_SHAPE), così sta bene su tutti, sia a figura intera sia nella figurina.
 */

const INK = "#1D1A16";
const CREAM = "#FFF8EA";

export type OutfitMap = Partial<Record<string, string>> | null | undefined;
type HeadBox = { cx: number; cy: number; rx: number; ry: number };

/**
 * Si vedono i vestiti del gioco? Finché il gioco è in prova li vede solo chi può giocare
 * (l'amministratore); nel resto dell'app restano le figurine di sempre.
 */
export const OutfitsVisible = createContext(true);

/** Il colore della canotta scelta nel gioco (per le spalle della figurina). */
export const JerseyOverride = createContext<{ jersey: string; trim: string } | null>(null);

export function lookOf(outfit: OutfitMap, slot: string): Look | null {
  const id = outfit?.[slot];
  return (id && ITEM_BY_ID.get(id)?.look) || null;
}

export function jerseyOf(outfit: OutfitMap): { jersey: string; trim: string } | null {
  const l = lookOf(outfit, "maglia");
  return l?.kind === "jersey" ? { jersey: l.jersey, trim: l.trim } : null;
}

export function shoesOf(outfit: OutfitMap): string | null {
  const l = lookOf(outfit, "scarpe");
  return l?.kind === "shoes" ? l.color : null;
}

export const hasOutfit = (o: OutfitMap) => !!o && Object.values(o).some(Boolean);

function Glasses({ h, l }: { h: HeadBox; l: Extract<Look, { kind: "glasses" }> }) {
  const y = h.cy - h.ry * 0.14;
  const dx = h.rx * 0.33;
  const w = h.rx * 0.5;
  const ht = h.ry * 0.3;
  const lens = (x: number) => {
    switch (l.shape) {
      case "round":
        return <circle cx={x} cy={y} r={w * 0.48} />;
      case "aviator":
        return (
          <path
            d={`M${x - w / 2} ${y - ht * 0.45} H${x + w / 2} Q${x + w / 2} ${y + ht * 0.75} ${x} ${y + ht * 0.62} Q${x - w / 2} ${y + ht * 0.5} ${x - w / 2} ${y - ht * 0.45} Z`}
          />
        );
      case "star": {
        const r = w * 0.56;
        const pts = Array.from({ length: 10 }, (_, i) => {
          const a = (Math.PI / 5) * i - Math.PI / 2;
          const rr = i % 2 ? r * 0.48 : r;
          return `${x + rr * Math.cos(a)},${y + rr * Math.sin(a)}`;
        }).join(" ");
        return <polygon points={pts} />;
      }
      default:
        return <rect x={x - w / 2} y={y - ht / 2} width={w} height={ht} rx={ht * 0.32} />;
    }
  };
  return (
    <g>
      <path
        d={`M${h.cx - dx + w * 0.42} ${y - ht * 0.12} Q${h.cx} ${y - ht * 0.42} ${h.cx + dx - w * 0.42} ${y - ht * 0.12}`}
        fill="none"
        stroke={l.frame}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d={`M${h.cx - dx - w * 0.5} ${y - ht * 0.2} L${h.cx - h.rx * 0.96} ${y - ht * 0.45} M${h.cx + dx + w * 0.5} ${y - ht * 0.2} L${h.cx + h.rx * 0.96} ${y - ht * 0.45}`}
        stroke={INK}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {l.frame !== INK && (
        <g fill="none" stroke={INK} strokeWidth="4" strokeLinejoin="round">
          {lens(h.cx - dx)}
          {lens(h.cx + dx)}
        </g>
      )}
      <g fill={l.lens} stroke={l.frame} strokeWidth="2.2" strokeLinejoin="round">
        {lens(h.cx - dx)}
        {lens(h.cx + dx)}
      </g>
      {/* il riflesso */}
      <path
        d={`M${h.cx - dx - w * 0.22} ${y - ht * 0.12} L${h.cx - dx - w * 0.04} ${y - ht * 0.3} M${h.cx + dx - w * 0.22} ${y - ht * 0.12} L${h.cx + dx - w * 0.04} ${y - ht * 0.3}`}
        stroke="#fff"
        strokeOpacity="0.75"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </g>
  );
}

function Headwear({ h, l }: { h: HeadBox; l: Look }) {
  const top = h.cy - h.ry;
  const edge = h.cy - h.ry * 0.36;
  const L = h.cx - h.rx * 0.97;
  const R = h.cx + h.rx * 0.97;
  switch (l.kind) {
    case "cap":
      return (
        <g stroke={INK} strokeWidth="2.4" strokeLinejoin="round">
          <path
            d={`M${L} ${edge} Q${L - 0.5} ${top - h.ry * 0.14} ${h.cx} ${top - h.ry * 0.12} Q${R + 0.5} ${top - h.ry * 0.14} ${R} ${edge} Q${h.cx} ${edge - h.ry * 0.12} ${L} ${edge} Z`}
            fill={l.color}
          />
          <path d={`M${h.cx} ${top - h.ry * 0.1} V${edge - h.ry * 0.1}`} fill="none" strokeWidth="1.2" opacity="0.5" />
          <path
            d={`M${L - h.rx * 0.06} ${edge} Q${h.cx} ${edge - h.ry * 0.14} ${R + h.rx * 0.06} ${edge} Q${h.cx} ${edge + h.ry * 0.3} ${L - h.rx * 0.06} ${edge} Z`}
            fill={l.visor}
          />
          <circle cx={h.cx} cy={top - h.ry * 0.1} r="2" fill={l.visor} />
          <path
            d={`M${h.cx - h.rx * 0.6} ${top + h.ry * 0.28} Q${h.cx - h.rx * 0.3} ${top + h.ry * 0.02} ${h.cx - h.rx * 0.05} ${top}`}
            fill="none"
            stroke="#fff"
            strokeOpacity="0.4"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      );
    case "beanie": {
      const band = edge + h.ry * 0.05;
      return (
        <g stroke={INK} strokeWidth="2.4" strokeLinejoin="round">
          <path
            d={`M${L} ${band} Q${L - 1} ${top - h.ry * 0.2} ${h.cx} ${top - h.ry * 0.22} Q${R + 1} ${top - h.ry * 0.2} ${R} ${band} Z`}
            fill={l.color}
          />
          <path
            d={`M${L - 1} ${band - h.ry * 0.2} Q${h.cx} ${band - h.ry * 0.36} ${R + 1} ${band - h.ry * 0.2} L${R + 1} ${band + h.ry * 0.02} Q${h.cx} ${band - h.ry * 0.14} ${L - 1} ${band + h.ry * 0.02} Z`}
            fill={l.band}
          />
          <circle cx={h.cx} cy={top - h.ry * 0.3} r={h.rx * 0.18} fill={CREAM} />
        </g>
      );
    }
    case "headband": {
      const y = h.cy - h.ry * 0.5;
      const d = `M${h.cx - h.rx * 0.9} ${y + h.ry * 0.04} Q${h.cx} ${y - h.ry * 0.2} ${h.cx + h.rx * 0.9} ${y + h.ry * 0.04}`;
      return (
        <g fill="none" strokeLinecap="round">
          <path d={d} stroke={INK} strokeWidth={h.ry * 0.3} />
          <path d={d} stroke={l.color} strokeWidth={h.ry * 0.3 - 3.2} />
          {l.logo && (
            <path
              d={`M${h.cx - 2.6} ${y - h.ry * 0.08} q2.6 -3 5.2 0`}
              stroke={l.logo}
              strokeWidth="2.2"
            />
          )}
        </g>
      );
    }
    case "crown": {
      const b = top + h.ry * 0.18;
      const w = h.rx * 0.7;
      const t = top - h.ry * 0.42;
      return (
        <g stroke={INK} strokeWidth="2.2" strokeLinejoin="round">
          <path
            d={`M${h.cx - w} ${b} L${h.cx - w - 1} ${t} L${h.cx - w / 2} ${t + h.ry * 0.24} L${h.cx} ${t - h.ry * 0.06} L${h.cx + w / 2} ${t + h.ry * 0.24} L${h.cx + w + 1} ${t} L${h.cx + w} ${b} Z`}
            fill={l.color}
          />
          <circle cx={h.cx} cy={b - h.ry * 0.16} r="2.4" fill="#E5412D" strokeWidth="1.4" />
          <circle cx={h.cx - w * 0.55} cy={b - h.ry * 0.14} r="1.7" fill="#2D5BE3" strokeWidth="1.2" />
          <circle cx={h.cx + w * 0.55} cy={b - h.ry * 0.14} r="1.7" fill="#2E9E5B" strokeWidth="1.2" />
        </g>
      );
    }
    default:
      return null;
  }
}

function Earrings({ h, l }: { h: HeadBox; l: Extract<Look, { kind: "earring" }> }) {
  const y = h.cy + h.ry * 0.22;
  const xs = [h.cx - h.rx * 0.99, h.cx + h.rx * 0.99];
  return (
    <g>
      {xs.map((x) =>
        l.gem ? (
          <g key={x}>
            <path
              d={`M${x} ${y - 3.4} L${x + 2.8} ${y} L${x} ${y + 3.4} L${x - 2.8} ${y} Z`}
              fill={l.color}
              stroke={INK}
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path d={`M${x - 1} ${y - 1.4} L${x} ${y - 2.4}`} stroke="#fff" strokeWidth="1" strokeLinecap="round" />
          </g>
        ) : (
          <circle key={x} cx={x} cy={y} r="2.5" fill={l.color} stroke={INK} strokeWidth="1.4" />
        ),
      )}
    </g>
  );
}

function Chain({ h, l }: { h: HeadBox; l: Extract<Look, { kind: "chain" }> }) {
  const y0 = Math.min(h.cy + h.ry - 1, 82);
  const d = `M${h.cx - 15.5} ${y0} Q${h.cx} ${y0 + 15} ${h.cx + 15.5} ${y0}`;
  const py = y0 + 8.4;
  return (
    <g fill="none" strokeLinecap="round">
      <path d={d} stroke={INK} strokeWidth={l.thick ? 5.2 : 3.6} />
      <path d={d} stroke={l.color} strokeWidth={l.thick ? 2.8 : 1.6} strokeDasharray={l.thick ? "2.4 1.2" : undefined} />
      {l.pendant && (
        <g>
          <circle cx={h.cx} cy={py + 4.2} r="4.4" fill={l.pendant} stroke={INK} strokeWidth="1.6" />
          <path
            d={`M${h.cx} ${py - 0.2} V${py + 8.6} M${h.cx - 4.4} ${py + 4.2} H${h.cx + 4.4}`}
            stroke={INK}
            strokeWidth="0.9"
          />
        </g>
      )}
    </g>
  );
}

/** Orologio sul polso del braccio lungo il fianco (solo a figura intera). */
function Watch({ l }: { l: Extract<Look, { kind: "watch" }> }) {
  return (
    <g transform="rotate(-8 15 111)">
      <rect x="8.6" y="108.4" width="12.8" height="5.4" rx="1.6" fill={l.band} stroke={INK} strokeWidth="1.6" />
      <rect x="11.6" y="107.2" width="6.8" height="7.8" rx="1.8" fill={l.face} stroke={INK} strokeWidth="1.6" />
      <path d="M15 109.4 V111.1 L16.4 111.9" stroke={l.face === INK ? CREAM : INK} strokeWidth="0.9" fill="none" strokeLinecap="round" />
    </g>
  );
}

export function OutfitLayer({
  head,
  outfit,
  full = false,
}: {
  head: HeadBox;
  outfit: OutfitMap;
  /** A figura intera c'è anche il polso. */
  full?: boolean;
}) {
  if (!hasOutfit(outfit)) return null;
  const neck = lookOf(outfit, "collo");
  const ears = lookOf(outfit, "orecchie");
  const eyes = lookOf(outfit, "occhi");
  const top = lookOf(outfit, "testa");
  const wrist = lookOf(outfit, "polso");
  return (
    <g className="outfit">
      {neck?.kind === "chain" && <Chain h={head} l={neck} />}
      {ears?.kind === "earring" && <Earrings h={head} l={ears} />}
      {eyes?.kind === "glasses" && <Glasses h={head} l={eyes} />}
      {top && <Headwear h={head} l={top} />}
      {full && wrist?.kind === "watch" && <Watch l={wrist} />}
    </g>
  );
}
