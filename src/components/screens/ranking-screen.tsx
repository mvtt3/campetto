"use client";

import clsx from "clsx";
import Link from "next/link";
import { BookOpen, Crown } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { defaultPeriod, PeriodPicker } from "@/components/period-picker";
import { Avatar } from "@/components/ui/avatar";
import { Chips, EmptyState, ScreenHeader } from "@/components/ui/basics";
import { InfoTip } from "@/components/ui/info";
import { GroupStrip } from "@/components/group-strip";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useData } from "@/lib/data/provider";
import { filterMatches, periodRange, type FormatFilter, type Period } from "@/lib/periods";
import { minGamesFor, MVP_MIN_GAMES, mvpRanking } from "@/lib/stats/awards";
import { leaderboard, STAT_BY_KEY, type StatKey } from "@/lib/stats/leaderboards";
import { computePlayerStats } from "@/lib/stats/player";
import { playerHref, shortName } from "@/lib/types";
import { Character, characterOf } from "@/components/character";
import { TeamBoard } from "@/components/team-board";

type Board = "mvp" | "squadre" | StatKey;

const BOARDS: { value: Board; label: string }[] = [
  { value: "mvp", label: "MVP" },
  { value: "vittorie", label: "Vittorie" },
  { value: "punti", label: "Punti" },
  { value: "assist", label: "Assist" },
  { value: "rimbalzi", label: "Rimbalzi" },
  { value: "tre", label: "Da tre" },
  { value: "elo", label: "ELO" },
  { value: "squadre", label: "Squadre" },
];

interface Row {
  playerId: string;
  rank: number;
  value: string;
  sub?: string;
}

interface Pending {
  playerId: string;
  value: string;
  missing: number;
}

function boardInfo(board: Board, minGames: number | null): string {
  if (board === "mvp")
    return `Conta soprattutto vincere: 35% vittorie, 20% quanto fai vincere la squadra (+/−), 30% statistiche, 15% presenza. Servono almeno ${minGames ?? 3} partite`;
  if (board === "vittorie") return "Il totale delle vittorie nel periodo: qui conta anche quante volte vieni";
  if (board === "elo") return "Sale quando vinci e scende quando perdi, di più contro chi è più forte. Nel mese e nella stagione vedi quanto è cambiato.";
  const extra = board === "tre" ? " e almeno 5 tiri da tre" : "";
  return `Media a partita. Per entrare servono almeno ${minGames ?? 2} partite con tabellino${extra}, così chi gioca poco non scavalca chi c'è sempre.`;
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
          <Link key={place} href={playerHref(r.playerId)} className="flex min-w-0 flex-col items-center">
            <div className="flex w-full min-w-0 flex-col items-center">
              {place === 1 && <Crown size={22} className="mb-1 text-gold" aria-hidden />}
              {/* Sul podio salgono i personaggi. */}
              {p && <Character id={characterOf(p)} number={p.jerseyNumber} height={place === 1 ? 82 : 68} title={shortName(p, data.players)} />}
              <p className="title mt-1.5 w-full truncate text-center text-[14px]">{shortName(p, data.players)}</p>
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
  const teamScope = useMemo(() => filterMatches(data.matches, { period, format: "all" }), [data.matches, period]);

  const { rows, pending, minGames } = useMemo<{ rows: Row[]; pending: Pending[]; minGames: number | null }>(() => {
    if (board === "squadre") return { rows: [], pending: [], minGames: null };
    if (board === "mvp") {
      const ranked = mvpRanking(ids, data.matches, period, format, { elo: engine.elo });
      const games = ids.map((id) => ({ id, n: computePlayerStats(id, scoped).games }));
      const need = minGamesFor(Math.max(0, ...games.map((g) => g.n)), MVP_MIN_GAMES);
      return {
        rows: ranked.map((r, i) => ({
          playerId: r.playerId,
          rank: i + 1,
          value: String(Math.round(r.score * 100)),
          sub: `${r.games} partite, ${Math.round(r.winPct * 100)}% vinte`,
        })),
        pending: games
          .filter((g) => g.n > 0 && g.n < need)
          .sort((a, b) => b.n - a.n)
          .map((g) => ({ playerId: g.id, value: "", missing: need - g.n })),
        minGames: need,
      };
    }
    const stat = STAT_BY_KEY.get(board)!;
    const stats = ids.map((id) => computePlayerStats(id, scoped));
    const lb = leaderboard(stat, stats, { elo: engine.elo, start: range?.start, end: range?.end, allTime: period.kind === "all" });
    const fmt = (v: number) => stat.format(v).replace(".", ",");
    return {
      rows: lb.rows.map((r) => {
        const s = stats.find((x) => x.playerId === r.playerId)!;
        const n = stat.qualify?.by === "statGames" ? s.statGames : s.games;
        return { playerId: r.playerId, rank: r.rank, value: fmt(r.value), sub: stat.qualify ? `su ${n} ${n === 1 ? "partita" : "partite"}` : `${s.games} ${s.games === 1 ? "partita" : "partite"}` };
      }),
      pending: lb.pending.map((r) => ({ playerId: r.playerId, value: fmt(r.value), missing: r.missing })),
      minGames: lb.minGames,
    };
  }, [board, ids, data.matches, period, format, engine.elo, scoped, range?.start, range?.end]);

  const info = boardInfo(board, minGames);

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
        <div data-tour="rank-period">
          {/* Per le squadre il formato si sceglie sotto: qui non serve. */}
          <PeriodPicker value={period} onChange={setPeriod} format={format} onFormat={board === "squadre" ? undefined : setFormat} />
        </div>
        <div data-tour="rank-boards">
          <Chips value={board} onChange={setBoard} options={BOARDS} />
        </div>
      </div>

      <PullToRefresh className="px-5 pb-4 pt-2">
        {board === "squadre" ? (
          <TeamBoard matches={teamScope} />
        ) : rows.length === 0 ? (
          <>
            <EmptyState
              title="Classifica ancora vuota"
              text={board === "mvp" ? "Per entrare in classifica servono almeno 3 partite nel periodo" : "Non ci sono ancora abbastanza partite in questo periodo"}
            />
            <GroupStrip title="Intanto, ecco il gruppo" />
          </>
        ) : (
          <div key={`${board}-${period.kind}-${format}`} className="relative" data-tour="rank-podium">
            <div className="absolute right-0 top-1 z-10">
              <InfoTip label="Come funziona questa classifica">{info}</InfoTip>
            </div>
            <Podium rows={rows} />
            <ol className="flex flex-col gap-2">
              {rows.slice(3).map((r) => {
                const p = data.players.find((x) => x.id === r.playerId);
                const mine = r.playerId === me?.id;
                return (
                  <li key={r.playerId}>
                    <Link
                      href={mine ? "/profilo" : playerHref(r.playerId)}
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
            {pending.length > 0 && (
              <section className="mt-5" aria-label="Fuori classifica">
                <h3 className="mb-2 flex items-center justify-center gap-1.5 text-[13px] font-bold text-muted">
                  Fuori classifica
                  <InfoTip label="Perché sono fuori classifica" size={16}>
                    Hanno giocato meno partite del minimo di questo periodo: entrano appena le raggiungono
                  </InfoTip>
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {pending.map((r) => {
                    const p = data.players.find((x) => x.id === r.playerId);
                    return (
                      <li key={r.playerId} className="flex items-center gap-3 rounded-[18px] border-2 border-dashed border-line-strong px-3 py-2 opacity-80">
                        <Avatar player={p} size={30} href={false} ring="none" />
                        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{shortName(p, data.players)}</span>
                        <span className="shrink-0 text-[12.5px] font-semibold text-muted">
                          {r.value && <span className="num mr-2 text-[15px] text-faint">{r.value}</span>}
                          {r.missing === 1 ? "manca 1 partita" : `mancano ${r.missing} partite`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        )}
      </PullToRefresh>
    </>
  );
}
