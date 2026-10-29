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
            <EmptyState title="Ancora nessun record" text="I primati del gruppo compaiono dopo le prime partite" />
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {records.map((r) => (
                <button
                  key={r.key}
                  disabled={!r.matchId}
                  onClick={() => setOpenMatch(data.matches.find((m) => m.id === r.matchId) ?? null)}
                  className="card press flex min-w-0 flex-col items-center px-2.5 pb-3 pt-2.5 text-center"
                >
                  <p className="min-h-[2.4em] text-[12px] font-semibold leading-tight text-muted [text-wrap:balance]">{r.label}</p>
                  <p className="num mt-1 text-[22px] leading-none text-court">{r.display}</p>
                  <div className="mt-2 flex -space-x-2">
                    {r.playerIds.slice(0, 3).map((id) => (
                      <span key={id} className="rounded-full ring-2 ring-surface">
                        <Avatar player={data.players.find((p) => p.id === id)} size={28} href={false} ring="none" />
                      </span>
                    ))}
                  </div>
                  <p className="mt-1 w-full truncate text-[13px] font-bold">{r.playerIds.map(name).join(", ")}</p>
                </button>
              ))}
            </div>
          )
        ) : engine.months.length === 0 ? (
          <EmptyState title="Albo ancora vuoto" text="Ogni mese qui finiscono l'MVP e i migliori, ogni tre mesi chi vince la stagione prende un trofeo per sempre" />
        ) : (
          <div className="flex flex-col gap-5">
            <section>
              <h2 className="title mb-2 text-center text-[16px]">Stagioni</h2>
              <div className="grid grid-cols-2 gap-2.5">
                {engine.seasons.map((s) => {
                  const top = s.ranking[0];
                  return (
                    <div key={`${s.year}-${s.quarter}`} className="card flex min-w-0 flex-col items-center px-2.5 pb-3 pt-3 text-center">
                      <span className={clsx("grid h-10 w-10 place-items-center rounded-full border-2 border-edge", s.closed ? "bg-volt text-volt-ink" : "bg-raised text-muted")}>
                        <Trophy size={18} />
                      </span>
                      <p className="mt-1.5 text-[13px] font-bold leading-tight [text-wrap:balance]">{seasonLabel(s.year, s.quarter).replace("Stagione ", "")}</p>
                      <p className="mt-0.5 text-[11.5px] text-muted">{top ? (s.closed ? "Campione" : "In testa") : "Servono 3 partite"}</p>
                      {top && (
                        <span className="mt-1.5 flex max-w-full items-center gap-1.5">
                          <Avatar player={data.players.find((p) => p.id === top.playerId)} size={26} />
                          <span className="truncate text-[13px] font-bold">{name(top.playerId)}</span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
            <section>
              <h2 className="title mb-2 text-center text-[16px]">Mese per mese</h2>
              <div className="flex flex-col gap-2.5">
                {engine.months.map((mo) => (
                  <div key={`${mo.year}-${mo.month}`} className="card px-3 pb-3 pt-3 text-center">
                    <p className="title flex items-center justify-center gap-2 text-[16px]">
                      {monthLabel(mo.year, mo.month)}
                      {!mo.closed && <span className="rounded-full bg-court-soft px-2 py-0.5 text-[11.5px] font-semibold text-court">in corso</span>}
                    </p>
                    {mo.mvp ? (
                      <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[14px]">
                        <Crown size={16} className="text-gold" /> MVP <span className="font-bold">{name(mo.mvp.playerId)}</span>
                      </p>
                    ) : (
                      <p className="mt-1.5 text-[13px] text-muted">Nessun MVP: servono 3 partite</p>
                    )}
                    {mo.kings.length > 0 && (
                      <ul className="mt-2.5 grid grid-cols-2 gap-1.5">
                        {mo.kings.map((k) => (
                          <li key={k.category} className="min-w-0 rounded-[14px] bg-raised px-2 py-1.5">
                            <span className="block text-[11px] leading-tight text-muted [text-wrap:balance]">{KING_LABELS[k.category]}</span>
                            <span className="block truncate text-[13px] font-bold">{name(k.playerId)}</span>
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
