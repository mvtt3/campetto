"use client";

import clsx from "clsx";
import Link from "next/link";
import {
  IconCalendar,
  IconChevronRight,
  IconCircleCheck,
  IconCloudRain,
  IconCrown,
  IconPlus,
  IconSparkles,
  IconTrendingDown,
  IconTrendingUp,
} from "@tabler/icons-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { proposalPhase, rainedOutToday } from "@/lib/proposals";
import { RainedOut } from "@/components/rained-out";
import { neededPlayers } from "@/lib/notifications/grouping";
import { NewsButton, NewsPanel, useNews } from "@/components/news-panel";
import { Mascot } from "@/components/mascot";
import { ProposalCard } from "@/components/proposal-card";
import { markMatchOpenedFromElsewhere } from "@/components/screens/matches-screen";
import { Avatar } from "@/components/ui/avatar";
import { CountUp, CourtLines } from "@/components/ui/basics";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { HighlightsHomeButton, PlayBadge } from "@/components/highlights/entry";
import { GameHomeButton } from "@/components/game/entry";
import { useHighlights } from "@/components/highlights/provider";
import { useData } from "@/lib/data/provider";
import { filterMatches, MONTHS_IT } from "@/lib/periods";
import { eloDelta, eloOf } from "@/lib/stats/elo";
import type { MvpEntry } from "@/lib/stats/awards";
import { matchMvp } from "@/lib/stats/match-mvp";
import { computePlayerStats, teamOf } from "@/lib/stats/player";
import { Character, characterOf } from "@/components/character";
import { shortName, winnerOf, type Match, type Player } from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { InfoTip } from "@/components/ui/info";
import { MvpMonthInfo } from "@/components/mvp-info";
import { useNav } from "@/lib/nav";

const RECENT = 8;

function relativeDay(iso: string, now: Date): string {
  const d = new Date(iso);
  const days = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86_400_000,
  );
  if (days === 0) return "oggi";
  if (days === 1) return "ieri";
  if (days < 7) return `${days} giorni fa`;
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

const sameDayAs = (iso: string, d: Date) =>
  new Date(iso).toDateString() === d.toDateString();

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

function Section({
  title,
  action,
  index,
  children,
}: {
  title: ReactNode;
  action?: ReactNode;
  index: number;
  children: ReactNode;
}) {
  return (
    <section className="rise" style={rise(index)}>
      <div className="mb-2.5 flex min-h-8 items-center justify-between gap-3 px-1">
        <h2 className="title flex items-center gap-1.5 text-[17px]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="press -mr-2 flex items-center gap-1 rounded-full px-2 py-1.5 text-[13px] font-semibold text-muted"
    >
      {children}
    </Link>
  );
}

function RecentMatch({
  match,
  meId,
  players,
  now,
  onOpenVideo,
}: {
  match: Match;
  meId: string;
  players: Player[];
  now: Date;
  onOpenVideo: (id: string) => void;
}) {
  const team = teamOf(match, meId);
  const winner = winnerOf(match);
  const outcome = !team ? null : winner === team ? "won" : "lost";
  const best = matchMvp(match);
  const bestPlayer = best
    ? players.find((p) => p.id === best.playerId)
    : undefined;
  return (
    <Link
      href={`/partite?m=${match.id}`}
      onClick={(e) => {
        if ((e.target as Element).closest("[data-hl-badge]")) {
          e.preventDefault();
          onOpenVideo(match.id);
          return;
        }
        markMatchOpenedFromElsewhere();
      }}
      className="card press flex w-[156px] shrink-0 snap-start flex-col p-3.5"
    >
      <div className="flex h-7 items-center justify-between gap-1">
        <span
          className={clsx(
            "rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
            outcome === "won" && "bg-ok/15 text-ok",
            outcome === "lost" && "bg-danger/10 text-danger",
            !outcome && "bg-raised text-muted",
          )}
        >
          {outcome === "won" ? "Vinta" : outcome === "lost" ? "Persa" : match.format}
        </span>
        <PlayBadge matchId={match.id} className="!h-7 !w-7" />
      </div>
      <p className="score mt-3 whitespace-nowrap text-[34px]">
        <span className={clsx(team === "B" && "text-faint")}>{match.scoreA}</span>
        <span className="mx-0.5 text-line-strong">–</span>
        <span className={clsx(team === "A" && "text-faint")}>{match.scoreB}</span>
      </p>
      <p className="mt-1.5 truncate text-[12.5px] text-muted">
        {outcome ? `${match.format} · ` : ""}
        {relativeDay(match.playedAt, now)}
      </p>
      {bestPlayer && (
        <div className="mt-3 flex min-w-0 items-center gap-2 border-t border-line pt-3">
          <Avatar player={bestPlayer} size={24} href={false} />
          <span className="min-w-0">
            <span className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-gold">
              <IconCrown size={11} /> MVP
            </span>
            <span className="block truncate text-[12.5px] font-semibold">
              {shortName(bestPlayer, players)}
            </span>
          </span>
        </div>
      )}
    </Link>
  );
}

function MvpCard({
  mvp,
  player,
  players,
}: {
  mvp: { entry: MvpEntry; period: { kind: string; month?: number } } | null;
  player: Player | undefined;
  players: Player[];
}) {
  return (
    <Link
      href="/classifiche"
      data-tour="home-mvp"
      className="mvp-hero press relative isolate flex min-h-[188px] overflow-hidden rounded-[28px] p-5 text-volt-ink shadow-[var(--shadow-pop)]"
    >
      <span
        className="mvp-rays absolute -right-24 -top-16 -z-10 h-80 w-80"
        aria-hidden
      />
      <span
        className="display pointer-events-none absolute -bottom-6 -left-2 -z-10 text-[112px] leading-none text-white/25"
        aria-hidden
      >
        MVP
      </span>
      {SPARKS.map(([top, right, size, delay]) => (
        <IconSparkles
          key={`${top}${right}`}
          size={size}
          className="mvp-twinkle absolute text-white"
          style={{ top, right, "--d": delay } as CSSProperties}
          aria-hidden
        />
      ))}
      {mvp && player ? (
        <>
          <span className="mvp-float absolute -bottom-3 right-3" aria-hidden>
            <Character
              id={characterOf(player)}
              outfit={player.outfit}
              number={player.jerseyNumber}
              height={164}
            />
          </span>
          <div className="relative flex min-w-0 flex-col pr-32">
            <span className="flex w-fit items-center gap-1.5 rounded-full bg-volt-ink px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-volt">
              <IconCrown size={13} />
              {mvp.period.kind === "month" && mvp.period.month !== undefined
                ? MONTHS_IT[mvp.period.month]
                : "MVP"}
            </span>
            <p className="display mt-3 line-clamp-2 text-[30px] leading-[1.02] [overflow-wrap:anywhere]">
              {shortName(player, players)}
            </p>
            <div className="mt-auto flex gap-4 pt-4">
              <div>
                <p className="num text-[18px]">{mvp.entry.games}</p>
                <p className="text-[11px] font-medium opacity-70">Partite</p>
              </div>
              <div>
                <p className="num text-[18px]">
                  {Math.round(mvp.entry.winPct * 100)}%
                </p>
                <p className="text-[11px] font-medium opacity-70">Vittorie</p>
              </div>
              {mvp.entry.eloDelta !== 0 && (
                <div>
                  <p className="num text-[18px]">
                    {mvp.entry.eloDelta > 0 ? "+" : "−"}
                    {Math.abs(Math.round(mvp.entry.eloDelta))}
                  </p>
                  <p className="text-[11px] font-medium opacity-70">ELO</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="relative mt-auto">
          <p className="display text-[24px]">Ancora nessuno</p>
          <p className="mt-1 text-[13px] font-medium opacity-70">
            Serve giocare almeno 3 partite nel mese
          </p>
        </div>
      )}
    </Link>
  );
}

const SPARKS = [
  ["14%", "38%", 14, "0s"],
  ["8%", "8%", 18, "0.8s"],
  ["46%", "44%", 11, "1.5s"],
] as const;

export function HomeScreen() {
  const { data, me, engine } = useData();
  const hl = useHighlights();
  const now = useNow();
  const router = useNav();
  const news = useNews();
  const [newsOpen, setNewsOpen] = useState(false);
  const [freshSince, setFreshSince] = useState<string | null>(null);
  const openNews = () => {
    setFreshSince(news.since);
    setNewsOpen(true);
    news.markSeen();
  };
  const fromPush = useRef(false);
  useEffect(() => {
    if (fromPush.current || !me) return;
    if (new URLSearchParams(window.location.search).get("notizie") === "1") {
      fromPush.current = true;
      window.history.replaceState(null, "", window.location.pathname);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      openNews();
    }
  });

  const next = useMemo(
    () =>
      data.proposals
        .filter(
          (p) =>
            p.status === "aperta" &&
            proposalPhase(p, now, neededPlayers(p.format)) !== "over",
        )
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0],
    [data.proposals, now],
  );
  const nextPhase = next
    ? proposalPhase(next, now, neededPlayers(next.format))
    : null;
  const rained = useMemo(() => {
    const r = rainedOutToday(data.proposals, now);
    return r && !(next && sameDayAs(next.startsAt, now)) ? r : null;
  }, [data.proposals, now, next]);
  const month = now.getMonth();
  const year = now.getFullYear();
  const mine = useMemo(
    () =>
      me
        ? computePlayerStats(
            me.id,
            filterMatches(data.matches, {
              period: { kind: "month", year, month },
            }),
          )
        : null,
    [me, data.matches, year, month],
  );

  if (!me || !mine) return null;
  const elo = eloOf(engine.elo, me.id);
  const delta = Math.round(
    eloDelta(engine.elo, me.id, new Date(year, month, 1)),
  );
  const recent = data.matches.slice(0, RECENT);
  const mvp = engine.mvp;
  const mvpPlayer = data.players.find((p) => p.id === mvp?.entry.playerId);
  const winPct = Math.round(mine.winPct * 100);
  const openDay = () => {
    const shown = rained ?? next;
    if (!shown) return router.push("/organizza");
    const d = new Date(shown.startsAt);
    router.push(
      `/organizza?giorno=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  };

  const hasNext = Boolean(rained ?? next);
  const nextSection = (
    <Section
      index={hasNext ? 0 : 1}
      title={
        rained ? (
          <>
            <IconCloudRain size={18} className="text-court" aria-hidden />
            Oggi non si gioca
          </>
        ) : nextPhase === "confirmed" ? (
          <span className="flex items-center gap-1.5 text-ok">
            <IconCircleCheck size={18} aria-hidden />
            Partita confermata
          </span>
        ) : nextPhase === "live" ? (
          "Si gioca adesso"
        ) : (
          "Prossima partita"
        )
      }
      action={
        <SectionLink href="/organizza">
          <IconCalendar size={15} /> Calendario
        </SectionLink>
      }
    >
      <div
        data-tour="home-next"
        className="card cursor-pointer p-4"
        onClick={(e) => {
          if ((e.target as Element).closest("button, a")) return;
          openDay();
        }}
      >
        {rained ? (
          <RainedOut proposal={rained} next={next} compact />
        ) : next ? (
          <ProposalCard proposal={next} compact />
        ) : (
          <div className="flex items-center gap-3">
            <Mascot pose="boh" size={52} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">Nessuna partita in vista</p>
              <p className="text-[13px] text-muted">Proponi tu un giorno</p>
            </div>
            <Link
              href="/organizza?nuova=1"
              className="press flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-ball px-4 text-[14px] font-semibold text-ball-ink"
            >
              <IconPlus size={16} strokeWidth={2.4} /> Proponi
            </Link>
          </div>
        )}
      </div>
    </Section>
  );

  return (
    <>
      <header className="safe-top shrink-0 px-5">
        <div className="flex h-16 items-center justify-end gap-3 short:h-14">
          <h1 className="sr-only">Home</h1>
          <div className="flex shrink-0 items-center gap-1.5">
            <GameHomeButton />
            <HighlightsHomeButton />
            <NewsButton unseen={news.unseen} onOpen={openNews} />
            <Avatar player={me} size={40} />
          </div>
        </div>
        <NewsPanel
          open={newsOpen}
          onClose={() => setNewsOpen(false)}
          stories={news.stories}
          freshSince={freshSince}
        />
      </header>

      <PullToRefresh className="px-5">
        <div className="flex flex-col gap-7 pb-8 pt-3">
          {hasNext && nextSection}
          <section
            data-tour="home-month"
            className="rise court relative mt-8 rounded-[28px]"
            style={rise(hasNext ? 1 : 0)}
          >
            <div className="absolute inset-0 overflow-hidden rounded-[28px]" aria-hidden>
              <span className="blob -right-16 -top-20 h-56 w-56 bg-[radial-gradient(circle,rgb(255_197_49/0.45),transparent_68%)]" />
              <span className="blob -bottom-24 -left-16 h-60 w-60 bg-[radial-gradient(circle,rgb(242_106_27/0.35),transparent_70%)]" />
              <span className="blob -bottom-10 right-10 h-32 w-32 bg-[radial-gradient(circle,rgb(255_250_240/0.14),transparent_70%)]" />
              <CourtLines draw className="absolute inset-0 h-full w-full" />
            </div>
            <span
              className="absolute -top-12 right-4 drop-shadow-[0_10px_14px_rgb(0_0_0/0.25)]"
              aria-hidden
            >
              <Character
                id={characterOf(me)}
                outfit={me.outfit}
                number={me.jerseyNumber}
                height={132}
              />
            </span>
            <div className="relative px-5 pb-5 pt-6">
              <p className="w-fit rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-semibold">
                Il tuo {MONTHS_IT[month].toLowerCase()}
              </p>
              <div
                className="mt-4 flex items-end gap-5"
                aria-label={`${mine.wins} vinte, ${mine.losses} perse`}
              >
                <div>
                  <p className="score text-[60px]">
                    <CountUp value={mine.wins} />
                  </p>
                  <p className="mt-1 text-[13px] font-medium text-white/75">
                    {mine.wins === 1 ? "vinta" : "vinte"}
                  </p>
                </div>
                <div>
                  <p className="score text-[60px] text-white/55">
                    <CountUp value={mine.losses} />
                  </p>
                  <p className="mt-1 text-[13px] font-medium text-white/60">
                    {mine.losses === 1 ? "persa" : "perse"}
                  </p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 divide-x divide-white/15 rounded-[20px] bg-black/15 py-3">
                <div className="px-3.5">
                  <p className="num text-[20px]">{mine.games ? `${winPct}%` : "—"}</p>
                  <p className="mt-1 text-[11.5px] font-medium text-white/70">Vittorie</p>
                </div>
                <div className="px-3.5">
                  <p className="flex items-center gap-1.5">
                    <span className="num text-[20px]">
                      <CountUp value={elo} />
                    </span>
                    {delta !== 0 && (
                      <span
                        className={clsx(
                          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[11px] font-semibold",
                          delta > 0 ? "bg-volt text-volt-ink" : "bg-white/20",
                        )}
                      >
                        {delta > 0 ? <IconTrendingUp size={11} /> : <IconTrendingDown size={11} />}
                        {delta > 0 ? `+${delta}` : `−${-delta}`}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[11.5px] font-medium text-white/70">
                    ELO
                    <InfoTip label="Cos'è l'ELO" size={13}>
                      Il tuo punteggio di forza. Si parte tutti da 1000:
                      vincendo sale, perdendo scende. Battere chi è più forte
                      vale di più
                    </InfoTip>
                  </p>
                </div>
                <div className="px-3.5">
                  <p className="num text-[20px]">{mine.games}</p>
                  <p className="mt-1 text-[11.5px] font-medium text-white/70">
                    {mine.games === 1 ? "Partita" : "Partite"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {!hasNext && nextSection}

          <Section
            index={2}
            title="MVP in carica"
            action={
              <InfoTip label="Come si diventa MVP" size={16}>
                <MvpMonthInfo />
              </InfoTip>
            }
          >
            <MvpCard mvp={mvp} player={mvpPlayer} players={data.players} />
          </Section>

          <Section
            index={3}
            title="Ultime partite"
            action={
              recent.length > 0 && (
                <SectionLink href="/partite">
                  Tutte <IconChevronRight size={15} />
                </SectionLink>
              )
            }
          >
            {recent.length ? (
              <div className="scroll-x -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 px-5 pb-3 pt-1">
                {recent.map((m) => (
                  <RecentMatch
                    key={m.id}
                    match={m}
                    meId={me.id}
                    players={data.players}
                    now={now}
                    onOpenVideo={hl.open}
                  />
                ))}
              </div>
            ) : (
              <div className="card p-4">
                <p className="text-[15px] font-semibold">Si parte da zero</p>
                <p className="mt-0.5 text-[13px] text-muted">
                  Le partite compaiono qui appena le inseriamo
                </p>
              </div>
            )}
          </Section>

        </div>
      </PullToRefresh>
    </>
  );
}
