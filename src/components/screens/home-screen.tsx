"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Crown, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { Logo, Mascot } from "@/components/mascot";
import { ProposalCard } from "@/components/proposal-card";
import { Avatar } from "@/components/ui/avatar";
import { CountUp, CourtLines, Ring } from "@/components/ui/basics";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useData } from "@/lib/data/provider";
import { filterMatches, MONTHS_IT } from "@/lib/periods";
import { eloDelta, eloOf } from "@/lib/stats/elo";
import { computePlayerStats, teamOf } from "@/lib/stats/player";
import { shortName, winnerOf } from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { InfoTip } from "@/components/ui/info";

function relativeDay(iso: string, now: Date): string {
  const d = new Date(iso);
  const days = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000,
  );
  if (days === 0) return "oggi";
  if (days === 1) return "ieri";
  if (days < 7) return `${days} giorni fa`;
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

export function HomeScreen() {
  const { data, me, engine } = useData();
  const now = useNow();
  const router = useRouter();

  const next = useMemo(
    () =>
      data.proposals
        .filter((p) => p.status === "aperta" && new Date(p.startsAt).getTime() > now.getTime() - 2 * 3_600_000)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0],
    [data.proposals, now],
  );
  const month = now.getMonth();
  const year = now.getFullYear();
  const mine = useMemo(
    () => (me ? computePlayerStats(me.id, filterMatches(data.matches, { period: { kind: "month", year, month } })) : null),
    [me, data.matches, year, month],
  );

  if (!me || !mine) return null;
  const elo = eloOf(engine.elo, me.id);
  const delta = Math.round(eloDelta(engine.elo, me.id, new Date(year, month, 1)));
  const last = data.matches[0];
  const lastTeam = last ? teamOf(last, me.id) : null;
  const mvp = engine.mvp;
  const mvpPlayer = data.players.find((p) => p.id === mvp?.entry.playerId);
  const goodMonth = mine.games > 0 && mine.winPct >= 0.5;

  return (
    <>
      <header className="safe-top shrink-0 px-5">
        <div className={"flex h-16 items-center justify-between short:h-14"}>
          <div className="flex items-center gap-3">
            <Logo size={46} text={false} className="shrink-0 short:h-10 short:w-10" />
            <div>
            <p className="text-[13px] font-semibold text-muted">{now.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}</p>
            <h1 className="display text-[26px]">Ciao {me.nickname ?? me.firstName}</h1>
            </div>
          </div>
          <Avatar player={me} size={44} />
        </div>
      </header>

      <PullToRefresh scroll={false} className="px-5 pb-2 pt-2">
        <div className={"flex h-full flex-col gap-3 short:gap-2"}>
          {/* Il tuo mese, sul campo */}
          <section data-tour="home-month" className="court relative shrink-0 overflow-hidden rounded-[26px]">
            <CourtLines draw className="absolute inset-x-0 bottom-0 h-full w-full" />
            <div className={"relative flex items-end gap-3 p-5 short:p-4"}>
              <div className="min-w-0 flex-1">
                <h2 className="text-[14px] font-semibold text-white/85">Il tuo {MONTHS_IT[month].toLowerCase()}</h2>
                <p className={"score mt-2 text-[64px] short:mt-1 short:text-[46px]"} aria-label={`${mine.wins} vinte, ${mine.losses} perse`}>
                  <CountUp value={mine.wins} />
                  <span className="text-white/45">–</span>
                  <CountUp value={mine.losses} />
                </p>
                <p className="mt-1 text-[13px] text-white/85 short:hidden">{mine.games ? "vinte e perse" : "Nessuna partita questo mese"}</p>
                <div className="mt-3 flex items-center gap-3 short:mt-2">
                  <Ring value={mine.winPct} size={46} stroke={6} label={`${Math.round(mine.winPct * 100)}% di vittorie`}>
                    <span className="num text-[13px]">{Math.round(mine.winPct * 100)}%</span>
                  </Ring>
                  <div className="text-[13px] leading-tight">
                    <p className="flex items-center gap-1 text-white/75">
                      ELO
                      <InfoTip label="Cos'è l'ELO" size={15}>
                        Il tuo punteggio di forza: parte da 1000, sale quando vinci e scende quando perdi, di più contro chi è forte
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
                            delta > 0 ? "border-2 border-[#1d1a16] bg-volt text-volt-ink" : "bg-white/20 text-white",
                          )}
                        >
                          {delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {delta > 0 ? `+${delta}` : `−${-delta}`}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <Mascot pose={goodMonth ? "esulta" : "ciao"} size={96} className={"-mb-2 -mr-1 shrink-0 short:h-auto short:w-[64px]"} />
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
              router.push(`/organizza?giorno=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
            }}
          >
            <div className="mb-3 flex items-center justify-between short:mb-1.5">
              <h2 className="title text-[16px]">Prossima partita</h2>
              <Link href="/organizza" className="press -my-2 flex items-center gap-1.5 py-2 text-[13.5px] font-semibold text-court">
                <CalendarDays size={16} /> Calendario
              </Link>
            </div>
            {next ? (
              <ProposalCard proposal={next} compact />
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[14.5px] text-muted">Nessuno ha ancora proposto un giorno.</p>
                <Link href="/organizza?nuova=1" className="sticker press flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-ball px-4 text-[14px] font-bold text-ball-ink">
                  <Plus size={17} strokeWidth={2.6} /> Proponi
                </Link>
              </div>
            )}
          </section>

          {/* MVP e ultima partita */}
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
            <div className="min-h-0">
              <Link href="/classifiche" data-tour="home-mvp" className="card halftone relative flex h-full flex-col overflow-hidden !bg-volt p-4 text-volt-ink short:p-3.5">
                <h2 className="relative flex items-center gap-1 whitespace-nowrap text-[13.5px] font-bold">
                  <Crown size={15} className="shrink-0" /> MVP in carica
                  <InfoTip label="Come si diventa MVP" size={14} className="ml-auto">
                    Il migliore del mese per vittorie, valutazione, presenza e crescita ELO, con almeno 3 partite giocate
                  </InfoTip>
                </h2>
                {mvp && mvpPlayer ? (
                  <div className="relative flex min-h-0 flex-1 flex-col justify-end gap-2 short:flex-row short:items-center">
                    <span className="short:hidden">
                      <Avatar player={mvpPlayer} size={52} href={false} />
                    </span>
                    <span className="hidden short:inline">
                      <Avatar player={mvpPlayer} size={36} href={false} />
                    </span>
                    <div className="min-w-0">
                      <p className="title truncate text-[18px]">{shortName(mvpPlayer, data.players)}</p>
                      <p className="text-[12.5px] font-semibold opacity-75">di {mvp.period.kind === "month" ? MONTHS_IT[mvp.period.month].toLowerCase() : ""}</p>
                    </div>
                  </div>
                ) : (
                  <div className="relative flex flex-1 flex-col justify-end">
                    <p className="title text-[17px]">Ancora nessuno</p>
                    <p className="mt-1 text-[12.5px] font-semibold opacity-75">Serve giocare almeno 3 partite nel mese</p>
                  </div>
                )}
              </Link>
            </div>

            <div className="min-h-0">
              <Link href={last ? `/partite?m=${last.id}` : "/partite"} className="card flex h-full flex-col overflow-hidden p-4 short:p-3.5">
                <h2 className="text-[13.5px] font-semibold text-muted">Ultima partita</h2>
                {last ? (
                  <div className="flex flex-1 flex-col justify-end">
                    <p className="score text-[40px] short:text-[30px]">
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
                          "sticker-sm mt-2 w-fit rounded-full px-2.5 py-0.5 text-[12px] font-bold short:hidden",
                          winnerOf(last) === lastTeam ? "bg-volt text-volt-ink" : "bg-raised text-muted",
                        )}
                      >
                        {winnerOf(last) === lastTeam ? "Hai vinto" : "Hai perso"}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col justify-end">
                    <p className="title text-[17px]">Si parte da zero</p>
                    <p className="mt-1 text-[12.5px] text-muted">Le partite compaiono qui appena le inseriamo.</p>
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
