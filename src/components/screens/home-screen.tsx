"use client";

import clsx from "clsx";
import Link from "next/link";
import {
  CalendarDays,
  CircleCheck,
  Crown,
  Plus,
  TrendingDown,
  TrendingUp,
  CloudRain,
} from "lucide-react";
import { proposalPhase, rainedOutToday } from "@/lib/proposals";
import { RainedOut } from "@/components/rained-out";
import { neededPlayers } from "@/lib/notifications/grouping";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { matchMvp } from "@/lib/stats/match-mvp";
import { computePlayerStats, teamOf } from "@/lib/stats/player";
import { Character, characterOf } from "@/components/character";
import { shortName, winnerOf } from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { InfoTip } from "@/components/ui/info";
import { MvpMonthInfo } from "@/components/mvp-info";
import { greeting } from "@/lib/greeting";
import { useNav } from "@/lib/nav";

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

export function HomeScreen() {
  const { data, me, engine } = useData();
  const hl = useHighlights();
  const now = useNow();
  const router = useNav();
  const news = useNews();
  const [newsOpen, setNewsOpen] = useState(false);
  // Le notizie nuove di questa apertura: hanno il pallino sulla scheda. Alla prossima, niente.
  const [freshSince, setFreshSince] = useState<string | null>(null);
  const openNews = () => {
    setFreshSince(news.since);
    setNewsOpen(true);
    news.markSeen();
  };
  // Dalla notifica di una notizia: la Home si apre con il pannello già aperto.
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
  // Oggi annullata per pioggia: per tutto il giorno la scheda lo dice (se oggi non c'è altro).
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
  const last = data.matches[0];
  const lastMvp = last ? matchMvp(last) : null;
  const lastMvpPlayer = lastMvp
    ? data.players.find((p) => p.id === lastMvp.playerId)
    : undefined;
  const lastTeam = last ? teamOf(last, me.id) : null;
  const mvp = engine.mvp;
  const mvpPlayer = data.players.find((p) => p.id === mvp?.entry.playerId);
  const goodMonth = mine.games > 0 && mine.winPct >= 0.5;
  const hello = greeting(now.getHours());
  const digits = String(mine.wins).length + String(mine.losses).length;

  return (
    <>
      <header className="safe-top shrink-0 px-5">
        <div className="flex h-16 items-center justify-between gap-3 short:h-14">
          <h1 className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-muted">
              {hello.lead}
            </span>
            <span className="display block truncate text-[24px]">
              {engine.mvp?.entry.playerId === me.id
                ? "MVP"
                : (me.nickname ?? me.firstName)}
              {hello.question ? "?" : ""}
            </span>
          </h1>
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

      <PullToRefresh scroll={false} className="px-5 pb-2 pt-2">
        <div className="flex h-full flex-col gap-3 short:gap-2">
          <section
            data-tour="home-month"
            className="court relative shrink-0 overflow-hidden rounded-[24px]"
          >
            <CourtLines draw className="absolute inset-0 h-full w-full" />
            <div className="relative p-5 short:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/70">
                    Il tuo {MONTHS_IT[month].toLowerCase()}
                  </h2>
                  <p
                    className={clsx(
                      "score mt-2 whitespace-nowrap short:mt-1",
                      digits <= 3
                        ? "text-[56px] short:text-[44px]"
                        : digits <= 4
                          ? "text-[48px] short:text-[38px]"
                          : "text-[40px] short:text-[34px]",
                    )}
                    aria-label={`${mine.wins} vinte, ${mine.losses} perse`}
                  >
                    <CountUp value={mine.wins} />
                    <span className="mx-1 text-white/40">–</span>
                    <CountUp value={mine.losses} />
                  </p>
                  <p className="mt-1.5 text-[14px] font-medium text-white/80">
                    {mine.games
                      ? `${mine.wins} ${mine.wins === 1 ? "vinta" : "vinte"}, ${mine.losses} ${mine.losses === 1 ? "persa" : "perse"}`
                      : "Nessuna partita questo mese"}
                  </p>
                </div>
                <Mascot
                  pose={goodMonth ? "esulta" : "ciao"}
                  size={84}
                  className="-mr-1 -mt-1 shrink-0 short:h-auto short:w-[60px]"
                />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 short:mt-3">
                <div className="rounded-2xl bg-white/12 px-3.5 py-2.5 short:py-2">
                  <dt className="text-[12px] font-medium text-white/70">
                    Vittorie
                  </dt>
                  <dd className="num mt-1 text-[22px]">
                    {Math.round(mine.winPct * 100)}%
                  </dd>
                </div>
                <div className="rounded-2xl bg-white/12 px-3.5 py-2.5 short:py-2">
                  <dt className="flex items-center gap-1 text-[12px] font-medium text-white/70">
                    ELO
                    <InfoTip label="Cos'è l'ELO" size={14}>
                      Il tuo punteggio di forza. Si parte tutti da 1000:
                      vincendo sale, perdendo scende. Battere chi è più forte
                      vale di più
                    </InfoTip>
                  </dt>
                  <dd className="mt-1 flex items-center gap-2">
                    <span className="num text-[22px]">
                      <CountUp value={elo} />
                    </span>
                    {delta !== 0 && (
                      <span
                        className={clsx(
                          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[12px] font-semibold",
                          delta > 0
                            ? "bg-volt text-volt-ink"
                            : "bg-white/20 text-white",
                        )}
                      >
                        {delta > 0 ? (
                          <TrendingUp size={12} />
                        ) : (
                          <TrendingDown size={12} />
                        )}
                        {delta > 0 ? `+${delta}` : `−${-delta}`}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          <section
            data-tour="home-next"
            className="card shrink-0 cursor-pointer p-4 transition-transform duration-100 active:scale-[0.99] short:p-3.5"
            onClick={(e) => {
              if ((e.target as Element).closest("button, a")) return;
              const shown = rained ?? next;
              if (!shown) return router.push("/organizza");
              const d = new Date(shown.startsAt);
              router.push(
                `/organizza?giorno=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
              );
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-2 short:mb-2">
              {rained ? (
                <h2 className="title flex items-center gap-1.5 text-[15px]">
                  <CloudRain
                    size={17}
                    strokeWidth={2.4}
                    className="text-court"
                    aria-hidden
                  />
                  Oggi non si gioca
                </h2>
              ) : nextPhase === "confirmed" ? (
                <h2 className="title flex items-center gap-1.5 text-[15px] text-ok">
                  <CircleCheck size={17} strokeWidth={2.4} aria-hidden />
                  Partita confermata
                </h2>
              ) : (
                <h2 className="title text-[15px]">
                  {nextPhase === "live" ? "Si gioca adesso" : "Prossima partita"}
                </h2>
              )}
              <Link
                href="/organizza"
                className="press -my-2 -mr-2 flex items-center gap-1.5 rounded-full px-2 py-2 text-[13px] font-semibold text-court"
              >
                <CalendarDays size={15} /> Calendario
              </Link>
            </div>
            {rained ? (
              <RainedOut proposal={rained} next={next} compact />
            ) : next ? (
              <ProposalCard proposal={next} compact />
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[14px] text-muted">
                  Nessuno ha ancora proposto un giorno
                </p>
                <Link
                  href="/organizza?nuova=1"
                  className="press flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-ball px-4 text-[14px] font-semibold text-ball-ink"
                >
                  <Plus size={16} strokeWidth={2.4} /> Proponi
                </Link>
              </div>
            )}
          </section>

          <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 short:gap-2">
            <div className="min-h-0">
              <Link
                href="/classifiche"
                data-tour="home-mvp"
                className="mvp-card card relative flex h-full flex-col overflow-hidden !border-transparent !bg-volt p-4 text-volt-ink short:p-3.5"
              >
                <div className="flex items-center justify-between gap-1">
                  <h2 className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold">
                    <Crown size={15} className="shrink-0" /> MVP in carica
                  </h2>
                  <InfoTip label="Come si diventa MVP" size={14}>
                    <MvpMonthInfo />
                  </InfoTip>
                </div>
                {mvp && mvpPlayer ? (
                  <div className="relative flex min-h-0 flex-1 flex-col">
                    <span
                      className="mvp-art flex min-h-0 flex-1 items-end justify-center pb-2"
                      aria-hidden
                    >
                      <Character
                        id={characterOf(mvpPlayer)}
                        outfit={mvpPlayer.outfit}
                        number={mvpPlayer.jerseyNumber}
                        height={104}
                      />
                    </span>
                    <div className="mt-auto flex items-center gap-2.5">
                      <span className="mvp-av-big">
                        <Avatar player={mvpPlayer} size={40} href={false} />
                      </span>
                      <span className="mvp-av-small hidden">
                        <Avatar player={mvpPlayer} size={32} href={false} />
                      </span>
                      <div className="min-w-0">
                        <p
                          className={clsx(
                            "title line-clamp-2 [overflow-wrap:anywhere]",
                            shortName(mvpPlayer, data.players).length > 13
                              ? "text-[13px]"
                              : shortName(mvpPlayer, data.players).length > 11
                                ? "text-[14px]"
                                : "mvp-name text-[16px]",
                          )}
                        >
                          {shortName(mvpPlayer, data.players)}
                        </p>
                        {mvp.period.kind === "month" && (
                          <p className="text-[12px] font-medium opacity-70">
                            {MONTHS_IT[mvp.period.month]}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col justify-end">
                    <p className="title text-[16px]">Ancora nessuno</p>
                    <p className="mt-1 text-[12px] font-medium opacity-70">
                      Serve giocare almeno 3 partite nel mese
                    </p>
                  </div>
                )}
              </Link>
            </div>

            <div className="min-h-0">
              <Link
                href={last ? `/partite?m=${last.id}` : "/partite"}
                onClick={(e) => {
                  if (!last) return;
                  if ((e.target as Element).closest("[data-hl-badge]")) {
                    e.preventDefault();
                    hl.open(last.id);
                    return;
                  }
                  markMatchOpenedFromElsewhere();
                }}
                className="last-card card flex h-full flex-col overflow-hidden p-4 short:p-3.5"
              >
                <div className="flex items-start justify-between gap-1">
                  <h2 className="text-[13px] font-semibold text-muted">
                    Ultima partita
                  </h2>
                  {last && (
                    <PlayBadge matchId={last.id} className="-my-1.5 -mr-1.5" />
                  )}
                </div>
                {last ? (
                  <>
                    {lastTeam && (
                      <span
                        className={clsx(
                          "last-pill mt-2 w-fit rounded-full px-2.5 py-1 text-[12px] font-semibold",
                          winnerOf(last) === lastTeam
                            ? "bg-ok/15 text-ok"
                            : "bg-raised text-muted",
                        )}
                      >
                        {winnerOf(last) === lastTeam ? "Hai vinto" : "Hai perso"}
                      </span>
                    )}
                    <div className="mt-auto pt-2">
                      <p
                        className={clsx(
                          "score whitespace-nowrap",
                          String(last.scoreA).length +
                            String(last.scoreB).length >
                            3
                            ? "text-[clamp(26px,8.4vw,36px)] short:text-[28px]"
                            : "text-[40px] short:text-[32px]",
                        )}
                      >
                        {last.scoreA}
                        <span className="mx-0.5 text-faint">–</span>
                        {last.scoreB}
                      </p>
                      <p className="mt-1 truncate text-[12.5px] text-muted">
                        {last.format} · {relativeDay(last.playedAt, now)}
                      </p>
                    </div>
                    {lastMvpPlayer && (
                      <div className="last-mvp mt-3 flex min-w-0 items-center gap-2 border-t border-line pt-3">
                        <span className="last-mvp-art shrink-0" aria-hidden>
                          <Character
                            id={characterOf(lastMvpPlayer)}
                            outfit={lastMvpPlayer.outfit}
                            number={lastMvpPlayer.jerseyNumber}
                            height={40}
                          />
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-gold">
                            <Crown size={12} /> MVP
                          </span>
                          <span className="block truncate text-[13px] font-semibold">
                            {shortName(lastMvpPlayer, data.players)}
                          </span>
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-1 flex-col justify-end">
                    <p className="title text-[16px]">Si parte da zero</p>
                    <p className="mt-1 text-[12px] text-muted">
                      Le partite compaiono qui appena le inseriamo
                    </p>
                  </div>
                )}
              </Link>
            </div>
          </div>
        </div>
      </PullToRefresh>
    </>
  );
}
