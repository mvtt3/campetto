"use client";

import clsx from "clsx";
import { useMemo } from "react";
import { CountUp, Ring } from "@/components/ui/basics";
import { useData } from "@/lib/data/provider";
import { computePlayerStats } from "@/lib/stats/player";
import { form } from "@/lib/stats/relations";

/** Quattro anelli: le cose che contano a colpo d'occhio. */
export function KeyRings({ playerId }: { playerId: string }) {
  const { data } = useData();
  const s = useMemo(() => computePlayerStats(playerId, data.matches), [playerId, data.matches]);
  const items = [
    { label: "Vittorie", value: s.winPct, text: s.games ? `${Math.round(s.winPct * 100)}%` : "—", color: "var(--ok)" },
    { label: "Partite", value: Math.min(1, s.games / 50), text: <CountUp value={s.games} />, color: "var(--court)" },
    { label: "Punti", value: Math.min(1, s.avg.pts / 15), text: s.statGames ? s.avg.pts.toFixed(1).replace(".", ",") : "—", color: "var(--ball)" },
    { label: "Assist", value: Math.min(1, s.avg.ast / 6), text: s.statGames ? s.avg.ast.toFixed(1).replace(".", ",") : "—", color: "var(--gold)" },
  ];
  return (
    <div className="card grid grid-cols-4 gap-1 px-2 py-3.5">
      {items.map((it) => (
        <div key={it.label} className="flex flex-col items-center gap-1.5">
          <Ring value={it.value} size={58} stroke={7} color={it.color} track="var(--raised)" label={`${it.label}: ${typeof it.text === "string" ? it.text : s.games}`}>
            <span className="num text-[16px]">{it.text}</span>
          </Ring>
          <span className="text-[12px] font-semibold text-muted">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Form({ playerId }: { playerId: string }) {
  const { data } = useData();
  const recent = form(playerId, data.matches, 6);
  return (
    <div className="flex items-center gap-3 px-1">
      <span className="title text-[15px]">Forma</span>
      <div className="flex gap-1.5" aria-label={`Ultime partite: ${recent.join(" ") || "nessuna"}`}>
        {recent.length ? (
          recent.map((r, i) => (
            <span
              key={i}
              className={clsx("grid h-7 w-7 place-items-center rounded-full text-[12px] font-bold", r === "V" ? "bg-volt text-volt-ink" : "bg-surface text-faint sticker-sm")}
            >
              {r}
            </span>
          ))
        ) : (
          <span className="text-[13.5px] text-muted">nessuna partita ancora</span>
        )}
      </div>
    </div>
  );
}

