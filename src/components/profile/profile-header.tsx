"use client";

import clsx from "clsx";
import Link from "next/link";
import { Crown, Settings, Trophy } from "lucide-react";
import { BadgeMedal } from "@/components/badge-medal";
import { Avatar, isLightColor, playerColor } from "@/components/ui/avatar";
import { CourtLines } from "@/components/ui/basics";
import { InfoTip } from "@/components/ui/info";
import { showcaseBadges } from "@/lib/badges";
import { useData } from "@/lib/data/provider";
import { MONTHS_IT } from "@/lib/periods";
import { trophiesOf } from "@/lib/stats/awards";
import { eloOf } from "@/lib/stats/elo";
import { displayName, type Player } from "@/lib/types";

/** La figurina del giocatore: foto, nome, ruolo, ELO e i tre badge in vetrina. */
export function ProfileHeader({ player, self }: { player: Player; self?: boolean }) {
  const { engine } = useData();
  const isMvp = engine.mvp?.entry.playerId === player.id;
  const elo = eloOf(engine.elo, player.id);
  const showcase = showcaseBadges(engine.badges(player.id).states, player.showcase);
  const trophies = trophiesOf(player.id, engine.seasons).length;
  const tint = playerColor(player);
  const light = isLightColor(tint);
  const badgesHref = self ? "/profilo/badge" : `/giocatore/${player.id}/badge`;

  return (
    <div
      className={clsx(
        "halftone relative overflow-hidden rounded-[26px] border-[2.5px] border-edge p-5 shadow-[var(--shadow-pop)]",
        light ? "text-[#1d1a16] [--soft:rgb(29_26_22/0.72)] [--chip:rgb(29_26_22/0.1)]" : "text-[#fffaf0] [--soft:rgb(255_255_255/0.8)] [--chip:rgb(255_255_255/0.2)]",
      )}
      style={{ backgroundColor: tint }}
    >
      <CourtLines className="absolute inset-0 h-full w-full" />
      {player.jerseyNumber !== null && (
        <span className="score pointer-events-none absolute -right-2 -top-2 text-[130px] text-[#1d1a16]/15" aria-hidden>
          {player.jerseyNumber}
        </span>
      )}
      <div className="relative flex items-center gap-4">
        <span className="rounded-full ring-4 ring-[#fffaf0]/30">
          <Avatar player={player} size={68} href={false} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="display line-clamp-2 break-words text-[20px] leading-[1.02]">{displayName(player)}</h1>
          <p className="truncate text-[13.5px] text-[var(--soft)]">
            {player.roles.join(", ") || "Giocatore"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1.5 rounded-full bg-[var(--chip)] py-1 pl-2.5 pr-1.5 text-[12.5px] font-semibold">
              ELO <span className="tnum font-bold">{elo}</span>
              <InfoTip label="Cos'è l'ELO" size={15}>
                È il punteggio di forza: si parte da 1000, sale quando vinci e scende quando perdi, di più se l&apos;avversario è forte
              </InfoTip>
            </span>
            {isMvp && engine.mvp?.period.kind === "month" && (
              <span className="flex items-center gap-1 rounded-full border-2 border-[#1d1a16] bg-volt px-2.5 py-0.5 text-[12.5px] font-bold text-[#1d1a16]">
                <Crown size={13} /> MVP di {MONTHS_IT[engine.mvp.period.month].toLowerCase()}
              </span>
            )}
            {trophies > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-[var(--chip)] px-2.5 py-1 text-[12.5px] font-semibold">
                <Trophy size={13} /> {trophies}
              </span>
            )}
          </div>
        </div>
        {self && (
          <Link href="/profilo/impostazioni" aria-label="Impostazioni" data-tour="profile-settings" className="press -mr-2 -mt-2 grid h-11 w-11 shrink-0 place-items-center self-start rounded-full bg-[var(--chip)]">
            <Settings size={20} />
          </Link>
        )}
      </div>
      <Link href={badgesHref} className="relative mt-4 flex items-center gap-2 rounded-2xl border-2 border-[#1d1a16] bg-[#fffaf0] px-3 py-2 text-[#1d1a16]" aria-label="Vedi tutti i badge">
        {showcase.length ? (
          showcase.map((s) => <BadgeMedal key={s.def.key} icon={s.def.icon} tier={s.tier} size={34} />)
        ) : (
          <span className="text-[13.5px] text-[#6b5e4b]">Ancora nessun badge</span>
        )}
        <span className="ml-auto text-[13.5px] font-bold">Tutti i badge</span>
      </Link>
    </div>
  );
}
