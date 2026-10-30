"use client";

import clsx from "clsx";
import Link from "next/link";
import { useData } from "@/lib/data/provider";
import { PresetAvatar, presetOf } from "@/components/avatar-presets";
import { initials, playerHref, shortName, type Player } from "@/lib/types";

const PALETTE = [
  "#2D5BE3",
  "#F26A1B",
  "#2E9E5B",
  "#7C4DCC",
  "#E5412D",
  "#1597A6",
  "#D99A00",
  "#C93B78",
];

/** Gli sfondi tra cui scegliere per la propria figurina. */
export const CARD_COLORS: { value: string; name: string }[] = [
  { value: "#F26A1B", name: "Arancione" },
  { value: "#FFC531", name: "Giallo" },
  { value: "#2D5BE3", name: "Blu" },
  { value: "#E5412D", name: "Rosso" },
  { value: "#2E9E5B", name: "Verde" },
  { value: "#7C4DCC", name: "Viola" },
  { value: "#1597A6", name: "Turchese" },
  { value: "#C93B78", name: "Fucsia" },
];

/** true per i colori chiari, dove il testo va scuro. */
export function isLightColor(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

export function playerColor(p: Pick<Player, "id" | "cardColor">): string {
  if (p.cardColor) return p.cardColor;
  let h = 0;
  for (const c of p.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function Avatar({
  player,
  size = 40,
  href,
  ring = "auto",
  className,
}: {
  player: Player | undefined;
  size?: number;
  href?: string | false;
  /** "auto": gold frame when the player is the MVP in charge. */
  ring?: "auto" | "none" | "gold";
  className?: string;
}) {
  const { engine, me } = useData();
  if (!player)
    return (
      <span
        className="inline-block rounded-full bg-raised"
        style={{ width: size, height: size }}
      />
    );
  const isMvp =
    ring === "gold" ||
    (ring === "auto" && engine.mvp?.entry.playerId === player.id);
  const preset = presetOf(player.avatarUrl);
  const name = shortName(player);
  const pad = isMvp ? Math.max(2, Math.round(size * 0.07)) : 0;
  const inner = (
    <span
      className={clsx(
        "relative inline-grid shrink-0 place-items-center rounded-full",
        isMvp && "mvp-ring",
        className,
      )}
      style={{ width: size, height: size, padding: pad }}
      title={isMvp ? `${name} è l'MVP in carica` : undefined}
    >
      <span
        className={clsx(
          "grid h-full w-full place-items-center overflow-hidden rounded-full border-2 border-[#1d1a16]",
          isLightColor(playerColor(player))
            ? "text-[#1d1a16]"
            : "text-[#fffaf0]",
        )}
        style={{
          background: playerColor(player),
          boxShadow: isMvp ? "0 0 0 2.5px var(--surface)" : undefined,
        }}
      >
        {preset ? (
          <PresetAvatar id={preset} />
        ) : player.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.avatarUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span
            className="num"
            style={{ fontSize: Math.max(10, size * 0.34) }}
            aria-hidden
          >
            {initials(player)}
          </span>
        )}
      </span>
    </span>
  );
  if (href === false) return inner;
  const target =
    href ?? (me?.id === player.id ? "/profilo" : playerHref(player.id));
  return (
    <Link href={target} className="shrink-0 rounded-full">
      <span className="sr-only">Profilo di {name}</span>
      {inner}
    </Link>
  );
}

export function AvatarStack({
  players,
  size = 28,
  max = 5,
}: {
  players: Player[];
  size?: number;
  max?: number;
}) {
  const shown = players.slice(0, max);
  const extra = players.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span
          key={p.id}
          style={{ marginLeft: i ? -size * 0.28 : 0 }}
          className="rounded-full ring-2 ring-surface"
        >
          <Avatar player={p} size={size} href={false} />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="tnum grid place-items-center rounded-full bg-raised text-[11px] font-bold text-muted ring-2 ring-surface"
          style={{ width: size, height: size, marginLeft: -size * 0.28 }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
