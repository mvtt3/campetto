"use client";

import clsx from "clsx";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { defaultPeriod, PeriodPicker } from "@/components/period-picker";
import { fmt } from "@/components/ui/basics";
import { InfoTip } from "@/components/ui/info";
import { useData } from "@/lib/data/provider";
import { filterMatches, type FormatFilter, type Period } from "@/lib/periods";
import { computePlayerStats } from "@/lib/stats/player";

function Tile({
  value,
  label,
  sub,
  accent,
}: {
  value: ReactNode;
  label: string;
  sub?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex min-w-0 flex-col items-center justify-center rounded-[18px] px-1.5 py-2.5 text-center",
        accent ? "bg-volt text-volt-ink" : "bg-raised",
      )}
    >
      <span className="num text-[21px] leading-none">{value}</span>
      <span className="mt-1.5 text-[11.5px] font-bold leading-tight">
        {label}
      </span>
      {sub && (
        <span
          className={clsx(
            "mt-0.5 text-[11px] leading-tight",
            accent ? "opacity-70" : "text-muted",
          )}
        >
          {sub}
        </span>
      )}
    </div>
  );
}

function Section({
  title,
  info,
  children,
}: {
  title: string;
  info?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card px-3 pb-3 pt-2.5">
      <h3 className="title mb-2.5 flex items-center justify-center gap-1.5 text-center text-[15px]">
        {title}
        {info && (
          <InfoTip label={`Cosa vuol dire ${title.toLowerCase()}`} size={15}>
            {info}
          </InfoTip>
        )}
      </h3>
      {children}
    </section>
  );
}

/** L'ingresso alle statistiche avanzate: una metà campo in miniatura e due parole. */
function AdvancedLink({ playerId, self }: { playerId: string; self: boolean }) {
  return (
    <Link
      href={`/statistiche?id=${playerId}`}
      data-tour="stats-advanced"
      className="card press flex items-center gap-3 px-3.5 py-3"
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
        <span className="block text-[15px] font-bold">
          Statistiche avanzate
        </span>
        <span className="block truncate text-[12.5px] text-muted">
          {self
            ? "Dove tiri meglio, assist, impatto"
            : "Mappa di tiro, assist, impatto"}
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-faint" />
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
    <div className="flex flex-col gap-3">
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
          <Section title="Partite">
            <div className="grid grid-cols-3 gap-2">
              <Tile value={s.games} label="Giocate" />
              <Tile
                value={s.wins}
                label="Vinte"
                sub={`${Math.round(s.winPct * 100)}%`}
                accent
              />
              <Tile value={s.losses} label="Perse" />
            </div>
          </Section>

          <Section
            title="A partita"
            info={
              has
                ? `La media a partita, sulle ${s.statGames} partite con il tabellino`
                : "Le medie arrivano con le partite che hanno il tabellino"
            }
          >
            <div className="grid grid-cols-3 gap-2">
              <Tile
                value={avg(s.avg.pts)}
                label="Punti"
                sub={has ? per(s.totals.pts) : undefined}
                accent
              />
              <Tile
                value={avg(s.rebAvg)}
                label="Rimbalzi"
                sub={has ? per(s.reb) : undefined}
              />
              <Tile
                value={avg(s.avg.ast)}
                label="Assist"
                sub={has ? per(s.totals.ast) : undefined}
              />
              <Tile
                value={avg(s.avg.stl)}
                label="Rubate"
                sub={has ? per(s.totals.stl) : undefined}
              />
              <Tile
                value={avg(s.avg.blk)}
                label="Stoppate"
                sub={has ? per(s.totals.blk) : undefined}
              />
              <Tile
                value={avg(s.avg.tov)}
                label="Palle perse"
                sub={has ? per(s.totals.tov) : undefined}
              />
              <Tile
                value={avg(s.avg.fg3m)}
                label="Triple"
                sub={has ? per(s.totals.fg3m) : undefined}
              />
              <Tile
                value={avg(s.avg.fouls)}
                label="Falli"
                sub={has ? per(s.totals.fouls) : undefined}
              />
              <Tile value={has ? fmt(s.effAvg) : "—"} label="Valutazione" />
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
