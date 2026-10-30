"use client";

import clsx from "clsx";
import Link from "next/link";
import { Crown, Settings, Trophy } from "lucide-react";
import { AVATAR_PRESETS, CHARACTER_TAGLINE } from "@/components/avatar-presets";
import { BadgeMedal } from "@/components/badge-medal";
import { Character, characterOf } from "@/components/character";
import { Avatar, isLightColor, playerColor } from "@/components/ui/avatar";
import { NewDot } from "@/components/new-dot";
import { useNewRewards } from "@/components/rewards";
import { CourtLines } from "@/components/ui/basics";
import { InfoTip } from "@/components/ui/info";
import { showcaseBadges } from "@/lib/badges";
import { useData } from "@/lib/data/provider";
import { MONTHS_IT } from "@/lib/periods";
import { trophiesOf } from "@/lib/stats/awards";
import { eloOf } from "@/lib/stats/elo";
import { displayName, type Player } from "@/lib/types";

/** Dal profilo alla collezione dei personaggi, già aperta. */
export const CHARACTERS_HREF = "/profilo/impostazioni?personaggi=1";

/** La figurina del giocatore: foto, nome, ruolo, ELO e i tre badge in vetrina. */
export function ProfileHeader({
  player,
  self,
}: {
  player: Player;
  self?: boolean;
}) {
  const { engine } = useData();
  const isMvp = engine.mvp?.entry.playerId === player.id;
  const elo = eloOf(engine.elo, player.id);
  const showcase = showcaseBadges(
    engine.badges(player.id).states,
    player.showcase,
  );
  const trophies = trophiesOf(player.id, engine.seasons).length;
  const tint = playerColor(player);
  const light = isLightColor(tint);
  const charId = characterOf(player);
  const badgesHref = self ? "/profilo/badge" : `/giocatore/badge?id=${encodeURIComponent(player.id)}`;
  const news = useNewRewards();
  const newBadges = self ? news.badges.size : 0;
  const newChars = self ? news.characters.size : 0;

  return (
    <div
      className={clsx(
        "halftone relative overflow-hidden rounded-[26px] border-[2.5px] border-edge p-5 shadow-[var(--shadow-pop)] short:p-4",
        light
          ? "text-[#1d1a16] [--soft:rgb(29_26_22/0.72)] [--chip:rgb(29_26_22/0.1)]"
          : "text-[#fffaf0] [--soft:rgb(255_255_255/0.8)] [--chip:rgb(255_255_255/0.2)]",
      )}
      style={{ backgroundColor: tint }}
    >
      <CourtLines className="absolute inset-0 h-full w-full" />
      {/* Il personaggio a figura intera, in piedi a destra (nel proprio profilo palleggia e si tocca per cambiarlo). */}
      {self ? (
        <Link
          href={CHARACTERS_HREF}
          className="press absolute right-2.5 top-2 z-10 rounded-2xl"
          data-tour="profile-character"
        >
          <span className="sr-only">
            Il tuo personaggio, {AVATAR_PRESETS.find((p) => p.id === charId)?.name}: apri la collezione
            {newChars ? `, ${newChars === 1 ? "un personaggio nuovo" : `${newChars} personaggi nuovi`}` : ""}
          </span>
          <NewDot count={newChars || -1} className="absolute -left-1 top-0 z-10" />
          <Character
            id={charId}
            number={player.jerseyNumber}
            height={104}
            idle
            className="short:h-[84px] short:w-auto"
          />
        </Link>
      ) : (
        <span
          className="pointer-events-none absolute right-2.5 top-2"
          aria-hidden
        >
          <Character
            id={charId}
            number={player.jerseyNumber}
            height={104}
            className="short:h-[84px] short:w-auto"
          />
        </span>
      )}
      <div className="relative flex items-center gap-4 pr-[58px] short:gap-3 short:pr-[46px]">
        <span className="rounded-full ring-4 ring-[#fffaf0]/30">
          <Avatar player={player} size={68} href={false} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="display line-clamp-2 break-words text-[20px] short:text-[18px]">
            {displayName(player)}
          </h1>
          <p className="truncate text-[13.5px] text-[var(--soft)]">
            {player.roles.join(", ") || "Giocatore"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1.5 rounded-full bg-[var(--chip)] py-1 pl-2.5 pr-1.5 text-[12.5px] font-semibold">
              ELO <span className="tnum font-bold">{elo}</span>
              <InfoTip label="Cos'è l'ELO" size={15}>
                È il punteggio di forza: si parte da 1000, sale quando vinci e
                scende quando perdi, di più se l&apos;avversario è forte
              </InfoTip>
            </span>
            {isMvp && engine.mvp?.period.kind === "month" && (
              // Sui telefoni bassi basta la cornice d'oro attorno alla foto: una riga in meno.
              <span className="flex items-center gap-1 rounded-full border-2 border-[#1d1a16] bg-volt px-2.5 py-0.5 text-[12.5px] font-bold text-[#1d1a16] short:hidden">
                <Crown size={13} /> MVP di {MONTHS_IT[engine.mvp.period.month].toLowerCase()}
              </span>
            )}
            {self && (
              <Link
                href={CHARACTERS_HREF}
                className="press rounded-full bg-[var(--chip)] px-2.5 py-1 text-[12.5px] font-semibold"
                title={CHARACTER_TAGLINE[charId]}
              >
                {AVATAR_PRESETS.find((p) => p.id === charId)?.name}
              </Link>
            )}
            {trophies > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-[var(--chip)] px-2.5 py-1 text-[12.5px] font-semibold">
                <Trophy size={13} /> {trophies}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="relative mt-4 flex items-stretch gap-2 short:mt-3">
        <Link
          href={badgesHref}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border-2 border-[#1d1a16] bg-[#fffaf0] px-3 py-2 text-[#1d1a16]"
          aria-label={newBadges ? `Vedi tutti i badge, ${newBadges === 1 ? "uno nuovo" : `${newBadges} nuovi`}` : "Vedi tutti i badge"}
        >
          {showcase.length ? (
            showcase.map((s) => (
              <BadgeMedal
                key={s.def.key}
                icon={s.def.icon}
                tier={s.tier}
                size={34}
              />
            ))
          ) : (
            <span className="text-[13.5px] text-[#6b5e4b]">
              Ancora nessun badge
            </span>
          )}
          <span className="ml-auto flex items-center gap-1.5 whitespace-nowrap pl-1 text-[13.5px] font-bold">
            {self ? "Badge" : "Tutti i badge"}
            <NewDot count={newBadges || -1} />
          </span>
        </Link>
        {self && (
          <Link
            href="/profilo/impostazioni"
            aria-label="Impostazioni"
            data-tour="profile-settings"
            className="press grid w-[52px] shrink-0 place-items-center rounded-2xl border-2 border-[#1d1a16] bg-[#fffaf0] text-[#1d1a16]"
          >
            <Settings size={21} />
          </Link>
        )}
      </div>
    </div>
  );
}
