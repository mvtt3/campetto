"use client";

import clsx from "clsx";
import Link from "next/link";
import {
  IconArrowDown,
  IconArrowUp,
  IconBook,
  IconChevronRight,
  IconCrown,
} from "@tabler/icons-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { defaultPeriod, PeriodPicker } from "@/components/period-picker";
import { Avatar } from "@/components/ui/avatar";
import { Chips, EmptyState } from "@/components/ui/basics";
import { InfoTip } from "@/components/ui/info";
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

function missingLabel(missing: number): string {
  return missing === 1 ? "manca 1 partita" : `mancano ${missing} partite`;
}

const LABEL =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted";

const STEPS = [
  {
    place: 2,
    height: 150,
    numeral: "text-[38px]",
    top: "bg-[#ffffff]",
    tone: "bg-linear-to-b from-[#e6ebf5] to-[#9aa5bd] text-[#2b3245]",
  },
  {
    place: 1,
    height: 186,
    numeral: "text-[50px]",
    top: "bg-[#fff3c2]",
    tone: "bg-linear-to-b from-[#ffd65c] via-[#ffad33] to-[#e9781a] text-[#1d1a16]",
  },
  {
    place: 3,
    height: 128,
    numeral: "text-[32px]",
    top: "bg-[#ffe9d8]",
    tone: "bg-linear-to-b from-[#ffcaa3] to-[#c86d3a] text-[#4a2410]",
  },
];

const SPRING = { type: "spring", stiffness: 260, damping: 22 } as const;

function Podium({ rows }: { rows: Row[] }) {
  const { data, me } = useData();
  return (
    <div className="relative isolate -mx-5 overflow-hidden px-4 pt-2">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_38%_44%_at_50%_48%,rgb(255_197_49/0.5),transparent),radial-gradient(ellipse_50%_14%_at_50%_86%,rgb(255_197_49/0.3),transparent)]"
      />
      <div className="grid grid-cols-3 items-end [mask-image:linear-gradient(to_bottom,#000_calc(100%-44px),transparent)]">
        {STEPS.map(({ place, height, numeral, top, tone }, i) => {
          const row = rows[place - 1];
          if (!row) return <div key={place} />;
          const p = data.players.find((x) => x.id === row.playerId);
          const name = shortName(p, data.players);
          const mine = row.playerId === me?.id;
          const first = place === 1;
          return (
            <Link
              key={place}
              href={mine ? "/profilo" : playerHref(row.playerId)}
              className={clsx(
                "press relative flex min-w-0 flex-col items-center",
                first && "z-10",
              )}
            >
              <motion.div
                className="relative z-10 -mb-2 flex flex-col items-center"
                initial={{ opacity: 0, y: -28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING, delay: 0.3 + i * 0.08 }}
              >
                {first && (
                  <motion.span
                    className="mb-0.5 text-gold drop-shadow-[0_2px_6px_rgb(232_161_0/0.5)]"
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ ...SPRING, delay: 0.6 }}
                  >
                    <IconCrown size={26} aria-hidden />
                  </motion.span>
                )}
                {p && (
                  <Character
                    id={characterOf(p)}
                    outfit={p.outfit}
                    number={p.jerseyNumber}
                    height={first ? 104 : 80}
                    title={name}
                  />
                )}
                <span className="absolute -bottom-0.5 left-1/2 -z-10 h-3 w-16 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(29_26_22/0.4),transparent)]" />
              </motion.div>
              <motion.div
                className={clsx(
                  "flex w-full flex-col",
                  first && "drop-shadow-[0_0_18px_rgb(29_26_22/0.22)]",
                )}
                style={{ height, transformOrigin: "bottom" }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ ...SPRING, delay: i * 0.06 }}
              >
                <span
                  className={clsx(
                    "h-3 shrink-0 [clip-path:polygon(7%_0,93%_0,100%_100%,0_100%)]",
                    top,
                  )}
                />
                <div
                  className={clsx(
                    "relative flex flex-1 flex-col items-center overflow-hidden px-1 pt-1.5",
                    tone,
                  )}
                >
                  <span
                    className={clsx(
                      "display leading-none opacity-80 [text-shadow:0_1px_0_rgb(255_255_255/0.6)]",
                      numeral,
                    )}
                  >
                    {place}
                  </span>
                  <p
                    className={clsx(
                      "mt-1 w-full truncate text-center font-semibold leading-tight",
                      first ? "text-[14.5px]" : "text-[12.5px]",
                    )}
                  >
                    {mine ? "Tu" : name}
                  </p>
                  {row.value === "—" && row.sub ? (
                    <span className="mt-1 text-center text-[10.5px] font-semibold leading-tight opacity-75">
                      {row.sub}
                    </span>
                  ) : (
                    <span
                      className={clsx(
                        "num mt-1 rounded-full bg-[#1d1a16]/85 px-2.5 py-0.5 leading-tight",
                        first
                          ? "text-[18px] text-volt"
                          : "text-[14.5px] text-white",
                      )}
                    >
                      {row.value}
                    </span>
                  )}
                  {first && (
                    <motion.span
                      className="absolute inset-y-0 left-0 w-1/2 -skew-x-12 bg-linear-to-r from-transparent via-white/50 to-transparent"
                      initial={{ x: "-120%" }}
                      animate={{ x: "320%" }}
                      transition={{
                        delay: 0.7,
                        duration: 1.1,
                        ease: "easeInOut",
                      }}
                    />
                  )}
                </div>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

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
  const Arrow = above ? IconArrowUp : IconArrowDown;
  return (
    <div className="sticky bottom-0 z-10 h-0">
      <button
        type="button"
        onClick={onGo}
        tabIndex={show ? 0 : -1}
        aria-hidden={!show}
        aria-label={`La tua posizione${rank ? `: ${rank}°` : ""}, vai alla tua riga`}
        className={clsx(
          "press absolute inset-x-0 bottom-2 flex items-center gap-3 rounded-[20px] bg-surface px-3 py-2 text-left shadow-[0_12px_30px_-12px_rgb(29_26_22/0.45)] transition-[opacity,transform] duration-200",
          show
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0",
        )}
      >
        <span className="num w-7 text-center text-[17px] text-muted">
          {rank ?? "–"}
        </span>
        <Avatar player={me ?? undefined} size={32} href={false} ring="none" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-semibold">
            Tu · {shortName(me ?? undefined, data.players)}
          </span>
          <span className="block truncate text-[12px] text-muted">{sub}</span>
        </span>
        <span className="num text-[19px]">{value}</span>
        <Arrow size={17} className="shrink-0 text-ball" aria-hidden />
      </button>
    </div>
  );
}

function SideList({
  title,
  tip,
  rows,
  myRef,
}: {
  title: string;
  tip: ReactNode;
  rows: { playerId: string; value: string; note: string }[];
  myRef?: React.Ref<HTMLLIElement>;
}) {
  const { data, me } = useData();
  return (
    <section className="mt-5" aria-label={title}>
      <h3 className={clsx(LABEL, "mb-2 flex items-center gap-1.5 px-1")}>
        {title}
        <InfoTip label={`Perché: ${title.toLowerCase()}`} size={14}>
          {tip}
        </InfoTip>
      </h3>
      <ul className="overflow-hidden rounded-[20px] bg-surface/60">
        {rows.map((r) => {
          const p = data.players.find((x) => x.id === r.playerId);
          return (
            <li
              key={r.playerId}
              ref={r.playerId === me?.id ? myRef : undefined}
              className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-b-0"
            >
              <Avatar player={p} size={28} href={false} ring="none" />
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-muted">
                {shortName(p, data.players)}
              </span>
              {r.value && (
                <span className="num text-[14px] text-faint">{r.value}</span>
              )}
              <span className="shrink-0 text-[12px] font-semibold text-muted">
                {r.note}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
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

  const { rows, pending, loose } = useMemo<{
    rows: Row[];
    pending: Pending[];
    /** Chi ha tirato troppo poco per una percentuale (es. 1 su 1 = 100%): a parte, senza posizione. */
    loose: Row[];
  }>(() => {
    if (board === "squadre") return { rows: [], pending: [], loose: [] };
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
        loose: [],
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
      // Chi ha tirato poco non sparisce: sta a parte, sotto, con il motivo (non in classifica).
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
      ],
      loose: lb.loose.map((r) => ({
        playerId: r.playerId,
        rank: 0,
        value: fmt(r.value),
        sub: r.note,
      })),
      pending: lb.pending.map((r) => ({
        playerId: r.playerId,
        value: fmt(r.value),
        missing: r.missing,
      })),
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

  const listKey = `${board}-${period.kind}-${format}`;

  return (
    <>
      <h1 className="sr-only">Classifica</h1>
      <div className="safe-top flex shrink-0 flex-col gap-3 px-5 pb-3 pt-5">
        <div data-tour="rank-period">
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

      {board !== "squadre" &&
      (rows.length > 0 || pending.length > 0 || loose.length > 0) ? (
        <PullToRefresh className="px-5 pb-6 pt-1">
          <motion.div
            key={listKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div ref={podiumRef} data-tour="rank-podium" aria-label="Podio">
              {podium.length > 0 ? (
                <Podium rows={podium} />
              ) : (
                <p className="px-10 py-6 text-center text-[14px] font-semibold text-muted">
                  Nessuno ha ancora tirato abbastanza per entrare in classifica
                </p>
              )}
            </div>

            {rest.length > 0 && (
              <ol className="mt-5 overflow-hidden rounded-[22px] bg-surface shadow-[var(--shadow)]">
                {rest.map((r, i) => {
                  const p = data.players.find((x) => x.id === r.playerId);
                  const mine = r.playerId === me?.id;
                  return (
                    <motion.li
                      key={r.playerId}
                      ref={mine ? myRowRef : undefined}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: Math.min(i, 10) * 0.025,
                        duration: 0.2,
                      }}
                      className="border-b border-line last:border-b-0"
                    >
                      <Link
                        href={mine ? "/profilo" : playerHref(r.playerId)}
                        className={clsx(
                          "press flex items-center gap-3 px-3 py-2.5",
                          mine && "bg-ball-soft",
                        )}
                      >
                        <span className="num w-6 text-center text-[15px] text-muted">
                          {r.rank}
                        </span>
                        <Avatar player={p} size={34} href={false} ring="none" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14.5px] font-semibold">
                            {mine ? "Tu" : shortName(p, data.players)}
                          </p>
                          {r.sub && (
                            <p className="truncate text-[12px] text-muted">
                              {r.sub}
                            </p>
                          )}
                        </div>
                        <span className="num text-[19px]">{r.value}</span>
                      </Link>
                    </motion.li>
                  );
                })}
              </ol>
            )}
            {loose.length > 0 && (
              <div data-testid="few-shots">
                <SideList
                  title="Ancora pochi tiri"
                  tip={`${(board !== "mvp" && STAT_BY_KEY.get(board)?.note) || "Servono più tiri"}: con 1 tiro su 1 si è al 100%, ma è ancora presto per dirlo. Entrano in classifica appena ci arrivano`}
                  rows={loose.map((r) => ({
                    playerId: r.playerId,
                    value: r.value,
                    note: r.sub ?? "",
                  }))}
                />
              </div>
            )}
            {restPending.length > 0 && (
              <SideList
                title="Fuori classifica"
                tip="Hanno giocato meno partite del minimo: entrano in classifica appena lo raggiungono"
                rows={restPending.map((r) => ({
                  playerId: r.playerId,
                  value: r.value,
                  note: missingLabel(r.missing),
                }))}
                myRef={myRowRef}
              />
            )}
            <Link
              href="/classifiche/albo"
              className="card press mt-5 flex items-center gap-3 p-3"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-volt/30 text-volt-ink">
                <IconBook size={19} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold">
                  Record e albo d&apos;oro
                </span>
                <span className="block text-[12.5px] text-muted">
                  I migliori di sempre, mese per mese
                </span>
              </span>
              <IconChevronRight
                size={19}
                className="shrink-0 text-faint"
                aria-hidden
              />
            </Link>
          </motion.div>
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
      ) : (
        <PullToRefresh className="px-5 pb-4 pt-1">
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
