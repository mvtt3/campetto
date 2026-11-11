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
  IconSettings,
  IconTrophy,
} from "@tabler/icons-react";
import { AVATAR_PRESETS, CHARACTER_TAGLINE } from "@/components/avatar-presets";
import { BadgeMedal } from "@/components/badge-medal";
import { Character, characterOf } from "@/components/character";
import { NewDot } from "@/components/new-dot";
import { RelationsList } from "@/components/profile/relations-list";
import { StatsDashboard } from "@/components/profile/stats-dashboard";
import { TrendChart } from "@/components/profile/trend-chart";
import { useNewRewards } from "@/components/rewards";
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
import { form, headToHead } from "@/lib/stats/relations";
import { displayName, shortName } from "@/lib/types";

type Tab = "panoramica" | "numeri" | "compagni";

const TABS: { value: Tab; label: string }[] = [
  { value: "panoramica", label: "Panoramica" },
  { value: "numeri", label: "Numeri" },
];

const MY_TABS: { value: Tab; label: string }[] = [
  ...TABS,
  { value: "compagni", label: "Compagni" },
];

const CHARACTERS_HREF = "/profilo/impostazioni?personaggi=1";

const LABEL =
  "mb-2 px-1 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted";

const GLASS = "bg-[var(--chip)] ring-1 ring-inset ring-[var(--edge)]";

const PILL = clsx(
  GLASS,
  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold",
);

const SPRING = { type: "spring", stiffness: 240, damping: 22 } as const;

const TILT = ["-rotate-6", "rotate-3", "-rotate-2"];

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

export function PlayerPage() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const { me } = useData();
  const router = useRouter();
  const preview = params.get("anteprima") === "1";
  const self = me?.id === id;
  useEffect(() => {
    if (self && !preview) router.replace("/profilo");
  }, [self, preview, router]);
  return <PlayerView id={id} />;
}

export function PlayerView({ id, mine }: { id: string; mine?: boolean }) {
  const { data, me, engine } = useData();
  const router = useRouter();
  const self = me?.id === id;
  const news = useNewRewards();
  const newBadges = mine ? news.badges.size : 0;
  const newChars = mine ? news.characters.size : 0;
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
  const name = mine ? displayName(player) : shortName(player, data.players);
  const charId = characterOf(player);
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
  const recent = form(player.id, data.matches, 6);
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
          data-tour={mine ? "profile-card" : undefined}
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
          <span
            aria-hidden
            className="blob hero-drift -left-20 -top-24 -z-10 h-64 w-64 bg-[radial-gradient(circle,rgb(255_255_255/0.28),transparent_68%)]"
          />
          <span
            aria-hidden
            className="blob hero-drift -bottom-28 right-10 -z-10 h-72 w-72 bg-[radial-gradient(circle,rgb(255_197_49/0.3),transparent_70%)] [animation-delay:-7s]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -right-16 top-10 -z-10 h-[300px] w-[300px]"
          >
            <svg
              viewBox="0 0 200 200"
              className="court-lines draw ball-spin h-full w-full opacity-70"
            >
              <circle cx="100" cy="100" r="96" />
              <path d="M100 4v192" />
              <path d="M4 100h192" />
              <path d="M32 32c30 30 30 106 0 136" />
              <path d="M168 32c-30 30-30 106 0 136" />
            </svg>
          </span>
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -z-10 w-1/3 -skew-x-12 bg-linear-to-r from-transparent via-white/35 to-transparent"
            initial={{ x: "-150%" }}
            animate={{ x: "400%" }}
            transition={{ delay: 0.6, duration: 1.2, ease: "easeInOut" }}
          />

          <div
            className={clsx(
              "safe-top flex items-start px-5 pt-5",
              mine ? "justify-end" : "justify-between",
            )}
          >
            {mine ? (
              <Link
                href="/profilo/impostazioni"
                aria-label="Impostazioni"
                data-tour="profile-settings"
                className={clsx(
                  GLASS,
                  "press relative z-10 grid h-11 w-11 place-items-center rounded-full",
                )}
              >
                <IconSettings size={21} />
              </Link>
            ) : (
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
            )}
          </div>

          <motion.span
            className="pointer-events-none absolute bottom-[86px] right-2"
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.1 }}
          >
            <span className="absolute -bottom-1 left-1/2 -z-10 h-6 w-32 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(0_0_0/0.4),transparent)]" />
            <span className="duo-idle relative isolate block">
              {ovr !== null && (
                <motion.span
                  aria-label={`Valutazione ${ovr}`}
                  className="absolute right-[56%] top-3 -z-10 flex flex-col items-end"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...SPRING, delay: 0.08 }}
                >
                  <span className="mr-1 text-[10.5px] font-bold uppercase tracking-[0.22em] text-[var(--soft)]">
                    OVR
                  </span>
                  <span className="display bg-linear-to-b from-white/60 via-white/35 to-white/0 bg-clip-text pr-1 text-[132px] leading-[0.78] text-transparent">
                    <CountUp value={ovr} />
                  </span>
                </motion.span>
              )}
              {mine ? (
                <Link
                  href={CHARACTERS_HREF}
                  data-tour="profile-character"
                  className="press pointer-events-auto relative block"
                >
                  <span className="sr-only">
                    Il tuo personaggio,{" "}
                    {AVATAR_PRESETS.find((p) => p.id === charId)?.name}: apri la
                    collezione
                    {newChars
                      ? `, ${newChars === 1 ? "un personaggio nuovo" : `${newChars} personaggi nuovi`}`
                      : ""}
                  </span>
                  <NewDot
                    count={newChars || -1}
                    className="absolute right-6 top-2 z-10"
                  />
                  <Character
                    id={charId}
                    outfit={player.outfit}
                    number={player.jerseyNumber}
                    height={176}
                    className="short:h-[150px] short:w-auto"
                  />
                </Link>
              ) : (
                <Character
                  id={charId}
                  outfit={player.outfit}
                  number={player.jerseyNumber}
                  height={176}
                  title={name}
                  className="short:h-[150px] short:w-auto"
                />
              )}
            </span>
          </motion.span>

          <div className="relative flex min-h-[190px] w-[60%] flex-col px-5 pb-4 pt-3 short:min-h-[150px]">
            {self && !mine && (
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
                "display mt-1 break-words uppercase leading-[0.92] [overflow-wrap:anywhere] [text-shadow:0_2px_14px_rgb(0_0_0/0.35)]",
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
              {mine && (
                <Link
                  href={CHARACTERS_HREF}
                  className={clsx(PILL, "press")}
                  title={CHARACTER_TAGLINE[charId]}
                >
                  {AVATAR_PRESETS.find((p) => p.id === charId)?.name}
                </Link>
              )}
            </motion.div>
            <motion.div {...rise(0.32)} className="mt-auto pt-3">
              <Link
                href={
                  mine
                    ? "/profilo/badge"
                    : `/giocatore/badge?id=${encodeURIComponent(player.id)}`
                }
                aria-label={
                  newBadges
                    ? `Vedi tutti i badge, ${newBadges === 1 ? "uno nuovo" : `${newBadges} nuovi`}`
                    : "Vedi tutti i badge"
                }
                className="press relative inline-flex items-center gap-1"
              >
                <NewDot
                  count={newBadges || -1}
                  className="absolute -right-3 -top-1 z-10"
                />
                {showcase.length ? (
                  <span className="flex -space-x-1.5">
                    {showcase.map((s, i) => (
                      <motion.span
                        key={s.def.key}
                        initial={{ scale: 0, rotate: -40, y: 10 }}
                        animate={{ scale: 1, rotate: 0, y: 0 }}
                        transition={{ ...SPRING, delay: 0.1 + i * 0.05 }}
                      >
                        <span
                          className="badge-float block"
                          style={{ animationDelay: `${i * -1.1}s` }}
                        >
                          <span
                            className={clsx(
                              "block drop-shadow-[0_6px_10px_rgb(0_0_0/0.35)]",
                              TILT[i],
                            )}
                          >
                            <BadgeMedal
                              icon={s.def.icon}
                              tier={s.tier}
                              size={40}
                            />
                          </span>
                        </span>
                      </motion.span>
                    ))}
                  </span>
                ) : (
                  <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--soft)]">
                    Badge
                  </span>
                )}
                <IconChevronRight
                  size={18}
                  className="text-[var(--soft)]"
                  aria-hidden
                />
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

        <div className="mt-5" data-tour={mine ? "profile-tabs" : undefined}>
          <Chips
            value={tab}
            onChange={setTab}
            options={mine ? MY_TABS : TABS}
            scroll
          />
        </div>

        {tab === "panoramica" ? (
          <div
            className="mt-3 flex flex-col gap-5"
            data-tour={mine ? "profile-stats" : undefined}
          >
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
                          className="h-full rounded-full bg-linear-to-r from-ball to-volt"
                          initial={{ width: 0 }}
                          animate={{ width: `${a.value}%` }}
                          transition={{
                            delay: 0.05 + i * 0.03,
                            duration: 0.5,
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
            <section aria-label="Forma">
              <h2 className={LABEL}>Forma</h2>
              <div
                className="flex items-center gap-2 rounded-[22px] bg-surface px-4 py-3.5 shadow-[var(--shadow)]"
                aria-label={`Ultime partite: ${recent.join(" ") || "nessuna"}`}
              >
                {recent.length ? (
                  recent.map((r, i) => (
                    <span
                      key={i}
                      className={clsx(
                        "grid h-9 flex-1 place-items-center rounded-full text-[13px] font-bold",
                        r === "V"
                          ? "bg-volt text-volt-ink"
                          : "bg-raised text-faint",
                      )}
                    >
                      {r}
                    </span>
                  ))
                ) : (
                  <span className="text-[13.5px] text-muted">
                    Nessuna partita ancora
                  </span>
                )}
              </div>
            </section>
            {mine && (
              <section aria-label="Andamento">
                <h2 className={clsx(LABEL, "flex items-center gap-1.5")}>
                  Andamento
                  <InfoTip label="Cosa mostra il grafico" size={14}>
                    Come vai mese dopo mese. Voto: punti, rimbalzi, assist,
                    rubate e stoppate, meno tiri sbagliati e palle perse. Punti:
                    la media a partita. ELO: il punteggio di forza
                  </InfoTip>
                </h2>
                <div className="h-[220px] rounded-[22px] bg-surface p-4 shadow-[var(--shadow)]">
                  <TrendChart playerId={player.id} />
                </div>
              </section>
            )}
          </div>
        ) : tab === "numeri" ? (
          <div
            className="mt-3"
            data-tour={mine ? "profile-advanced" : undefined}
          >
            <StatsDashboard playerId={player.id} advanced={mine} />
          </div>
        ) : (
          <div className="mt-3">
            <RelationsList playerId={player.id} />
          </div>
        )}
      </PullToRefresh>
    </>
  );
}
