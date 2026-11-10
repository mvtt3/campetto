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
import {
  computePlayerStats,
  defenseAvg,
  type PlayerStats,
} from "@/lib/stats/player";
import { headToHead } from "@/lib/stats/relations";
import { shortName } from "@/lib/types";

type Tab = "panoramica" | "numeri";

const TABS: { value: Tab; label: string }[] = [
  { value: "panoramica", label: "Panoramica" },
  { value: "numeri", label: "Numeri" },
];

const LABEL =
  "mb-2 px-1 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted";

const GLASS = "bg-[var(--chip)] ring-1 ring-inset ring-[var(--edge)]";

const PILL = clsx(
  GLASS,
  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold",
);

const SPRING = { type: "spring", stiffness: 240, damping: 22 } as const;

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { ...SPRING, delay },
});

const ATTRIBUTES: {
  label: string;
  get: (s: PlayerStats) => number | null;
}[] = [
  { label: "Realizzazione", get: (s) => (s.statGames ? s.avg.pts : null) },
  {
    label: "Tiro da tre",
    get: (s) => (s.totals.fg3a >= 5 ? s.fg3Pct : null),
  },
  { label: "Rimbalzi", get: (s) => (s.statGames ? s.rebAvg : null) },
  { label: "Passaggio", get: (s) => (s.statGames ? s.avg.ast : null) },
  { label: "Difesa", get: (s) => (s.statGames ? defenseAvg(s) : null) },
  { label: "Vincente", get: (s) => (s.games ? s.winPct : null) },
];

function rating(mine: number | null, all: (number | null)[]): number | null {
  if (mine === null) return null;
  const pool = all.filter((v): v is number => v !== null);
  if (pool.length < 2) return 75;
  const below = pool.filter((v) => v < mine).length;
  return Math.round(45 + (54 * below) / (pool.length - 1));
}

function tier(r: number): string {
  if (r >= 90) return "from-[#c9a6ff] to-[#7c4dff]";
  if (r >= 80) return "from-[#ffe58a] to-[#f0a01c]";
  if (r >= 70) return "from-[#8be3a8] to-[#2e9e5b]";
  if (r >= 60) return "from-[#ffd0a1] to-[#f26a1b]";
  return "from-[#ffb3a7] to-[#d64531]";
}

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
  const group = useMemo(
    () => engine.playerIds.map((pid) => computePlayerStats(pid, data.matches)),
    [engine.playerIds, data.matches],
  );
  const stats = useMemo(
    () =>
      group.find((s) => s.playerId === id) ??
      computePlayerStats(id, data.matches),
    [group, id, data.matches],
  );
  const attributes = useMemo(
    () =>
      ATTRIBUTES.map((a) => ({
        label: a.label,
        value: rating(a.get(stats), group.map(a.get)),
      })),
    [stats, group],
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
  const rated = attributes.flatMap((a) => (a.value === null ? [] : [a.value]));
  const ovr = rated.length
    ? Math.round(rated.reduce((x, y) => x + y, 0) / rated.length)
    : null;
  const line = [
    { label: "Punti", value: boxed ? stats.avg.pts : null, decimals: 1 },
    { label: "Rimb.", value: boxed ? stats.rebAvg : null, decimals: 1 },
    { label: "Assist", value: boxed ? stats.avg.ast : null, decimals: 1 },
    {
      label: "Vitt.",
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
            "relative isolate -mx-5 overflow-hidden rounded-b-[30px]",
            light
              ? "text-[#1d1a16] [--chip:rgb(255_255_255/0.35)] [--edge:rgb(29_26_22/0.1)] [--soft:rgb(29_26_22/0.7)]"
              : "text-white [--chip:rgb(255_255_255/0.14)] [--edge:rgb(255_255_255/0.18)] [--soft:rgb(255_255_255/0.78)]",
          )}
          style={{ backgroundColor: tint }}
        >
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_55%_at_12%_8%,rgb(255_255_255/0.35),transparent_60%),radial-gradient(ellipse_50%_45%_at_76%_48%,rgb(255_255_255/0.3),transparent_65%),linear-gradient(170deg,transparent_30%,rgb(0_0_0/0.6))]"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[repeating-linear-gradient(115deg,rgb(255_255_255/0.08)_0_2px,transparent_2px_14px)] [mask-image:linear-gradient(to_left,#000,transparent_75%)]"
          />
          {player.jerseyNumber !== null && (
            <motion.span
              aria-hidden
              className="display pointer-events-none absolute -right-6 top-16 -z-10 bg-linear-to-b from-white/50 to-white/0 bg-clip-text text-[240px] leading-none text-transparent"
              initial={{ opacity: 0, x: 70 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {player.jerseyNumber}
            </motion.span>
          )}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -z-10 w-1/3 -skew-x-12 bg-linear-to-r from-transparent via-white/35 to-transparent"
            initial={{ x: "-150%" }}
            animate={{ x: "400%" }}
            transition={{ delay: 0.6, duration: 1.2, ease: "easeInOut" }}
          />

          <div className="safe-top flex items-start justify-between px-5 pt-5">
            <button
              onClick={() => router.back()}
              aria-label="Indietro"
              className={clsx(
                GLASS,
                "press grid h-11 w-11 place-items-center rounded-full",
              )}
            >
              <IconChevronLeft size={22} />
            </button>
            {ovr !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ ...SPRING, delay: 0.35 }}
                className={clsx(
                  "rounded-[18px] bg-linear-to-br p-[2px] shadow-[0_10px_24px_-8px_rgb(0_0_0/0.6)]",
                  tier(ovr),
                )}
              >
                <span className="flex h-[60px] w-[60px] flex-col items-center justify-center rounded-[16px] bg-[#1d1a16] text-white">
                  <span
                    className={clsx(
                      "num bg-linear-to-b bg-clip-text text-[30px] leading-none text-transparent",
                      tier(ovr),
                    )}
                  >
                    <CountUp value={ovr} />
                  </span>
                  <span className="mt-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/70">
                    OVR
                  </span>
                </span>
              </motion.div>
            )}
          </div>

          <motion.span
            className="pointer-events-none absolute bottom-[86px] right-2"
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.1 }}
          >
            <span className="absolute -bottom-1 left-1/2 -z-10 h-6 w-32 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(0_0_0/0.4),transparent)]" />
            <Character
              id={characterOf(player)}
              outfit={player.outfit}
              number={player.jerseyNumber}
              height={190}
              title={name}
              className="short:h-[150px] short:w-auto"
            />
          </motion.span>

          <div className="relative flex min-h-[190px] w-[60%] flex-col px-5 pb-4 pt-3 short:min-h-[150px]">
            {self && (
              <motion.h2
                {...rise(0.05)}
                className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--soft)]"
              >
                Come ti vedono gli altri
              </motion.h2>
            )}
            <motion.p
              {...rise(0.1)}
              className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[var(--soft)]"
            >
              {player.jerseyNumber !== null && `#${player.jerseyNumber} · `}
              {player.roles[0] ?? "Giocatore"}
            </motion.p>
            <motion.h1
              {...rise(0.16)}
              className={clsx(
                "display mt-1 break-words uppercase leading-[0.92] [overflow-wrap:anywhere] [text-shadow:0_2px_18px_rgb(0_0_0/0.2)]",
                name.length > 9 ? "text-[30px]" : "text-[42px]",
              )}
            >
              {name}
            </motion.h1>
            <motion.div
              {...rise(0.24)}
              className="mt-2.5 flex flex-wrap gap-1.5"
            >
              <span className={clsx(PILL, "pr-1.5")}>
                ELO <span className="num text-[13.5px]">{elo}</span>
                <InfoTip label="Cos'è l'ELO" size={14}>
                  Il punteggio di forza. Si parte tutti da 1000: vincendo sale,
                  perdendo scende. Battere chi è più forte vale di più
                </InfoTip>
              </span>
              {monthMvp && (
                <span className="flex items-center gap-1.5 rounded-full bg-linear-to-r from-[#ffe58a] to-[#ffb73a] px-2.5 py-1 text-[12px] font-semibold text-[#1d1a16] shadow-[0_4px_14px_-4px_rgb(255_183_58/0.8)]">
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
            <motion.div {...rise(0.32)} className="mt-auto pt-3">
              <Link
                href={`/giocatore/badge?id=${encodeURIComponent(player.id)}`}
                aria-label="Vedi tutti i badge"
                className={clsx(
                  GLASS,
                  "press inline-flex items-center gap-1 rounded-full py-1 pl-1 pr-2",
                )}
              >
                {showcase.length ? (
                  showcase.map((s, i) => (
                    <motion.span
                      key={s.def.key}
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ ...SPRING, delay: 0.45 + i * 0.08 }}
                    >
                      <BadgeMedal icon={s.def.icon} tier={s.tier} size={30} />
                    </motion.span>
                  ))
                ) : (
                  <span className="pl-1.5 text-[12px] font-semibold">
                    Badge
                  </span>
                )}
                <IconChevronRight size={16} aria-hidden />
              </Link>
            </motion.div>
          </div>

          <motion.dl
            {...rise(0.3)}
            className="relative mx-3 mb-3 grid grid-cols-4 divide-x divide-white/15 rounded-[20px] bg-[#1d1a16]/55 py-3 text-white ring-1 ring-inset ring-white/10"
          >
            {line.map((it) => (
              <div
                key={it.label}
                className="flex flex-col-reverse items-center gap-1"
              >
                <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/60">
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
        </section>

        <p className="mt-2 text-center text-[12px] text-muted">
          {stats.games === 1 ? "1 partita" : `${stats.games} partite`}
          {boxed && ` · medie su ${stats.statGames} con il tabellino`}
        </p>

        <div className="mt-4">
          <Chips value={tab} onChange={setTab} options={TABS} scroll />
        </div>

        {tab === "panoramica" ? (
          <div className="mt-3 flex flex-col gap-5">
            <section aria-label="Attributi">
              <h2 className={clsx(LABEL, "flex items-center gap-1.5")}>
                Attributi
                <InfoTip label="Come si calcolano gli attributi" size={14}>
                  Ogni voce confronta il giocatore con il resto del gruppo: 99 è
                  il migliore, 45 chi sta più indietro. OVR è la media. Senza
                  tabellino si vede solo Vincente
                </InfoTip>
              </h2>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-[22px] bg-surface px-4 py-4 shadow-[var(--shadow)]">
                {attributes.map((a, i) => (
                  <li key={a.label} className="min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[12.5px] font-semibold text-muted">
                        {a.label}
                      </span>
                      <span className="num text-[17px] leading-none">
                        {a.value ?? "—"}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-raised">
                      {a.value !== null && (
                        <motion.div
                          className={clsx(
                            "h-full rounded-full bg-linear-to-r",
                            tier(a.value),
                          )}
                          initial={{ width: 0 }}
                          animate={{ width: `${a.value}%` }}
                          transition={{
                            delay: 0.4 + i * 0.06,
                            duration: 0.8,
                            ease: [0.2, 0.8, 0.2, 1],
                          }}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
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
