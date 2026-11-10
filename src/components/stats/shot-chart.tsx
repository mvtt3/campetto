"use client";

import { useId } from "react";
import { pctTone, type ShotZones, type ZoneKey } from "@/lib/stats/zones";

/*
 * Metà campo vista dall'alto, in scala (20 punti = 1 metro): canestro in alto, linea da
 * tre a 6,75 m, area larga 4,9 m e lunga 5,8 m. Tre zone da toccare: da sotto (l'area),
 * dalla media (dentro l'arco) e da tre (fuori). Il colore di fondo è il livello, come i
 * badge, ma appena accennato; il numero è verde, giallo o rosso.
 */
const W = 300;
const H = 232;
const HOOP = { x: 150, y: 31.5 };
const ARC = 135;
const CORNER_X = 18;
const CORNER_Y = HOOP.y + Math.sqrt(ARC * ARC - (HOOP.x - CORNER_X) ** 2);
const PAINT = { x: 101, y: 0, w: 98, h: 116 };

const INSIDE = `M${CORNER_X} 0 L${CORNER_X} ${CORNER_Y.toFixed(1)} A${ARC} ${ARC} 0 0 0 ${W - CORNER_X} ${CORNER_Y.toFixed(1)} L${W - CORNER_X} 0 Z`;
const PAINT_PATH = `M${PAINT.x} 0 H${PAINT.x + PAINT.w} V${PAINT.h} H${PAINT.x} Z`;
const ZONE_PATH: Record<ZoneKey, string> = {
  sotto: PAINT_PATH,
  media: `${INSIDE} ${PAINT_PATH}`,
  tre: `M0 0 H${W} V${H} H0 Z ${INSIDE}`,
};
const LABEL_AT: Record<ZoneKey, { x: number; y: number }> = {
  sotto: { x: 150, y: 72 },
  media: { x: 59, y: 66 },
  tre: { x: 150, y: 202 },
};
export const ZONE_NAME: Record<ZoneKey, string> = {
  sotto: "Da sotto",
  media: "Dalla media",
  tre: "Da tre",
};

/** I colori dei livelli, pieni come le medaglie: bronzo, argento, oro, Hall of Fame. */
export const TIER_TINT = [
  "transparent",
  "#cd7f32",
  "#a8bfd6",
  "#f5c518",
  "#8b5cf6",
] as const;
const HEAT = {
  bad: "#e5484d",
  mid: "#f0b429",
  good: "#3fbf6f",
  none: "#ffffff",
} as const;

export function ShotChart({
  zones,
  selected,
  onSelect,
}: {
  zones: ShotZones;
  selected: ZoneKey;
  onSelect: (z: ZoneKey) => void;
}) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full touch-manipulation select-none"
      role="group"
      aria-label="Mappa di tiro"
    >
      <defs>
        <linearGradient id={`${uid}-floor`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b231c" />
          <stop offset="1" stopColor="#15110d" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`} cx="0.5" cy="0.1" r="0.6">
          <stop offset="0" stopColor="#f26a1b" stopOpacity="0.35" />
          <stop offset="1" stopColor="#f26a1b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${uid}-floor)`} />
      <rect width={W} height={H} fill={`url(#${uid}-glow)`} />
      {(["tre", "media", "sotto"] as const).map((k) => {
        const z = zones[k];
        const p = z.att ? z.made / z.att : null;
        const on = selected === k;
        return (
          <path
            key={k}
            d={ZONE_PATH[k]}
            fillRule="evenodd"
            fill={HEAT[pctTone(p)]}
            fillOpacity={p === null ? 0.04 : on ? 0.5 : 0.16}
            className="cursor-pointer outline-none transition-[fill-opacity] duration-300 [-webkit-tap-highlight-color:transparent]"
            role="button"
            tabIndex={0}
            aria-pressed={on}
            aria-label={`${ZONE_NAME[k]}: ${p === null ? "nessun tiro" : `${Math.round(p * 100)}%, ${z.made} su ${z.att}`}`}
            onClick={() => onSelect(k)}
            onKeyDown={(e) =>
              (e.key === "Enter" || e.key === " ") && onSelect(k)
            }
          />
        );
      })}
      <g
        fill="none"
        stroke="rgb(255 255 255 / 0.28)"
        strokeWidth="1.75"
        pointerEvents="none"
      >
        <path
          d={`M${CORNER_X} 0 L${CORNER_X} ${CORNER_Y.toFixed(1)} A${ARC} ${ARC} 0 0 0 ${W - CORNER_X} ${CORNER_Y.toFixed(1)} L${W - CORNER_X} 0`}
        />
        <rect x={PAINT.x} y={0} width={PAINT.w} height={PAINT.h} />
        <path
          d={`M${150 - 36} ${PAINT.h} A36 36 0 0 0 ${150 + 36} ${PAINT.h}`}
        />
        <path d={`M${150 - 36} ${H} A36 36 0 0 1 ${150 + 36} ${H}`} />
      </g>
      <path
        d={ZONE_PATH[selected]}
        fillRule="evenodd"
        fill="none"
        stroke="#ffc531"
        strokeWidth="2.5"
        strokeLinejoin="round"
        pointerEvents="none"
        className="transition-[d] duration-300"
      />
      <g pointerEvents="none">
        <line
          x1="128"
          y1="14"
          x2="172"
          y2="14"
          stroke="#fffaf0"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <circle
          cx={HOOP.x}
          cy={HOOP.y}
          r="8"
          fill="none"
          stroke="#f26a1b"
          strokeWidth="3"
        />
      </g>
      {(["sotto", "media", "tre"] as const).map((k) => {
        const z = zones[k];
        const p = z.att ? z.made / z.att : null;
        const { x, y } = LABEL_AT[k];
        return (
          <g
            key={k}
            pointerEvents="none"
            textAnchor="middle"
            opacity={selected === k ? 1 : 0.6}
            className="transition-opacity duration-300"
          >
            <text
              x={x}
              y={y}
              className="num"
              fontSize={selected === k ? 28 : 22}
              fill="#fffaf0"
            >
              {p === null ? "—" : `${Math.round(p * 100)}%`}
            </text>
            <text
              x={x}
              y={y + 16}
              fontSize="11"
              fontWeight="600"
              fill="rgb(255 250 240 / 0.65)"
            >
              {z.att ? `${z.made}/${z.att}` : "nessun tiro"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
