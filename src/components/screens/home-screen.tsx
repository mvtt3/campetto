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
} from "lucide-react";
import { proposalPhase } from "@/lib/proposals";
import { neededPlayers } from "@/lib/notifications/grouping";
import { useEffect, useMemo, useState } from "react";
import { NewsButton, NewsPanel, useNews } from "@/components/news-panel";
import { Logo, Mascot } from "@/components/mascot";
import { ProposalCard } from "@/components/proposal-card";
import { markMatchOpenedFromElsewhere } from "@/components/screens/matches-screen";
import { Avatar } from "@/components/ui/avatar";
import { CountUp, CourtLines, Ring } from "@/components/ui/basics";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
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

export function HomeScreen() {
  const { data, me, engine } = useData();
  const now = useNow();
  const router = useNav();
  const news = useNews();
  const [newsOpen, setNewsOpen] = useState(false);
  // Dalla notifica di una notizia: la Home si apre con il pannello già aperto.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("notizie") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNewsOpen(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  const openNews = () => {
    setNewsOpen(true);
    news.markSeen();
  };

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
  // Il punteggio del mese resta su una riga anche con tante partite.
  const digits = String(mine.wins).length + String(mine.losses).length;

  return (
    <>
      <header className="safe-top shrink-0 px-5">
        <div className={"flex h-16 items-center justify-between short:h-14"}>
          <div className="flex min-w-0 items-center gap-3">
            <Logo
              size={46}
              text={false}
              className="shrink-0 short:h-10 short:w-10"
            />
            <h1 className="min-w-0">
              <span className="block text-[14px] font-bold text-muted">
                {hello.lead},
              </span>{" "}
              <span className="display block truncate text-[26px] leading-[1.05]">
                {/* L'MVP in carica viene salutato come tale. */}
                {engine.mvp?.entry.playerId === me.id
                  ? "MVP"
                  : (me.nickname ?? me.firstName)}
                {hello.question ? "?" : ""}
              </span>
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <NewsButton unseen={news.unseen} onOpen={openNews} />
            <Avatar player={me} size={44} />
          </div>
        </div>
        <NewsPanel
          open={newsOpen}
          onClose={() => setNewsOpen(false)}
          stories={news.stories}
        />
      </header>

      <PullToRefresh scroll={false} className="px-5 pb-2 pt-2">
        <div className={"flex h-full flex-col gap-3 short:gap-2"}>
          {/* Il tuo mese, sul campo */}
          <section
            data-tour="home-month"
            className="court relative shrink-0 overflow-hidden rounded-[26px]"
          >
            <CourtLines
              draw
              className="absolute inset-x-0 bottom-0 h-full w-full"
            />
            <div className={"relative flex items-end gap-3 p-5 short:p-4"}>
              <div className="min-w-0 flex-1">
                <h2 className="text-[14px] font-semibold text-white/85">
                  Il tuo {MONTHS_IT[month].toLowerCase()}
                </h2>
                <p
                  className={clsx(
                    "score mt-2 whitespace-nowrap short:mt-1",
                    digits <= 3
                      ? "text-[64px] short:text-[46px]"
                      : digits <= 4
                        ? "text-[54px] short:text-[42px]"
                        : "text-[44px] short:text-[36px]",
                  )}
                  aria-label={`${mine.wins} vinte, ${mine.losses} perse`}
                >
                  <CountUp value={mine.wins} />
                  <span className="text-white/45">–</span>
                  <CountUp value={mine.losses} />
                </p>
                <p className="mt-1 text-[13px] text-white/85 short:hidden">
                  {mine.games ? "vinte e perse" : "Nessuna partita questo mese"}
                </p>
                <div className="mt-3 flex items-center gap-3 short:mt-2">
                  <Ring
                    value={mine.winPct}
                    size={46}
                    stroke={6}
                    label={`${Math.round(mine.winPct * 100)}% di vittorie`}
                  >
                    {/* Il % piccolo in alto: "100%" a grandezza piena usciva dall'anello. */}
                    <span className="num whitespace-nowrap text-[13px] leading-none">
                      {Math.round(mine.winPct * 100)}
                      <span className="ml-px align-[0.3em] text-[8.5px]">
                        %
                      </span>
                    </span>
                  </Ring>
                  <div className="text-[13px] leading-tight">
                    <p className="flex items-center gap-1 text-white/75">
                      ELO
                      <InfoTip label="Cos'è l'ELO" size={15}>
                        Il tuo punteggio di forza. Si parte tutti da 1000:
                        vincendo sale, perdendo scende. Battere chi è più forte
                        vale di più
                      </InfoTip>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <span className="num text-[20px]">
                        <CountUp value={elo} />
                      </span>
                      {delta !== 0 && (
                        <span
                          className={clsx(
                            "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11.5px] font-bold",
                            delta > 0
                              ? "border-2 border-[#1d1a16] bg-volt text-volt-ink"
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
                    </p>
                  </div>
                </div>
              </div>
              <Mascot
                pose={goodMonth ? "esulta" : "ciao"}
                size={96}
                className={"-mb-2 -mr-1 shrink-0 short:h-auto short:w-[64px]"}
              />
            </div>
          </section>

          {/* Prossima partita */}
          <section
            data-tour="home-next"
            className="card shrink-0 cursor-pointer p-4 transition-transform duration-100 active:translate-x-px active:translate-y-px short:p-3.5"
            onClick={(e) => {
              // Tutta la scheda apre il calendario; i pulsanti di risposta restano pulsanti.
              if ((e.target as Element).closest("button, a")) return;
              if (!next) return router.push("/organizza");
              const d = new Date(next.startsAt);
              router.push(
                `/organizza?giorno=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
              );
            }}
          >
            <div className="mb-3 flex items-center justify-between short:mb-1.5">
              {nextPhase === "confirmed" ? (
                <h2 className="title flex items-center gap-1.5 text-[16px] text-ok">
                  <CircleCheck size={18} strokeWidth={2.6} aria-hidden />
                  Partita confermata
                </h2>
              ) : (
                <h2 className="title text-[16px]">
                  {nextPhase === "live"
                    ? "Si gioca adesso"
                    : "Prossima partita"}
                </h2>
              )}
              <Link
                href="/organizza"
                className="press -my-2 flex items-center gap-1.5 py-2 text-[13.5px] font-semibold text-text"
              >
                <CalendarDays size={16} /> Calendario
              </Link>
            </div>
            {next ? (
              <ProposalCard proposal={next} compact />
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[14.5px] text-muted">
                  Nessuno ha ancora proposto un giorno
                </p>
                <Link
                  href="/organizza?nuova=1"
                  className="sticker press flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-ball px-4 text-[14px] font-bold text-ball-ink"
                >
                  <Plus size={17} strokeWidth={2.6} /> Proponi
                </Link>
              </div>
            )}
          </section>

          {/* MVP e ultima partita */}
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
            <div className="min-h-0">
              <Link
                href="/classifiche"
                data-tour="home-mvp"
                className="card halftone relative flex h-full flex-col overflow-hidden !bg-volt p-4 text-volt-ink short:p-3.5"
              >
                <h2 className="relative flex items-center gap-1 whitespace-nowrap text-[13.5px] font-bold">
                  <Crown size={15} className="shrink-0" /> MVP in carica
                  <InfoTip
                    label="Come si diventa MVP"
                    size={14}
                    className="ml-auto"
                  >
                    <MvpMonthInfo />
                  </InfoTip>
                </h2>
                {mvp && mvpPlayer ? (
                  <div className="relative flex min-h-0 flex-1 flex-col">
                    {/* Sui telefoni alti lo spazio libero lo riempie il suo personaggio, come in Classifica. */}
                    <span
                      className="flex min-h-0 flex-1 items-end justify-center overflow-hidden pb-1.5 [@media(max-height:780px)]:hidden"
                      aria-hidden
                    >
                      <Character
                        id={characterOf(mvpPlayer)}
                        number={mvpPlayer.jerseyNumber}
                        height={104}
                      />
                    </span>
                    <div className="mt-auto flex flex-row items-end gap-2">
                      <span className="short:hidden">
                        <Avatar player={mvpPlayer} size={44} href={false} />
                      </span>
                      <span className="hidden short:inline">
                        <Avatar player={mvpPlayer} size={34} href={false} />
                      </span>
                      <div className="min-w-0">
                        <p
                          className={clsx(
                            "title leading-tight",
                            // Un nome lungo (fino a 16 lettere) scende di misura invece di tagliarsi.
                            shortName(mvpPlayer, data.players).length > 13
                              ? "line-clamp-3 text-[12.5px] [overflow-wrap:anywhere]"
                              : shortName(mvpPlayer, data.players).length > 11
                                ? "line-clamp-3 text-[14px] [overflow-wrap:anywhere]"
                                : "line-clamp-2 break-words text-[17px]",
                          )}
                        >
                          {shortName(mvpPlayer, data.players)}
                        </p>
                        <p className="text-[12.5px] font-semibold opacity-75">
                          di{" "}
                          {mvp.period.kind === "month"
                            ? MONTHS_IT[mvp.period.month].toLowerCase()
                            : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative flex flex-1 flex-col justify-end">
                    <p className="title text-[17px]">Ancora nessuno</p>
                    <p className="mt-1 text-[12.5px] font-semibold opacity-75">
                      Serve giocare almeno 3 partite nel mese
                    </p>
                  </div>
                )}
              </Link>
            </div>

            <div className="min-h-0">
              <Link
                href={last ? `/partite?m=${last.id}` : "/partite"}
                onClick={() => last && markMatchOpenedFromElsewhere()}
                // Si adatta all'altezza che resta (container query): su un telefono basso spariscono
                // prima "Hai vinto", poi la figurina, mai il risultato tagliato.
                className="last-card card flex h-full flex-col overflow-hidden p-4 short:p-3.5"
              >
                <h2 className="text-[13.5px] font-semibold text-muted">
                  Ultima partita
                </h2>
                {lastMvpPlayer && (
                  <div className="last-mvp mt-1.5 flex min-w-0 items-end gap-1.5">
                    <span
                      className="last-mvp-art shrink-0 short:hidden"
                      aria-hidden
                    >
                      <Character
                        id={characterOf(lastMvpPlayer)}
                        number={lastMvpPlayer.jerseyNumber}
                        height={52}
                      />
                    </span>
                    <span className="min-w-0 pb-1">
                      <span className="flex items-center gap-1 text-[11.5px] font-bold text-gold">
                        <Crown size={12} /> MVP
                      </span>
                      <span className="block truncate text-[13.5px] font-bold">
                        {shortName(lastMvpPlayer, data.players)}
                      </span>
                    </span>
                  </div>
                )}
                {last ? (
                  <div className="flex flex-1 flex-col justify-end">
                    <p
                      // Si adatta alla larghezza: con le cifre doppie "22–10" a 40 px usciva dal riquadro.
                      className={clsx(
                        "score whitespace-nowrap",
                        String(last.scoreA).length +
                          String(last.scoreB).length >
                          3
                          ? "text-[clamp(24px,8.4vw,36px)] short:text-[26px]"
                          : "text-[40px] short:text-[30px]",
                      )}
                    >
                      {last.scoreA}
                      <span className="text-faint">–</span>
                      {last.scoreB}
                    </p>
                    <p className="mt-1 truncate text-[12.5px] text-muted">
                      {last.format}, {relativeDay(last.playedAt, now)}
                    </p>
                    {lastTeam && (
                      <span
                        className={clsx(
                          "last-pill sticker-sm mt-2 w-fit rounded-full px-2.5 py-0.5 text-[12px] font-bold short:hidden",
                          winnerOf(last) === lastTeam
                            ? "bg-volt text-volt-ink"
                            : "bg-raised text-muted",
                        )}
                      >
                        {winnerOf(last) === lastTeam
                          ? "Hai vinto"
                          : "Hai perso"}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col justify-end">
                    <p className="title text-[17px]">Si parte da zero</p>
                    <p className="mt-1 text-[12.5px] text-muted">
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
