"use client";

import clsx from "clsx";
import Link from "next/link";
import { IconChevronRight } from "@tabler/icons-react";
import { useMemo, useState, type ReactNode } from "react";
import { defaultPeriod, PeriodPicker } from "@/components/period-picker";
import { fmt } from "@/components/ui/basics";
import { InfoTip } from "@/components/ui/info";
import { useData } from "@/lib/data/provider";
import { filterMatches, type FormatFilter, type Period } from "@/lib/periods";
import { computePlayerStats } from "@/lib/stats/player";

const LABEL =
  "flex items-center gap-1.5 px-1 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted";

const CARD = "rounded-[22px] bg-surface shadow-[var(--shadow)]";

function Group({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={clsx(CARD, "px-4 pb-4 pt-3", className)}>
      <p className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.12em] text-faint">
        {title}
      </p>
      {children}
    </div>
  );
}

function Stat({
  value,
  label,
  sub,
  big,
}: {
  value: ReactNode;
  label: string;
  sub?: ReactNode;
  big?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <span
        className={clsx(
          "num leading-none",
          big ? "text-[40px] text-ball" : "text-[24px]",
        )}
      >
        {value}
      </span>
      <span className="mt-1.5 truncate text-[12px] font-semibold text-muted">
        {label}
      </span>
      {sub && (
        <span className="mt-0.5 truncate text-[11px] text-faint">{sub}</span>
      )}
    </div>
  );
}

function Row({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-line py-2 first:pt-0 last:border-b-0 last:pb-0">
      <span className="min-w-0 truncate text-[12.5px] font-semibold text-muted">
        {label}
      </span>
      <span className="num shrink-0 text-[19px] leading-none">{value}</span>
    </div>
  );
}

function AdvancedLink({ playerId, self }: { playerId: string; self: boolean }) {
  return (
    <Link
      href={`/statistiche?id=${playerId}`}
      data-tour="stats-advanced"
      className="press flex items-center gap-3 rounded-[22px] bg-surface px-3.5 py-3 shadow-[var(--shadow)]"
    >
      <svg viewBox="0 0 60 46" className="h-11 w-14 shrink-0" aria-hidden>
        <rect
          x="1"
          y="1"
          width="58"
          height="44"
          rx="6"
          fill="var(--court-soft)"
        />
        <path
          d="M5 1 V11 A26 26 0 0 0 55 11 V1"
          fill="none"
          stroke="var(--court)"
          strokeWidth="2"
        />
        <rect
          x="21"
          y="1"
          width="18"
          height="20"
          fill="var(--court)"
          fillOpacity="0.25"
          stroke="var(--court)"
          strokeWidth="2"
        />
        <circle
          cx="30"
          cy="7"
          r="2.6"
          fill="none"
          stroke="var(--ball)"
          strokeWidth="2"
        />
      </svg>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold">
          Statistiche avanzate
        </span>
        <span className="block truncate text-[12.5px] text-muted">
          {self
            ? "Dove tiri meglio, assist, impatto"
            : "Mappa di tiro, assist, impatto"}
        </span>
      </span>
      <IconChevronRight size={18} className="shrink-0 text-faint" />
    </Link>
  );
}

/**
 * Le statistiche di un giocatore, a tessere. `advanced` (solo per sé): tiro,
 * gioco, impatto e massimi. Agli altri si mostrano le statistiche comuni.
 */
export function StatsDashboard({
  playerId,
  advanced = false,
}: {
  playerId: string;
  advanced?: boolean;
}) {
  const { data } = useData();
  const [period, setPeriod] = useState<Period>(() => defaultPeriod("all"));
  const [format, setFormat] = useState<FormatFilter>("all");
  const scoped = useMemo(
    () => filterMatches(data.matches, { period, format }),
    [data.matches, period, format],
  );
  const s = useMemo(
    () => computePlayerStats(playerId, scoped),
    [playerId, scoped],
  );
  const has = s.statGames > 0;
  const avg = (v: number) => (has ? fmt(v) : "—");
  const per = (n: number) => `${n} in tutto`;

  return (
    <div className="flex flex-col gap-5">
      <AdvancedLink playerId={playerId} self={advanced} />
      <PeriodPicker
        value={period}
        onChange={setPeriod}
        format={format}
        onFormat={setFormat}
      />

      {s.games === 0 ? (
        <p className="py-8 text-center text-[14px] text-muted">
          Nessuna partita in questo periodo
        </p>
      ) : (
        <>
          <section aria-label="Partite">
            <h3 className={clsx(LABEL, "mb-2")}>Partite</h3>
            <div className={clsx(CARD, "px-4 py-4")}>
              <div className="flex items-end justify-between gap-3">
                <p className="score text-[44px] leading-none">
                  {s.wins}
                  <span className="mx-1 text-line-strong">–</span>
                  <span className="text-faint">{s.losses}</span>
                </p>
                <p className="text-right">
                  <span className="num block text-[24px] leading-none text-ok">
                    {Math.round(s.winPct * 100)}%
                  </span>
                  <span className="mt-1 block text-[12px] font-semibold text-muted">
                    vinte
                  </span>
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-raised">
                <div
                  className="h-full rounded-full bg-ok"
                  style={{ width: `${s.winPct * 100}%` }}
                />
              </div>
              <p className="mt-2 text-[12px] text-muted">
                {s.wins} vinte e {s.losses} perse su {s.games}{" "}
                {s.games === 1 ? "partita" : "partite"}
              </p>
            </div>
          </section>

          <section aria-label="A partita" className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className={LABEL}>
                A partita
                <InfoTip label="Cosa vuol dire a partita" size={14}>
                  {has
                    ? `La media a partita, sulle ${s.statGames} partite con il tabellino`
                    : "Le medie arrivano con le partite che hanno il tabellino"}
                </InfoTip>
              </h3>
              {has && (
                <span className="flex items-center gap-1.5 rounded-full bg-volt px-2.5 py-1 text-[12px] font-semibold text-volt-ink">
                  Valutazione
                  <span className="num text-[14px]">{fmt(s.effAvg)}</span>
                </span>
              )}
            </div>
            <Group title="Attacco">
              <div className="grid grid-cols-[1.4fr_1fr_1fr] items-end gap-3">
                <Stat
                  big
                  value={avg(s.avg.pts)}
                  label="Punti"
                  sub={has ? per(s.totals.pts) : undefined}
                />
                <Stat
                  value={avg(s.avg.ast)}
                  label="Assist"
                  sub={has ? per(s.totals.ast) : undefined}
                />
                <Stat
                  value={avg(s.avg.fg3m)}
                  label="Triple"
                  sub={has ? per(s.totals.fg3m) : undefined}
                />
              </div>
            </Group>
            <div className="grid grid-cols-2 gap-2.5">
              <Group title="Difesa">
                <Row value={avg(s.rebAvg)} label="Rimbalzi" />
                <Row value={avg(s.avg.stl)} label="Rubate" />
                <Row value={avg(s.avg.blk)} label="Stoppate" />
              </Group>
              <Group title="Errori">
                <Row value={avg(s.avg.tov)} label="Palle perse" />
                <Row value={avg(s.avg.fouls)} label="Falli" />
              </Group>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
