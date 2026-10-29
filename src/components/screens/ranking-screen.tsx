"use client";

import clsx from "clsx";
import Link from "next/link";
import { BookOpen, Crown } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { defaultPeriod, PeriodPicker } from "@/components/period-picker";
import { Avatar } from "@/components/ui/avatar";
import { Chips, EmptyState, ScreenHeader } from "@/components/ui/basics";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useData } from "@/lib/data/provider";
import { filterMatches, periodRange, type FormatFilter, type Period } from "@/lib/periods";
import { mvpRanking } from "@/lib/stats/awards";
import { leaderboard, STAT_BY_KEY, type StatKey } from "@/lib/stats/leaderboards";
import { computePlayerStats } from "@/lib/stats/player";
import { shortName } from "@/lib/types";

type Board = "mvp" | StatKey;

const BOARDS: { value: Board; label: string }[] = [
  { value: "mvp", label: "MVP" },
  { value: "vittorie", label: "Vittorie" },
  { value: "punti", label: "Punti" },
  { value: "assist", label: "Assist" },
  { value: "rimbalzi", label: "Rimbalzi" },
  { value: "tre", label: "Da tre" },
  { value: "elo", label: "ELO" },
];

interface Row {
  playerId: string;
  rank: number;
  value: string;
  sub?: string;
}

const PODIUM = [
  { place: 2, h: 64, color: "bg-court text-court-ink" },
  { place: 1, h: 92, color: "bg-volt text-volt-ink" },
  { place: 3, h: 46, color: "bg-ball text-ball-ink" },
];

function Podium({ rows }: { rows: Row[] }) {
  const { data } = useData();
  return (
    <div className="mb-4 grid grid-cols-3 items-end gap-2 px-1 pt-2" aria-label="Podio">
      {PODIUM.map(({ place, h, color }, i) => {
        const r = rows[place - 1];
        if (!r) return <div key={place} />;
        const p = data.players.find((x) => x.id === r.playerId);
        return (
          <Link key={place} href={`/giocatore/${r.playerId}`} className="flex min-w-0 flex-col items-center">
            <div className="flex flex-col items-center">
              {place === 1 && <Crown size={22} className="mb-1 text-gold" aria-hidden />}
              <Avatar player={p} size={place === 1 ? 64 : 52} href={false} />
              <p className="title mt-1.5 max-w-full truncate text-[14px]">{shortName(p, data.players)}</p>
              <p className="num text-[20px]">{r.value}</p>
            </div>
            <motion.div
              className={clsx("halftone mt-2 grid w-full place-items-start justify-center rounded-t-2xl border-[2.5px] border-b-0 border-edge pt-1.5", color)}
              style={{ height: h, transformOrigin: "bottom" }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 22, delay: i * 0.05 }}
            >
              <span className="score text-[30px]">{place}</span>
            </motion.div>
          </Link>
        );
      })}
    </div>
  );
}

export function RankingScreen() {
  const { data, engine, me } = useData();
  const [board, setBoard] = useState<Board>("mvp");
  const [period, setPeriod] = useState<Period>(() => defaultPeriod("month"));
  const [format, setFormat] = useState<FormatFilter>("all");

  const ids = engine.playerIds;
  const scoped = useMemo(() => filterMatches(data.matches, { period, format }), [data.matches, period, format]);
  const range = periodRange(period);

  const rows = useMemo<Row[]>(() => {
    if (board === "mvp") {
      return mvpRanking(ids, data.matches, period, format, { elo: engine.elo }).map((r, i) => ({
        playerId: r.playerId,
        rank: i + 1,
        value: String(Math.round(r.score * 100)),
        sub: `${r.games} partite, ${Math.round(r.winPct * 100)}% vinte`,
      }));
    }
    const stat = STAT_BY_KEY.get(board)!;
    const stats = ids.map((id) => computePlayerStats(id, scoped));
    return leaderboard(stat, stats, { elo: engine.elo, start: range?.start, end: range?.end, allTime: period.kind === "all" }).map((r) => {
      const s = stats.find((x) => x.playerId === r.playerId)!;
      return { playerId: r.playerId, rank: r.rank, value: stat.format(r.value).replace(".", ","), sub: `${s.games} ${s.games === 1 ? "partita" : "partite"}` };
    });
  }, [board, ids, data.matches, period, format, engine.elo, scoped, range?.start, range?.end]);

  const stat = board === "mvp" ? null : STAT_BY_KEY.get(board)!;
  const note = board === "mvp" ? "Conta vittorie, valutazione e crescita. Servono almeno 3 partite." : stat?.note;

  return (
    <>
      <ScreenHeader
        title="Classifica"
        action={
          <Link href="/classifiche/albo" aria-label="Record e albo d'oro" className="press flex h-11 items-center gap-2 rounded-full bg-surface px-4 text-[14px] font-semibold sticker-sm">
            <BookOpen size={17} className="text-court" /> Albo
          </Link>
        }
      />
      <div className="flex shrink-0 flex-col gap-2.5 px-5 pb-2">
        <PeriodPicker value={period} onChange={setPeriod} format={format} onFormat={setFormat} />
        <Chips value={board} onChange={setBoard} options={BOARDS} />
      </div>

      <PullToRefresh className="px-5 pb-4 pt-2">
        {rows.length === 0 ? (
          <EmptyState
            title="Classifica ancora vuota"
            text={board === "mvp" ? "Per entrare in classifica servono almeno 3 partite nel periodo." : "Non ci sono ancora abbastanza partite in questo periodo."}
          />
        ) : (
          <div key={`${board}-${period.kind}-${format}`}>
            <Podium rows={rows} />
            <ol className="flex flex-col gap-2">
              {rows.slice(3).map((r) => {
                const p = data.players.find((x) => x.id === r.playerId);
                const mine = r.playerId === me?.id;
                return (
                  <li key={r.playerId}>
                    <Link
                      href={mine ? "/profilo" : `/giocatore/${r.playerId}`}
                      className={clsx("press card flex items-center gap-3 px-3 py-2.5", mine && "!bg-court-soft")}
                    >
                      <span className="num w-6 text-center text-[18px] text-muted">{r.rank}</span>
                      <Avatar player={p} size={40} href={false} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold">{shortName(p, data.players)}</p>
                        {r.sub && <p className="truncate text-[12.5px] text-muted">{r.sub}</p>}
                      </div>
                      <span className="num text-[22px]">{r.value}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
            {note && <p className="px-1 pt-3 text-[12.5px] text-faint">{note}</p>}
          </div>
        )}
      </PullToRefresh>
    </>
  );
}
