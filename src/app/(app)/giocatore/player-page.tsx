"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { IconChevronRight, IconCrown, IconTrophy } from "@tabler/icons-react";
import { BadgeMedal } from "@/components/badge-medal";
import { Character, characterOf } from "@/components/character";
import { StatsDashboard } from "@/components/profile/stats-dashboard";
import { Form, KeyRings } from "@/components/profile/key-stats";
import { Avatar, playerColor } from "@/components/ui/avatar";
import { Chips, EmptyState, ScreenHeader } from "@/components/ui/basics";
import { InfoTip } from "@/components/ui/info";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { showcaseBadges } from "@/lib/badges";
import { useData } from "@/lib/data/provider";
import { MONTHS_IT } from "@/lib/periods";
import { trophiesOf } from "@/lib/stats/awards";
import { eloOf } from "@/lib/stats/elo";
import { headToHead } from "@/lib/stats/relations";
import { shortName } from "@/lib/types";

type Tab = "panoramica" | "numeri";

const TABS: { value: Tab; label: string }[] = [
  { value: "panoramica", label: "Panoramica" },
  { value: "numeri", label: "Numeri" },
];

const LABEL =
  "mb-2 px-1 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted";

const PILL =
  "sticker-sm flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-[12.5px] font-semibold";

export function PlayerPage() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const { data, me, engine } = useData();
  const router = useRouter();
  const preview = params.get("anteprima") === "1";
  const self = me?.id === id;
  const player = data.players.find((p) => p.id === id);
  const [tab, setTab] = useState<Tab>("panoramica");
  const h = useMemo(
    () => (me ? headToHead(me.id, id, data.matches) : null),
    [me, id, data.matches],
  );

  useEffect(() => {
    if (self && !preview) router.replace("/profilo");
  }, [self, preview, router]);

  if (!player) {
    return (
      <>
        <ScreenHeader title="Giocatore" back="/classifiche" />
        <EmptyState
          title="Giocatore non trovato"
          text="Forse è stato tolto dal gruppo"
        />
      </>
    );
  }
  const name = shortName(player, data.players);
  const elo = eloOf(engine.elo, player.id);
  const trophies = trophiesOf(player.id, engine.seasons).length;
  const monthMvp =
    engine.mvp?.entry.playerId === player.id &&
    engine.mvp.period.kind === "month"
      ? MONTHS_IT[engine.mvp.period.month].toLowerCase()
      : null;
  const showcase = showcaseBadges(
    engine.badges(player.id).states,
    player.showcase,
  );

  return (
    <>
      <ScreenHeader
        title={self ? "Come ti vedono" : name}
        subtitle={self ? "Il tuo profilo, visto dagli altri" : undefined}
        back={() => router.back()}
      />
      <PullToRefresh className="px-5 pb-6">
        <section
          aria-label="Giocatore"
          className="relative isolate -mx-5 flex flex-col items-center overflow-hidden px-5 pb-1 pt-2"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background: `radial-gradient(ellipse 42% 46% at 50% 44%, ${playerColor(player)}66, transparent)`,
            }}
          />
          <span className="relative">
            <Character
              id={characterOf(player)}
              outfit={player.outfit}
              number={player.jerseyNumber}
              height={150}
              title={name}
              className="short:h-[110px] short:w-auto"
            />
            <span className="absolute -bottom-1 left-1/2 -z-10 h-4 w-24 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(29_26_22/0.35),transparent)]" />
          </span>
          <p className="mt-3 line-clamp-2 max-w-[30ch] text-center text-[13px] leading-snug text-muted [text-wrap:balance]">
            {player.roles.join(", ") || "Giocatore"}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
            <span className={clsx(PILL, "pr-1.5")}>
              ELO <span className="num text-[14px]">{elo}</span>
              <InfoTip label="Cos'è l'ELO" size={15}>
                Il punteggio di forza. Si parte tutti da 1000: vincendo sale,
                perdendo scende. Battere chi è più forte vale di più
              </InfoTip>
            </span>
            {monthMvp && (
              <span className={clsx(PILL, "bg-volt text-volt-ink")}>
                <IconCrown size={13} aria-hidden /> MVP di {monthMvp}
              </span>
            )}
            {trophies > 0 && (
              <span className={PILL}>
                <IconTrophy size={13} className="text-gold" aria-hidden />
                {trophies === 1 ? "1 trofeo" : `${trophies} trofei`}
              </span>
            )}
          </div>
        </section>

        <Link
          href={`/giocatore/badge?id=${encodeURIComponent(player.id)}`}
          aria-label="Vedi tutti i badge"
          className="press mt-5 flex items-center gap-2 rounded-[22px] bg-surface px-3 py-2.5 shadow-[var(--shadow)]"
        >
          {showcase.length ? (
            showcase.map((s) => (
              <BadgeMedal
                key={s.def.key}
                icon={s.def.icon}
                tier={s.tier}
                size={36}
              />
            ))
          ) : (
            <span className="px-1 text-[13.5px] text-muted">
              Ancora nessun badge
            </span>
          )}
          <span className="ml-auto flex items-center gap-0.5 whitespace-nowrap text-[13.5px] font-semibold">
            Tutti i badge
            <IconChevronRight size={17} className="text-faint" aria-hidden />
          </span>
        </Link>

        <div className="mt-5">
          <Chips value={tab} onChange={setTab} options={TABS} scroll />
        </div>

        {tab === "panoramica" ? (
          <div className="mt-3 flex flex-col gap-5">
            <KeyRings playerId={player.id} />
            {me && h && !self && (
              <section aria-label="Testa a testa">
                <h2 className={LABEL}>Testa a testa</h2>
                <div className="flex items-center gap-3 rounded-[22px] bg-surface px-4 py-3.5 shadow-[var(--shadow)]">
                  <span className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <Avatar player={me} size={40} href={false} ring="none" />
                    <span className="text-[12.5px] font-semibold">Tu</span>
                  </span>
                  {h.games ? (
                    <p
                      className="score shrink-0 whitespace-nowrap text-[38px] leading-none"
                      aria-label={`Tu ${h.winsA}, ${name} ${h.winsB}`}
                    >
                      <span className={clsx(h.winsA < h.winsB && "text-faint")}>
                        {h.winsA}
                      </span>
                      <span className="mx-1 text-line-strong">–</span>
                      <span className={clsx(h.winsB < h.winsA && "text-faint")}>
                        {h.winsB}
                      </span>
                    </p>
                  ) : (
                    <p className="shrink-0 text-center text-[13px] text-muted">
                      Non vi siete
                      <br />
                      ancora sfidati
                    </p>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <Avatar
                      player={player}
                      size={40}
                      href={false}
                      ring="none"
                    />
                    <span className="max-w-full truncate text-[12.5px] font-semibold">
                      {name}
                    </span>
                  </span>
                </div>
              </section>
            )}
            <Form playerId={player.id} />
          </div>
        ) : (
          <div className="mt-3">
            <StatsDashboard playerId={player.id} />
          </div>
        )}
      </PullToRefresh>
    </>
  );
}
