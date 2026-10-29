"use client";

import { useMemo, useState } from "react";
import { Segmented } from "@/components/ui/basics";
import { useData } from "@/lib/data/provider";
import { filterMatches, MONTHS_IT, monthsWithMatches } from "@/lib/periods";
import { eloByMonth } from "@/lib/stats/elo";
import { computePlayerStats } from "@/lib/stats/player";

type Metric = "eff" | "pts" | "elo";
const LABEL: Record<Metric, string> = { eff: "Valutazione", pts: "Punti", elo: "ELO" };

// Spazio di disegno in unità SVG; la larghezza si adatta al contenitore.
const W = 300;
const H = 100;
const PAD_X = 20;
const PAD_Y = 12;

/**
 * Andamento mese per mese, disegnato in SVG semplice (niente librerie di grafici:
 * molto più leggero sui telefoni economici). Valori e mesi sotto, in HTML.
 */
export function TrendChart({ playerId }: { playerId: string }) {
  const { data, engine } = useData();
  const [metric, setMetric] = useState<Metric>("eff");

  const series = useMemo(() => {
    const mine = data.matches.filter((m) => m.players.some((p) => p.playerId === playerId));
    const months = monthsWithMatches(mine).slice(-6);
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

  const pts = series
    .map((s, i) => ({ i, label: s.label, v: s[metric] }))
    .filter((p): p is { i: number; label: string; v: number } => p.v !== null);
  const min = pts.length ? Math.min(...pts.map((p) => p.v)) : 0;
  const max = pts.length ? Math.max(...pts.map((p) => p.v)) : 1;
  const span = max - min || 1;
  const n = series.length - 1;
  const x = (i: number) => (n <= 0 ? W / 2 : PAD_X + (i / n) * (W - PAD_X * 2));
  const y = (v: number) => PAD_Y + (1 - (v - min) / span) * (H - PAD_Y * 2);
  const line = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const area = pts.length > 1 ? `${line} L${x(pts[pts.length - 1].i).toFixed(1)} ${H} L${x(pts[0].i).toFixed(1)} ${H} Z` : "";
  const fmtv = (v: number) => (metric === "elo" ? String(Math.round(v)) : v.toFixed(1).replace(".", ","));
  const pct = (i: number) => `${(x(i) / W) * 100}%`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="title shrink-0 text-[16px]">Andamento</h2>
        <Segmented
          size="sm"
          className="min-w-0 max-w-[230px] flex-1"
          value={metric}
          onChange={setMetric}
          options={[
            { value: "eff", label: "Valut." },
            { value: "pts", label: "Punti" },
            { value: "elo", label: "ELO" },
          ]}
        />
      </div>
      {pts.length ? (
        <>
          <div className="relative min-h-[60px] flex-1" role="img" aria-label={`${LABEL[metric]} mese per mese: ${pts.map((p) => `${p.label} ${fmtv(p.v)}`).join(", ")}`}>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
              {area && <path d={area} fill="var(--court)" opacity="0.14" />}
              {pts.length > 1 && (
                <path d={line} fill="none" stroke="var(--court)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              )}
            </svg>
            {pts.map((p) => (
              <span
                key={p.i}
                className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-edge bg-volt"
                style={{ left: pct(p.i), top: `${(y(p.v) / H) * 100}%` }}
                aria-hidden
              />
            ))}
          </div>
          <div className="relative mt-2 h-9 border-t-2 border-line" aria-hidden>
            {series.map((s, i) => {
              const v = s[metric];
              return (
                <span key={s.label + i} className="absolute top-1 flex -translate-x-1/2 flex-col items-center leading-none" style={{ left: pct(i) }}>
                  <span className="num text-[14px]">{v === null ? "—" : fmtv(v)}</span>
                  <span className="mt-1 text-[11px] font-semibold text-muted">{s.label}</span>
                </span>
              );
            })}
          </div>
        </>
      ) : (
        <p className="grid flex-1 place-items-center text-center text-[13px] text-muted">
          Il grafico si riempie mese dopo mese{metric !== "elo" ? ", con le partite che hanno il tabellino" : ""}.
        </p>
      )}
    </div>
  );
}
