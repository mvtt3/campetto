"use client";

import { useMemo, useState } from "react";
import { defaultPeriod, PeriodPicker } from "@/components/period-picker";
import { Chips, fmt, pct, signed } from "@/components/ui/basics";
import { useData } from "@/lib/data/provider";
import { filterMatches, periodRange, type FormatFilter, type Period } from "@/lib/periods";
import { eloDelta, eloOf } from "@/lib/stats/elo";
import { computePlayerStats } from "@/lib/stats/player";
import { FORMATS } from "@/lib/types";

export function FullStats({ playerId }: { playerId: string }) {
  const { data, engine } = useData();
  const [period, setPeriod] = useState<Period>(() => defaultPeriod("all"));
  const [format, setFormat] = useState<FormatFilter>("all");
  const s = useMemo(
    () => computePlayerStats(playerId, filterMatches(data.matches, { period, format })),
    [data.matches, period, format, playerId],
  );
  const r = periodRange(period);
  const elo = period.kind === "all" ? String(eloOf(engine.elo, playerId)) : signed(eloDelta(engine.elo, playerId, r?.start, r?.end));

  const rows: { group: string; items: [string, string][] }[] = [
    {
      group: "Partite",
      items: [
        ["Giocate", String(s.games)],
        ["Vinte", String(s.wins)],
        ["Perse", String(s.losses)],
        ["% vittorie", s.games ? pct(s.winPct) : "—"],
        ["Plus/minus", s.games ? `${signed(s.plusMinus)} (${signed(s.plusMinusAvg, 1)} a partita)` : "—"],
        [period.kind === "all" ? "ELO" : "ELO nel periodo", elo],
      ],
    },
    {
      group: `Medie a partita (${s.statGames} con tabellino)`,
      items: [
        ["Punti", s.statGames ? fmt(s.avg.pts) : "—"],
        ["Rimbalzi", s.statGames ? `${fmt(s.rebAvg)} (${fmt(s.avg.oreb)} off, ${fmt(s.avg.dreb)} dif)` : "—"],
        ["Assist", s.statGames ? fmt(s.avg.ast) : "—"],
        ["Rubate", s.statGames ? fmt(s.avg.stl) : "—"],
        ["Stoppate", s.statGames ? fmt(s.avg.blk) : "—"],
        ["Palle perse", s.statGames ? fmt(s.avg.tov) : "—"],
        ["Falli", s.statGames ? fmt(s.avg.fouls) : "—"],
        ["Valutazione", fmt(s.effAvg)],
      ],
    },
    {
      group: "Tiro",
      items: [
        ["Da 2", s.fga ? `${s.totals.fg2m}/${s.totals.fg2a} (${pct(s.fg2Pct)})` : "—"],
        ["Da 3", s.fga ? `${s.totals.fg3m}/${s.totals.fg3a} (${pct(s.fg3Pct)})` : "—"],
        ["Dal campo", pct(s.fgPct)],
        ["eFG%", pct(s.efgPct)],
        ["TS%", pct(s.tsPct)],
        ["Assist / perse", s.astTov !== null ? fmt(s.astTov, 2) : "—"],
      ],
    },
    {
      group: "Totali",
      items: [
        ["Punti", String(s.totals.pts)],
        ["Rimbalzi", String(s.reb)],
        ["Assist", String(s.totals.ast)],
        ["Rubate", String(s.totals.stl)],
        ["Stoppate", String(s.totals.blk)],
        ["Triple", String(s.totals.fg3m)],
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <PeriodPicker value={period} onChange={setPeriod} />
      <Chips
        value={format}
        onChange={setFormat}
        options={[{ value: "all" as const, label: "Tutti i formati" }, ...FORMATS.map((f) => ({ value: f, label: f }))]}
      />
      {rows.map((g) => (
        <section key={g.group} className="rounded-[18px] bg-surface px-4 py-2 ring-1 ring-line ring-inset">
          <h3 className="py-1.5 text-[13px] font-semibold text-muted">{g.group}</h3>
          <dl>
            {g.items.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between border-t border-line py-2 text-[14.5px]">
                <dt className="text-muted">{k}</dt>
                <dd className="num-wide font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
