"use client";

import clsx from "clsx";
import { useMemo, useState, type ReactNode } from "react";
import { defaultPeriod, PeriodPicker } from "@/components/period-picker";
import { fmt, pct, Ring, signed } from "@/components/ui/basics";
import { InfoTip } from "@/components/ui/info";
import { useData } from "@/lib/data/provider";
import { filterMatches, periodRange, type FormatFilter, type Period } from "@/lib/periods";
import { eloDelta, eloOf } from "@/lib/stats/elo";
import { computePlayerStats, normalizeBox } from "@/lib/stats/player";
import type { Match } from "@/lib/types";

/** I massimi in una partita (solo partite con il tabellino). */
function personalBests(playerId: string, matches: Match[]) {
  const best = { pts: 0, reb: 0, ast: 0, fg3m: 0, stl: 0, blk: 0 };
  for (const m of matches) {
    const line = m.players.find((p) => p.playerId === playerId && p.hasStats);
    if (!line) continue;
    const b = normalizeBox(line.box);
    best.pts = Math.max(best.pts, b.pts);
    best.reb = Math.max(best.reb, b.oreb + b.dreb);
    best.ast = Math.max(best.ast, b.ast);
    best.fg3m = Math.max(best.fg3m, b.fg3m);
    best.stl = Math.max(best.stl, b.stl);
    best.blk = Math.max(best.blk, b.blk);
  }
  return best;
}

function Tile({ value, label, sub, accent }: { value: ReactNode; label: string; sub?: ReactNode; accent?: boolean }) {
  return (
    <div className={clsx("flex min-w-0 flex-col items-center justify-center rounded-[18px] px-1.5 py-2.5 text-center", accent ? "bg-volt text-volt-ink" : "bg-raised")}>
      <span className="num text-[21px] leading-none">{value}</span>
      <span className="mt-1.5 text-[11.5px] font-bold leading-tight">{label}</span>
      {sub && <span className={clsx("mt-0.5 text-[11px] leading-tight", accent ? "opacity-70" : "text-muted")}>{sub}</span>}
    </div>
  );
}

function ShotRing({ label, made, att, p }: { label: string; made: number; att: number; p: number | null }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Ring value={p ?? 0} size={62} stroke={7} color="var(--ball)" track="var(--raised)" label={`${label}: ${pct(p)}`}>
        <span className="num text-[15px]">{p === null ? "—" : pct(p)}</span>
      </Ring>
      <span className="text-[11.5px] font-bold">{label}</span>
      <span className="tnum text-[11px] text-muted">{att ? `${made}/${att}` : "nessun tiro"}</span>
    </div>
  );
}

function Section({ title, info, children }: { title: string; info?: ReactNode; children: ReactNode }) {
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

/**
 * Le statistiche di un giocatore, a tessere. `advanced` (solo per sé): tiro,
 * gioco, impatto e massimi. Agli altri si mostrano le statistiche comuni.
 */
export function StatsDashboard({ playerId, advanced = false }: { playerId: string; advanced?: boolean }) {
  const { data, engine } = useData();
  const [period, setPeriod] = useState<Period>(() => defaultPeriod("all"));
  const [format, setFormat] = useState<FormatFilter>("all");
  const scoped = useMemo(() => filterMatches(data.matches, { period, format }), [data.matches, period, format]);
  const s = useMemo(() => computePlayerStats(playerId, scoped), [playerId, scoped]);
  const best = useMemo(() => (advanced ? personalBests(playerId, scoped) : null), [advanced, playerId, scoped]);
  const r = periodRange(period);
  const elo = period.kind === "all" ? String(eloOf(engine.elo, playerId)) : signed(eloDelta(engine.elo, playerId, r?.start, r?.end));
  const has = s.statGames > 0;
  const avg = (v: number) => (has ? fmt(v) : "—");
  const per = (n: number) => `${n} in tutto`;
  const possessions = s.fga + s.totals.tov;
  const threeRate = s.fga ? s.totals.fg3a / s.fga : null;

  return (
    <div className="flex flex-col gap-3">
      <PeriodPicker value={period} onChange={setPeriod} format={format} onFormat={setFormat} />

      {s.games === 0 ? (
        <p className="py-8 text-center text-[14px] text-muted">Nessuna partita in questo periodo</p>
      ) : (
        <>
          <Section title="Partite">
            <div className="grid grid-cols-3 gap-2">
              <Tile value={s.games} label="Giocate" />
              <Tile value={s.wins} label="Vinte" sub={`${Math.round(s.winPct * 100)}%`} accent />
              <Tile value={s.losses} label="Perse" />
            </div>
          </Section>

          <Section
            title="A partita"
            info={has ? `Medie sulle ${s.statGames} partite con il tabellino` : "Servono partite con il tabellino"}
          >
            <div className="grid grid-cols-3 gap-2">
              <Tile value={avg(s.avg.pts)} label="Punti" sub={has ? per(s.totals.pts) : undefined} accent />
              <Tile value={avg(s.rebAvg)} label="Rimbalzi" sub={has ? per(s.reb) : undefined} />
              <Tile value={avg(s.avg.ast)} label="Assist" sub={has ? per(s.totals.ast) : undefined} />
              <Tile value={avg(s.avg.stl)} label="Rubate" sub={has ? per(s.totals.stl) : undefined} />
              <Tile value={avg(s.avg.blk)} label="Stoppate" sub={has ? per(s.totals.blk) : undefined} />
              <Tile value={avg(s.avg.tov)} label="Palle perse" sub={has ? per(s.totals.tov) : undefined} />
              <Tile value={avg(s.avg.fg3m)} label="Triple" sub={has ? per(s.totals.fg3m) : undefined} />
              <Tile value={avg(s.avg.fouls)} label="Falli" sub={has ? per(s.totals.fouls) : undefined} />
              <Tile value={has ? fmt(s.effAvg) : "—"} label="Valutazione" />
            </div>
          </Section>

          {advanced && (
            <>
              <Section title="Tiro" info="Le percentuali contano solo le partite dove i tiri tornano con i punti">
                <div className="grid grid-cols-3 gap-1">
                  <ShotRing label="Da 2" made={s.totals.fg2m} att={s.totals.fg2a} p={s.fg2Pct} />
                  <ShotRing label="Da 3" made={s.totals.fg3m} att={s.totals.fg3a} p={s.fg3Pct} />
                  <ShotRing label="Dal campo" made={s.fgm} att={s.fga} p={s.fgPct} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Tile value={pct(s.efgPct)} label="Tiro effettivo" sub="la tripla vale di più" />
                  <Tile value={s.fga ? fmt(s.totals.pts / s.fga, 2) : "—"} label="Punti per tiro" />
                  <Tile value={pct(threeRate)} label="Tiri da 3" sub="sul totale" />
                </div>
              </Section>

              <Section title="Gioco" info="Punti per possesso: punti diviso tiri tentati più palle perse, cioè quanto rendi ogni volta che la palla è tua">
                <div className="grid grid-cols-3 gap-2">
                  <Tile value={s.astTov !== null ? fmt(s.astTov, 1) : "—"} label="Assist per persa" />
                  <Tile value={possessions ? fmt(s.totals.pts / possessions, 2) : "—"} label="Punti per possesso" />
                  <Tile value={has ? `${fmt(s.avg.oreb)} · ${fmt(s.avg.dreb)}` : "—"} label="Rimbalzi" sub="offensivi · difensivi" />
                </div>
              </Section>

              <Section title="Impatto" info="+/−: di quanti punti vince (o perde) in media la tua squadra quando giochi tu">
                <div className="grid grid-cols-3 gap-2">
                  <Tile value={signed(s.plusMinusAvg, 1)} label="+/− a partita" sub={`${signed(s.plusMinus)} in tutto`} accent />
                  <Tile value={elo} label={period.kind === "all" ? "ELO" : "ELO nel periodo"} />
                  <Tile value={fmt(s.pointsFor / s.games, 1)} label="Punti squadra" sub="a partita, con te" />
                </div>
              </Section>

              {best && has && (
                <Section title="I tuoi massimi" info="Il meglio che hai fatto in una sola partita">
                  <div className="grid grid-cols-3 gap-2">
                    <Tile value={best.pts} label="Punti" />
                    <Tile value={best.reb} label="Rimbalzi" />
                    <Tile value={best.ast} label="Assist" />
                    <Tile value={best.fg3m} label="Triple" />
                    <Tile value={best.stl} label="Rubate" />
                    <Tile value={best.blk} label="Stoppate" />
                  </div>
                </Section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
