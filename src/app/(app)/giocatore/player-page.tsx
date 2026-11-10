"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  IconChevronLeft,
  IconChevronRight,
  IconCrown,
  IconTrophy,
} from "@tabler/icons-react";
import { BadgeMedal } from "@/components/badge-medal";
import { Character, characterOf } from "@/components/character";
import { StatsDashboard } from "@/components/profile/stats-dashboard";
import { Form } from "@/components/profile/key-stats";
import { Avatar, isLightColor, playerColor } from "@/components/ui/avatar";
import { Chips, EmptyState, ScreenHeader } from "@/components/ui/basics";
import { InfoTip } from "@/components/ui/info";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { showcaseBadges } from "@/lib/badges";
import { useData } from "@/lib/data/provider";
import { MONTHS_IT } from "@/lib/periods";
import { trophiesOf } from "@/lib/stats/awards";
import { eloOf } from "@/lib/stats/elo";
import { computePlayerStats } from "@/lib/stats/player";
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
  "flex items-center gap-1.5 rounded-full bg-[var(--chip)] px-2.5 py-1 text-[12px] font-semibold backdrop-blur-sm";

const avg = (v: number) => v.toFixed(1).replace(".", ",");

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
  const stats = useMemo(
    () => computePlayerStats(id, data.matches),
    [id, data.matches],
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

  const tint = playerColor(player);
  const light = isLightColor(tint);
  const boxed = stats.statGames > 0;
  const line = [
    { label: "Punti", value: boxed ? avg(stats.avg.pts) : "—" },
    { label: "Rimbalzi", value: boxed ? avg(stats.rebAvg) : "—" },
    { label: "Assist", value: boxed ? avg(stats.avg.ast) : "—" },
    {
      label: "Vittorie",
      value: stats.games ? `${Math.round(stats.winPct * 100)}%` : "—",
    },
  ];

  return (
    <>
      <PullToRefresh className="px-5 pb-6">
        <section
          aria-label="Giocatore"
          className={clsx(
            "relative isolate -mx-5 overflow-hidden",
            light
              ? "text-[#1d1a16] [--chip:rgb(29_26_22/0.12)] [--soft:rgb(29_26_22/0.7)]"
              : "text-white [--chip:rgb(255_255_255/0.18)] [--soft:rgb(255_255_255/0.75)]",
          )}
          style={{ backgroundColor: tint }}
        >
          <div
            aria-hidden
            className={clsx(
              "absolute inset-0 -z-10 bg-linear-to-br from-transparent",
              light ? "to-black/20" : "to-black/50",
            )}
          />
          {player.jerseyNumber !== null && (
            <span
              aria-hidden
              className="display pointer-events-none absolute -right-4 top-6 -z-10 text-[220px] leading-none opacity-[0.14]"
            >
              {player.jerseyNumber}
            </span>
          )}
          <div className="safe-top px-5 pt-5">
            <button
              onClick={() => router.back()}
              aria-label="Indietro"
              className="press grid h-11 w-11 place-items-center rounded-full bg-[var(--chip)] backdrop-blur-sm"
            >
              <IconChevronLeft size={22} />
            </button>
          </div>
          <span className="pointer-events-none absolute -bottom-3 right-1">
            <Character
              id={characterOf(player)}
              outfit={player.outfit}
              number={player.jerseyNumber}
              height={200}
              title={name}
              className="short:h-[160px] short:w-auto"
            />
          </span>
          <div className="relative w-[58%] px-5 pb-12 pt-10 short:pt-6">
            {self && (
              <h2 className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[var(--soft)]">
                Come ti vedono gli altri
              </h2>
            )}
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[var(--soft)]">
              {player.jerseyNumber !== null && `#${player.jerseyNumber} · `}
              {player.roles[0] ?? "Giocatore"}
            </p>
            <h1
              className={clsx(
                "display mt-1 break-words uppercase leading-[0.95] [overflow-wrap:anywhere]",
                name.length > 9 ? "text-[30px]" : "text-[40px]",
              )}
            >
              {name}
            </h1>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className={clsx(PILL, "pr-1.5")}>
                ELO <span className="num text-[13.5px]">{elo}</span>
                <InfoTip label="Cos'è l'ELO" size={14}>
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
                  <IconTrophy size={13} aria-hidden />
                  {trophies}
                </span>
              )}
            </div>
          </div>
        </section>

        <dl className="relative z-10 -mt-7 grid grid-cols-4 divide-x divide-line rounded-[22px] bg-surface py-3.5 shadow-[var(--shadow-pop)]">
          {line.map((it) => (
            <div
              key={it.label}
              className="flex flex-col-reverse items-center gap-1"
            >
              <dt className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">
                {it.label}
              </dt>
              <dd className="num text-[24px] leading-none">{it.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-center text-[12px] text-muted">
          {stats.games === 1 ? "1 partita" : `${stats.games} partite`}
          {boxed && ` · medie su ${stats.statGames} con il tabellino`}
        </p>

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
