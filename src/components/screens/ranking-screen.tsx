"use client";

import clsx from "clsx";
import Link from "next/link";
import { ArrowDown, ArrowUp, BookOpen, Crown } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { defaultPeriod, PeriodPicker } from "@/components/period-picker";
import { Avatar } from "@/components/ui/avatar";
import { Chips, EmptyState, ScreenHeader } from "@/components/ui/basics";
import { InfoTip } from "@/components/ui/info";
import { MvpMonthInfo } from "@/components/mvp-info";
import { GroupStrip } from "@/components/group-strip";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useData } from "@/lib/data/provider";
import {
  filterMatches,
  periodRange,
  type FormatFilter,
  type Period,
} from "@/lib/periods";
import { minGamesFor, MVP_MIN_GAMES, mvpRanking } from "@/lib/stats/awards";
import {
  leaderboard,
  STAT_BY_KEY,
  type StatKey,
} from "@/lib/stats/leaderboards";
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
  { value: "difesa", label: "Difesa" },
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
    return `Conta come giochi e conta vincere: 45% statistiche (punti, poi rimbalzi, assist, rubate e stoppate), 30% vittorie, 15% presenza, 10% impatto sulla squadra. Servono almeno ${minGames ?? 3} partite`;
  if (board === "vittorie")
    return "Le vittorie nel periodo: più giochi, più ne puoi mettere insieme";
  if (board === "elo")
    return "Il punteggio di forza: sale quando vinci, scende quando perdi, di più contro chi è forte. Nel mese e nella stagione vedi di quanto è salito o sceso";
  if (board === "difesa")
    return `Chi difende meglio: rubata o stoppata vale 1 punto difesa, un rimbalzo in difesa mezzo punto. È la media a partita: servono almeno ${minGames ?? 2} partite con il tabellino`;
  const extra = board === "tre" ? " e 5 tiri da tre" : "";
  return `La media a partita. Per entrare in classifica servono almeno ${minGames ?? 2} partite con il tabellino${extra}: così chi gioca una volta sola non scavalca chi c'è sempre. Chi tira poco compare in fondo`;
}

function missingLabel(missing: number): string {
  return missing === 1 ? "manca 1 partita" : `mancano ${missing} partite`;
}

const PODIUM = [
  { place: 2, h: 64, color: "bg-court text-court-ink" },
  { place: 1, h: 92, color: "bg-volt text-volt-ink" },
  { place: 3, h: 46, color: "bg-ball text-ball-ink" },
];

function Podium({ rows }: { rows: Row[] }) {
  const { data } = useData();
  return (
    <div
      className="mb-2 grid grid-cols-3 items-end gap-2 px-1 pt-2"
      aria-label="Podio"
    >
      {PODIUM.map(({ place, h, color }, i) => {
        const r = rows[place - 1];
        if (!r) return <div key={place} />;
        const p = data.players.find((x) => x.id === r.playerId);
        return (
          <Link
            key={place}
            href={playerHref(r.playerId)}
            className="flex min-w-0 flex-col items-center"
          >
            <div className="flex w-full min-w-0 flex-col items-center">
              {place === 1 && (
                <Crown size={22} className="mb-1 text-gold" aria-hidden />
              )}
              {/* Sul podio salgono i personaggi. */}
              {p && (
                <Character
                  id={characterOf(p)}
                  number={p.jerseyNumber}
                  height={place === 1 ? 82 : 68}
                  title={shortName(p, data.players)}
                />
              )}
              <p className="title mt-1.5 line-clamp-2 w-full break-words text-center text-[14px] leading-tight">
                {shortName(p, data.players)}
              </p>
              <p className="num text-[20px]">{r.value}</p>
              {r.value === "—" && r.sub && (
                <p className="text-[11.5px] font-semibold text-muted">
                  {r.sub}
                </p>
              )}
            </div>
            <motion.div
              className={clsx(
                "halftone mt-2 grid w-full place-items-start justify-center rounded-t-2xl border-[2.5px] border-b-0 border-edge pt-1.5",
                color,
              )}
              style={{ height: h, transformOrigin: "bottom" }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{
                type: "spring",
                stiffness: 220,
                damping: 22,
                delay: i * 0.05,
              }}
            >
              <span className="score text-[30px]">{place}</span>
            </motion.div>
          </Link>
        );
      })}
    </div>
  );
}

const MINI = [
  { place: 1, color: "bg-volt text-volt-ink" },
  { place: 2, color: "bg-court text-court-ink" },
  { place: 3, color: "bg-ball text-ball-ink" },
];

/**
 * Il podio in piccolo: quando scorri l'elenco il podio grande esce di scena e in cima resta
 * questa striscia con i primi tre, come nelle classifiche delle app di oggi. Così l'elenco
 * ha quasi tutto lo schermo ma i primi tre restano sempre in vista.
 */
function MiniPodium({ rows, show }: { rows: Row[]; show: boolean }) {
  const { data } = useData();
  return (
    <div
      className="pointer-events-none absolute inset-x-5 top-1 z-10"
      aria-hidden={!show}
    >
      <div
        className={clsx(
          "grid grid-cols-3 gap-1 rounded-[18px] bg-surface p-1.5 transition-[opacity,transform] duration-200 sticker-sm",
          show
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "-translate-y-2 opacity-0",
        )}
      >
        {MINI.map(({ place, color }) => {
          const r = rows[place - 1];
          if (!r) return <span key={place} />;
          const p = data.players.find((x) => x.id === r.playerId);
          return (
            <Link
              key={place}
              href={playerHref(r.playerId)}
              tabIndex={show ? 0 : -1}
              className="press flex min-w-0 items-center gap-1.5 rounded-[12px] px-1 py-0.5"
            >
              <span
                className={clsx(
                  "score grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-edge text-[13px]",
                  color,
                )}
              >
                {place}
              </span>
              <span className="min-w-0 leading-none">
                <span className="block truncate text-[12.5px] font-bold">
                  {shortName(p, data.players)}
                </span>
                <span className="num mt-0.5 block text-[13px]">{r.value}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/**
 * "Tu": se la tua riga è fuori dallo schermo resta agganciata in fondo all'elenco, con la tua
 * posizione. Un tocco e l'elenco ti porta lì.
 */
function MeDock({
  rank,
  value,
  sub,
  show,
  above,
  onGo,
}: {
  rank: number | null;
  value: string;
  sub: string;
  show: boolean;
  above: boolean;
  onGo: () => void;
}) {
  const { me, data } = useData();
  const Arrow = above ? ArrowUp : ArrowDown;
  return (
    <div className="sticky bottom-0 z-10 h-0">
      <button
        type="button"
        onClick={onGo}
        tabIndex={show ? 0 : -1}
        aria-hidden={!show}
        aria-label={`La tua posizione${rank ? `: ${rank}°` : ""}, vai alla tua riga`}
        className={clsx(
          "press absolute inset-x-0 bottom-2 flex items-center gap-3 rounded-[20px] border-[2.5px] border-edge bg-court-soft px-3 py-2 text-left transition-[opacity,transform] duration-200",
          show
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0",
        )}
        style={{ boxShadow: "3px 3px 0 var(--edge)" }}
      >
        <span className="num w-7 text-center text-[18px] text-muted">
          {rank ?? "–"}
        </span>
        <Avatar player={me ?? undefined} size={34} href={false} ring="none" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">
            Tu · {shortName(me ?? undefined, data.players)}
          </span>
          <span className="block truncate text-[12px] text-muted">{sub}</span>
        </span>
        <span className="num text-[20px]">{value}</span>
        <Arrow size={18} className="shrink-0 text-court" aria-hidden />
      </button>
    </div>
  );
}

export function RankingScreen() {
  const { data, engine, me } = useData();
  const [board, setBoard] = useState<Board>("mvp");
  const [period, setPeriod] = useState<Period>(() => defaultPeriod("month"));
  const [format, setFormat] = useState<FormatFilter>("all");

  const ids = engine.playerIds;
  const scoped = useMemo(
    () => filterMatches(data.matches, { period, format }),
    [data.matches, period, format],
  );
  const range = periodRange(period);
  const teamScope = useMemo(
    () => filterMatches(data.matches, { period, format: "all" }),
    [data.matches, period],
  );

  const { rows, pending, minGames } = useMemo<{
    rows: Row[];
    pending: Pending[];
    minGames: number | null;
  }>(() => {
    if (board === "squadre") return { rows: [], pending: [], minGames: null };
    if (board === "mvp") {
      const ranked = mvpRanking(ids, data.matches, period, format, {
        elo: engine.elo,
      });
      const games = ids.map((id) => ({
        id,
        n: computePlayerStats(id, scoped).games,
      }));
      const need = minGamesFor(
        Math.max(0, ...games.map((g) => g.n)),
        MVP_MIN_GAMES,
      );
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
    const lb = leaderboard(stat, stats, {
      elo: engine.elo,
      start: range?.start,
      end: range?.end,
      allTime: period.kind === "all",
    });
    const fmt = (v: number) => stat.format(v).replace(".", ",");
    return {
      // Chi ha tirato poco non sparisce: viene dopo gli altri, con il motivo.
      rows: [
        ...lb.rows.map((r) => {
          const s = stats.find((x) => x.playerId === r.playerId)!;
          const n = stat.qualify?.by === "statGames" ? s.statGames : s.games;
          return {
            playerId: r.playerId,
            rank: r.rank,
            value: fmt(r.value),
            sub: stat.qualify
              ? `su ${n} ${n === 1 ? "partita" : "partite"}`
              : `${s.games} ${s.games === 1 ? "partita" : "partite"}`,
          };
        }),
        ...lb.loose.map((r, i) => ({
          playerId: r.playerId,
          rank: lb.rows.length + i + 1,
          value: fmt(r.value),
          sub: r.note,
        })),
      ],
      pending: lb.pending.map((r) => ({
        playerId: r.playerId,
        value: fmt(r.value),
        missing: r.missing,
      })),
      minGames: lb.minGames,
    };
  }, [
    board,
    ids,
    data.matches,
    period,
    format,
    engine.elo,
    scoped,
    range?.start,
    range?.end,
  ]);

  const info = boardInfo(board, minGames);
  // Il podio non resta mai mezzo vuoto: se in classifica sono meno di tre, salgono anche
  // quelli fuori classifica (senza valore, con quante partite mancano).
  const fill = pending.slice(0, Math.max(0, 3 - rows.length));
  const podium: Row[] = [
    ...rows.slice(0, 3),
    ...fill.map((r, i) => ({
      playerId: r.playerId,
      rank: rows.length + i + 1,
      value: r.value || "—",
      sub: missingLabel(r.missing),
    })),
  ];
  const rest = rows.slice(3);
  const restPending = pending.slice(fill.length);

  // Dove sono io in questa classifica (dal quarto in giù o fuori classifica).
  const myRest = rest.find((r) => r.playerId === me?.id);
  const myPending = restPending.find((r) => r.playerId === me?.id);
  const podiumRef = useRef<HTMLDivElement>(null);
  const myRowRef = useRef<HTMLLIElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mineInView, setMineInView] = useState(true);
  const [mineAbove, setMineAbove] = useState(false);
  const scrollBox = () =>
    podiumRef.current?.closest<HTMLElement>(
      "[data-testid='scroll-container']",
    ) ?? null;
  // Il podio grande esce di scena: compare quello piccolo in cima.
  useEffect(() => {
    const el = podiumRef.current;
    const root = scrollBox();
    if (!el || !root) return;
    const io = new IntersectionObserver(
      ([e]) => setCollapsed(e.intersectionRatio < 0.3),
      { root, threshold: [0, 0.3, 0.6, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [board, period.kind, format, rows.length, pending.length]);
  // La mia riga: se non si vede, compare "Tu" agganciato in fondo.
  useEffect(() => {
    const el = myRowRef.current;
    const root = scrollBox();
    if (!el || !root) {
      setMineInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        setMineInView(e.intersectionRatio > 0.6);
        setMineAbove(e.boundingClientRect.top < (e.rootBounds?.top ?? 0));
      },
      { root, threshold: [0, 0.6, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [myRest?.playerId, myPending?.playerId, board, period.kind, format]);
  // Cambiando classifica si riparte dal podio.
  useEffect(() => {
    scrollBox()?.scrollTo({ top: 0 });
  }, [board, period.kind, format]);
  const goToMe = () => {
    const el = myRowRef.current;
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.remove("row-flash");
    void el.offsetWidth;
    el.classList.add("row-flash");
  };

  return (
    <>
      <ScreenHeader
        title="Classifica"
        action={
          <Link
            href="/classifiche/albo"
            aria-label="Record e albo d'oro"
            className="press flex h-11 items-center gap-2 rounded-full bg-surface px-4 text-[14px] font-semibold sticker-sm"
          >
            <BookOpen size={17} className="text-court" /> Albo
          </Link>
        }
      />
      <div className="flex shrink-0 flex-col gap-2.5 px-5 pb-2">
        <div data-tour="rank-period">
          {/* Per le squadre il formato si sceglie sotto: qui non serve. */}
          <PeriodPicker
            value={period}
            onChange={setPeriod}
            format={format}
            onFormat={board === "squadre" ? undefined : setFormat}
          />
        </div>
        <div data-tour="rank-boards">
          <Chips value={board} onChange={setBoard} options={BOARDS} scroll />
        </div>
      </div>

      {board !== "squadre" && (rows.length > 0 || pending.length > 0) ? (
        <>
          {/* Il podio grande in cima; scorrendo resta in vista quello piccolo e l'elenco
              prende quasi tutto lo schermo. */}
          <div className="relative flex min-h-0 flex-1 flex-col">
            <MiniPodium
              rows={podium}
              show={collapsed && rest.length + restPending.length > 0}
            />
            <PullToRefresh
              className={clsx(
                "px-5 pb-4 pt-1",
                // Sotto il podio piccolo le righe sfumano, senza bordi che spuntano.
                collapsed &&
                  "[-webkit-mask-image:linear-gradient(to_bottom,transparent_0,transparent_56px,#000_74px)] [mask-image:linear-gradient(to_bottom,transparent_0,transparent_56px,#000_74px)]",
              )}
            >
              <div
                key={`${board}-${period.kind}-${format}`}
                ref={podiumRef}
                className="relative"
                data-tour="rank-podium"
              >
                <div className="absolute right-5 top-1 z-10">
                  <InfoTip label="Come funziona questa classifica">
                    {board === "mvp" ? (
                      <MvpMonthInfo minGames={minGames ?? 3} />
                    ) : (
                      info
                    )}
                  </InfoTip>
                </div>
                <Podium rows={podium} />
              </div>
              <ol className="flex flex-col gap-2">
                {rest.map((r) => {
                  const p = data.players.find((x) => x.id === r.playerId);
                  const mine = r.playerId === me?.id;
                  return (
                    <li
                      key={r.playerId}
                      ref={mine ? myRowRef : undefined}
                      className="rounded-[20px]"
                    >
                      <Link
                        href={mine ? "/profilo" : playerHref(r.playerId)}
                        className={clsx(
                          "press card flex items-center gap-3 px-3 py-2",
                          mine && "!bg-court-soft",
                        )}
                      >
                        <span className="num w-6 text-center text-[18px] text-muted">
                          {r.rank}
                        </span>
                        <Avatar player={p} size={36} href={false} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold">
                            {shortName(p, data.players)}
                          </p>
                          {r.sub && (
                            <p className="truncate text-[12.5px] text-muted">
                              {r.sub}
                            </p>
                          )}
                        </div>
                        <span className="num text-[22px]">{r.value}</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
              {restPending.length > 0 && (
                <section className="mt-5" aria-label="Fuori classifica">
                  <h3 className="mb-2 flex items-center justify-center gap-1.5 text-[13px] font-bold text-muted">
                    Fuori classifica
                    <InfoTip label="Perché sono fuori classifica" size={16}>
                      Hanno giocato meno partite del minimo: entrano in
                      classifica appena lo raggiungono
                    </InfoTip>
                  </h3>
                  <ul className="flex flex-col gap-1.5">
                    {restPending.map((r) => {
                      const p = data.players.find((x) => x.id === r.playerId);
                      return (
                        <li
                          key={r.playerId}
                          ref={r.playerId === me?.id ? myRowRef : undefined}
                          className="flex items-center gap-3 rounded-[18px] border-2 border-dashed border-line-strong px-3 py-2 opacity-80"
                        >
                          <Avatar
                            player={p}
                            size={30}
                            href={false}
                            ring="none"
                          />
                          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                            {shortName(p, data.players)}
                          </span>
                          <span className="shrink-0 text-[12.5px] font-semibold text-muted">
                            {r.value && (
                              <span className="num mr-2 text-[15px] text-faint">
                                {r.value}
                              </span>
                            )}
                            {missingLabel(r.missing)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
              {(myRest || myPending) && (
                <>
                  <div className="h-16" aria-hidden />
                  <MeDock
                    rank={myRest?.rank ?? null}
                    value={myRest?.value ?? (myPending?.value || "—")}
                    sub={
                      myRest
                        ? (myRest.sub ?? "La tua posizione")
                        : `Fuori classifica · ${missingLabel(myPending!.missing)}`
                    }
                    show={!mineInView && collapsed}
                    above={mineAbove}
                    onGo={goToMe}
                  />
                </>
              )}
            </PullToRefresh>
          </div>
        </>
      ) : (
        <PullToRefresh className="px-5 pb-4 pt-2">
          {board === "squadre" ? (
            <TeamBoard matches={teamScope} />
          ) : (
            <>
              <EmptyState
                title="Classifica ancora vuota"
                text="Appena si gioca una partita in questo periodo, qui compare la classifica"
              />
              <GroupStrip title="Intanto, ecco il gruppo" />
            </>
          )}
        </PullToRefresh>
      )}
    </>
  );
}
