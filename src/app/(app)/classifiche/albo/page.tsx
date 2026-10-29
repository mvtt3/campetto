"use client";

import clsx from "clsx";
import { Crown, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { MatchSheet } from "@/components/match-sheet";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState, ScreenHeader, Segmented } from "@/components/ui/basics";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useData } from "@/lib/data/provider";
import { monthLabel, seasonLabel } from "@/lib/periods";
import { KING_LABELS } from "@/lib/stats/awards";
import { groupRecords } from "@/lib/stats/records";
import { shortName, type Match } from "@/lib/types";

export default function HallPage() {
  const { data, engine } = useData();
  const [tab, setTab] = useState<"record" | "albo">("record");
  const [openMatch, setOpenMatch] = useState<Match | null>(null);
  const records = useMemo(() => groupRecords(data.matches), [data.matches]);
  const name = (id: string) => shortName(data.players.find((p) => p.id === id), data.players);

  return (
    <>
      <ScreenHeader title="Albo" back="/classifiche" />
      <div className="shrink-0 px-5 pb-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "record", label: "Record" },
            { value: "albo", label: "Albo d'oro" },
          ]}
        />
      </div>
      <PullToRefresh className="px-5 pb-4">
        {tab === "record" ? (
          records.length === 0 ? (
            <EmptyState title="Ancora nessun record" text="I primati del gruppo compaiono dopo le prime partite." />
          ) : (
            <div className="flex flex-col gap-2">
              {records.map((r) => (
                <button
                  key={r.key}
                  disabled={!r.matchId}
                  onClick={() => setOpenMatch(data.matches.find((m) => m.id === r.matchId) ?? null)}
                  className="card press flex items-center gap-3 px-4 py-3 text-left"
                >
                  <div className="flex -space-x-2">
                    {r.playerIds.slice(0, 3).map((id) => (
                      <span key={id} className="rounded-full ring-2 ring-surface">
                        <Avatar player={data.players.find((p) => p.id === id)} size={34} href={false} ring="none" />
                      </span>
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] text-muted">{r.label}</p>
                    <p className="truncate text-[15px] font-semibold">{r.playerIds.map(name).join(", ")}</p>
                  </div>
                  <p className="num shrink-0 text-[22px] text-court">{r.display}</p>
                </button>
              ))}
            </div>
          )
        ) : engine.months.length === 0 ? (
          <EmptyState title="Albo ancora vuoto" text="Ogni mese qui finiscono l'MVP e i migliori. Ogni tre mesi si chiude una stagione e chi vince prende un trofeo per sempre." />
        ) : (
          <div className="flex flex-col gap-5">
            <section>
              <h2 className="title mb-2 px-1 text-[16px]">Stagioni</h2>
              <div className="flex flex-col gap-2">
                {engine.seasons.map((s) => {
                  const top = s.ranking[0];
                  return (
                    <div key={`${s.year}-${s.quarter}`} className="card flex items-center gap-3 px-4 py-3">
                      <span className={clsx("grid h-11 w-11 place-items-center rounded-full", s.closed ? "bg-gold-soft text-gold" : "bg-raised text-muted")}>
                        <Trophy size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold">{seasonLabel(s.year, s.quarter)}</p>
                        <p className="truncate text-[12.5px] text-muted">
                          {top ? `${s.closed ? "Campione" : "In testa"}: ${name(top.playerId)}` : "Ancora nessuno con 3 partite"}
                        </p>
                      </div>
                      {top && <Avatar player={data.players.find((p) => p.id === top.playerId)} size={36} />}
                    </div>
                  );
                })}
              </div>
            </section>
            <section>
              <h2 className="title mb-2 px-1 text-[16px]">Mese per mese</h2>
              <div className="flex flex-col gap-2">
                {engine.months.map((mo) => (
                  <div key={`${mo.year}-${mo.month}`} className="card px-4 py-3">
                    <div className="flex items-center justify-between">
                      <p className="title text-[16px]">{monthLabel(mo.year, mo.month)}</p>
                      {!mo.closed && <span className="rounded-full bg-court-soft px-2 py-0.5 text-[12px] font-semibold text-court">in corso</span>}
                    </div>
                    {mo.mvp ? (
                      <p className="mt-2 flex items-center gap-2 text-[14px]">
                        <Crown size={16} className="text-gold" /> MVP <span className="font-semibold">{name(mo.mvp.playerId)}</span>
                      </p>
                    ) : (
                      <p className="mt-2 text-[13px] text-muted">Nessun MVP: servono 3 partite.</p>
                    )}
                    {mo.kings.length > 0 && (
                      <ul className="mt-1.5 flex flex-col gap-0.5 text-[13px] text-muted">
                        {mo.kings.map((k) => (
                          <li key={k.category}>
                            {KING_LABELS[k.category]}: <span className="text-text">{name(k.playerId)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </PullToRefresh>
      <MatchSheet match={openMatch} onClose={() => setOpenMatch(null)} />
    </>
  );
}
