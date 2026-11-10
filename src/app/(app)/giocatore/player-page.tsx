"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
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
import {
  Chips,
  CountUp,
  EmptyState,
  ScreenHeader,
} from "@/components/ui/basics";
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

const SPRING = { type: "spring", stiffness: 240, damping: 22 } as const;

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { ...SPRING, delay },
});

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
    { label: "Punti", value: boxed ? stats.avg.pts : null, decimals: 1 },
    { label: "Rimbalzi", value: boxed ? stats.rebAvg : null, decimals: 1 },
    { label: "Assist", value: boxed ? stats.avg.ast : null, decimals: 1 },
    {
      label: "Vittorie",
      value: stats.games ? Math.round(stats.winPct * 100) : null,
      suffix: "%",
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
              : "text-white [--chip:rgb(255_255_255/0.18)] [--soft:rgb(255_255_255/0.78)]",
          )}
          style={{ backgroundColor: tint }}
        >
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_60%_at_15%_10%,rgb(255_255_255/0.32),transparent_60%),radial-gradient(ellipse_55%_65%_at_78%_62%,rgb(255_255_255/0.28),transparent_65%),linear-gradient(160deg,transparent_35%,rgb(0_0_0/0.55))]"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[repeating-linear-gradient(115deg,rgb(255_255_255/0.07)_0_2px,transparent_2px_14px)] [mask-image:linear-gradient(to_left,#000,transparent_70%)]"
          />
          {player.jerseyNumber !== null && (
            <motion.span
              aria-hidden
              className="display pointer-events-none absolute -right-4 top-4 -z-10 bg-linear-to-b from-white/45 to-white/0 bg-clip-text text-[230px] leading-none text-transparent"
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {player.jerseyNumber}
            </motion.span>
          )}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -z-10 w-1/3 -skew-x-12 bg-linear-to-r from-transparent via-white/30 to-transparent"
            initial={{ x: "-150%" }}
            animate={{ x: "400%" }}
            transition={{ delay: 0.5, duration: 1.2, ease: "easeInOut" }}
          />
          <div className="safe-top px-5 pt-5">
            <button
              onClick={() => router.back()}
              aria-label="Indietro"
              className="press grid h-11 w-11 place-items-center rounded-full bg-[var(--chip)] backdrop-blur-sm"
            >
              <IconChevronLeft size={22} />
            </button>
          </div>
          <motion.span
            className="pointer-events-none absolute -bottom-3 right-1"
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.1 }}
          >
            <span className="absolute bottom-6 left-1/2 -z-10 h-10 w-40 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(0_0_0/0.35),transparent)]" />
            <Character
              id={characterOf(player)}
              outfit={player.outfit}
              number={player.jerseyNumber}
              height={200}
              title={name}
              className="short:h-[160px] short:w-auto"
            />
          </motion.span>
          <div className="relative w-[58%] px-5 pb-12 pt-10 short:pt-6">
            {self && (
              <motion.h2
                {...rise(0.05)}
                className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[var(--soft)]"
              >
                Come ti vedono gli altri
              </motion.h2>
            )}
            <motion.p
              {...rise(0.1)}
              className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[var(--soft)]"
            >
              {player.jerseyNumber !== null && `#${player.jerseyNumber} · `}
              {player.roles[0] ?? "Giocatore"}
            </motion.p>
            <motion.h1
              {...rise(0.16)}
              className={clsx(
                "display mt-1 break-words uppercase leading-[0.95] [overflow-wrap:anywhere] [text-shadow:0_2px_18px_rgb(0_0_0/0.18)]",
                name.length > 9 ? "text-[30px]" : "text-[40px]",
              )}
            >
              {name}
            </motion.h1>
            <motion.div {...rise(0.24)} className="mt-3 flex flex-wrap gap-1.5">
              <span className={clsx(PILL, "pr-1.5")}>
                ELO <span className="num text-[13.5px]">{elo}</span>
                <InfoTip label="Cos'è l'ELO" size={14}>
                  Il punteggio di forza. Si parte tutti da 1000: vincendo sale,
                  perdendo scende. Battere chi è più forte vale di più
                </InfoTip>
              </span>
              {monthMvp && (
                <span
                  className={clsx(
                    PILL,
                    "bg-linear-to-r from-[#ffe58a] to-[#ffb73a] text-[#1d1a16] shadow-[0_4px_14px_-4px_rgb(255_183_58/0.8)]",
                  )}
                >
                  <IconCrown size={13} aria-hidden /> MVP di {monthMvp}
                </span>
              )}
              {trophies > 0 && (
                <span className={PILL}>
                  <IconTrophy size={13} aria-hidden />
                  {trophies}
                </span>
              )}
            </motion.div>
          </div>
        </section>

        <motion.dl
          {...rise(0.3)}
          className="relative z-10 -mt-7 grid grid-cols-4 divide-x divide-line overflow-hidden rounded-[22px] bg-surface py-3.5 shadow-[var(--shadow-pop)]"
        >
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-1"
            style={{
              background: `linear-gradient(90deg, ${tint}, #ffc531)`,
            }}
          />
          {line.map((it) => (
            <div
              key={it.label}
              className="flex flex-col-reverse items-center gap-1"
            >
              <dt className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">
                {it.label}
              </dt>
              <dd className="num text-[24px] leading-none">
                {it.value === null ? (
                  "—"
                ) : (
                  <CountUp
                    value={it.value}
                    decimals={it.decimals}
                    suffix={it.suffix}
                  />
                )}
              </dd>
            </div>
          ))}
        </motion.dl>
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
