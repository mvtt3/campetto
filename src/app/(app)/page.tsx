"use client";

import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { useMemo } from "react";
import { BadgeMedal, TIER_STYLE } from "@/components/badge-medal";
import { ProposalCard } from "@/components/proposal-card";
import { Avatar } from "@/components/ui/avatar";
import { Card, CourtArc, signed } from "@/components/ui/basics";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { BADGE_BY_KEY, unitFor } from "@/lib/badges";
import { useData } from "@/lib/data/provider";
import { filterMatches, MONTHS_IT } from "@/lib/periods";
import { eloDelta, eloOf } from "@/lib/stats/elo";
import { computePlayerStats, teamOf } from "@/lib/stats/player";
import { shortName, winnerOf } from "@/lib/types";
import { useNow } from "@/lib/use-now";

function relativeDay(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86_400_000,
  );
  if (days === 0) return "Oggi";
  if (days === 1) return "Ieri";
  if (days < 7) return `${days} giorni fa`;
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

export default function HomePage() {
  const { data, me, engine } = useData();
  const now = useNow();

  const next = useMemo(
    () =>
      data.proposals
        .filter((p) => p.status === "aperta" && new Date(p.startsAt).getTime() > now.getTime() - 2 * 3_600_000)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0],
    [data.proposals, now],
  );

  const month = { kind: "month" as const, year: now.getFullYear(), month: now.getMonth() };
  const myMonth = useMemo(
    () => (me ? computePlayerStats(me.id, filterMatches(data.matches, { period: month })) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [me, data.matches],
  );
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const myElo = me ? eloOf(engine.elo, me.id) : 1000;
  const myEloMonth = me ? eloDelta(engine.elo, me.id, start) : 0;

  const last = data.matches[0];
  const mvp = engine.mvp;
  const mvpPlayer = data.players.find((p) => p.id === mvp?.entry.playerId);
  const recentUnlock = me ? [...engine.badges(me.id).unlocks].pop() : undefined;
  const closest = useMemo(() => {
    if (!me) return null;
    return engine
      .badges(me.id)
      .states.filter((s) => s.next && s.def.mode === "total")
      .map((s) => ({ s, missing: s.next! - s.value, ratio: (s.value - s.prev) / (s.next! - s.prev) }))
      .sort((a, b) => b.ratio - a.ratio || Number(b.s.def.key === "presenze") - Number(a.s.def.key === "presenze") || a.missing - b.missing)[0];
  }, [me, engine]);

  if (!me) return null;
  const lastMine = last ? teamOf(last, me.id) : null;

  return (
    <>
      <header className="safe-top shrink-0 px-4">
        <div className="flex h-14 items-center justify-between">
          <h1 className="title text-[26px]">Ciao {me.nickname ?? me.firstName}</h1>
          <Avatar player={me} size={38} />
        </div>
      </header>

      <PullToRefresh scroll={false} className="px-4 pb-3">
        <div className="grid h-full grid-cols-2 grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-3 [@media(max-height:700px)]:gap-2">
          {/* Prossima partita */}
          <Card className="col-span-2 p-4 [@media(max-height:700px)]:p-3.5">
            <div className="mb-3 flex items-center justify-between [@media(max-height:700px)]:mb-2">
              <h2 className="text-[13px] font-semibold text-muted">Prossima partita</h2>
              <Link href="/organizza" className="-my-2 flex items-center gap-1.5 py-2 text-[13px] font-semibold text-ball">
                <CalendarDays size={15} /> Calendario
              </Link>
            </div>
            {next ? (
              <ProposalCard proposal={next} compact />
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[15px] text-muted">Nessuna partita in programma.</p>
                <Link
                  href="/organizza?nuova=1"
                  className="flex h-11 shrink-0 items-center gap-1.5 rounded-[14px] bg-ball px-4 text-[14px] font-semibold text-ball-ink"
                >
                  <Plus size={17} strokeWidth={2.6} /> Proponi
                </Link>
              </div>
            )}
          </Card>

          {/* MVP in carica */}
          <Link href="/classifiche" className="relative min-h-0 overflow-hidden rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-line ring-inset [@media(max-height:700px)]:p-3.5">
            <CourtArc className="pointer-events-none absolute -bottom-3 left-1/2 w-[150%] -translate-x-1/2 text-court" />
            <div className="relative flex h-full flex-col">
              <h2 className="text-[13px] font-semibold text-muted">MVP in carica</h2>
              {mvp && mvpPlayer ? (
                <div className="flex min-h-0 flex-1 flex-col items-start justify-end gap-2 [@media(max-height:700px)]:gap-1">
                  <span className="[@media(max-height:700px)]:hidden">
                    <Avatar player={mvpPlayer} size={56} href={false} />
                  </span>
                  <span className="hidden [@media(max-height:700px)]:inline">
                    <Avatar player={mvpPlayer} size={38} href={false} />
                  </span>
                  <div className="min-w-0">
                    <p className="title truncate text-[19px]">{shortName(mvpPlayer, data.players)}</p>
                    <p className="text-[12.5px] text-gold">
                      MVP di {mvp.period.kind === "month" ? MONTHS_IT[mvp.period.month].toLowerCase() : ""}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col justify-end">
                  <p className="title text-[17px]">Ancora nessuno</p>
                  <p className="mt-1 text-[12.5px] text-muted">Servono almeno 3 partite nel mese.</p>
                </div>
              )}
            </div>
          </Link>

          {/* Il tuo mese */}
          <Link href="/profilo" className="flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-line ring-inset [@media(max-height:700px)]:p-3.5">
            <h2 className="text-[13px] font-semibold text-muted">Il tuo {MONTHS_IT[now.getMonth()].toLowerCase()}</h2>
            <div className="flex flex-1 flex-col justify-end">
              <p className="num text-[44px] [@media(max-height:700px)]:text-[34px]" aria-label={`${myMonth?.wins ?? 0} vittorie e ${myMonth?.losses ?? 0} sconfitte`}>
                {myMonth?.wins ?? 0}
                <span className="text-faint">–</span>
                {myMonth?.losses ?? 0}
              </p>
              <p className="mt-1 text-[12.5px] text-muted">vittorie e sconfitte</p>
              <p className="mt-2 text-[13px]">
                ELO <span className="num-wide font-bold">{myElo}</span>{" "}
                {myEloMonth !== 0 && (
                  <span className={myEloMonth > 0 ? "text-ok" : "text-danger"}>{signed(myEloMonth)}</span>
                )}
              </p>
            </div>
          </Link>

          {/* Ultima partita */}
          <Link
            href={last ? `/partite?m=${last.id}` : "/nuova"}
            className="flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-line ring-inset [@media(max-height:700px)]:p-3.5"
          >
            <h2 className="text-[13px] font-semibold text-muted">Ultima partita</h2>
            {last ? (
              <div className="flex flex-1 flex-col justify-end">
                <p className="num text-[38px] [@media(max-height:700px)]:text-[30px]">
                  {last.scoreA}
                  <span className="text-faint">–</span>
                  {last.scoreB}
                </p>
                <p className="mt-1 truncate text-[12.5px] text-muted">
                  {last.format}, {relativeDay(last.playedAt)}
                </p>
                {lastMine && (
                  <p className={`mt-1 text-[13px] font-semibold ${winnerOf(last) === lastMine ? "text-ok" : "text-muted"}`}>
                    {winnerOf(last) === lastMine ? "Hai vinto" : "Hai perso"}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-1 flex-col justify-end">
                <p className="title text-[17px]">Gioca la prima</p>
                <p className="mt-1 text-[12.5px] text-muted">Poi segna qui il risultato.</p>
              </div>
            )}
          </Link>

          {/* Badge */}
          <Link href="/profilo/badge" className="flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-line ring-inset [@media(max-height:700px)]:p-3.5">
            <h2 className="text-[13px] font-semibold text-muted">{recentUnlock ? "Ultimo badge" : "Prossimo badge"}</h2>
            {recentUnlock ? (
              <div className="flex min-h-0 flex-1 flex-col items-start justify-end gap-2 [@media(max-height:700px)]:gap-1">
                <span className="[@media(max-height:700px)]:hidden">
                  <BadgeMedal icon={BADGE_BY_KEY.get(recentUnlock.key)!.icon} tier={recentUnlock.tier} size={44} />
                </span>
                <span className="hidden [@media(max-height:700px)]:inline">
                  <BadgeMedal icon={BADGE_BY_KEY.get(recentUnlock.key)!.icon} tier={recentUnlock.tier} size={30} />
                </span>
                <div className="min-w-0">
                  <p className="title truncate text-[16px]">{BADGE_BY_KEY.get(recentUnlock.key)!.name}</p>
                  <p className="text-[12.5px] text-muted">{TIER_STYLE[recentUnlock.tier].label}</p>
                </div>
              </div>
            ) : closest ? (
              <div className="flex min-h-0 flex-1 flex-col items-start justify-end gap-2 [@media(max-height:700px)]:gap-1">
                <span className="[@media(max-height:700px)]:hidden">
                  <BadgeMedal icon={closest.s.def.icon} tier={0} size={40} />
                </span>
                <div className="min-w-0">
                  <p className="title truncate text-[16px]">{closest.s.def.name}</p>
                  <p className="text-[12.5px] text-muted">
                    Ancora {closest.missing} {unitFor(closest.s.def, closest.missing)}
                  </p>
                </div>
              </div>
            ) : null}
          </Link>
        </div>
      </PullToRefresh>
    </>
  );
}
