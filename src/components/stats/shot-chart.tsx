"use client";

import clsx from "clsx";
import {
  pctTone,
  zoneTier,
  type ShotZones,
  type ZoneKey,
} from "@/lib/stats/zones";

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

/** Le tinte dei livelli, appena accennate: bronzo, argento, oro, Hall of Fame. */
export const TIER_TINT = [
  "transparent",
  "#c07a45",
  "#a9b8c6",
  "#d4a72c",
  "#7c55c8",
] as const;
export const TONE_CLASS = {
  bad: "fill-[var(--danger)]",
  mid: "fill-[#c98a00] dark:fill-[#f0b429]",
  good: "fill-[var(--ok)]",
  none: "fill-[var(--faint)]",
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
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full touch-manipulation select-none"
      role="group"
      aria-label="Mappa di tiro"
    >
      {(["tre", "media", "sotto"] as const).map((k) => {
        const z = zones[k];
        const tier = zoneTier(z);
        const p = z.att ? z.made / z.att : null;
        return (
          <path
            key={k}
            d={ZONE_PATH[k]}
            fillRule="evenodd"
            // Solo la zona scelta si illumina (col colore del suo livello, o blu se i tiri
            // sono pochi); le altre diventano grigie. Niente bordi: si capisce dal colore.
            fill={
              selected === k
                ? tier
                  ? TIER_TINT[tier]
                  : "var(--court)"
                : "var(--zone-off)"
            }
            fillOpacity={selected === k ? (tier ? 0.72 : 0.4) : 1}
            className="cursor-pointer transition-[fill,fill-opacity] duration-300"
            role="button"
            tabIndex={0}
            aria-pressed={selected === k}
            aria-label={`${ZONE_NAME[k]}: ${p === null ? "nessun tiro" : `${Math.round(p * 100)}%, ${z.made} su ${z.att}`}`}
            onClick={() => onSelect(k)}
            onKeyDown={(e) =>
              (e.key === "Enter" || e.key === " ") && onSelect(k)
            }
          />
        );
      })}
      {/* Le linee del campo, sopra le zone, sottili come un disegno tecnico. */}
      <g
        fill="none"
        stroke="var(--line-strong)"
        strokeWidth="2"
        pointerEvents="none"
      >
        <path d={`M0 0 H${W}`} strokeWidth="3" />
        <path
          d={`M${CORNER_X} 0 L${CORNER_X} ${CORNER_Y.toFixed(1)} A${ARC} ${ARC} 0 0 0 ${W - CORNER_X} ${CORNER_Y.toFixed(1)} L${W - CORNER_X} 0`}
        />
        <rect x={PAINT.x} y={0} width={PAINT.w} height={PAINT.h} />
        <path
          d={`M${150 - 36} ${PAINT.h} A36 36 0 0 0 ${150 + 36} ${PAINT.h}`}
        />
        <path d={`M${150 - 36} ${H} A36 36 0 0 1 ${150 + 36} ${H}`} />
        <line x1="130" y1="16" x2="170" y2="16" strokeWidth="3" />
        <circle
          cx={HOOP.x}
          cy={HOOP.y}
          r="7.5"
          strokeWidth="2.5"
          stroke="var(--ball)"
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
            // Le zone non scelte restano leggibili ma in secondo piano.
            opacity={selected === k ? 1 : 0.45}
            className="transition-opacity duration-300"
          >
            <text
              x={x}
              y={y}
              className={clsx("num", TONE_CLASS[pctTone(p)])}
              fontSize="24"
            >
              {p === null ? "—" : `${Math.round(p * 100)}%`}
            </text>
            <text
              x={x}
              y={y + 16}
              className="fill-[var(--muted)]"
              fontSize="11.5"
              fontWeight="600"
            >
              {z.att ? `${z.made}/${z.att}` : "nessun tiro"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
