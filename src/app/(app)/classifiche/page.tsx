"use client";

import clsx from "clsx";
import Link from "next/link";
import { Crown, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { MatchSheet } from "@/components/match-sheet";
import { defaultPeriod, PeriodPicker } from "@/components/period-picker";
import { Avatar } from "@/components/ui/avatar";
import { Chips, EmptyState, ScreenHeader, Segmented } from "@/components/ui/basics";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useData } from "@/lib/data/provider";
import { filterMatches, monthLabel, periodRange, seasonLabel, type FormatFilter, type Period } from "@/lib/periods";
import { categoryKings, KING_LABELS, mvpRanking } from "@/lib/stats/awards";
import { leaderboard, STATS, STAT_BY_KEY, type StatKey } from "@/lib/stats/leaderboards";
import { computePlayerStats } from "@/lib/stats/player";
import { groupRecords } from "@/lib/stats/records";
import { FORMATS, shortName, type Match } from "@/lib/types";

type Tab = "mvp" | "stat" | "record" | "albo";

function Row({ rank, playerId, main, sub, highlight }: { rank: number; playerId: string; main: string; sub?: string; highlight?: boolean }) {
  const { data, me } = useData();
  const p = data.players.find((x) => x.id === playerId);
  return (
    <Link
      href={me?.id === playerId ? "/profilo" : `/giocatore/${playerId}`}
      className={clsx(
        "flex items-center gap-3 rounded-[18px] px-3 py-2.5 ring-inset",
        highlight ? "bg-ball-soft ring-1 ring-ball/30" : "bg-surface ring-1 ring-line",
      )}
    >
      <span className="num w-6 text-center text-[20px] text-muted">{rank}</span>
      <Avatar player={p} size={38} href={false} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{shortName(p, data.players)}</p>
        {sub && <p className="truncate text-[12.5px] text-muted">{sub}</p>}
      </div>
      <span className="num text-[24px]">{main}</span>
    </Link>
  );
}

export default function RankingsPage() {
  const { data, engine, me } = useData();
  const [tab, setTab] = useState<Tab>("mvp");
  const [period, setPeriod] = useState<Period>(() => defaultPeriod("month"));
  const [format, setFormat] = useState<FormatFilter>("all");
  const [statKey, setStatKey] = useState<StatKey>("vittorie");
  const [openMatch, setOpenMatch] = useState<Match | null>(null);

  const ids = engine.playerIds;
  const scoped = useMemo(() => filterMatches(data.matches, { period, format }), [data.matches, period, format]);
  const ranking = useMemo(() => mvpRanking(ids, data.matches, period, format, { elo: engine.elo }), [ids, data.matches, period, format, engine.elo]);
  const kings = useMemo(() => categoryKings(ids, format === "all" ? data.matches : filterMatches(data.matches, { format }), period), [ids, data.matches, period, format]);
  const stats = useMemo(() => ids.map((id) => computePlayerStats(id, scoped)), [ids, scoped]);
  const range = periodRange(period);
  const stat = STAT_BY_KEY.get(statKey)!;
  const board = useMemo(
    () => leaderboard(stat, stats, { elo: engine.elo, start: range?.start, end: range?.end, allTime: period.kind === "all" }),
    [stat, stats, engine.elo, range?.start, range?.end, period.kind],
  );
  const records = useMemo(() => groupRecords(scoped), [scoped]);
  const name = (id: string) => shortName(data.players.find((p) => p.id === id), data.players);

  const showFilters = tab !== "albo";

  return (
    <>
      <ScreenHeader title="Classifiche" />
      <div className="flex shrink-0 flex-col gap-3 px-4 pb-3">
        <Segmented
          value={tab}
          onChange={setTab}
          size="sm"
          options={[
            { value: "mvp", label: "MVP" },
            { value: "stat", label: "Numeri" },
            { value: "record", label: "Record" },
            { value: "albo", label: "Albo" },
          ]}
        />
        {showFilters && (
          <>
            <PeriodPicker value={period} onChange={setPeriod} />
            <Chips
              value={format}
              onChange={setFormat}
              options={[{ value: "all" as const, label: "Tutti i formati" }, ...FORMATS.map((f) => ({ value: f, label: f }))]}
            />
          </>
        )}
      </div>

      <PullToRefresh className="px-4 pb-4">
        {tab === "mvp" && (
          <div className="flex flex-col gap-2">
            {ranking.length === 0 ? (
              <EmptyState title="Ancora nessun MVP" text="Per entrare in classifica servono almeno 3 partite nel periodo." />
            ) : (
              <>
                {ranking.map((r, i) => (
                  <Row
                    key={r.playerId}
                    rank={i + 1}
                    playerId={r.playerId}
                    main={String(Math.round(r.score * 100))}
                    sub={`${r.games} partite, ${Math.round(r.winPct * 100)}% vinte${r.effAvg !== null ? `, valutazione ${r.effAvg.toFixed(1)}` : ""}`}
                    highlight={i === 0}
                  />
                ))}
                <p className="px-1 pt-1 text-[12px] text-faint">
                  Punteggio MVP: 40% vittorie, 40% valutazione media, 20% crescita ELO. Minimo 3 partite.
                </p>
              </>
            )}
            {kings.length > 0 && (
              <section className="mt-4">
                <h2 className="mb-2 px-1 text-[13px] font-semibold text-muted">Migliori per categoria</h2>
                <div className="flex flex-col gap-2">
                  {kings.map((k) => (
                    <Link
                      key={k.category}
                      href={me?.id === k.playerId ? "/profilo" : `/giocatore/${k.playerId}`}
                      className="flex items-center gap-3 rounded-[18px] bg-surface px-3 py-2.5 ring-1 ring-line ring-inset"
                    >
                      <Avatar player={data.players.find((p) => p.id === k.playerId)} size={36} href={false} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] text-muted">{KING_LABELS[k.category]}</p>
                        <p className="truncate text-[15px] font-semibold">{name(k.playerId)}</p>
                      </div>
                      <p className="text-right text-[13px] text-muted">{k.label}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {tab === "stat" && (
          <div className="flex flex-col gap-2">
            <Chips value={statKey} onChange={setStatKey} options={STATS.map((s) => ({ value: s.key, label: s.short }))} className="mb-1" />
            <div className="mb-1 px-1">
              <p className="title text-[17px]">{stat.label}</p>
              {stat.note && <p className="text-[12px] text-faint">{stat.note}</p>}
            </div>
            {board.length === 0 ? (
              <EmptyState title="Nessun dato" text="Non ci sono abbastanza partite in questo periodo." />
            ) : (
              board.map((r) => <Row key={r.playerId} rank={r.rank} playerId={r.playerId} main={stat.format(r.value)} highlight={r.rank === 1} />)
            )}
          </div>
        )}

        {tab === "record" && (
          <div className="flex flex-col gap-2">
            {records.length === 0 ? (
              <EmptyState title="Ancora nessun record" text="I primati del gruppo compaiono dopo le prime partite." />
            ) : (
              records.map((r) => (
                <button
                  key={r.key}
                  disabled={!r.matchId}
                  onClick={() => setOpenMatch(data.matches.find((m) => m.id === r.matchId) ?? null)}
                  className="flex items-center gap-3 rounded-[18px] bg-surface px-3.5 py-3 text-left ring-1 ring-line ring-inset"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] text-muted">{r.label}</p>
                    <p className="truncate text-[15px] font-semibold">{r.playerIds.map(name).join(", ")}</p>
                    {r.date && (
                      <p className="text-[12px] text-faint">
                        {new Date(r.date).toLocaleDateString("it-IT", r.key === "busiest" ? { month: "long", year: "numeric" } : { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    )}
                  </div>
                  <p className="num shrink-0 text-[24px]">{r.display}</p>
                </button>
              ))
            )}
          </div>
        )}

        {tab === "albo" && (
          <div className="flex flex-col gap-5">
            <section>
              <h2 className="mb-2 px-1 text-[13px] font-semibold text-muted">Stagioni</h2>
              {engine.seasons.length === 0 ? (
                <p className="px-1 text-[14px] text-muted">Le stagioni durano tre mesi. Chi chiude da MVP vince un trofeo per sempre.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {engine.seasons.map((s) => {
                    const top = s.ranking[0];
                    return (
                      <div key={`${s.year}-${s.quarter}`} className="flex items-center gap-3 rounded-[18px] bg-surface px-3 py-2.5 ring-1 ring-line ring-inset">
                        <span className={clsx("grid h-10 w-10 place-items-center rounded-full", s.closed ? "bg-gold-soft text-gold" : "bg-raised text-muted")}>
                          <Trophy size={19} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold">{seasonLabel(s.year, s.quarter)}</p>
                          <p className="truncate text-[12.5px] text-muted">
                            {top ? `${s.closed ? "Campione" : "In testa"}: ${name(top.playerId)}` : "Ancora nessuno con 3 partite"}
                          </p>
                        </div>
                        {top && <Avatar player={data.players.find((p) => p.id === top.playerId)} size={34} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            <section>
              <h2 className="mb-2 px-1 text-[13px] font-semibold text-muted">Mese per mese</h2>
              {engine.months.length === 0 ? (
                <p className="px-1 text-[14px] text-muted">Qui finiranno gli MVP e i migliori di ogni mese.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {engine.months.map((mo) => (
                    <div key={`${mo.year}-${mo.month}`} className="rounded-[18px] bg-surface px-3.5 py-3 ring-1 ring-line ring-inset">
                      <div className="flex items-center justify-between">
                        <p className="title text-[16px]">{monthLabel(mo.year, mo.month)}</p>
                        {!mo.closed && <span className="text-[12px] text-muted">in corso</span>}
                      </div>
                      {mo.mvp ? (
                        <p className="mt-1.5 flex items-center gap-2 text-[14px]">
                          <Crown size={16} className="text-gold" /> MVP <span className="font-semibold">{name(mo.mvp.playerId)}</span>
                        </p>
                      ) : (
                        <p className="mt-1.5 text-[13px] text-muted">Nessun MVP: servono 3 partite.</p>
                      )}
                      {mo.kings.length > 0 && (
                        <ul className="mt-1.5 flex flex-col gap-0.5 text-[13px] text-muted">
                          {mo.kings.map((k) => (
                            <li key={k.category}>
                              {KING_LABELS[k.category]}: <span className="text-text">{name(k.playerId)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </PullToRefresh>
      <MatchSheet match={openMatch} onClose={() => setOpenMatch(null)} />
    </>
  );
}
