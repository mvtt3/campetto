"use client";

import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Segmented } from "@/components/ui/basics";
import { useData } from "@/lib/data/provider";
import { filterMatches, MONTHS_IT, monthsWithMatches } from "@/lib/periods";
import { eloByMonth } from "@/lib/stats/elo";
import { computePlayerStats } from "@/lib/stats/player";

type Metric = "eff" | "pts" | "elo";

export function TrendChart({ playerId }: { playerId: string }) {
  const { data, engine } = useData();
  const [metric, setMetric] = useState<Metric>("eff");

  const series = useMemo(() => {
    const mine = data.matches.filter((m) => m.players.some((p) => p.playerId === playerId));
    const months = monthsWithMatches(mine).slice(-8);
    const elo = new Map(eloByMonth(engine.elo, playerId).map((x) => [x.key, x.value]));
    return months.map(({ year, month }) => {
      const s = computePlayerStats(playerId, filterMatches(mine, { period: { kind: "month", year, month } }));
      const key = `${year}-${String(month + 1).padStart(2, "0")}`;
      return {
        label: MONTHS_IT[month].slice(0, 3),
        eff: s.effAvg !== null ? Number(s.effAvg.toFixed(1)) : null,
        pts: s.statGames ? Number(s.avg.pts.toFixed(1)) : null,
        elo: elo.get(key) ?? null,
      };
    });
  }, [data.matches, engine.elo, playerId]);

  const has = series.some((s) => s[metric] !== null);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="shrink-0 text-[13px] font-semibold text-muted">Mese per mese</h2>
        <Segmented
          size="sm"
          className="min-w-0 max-w-[240px] flex-1"
          value={metric}
          onChange={setMetric}
          options={[
            { value: "eff", label: "Valut." },
            { value: "pts", label: "Punti" },
            { value: "elo", label: "ELO" },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1" aria-label={`Grafico ${metric} mese per mese`}>
        {has ? (
          <ResponsiveContainer width="100%" height="100%" minHeight={90}>
            <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--faint)", fontSize: 11 }} width={44} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 13 }}
                labelStyle={{ color: "var(--muted)" }}
                itemStyle={{ color: "var(--text)" }}
                formatter={(v) => [v, metric === "eff" ? "Valutazione" : metric === "pts" ? "Punti" : "ELO"]}
              />
              <Line
                type="monotone"
                dataKey={metric}
                stroke="var(--ball)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "var(--ball)", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="grid h-full place-items-center text-center text-[13px] text-muted">
            Il grafico si riempie mese dopo mese{metric !== "elo" ? ", con le partite che hanno il tabellino" : ""}.
          </p>
        )}
      </div>
    </div>
  );
}
