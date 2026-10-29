"use client";

import Link from "next/link";
import { Crown, Settings } from "lucide-react";
import { BadgeMedal } from "@/components/badge-medal";
import { Avatar, playerColor } from "@/components/ui/avatar";
import { showcaseBadges } from "@/lib/badges";
import { useData } from "@/lib/data/provider";
import { MONTHS_IT } from "@/lib/periods";
import { eloOf } from "@/lib/stats/elo";
import { playerName, type Player } from "@/lib/types";

/** The player "figurine": photo, name, roles, ELO and the three showcase badges. */
export function ProfileHeader({ player, self }: { player: Player; self?: boolean }) {
  const { engine } = useData();
  const isMvp = engine.mvp?.entry.playerId === player.id;
  const elo = eloOf(engine.elo, player.id);
  const { states } = engine.badges(player.id);
  const showcase = showcaseBadges(states, player.showcase);
  const tint = playerColor(player);
  const badgesHref = self ? "/profilo/badge" : `/giocatore/${player.id}/badge`;

  return (
    <div
      className="relative overflow-hidden rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-line ring-inset"
      style={{ backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${tint} 22%, transparent), transparent 62%)` }}
    >
      {player.jerseyNumber !== null && (
        <span
          className="num pointer-events-none absolute -right-1 -top-3 text-[120px] leading-none opacity-[0.07]"
          aria-hidden
        >
          {player.jerseyNumber}
        </span>
      )}
      <div className="relative flex items-center gap-4">
        <Avatar player={player} size={76} href={false} />
        <div className="min-w-0 flex-1">
          <h1 className="title truncate text-[24px]">{playerName(player)}</h1>
          <p className="truncate text-[13.5px] text-muted">
            {[player.nickname && `“${player.nickname}”`, player.roles.join(", ")].filter(Boolean).join("  ")}
          </p>
          <div className="mt-1.5 flex items-center gap-3 text-[13px]">
            <span>
              ELO <span className="num-wide font-bold">{elo}</span>
            </span>
            {player.jerseyNumber !== null && (
              <span className="text-muted">
                Maglia <span className="num-wide font-semibold text-text">{player.jerseyNumber}</span>
              </span>
            )}
          </div>
        </div>
        {self && (
          <Link href="/profilo/impostazioni" aria-label="Impostazioni" className="-mr-1 -mt-8 grid h-11 w-11 place-items-center self-start rounded-full active:bg-raised">
            <Settings size={21} />
          </Link>
        )}
      </div>
      {isMvp && engine.mvp?.period.kind === "month" && (
        <p className="relative mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-gold">
          <Crown size={15} /> MVP di {MONTHS_IT[engine.mvp.period.month].toLowerCase()}
        </p>
      )}
      <Link href={badgesHref} className="relative mt-3 flex items-center gap-2" aria-label="Vedi tutti i badge">
        {showcase.length ? (
          showcase.map((s) => <BadgeMedal key={s.def.key} icon={s.def.icon} tier={s.tier} size={38} />)
        ) : (
          <span className="text-[13px] text-muted">Ancora nessun badge</span>
        )}
        <span className="ml-auto text-[13px] font-semibold text-ball">Tutti i badge</span>
      </Link>
    </div>
  );
}
