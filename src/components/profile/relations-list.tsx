"use client";

import { useMemo } from "react";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/basics";
import { useData } from "@/lib/data/provider";
import { chemistry, headToHead } from "@/lib/stats/relations";
import { shortName } from "@/lib/types";

export function RelationsList({ playerId }: { playerId: string }) {
  const { data } = useData();
  const chem = useMemo(() => chemistry(playerId, data.matches), [playerId, data.matches]);
  const h2h = useMemo(
    () =>
      data.players
        .filter((p) => p.id !== playerId)
        .map((p) => ({ p, h: headToHead(playerId, p.id, data.matches) }))
        .filter((x) => x.h.games > 0)
        .sort((a, b) => b.h.games - a.h.games),
    [data.players, data.matches, playerId],
  );
  const name = (id: string) => shortName(data.players.find((p) => p.id === id), data.players);

  if (!chem.length && !h2h.length) return <EmptyState title="Ancora niente da mostrare" text="Compagni e avversari compaiono dopo le prime partite di squadra" />;

  return (
    <div className="flex flex-col gap-5">
      {chem.length > 0 && (
        <section>
          <h2 className="title mb-2 px-1 text-[16px]">Con chi vinci di più</h2>
          <div className="flex flex-col gap-2">
            {chem.map((l) => (
              <div key={l.playerId} className="flex items-center gap-3 card px-3 py-2.5">
                <Avatar player={data.players.find((p) => p.id === l.playerId)} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{name(l.playerId)}</p>
                  <p className="text-[12.5px] text-muted">
                    {l.wins} su {l.games} insieme
                    {l.assistsTo > 0 && `, ${l.assistsTo} assist dati`}
                    {l.assistsFrom > 0 && `, ${l.assistsFrom} ricevuti`}
                  </p>
                </div>
                <span className="num text-[22px]">{Math.round(l.winPct * 100)}%</span>
              </div>
            ))}
          </div>
        </section>
      )}
      {h2h.length > 0 && (
        <section>
          <h2 className="title mb-2 px-1 text-[16px]">Testa a testa</h2>
          <div className="flex flex-col gap-2">
            {h2h.map(({ p, h }) => (
              <div key={p.id} className="flex items-center gap-3 card px-3 py-2.5">
                <Avatar player={p} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{name(p.id)}</p>
                  <p className="text-[12.5px] text-muted">{h.games} sfide da avversari</p>
                </div>
                <span className="num text-[22px]">
                  <span className={h.winsA >= h.winsB ? "text-text" : "text-muted"}>{h.winsA}</span>
                  <span className="text-faint">–</span>
                  <span className={h.winsB > h.winsA ? "text-text" : "text-muted"}>{h.winsB}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
