"use client";

import clsx from "clsx";
import { IconCrown, IconTrophy } from "@tabler/icons-react";
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

const LABEL =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted";

const CARD = "rounded-[22px] bg-surface shadow-[var(--shadow)]";

export default function HallPage() {
  const { data, engine } = useData();
  const [tab, setTab] = useState<"record" | "albo">("record");
  const [openMatch, setOpenMatch] = useState<Match | null>(null);
  const records = useMemo(() => groupRecords(data.matches), [data.matches]);
  const name = (id: string) =>
    shortName(
      data.players.find((p) => p.id === id),
      data.players,
    );

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
      <PullToRefresh className="px-5 pb-6 pt-1">
        {tab === "record" ? (
          records.length === 0 ? (
            <EmptyState
              title="Ancora nessun record"
              text="I primati del gruppo compaiono dopo le prime partite"
            />
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {records.map((r) => (
                <button
                  key={r.key}
                  disabled={!r.matchId}
                  onClick={() =>
                    setOpenMatch(
                      data.matches.find((m) => m.id === r.matchId) ?? null,
                    )
                  }
                  className={clsx(
                    CARD,
                    "press flex min-w-0 flex-col p-3.5 text-left",
                  )}
                >
                  <p
                    className={clsx(
                      LABEL,
                      "min-h-[2.6em] leading-tight [text-wrap:balance]",
                    )}
                  >
                    {r.label}
                  </p>
                  <p
                    className={clsx(
                      "num mt-2 whitespace-nowrap leading-none",
                      r.display.length > 12
                        ? "text-[17px]"
                        : r.display.length > 9
                          ? "text-[20px]"
                          : "text-[26px]",
                    )}
                  >
                    {r.display}
                  </p>
                  <div className="mt-3 flex w-full items-center gap-2 border-t border-line pt-2.5">
                    <span className="flex shrink-0 -space-x-2.5">
                      {r.playerIds.slice(0, 3).map((id) => (
                        <span
                          key={id}
                          className="rounded-full ring-2 ring-surface"
                        >
                          <Avatar
                            player={data.players.find((p) => p.id === id)}
                            size={26}
                            href={false}
                            ring="none"
                          />
                        </span>
                      ))}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                      {r.playerIds.map(name).join(", ")}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )
        ) : engine.months.length === 0 ? (
          <EmptyState
            title="Albo ancora vuoto"
            text="Ogni mese qui finiscono l'MVP e i migliori, ogni tre mesi chi vince la stagione prende un trofeo per sempre"
          />
        ) : (
          <div className="flex flex-col gap-6">
            <section>
              <h2 className={clsx(LABEL, "mb-2 px-1")}>Stagioni</h2>
              <div className="grid grid-cols-2 gap-2.5">
                {engine.seasons.map((s) => {
                  const top = s.ranking[0];
                  return (
                    <div
                      key={`${s.year}-${s.quarter}`}
                      className={clsx(
                        "flex min-w-0 flex-col rounded-[22px] p-3.5",
                        s.closed
                          ? "bg-linear-to-br from-[#ffd65c] via-[#ffad33] to-[#e9781a] text-[#1d1a16] shadow-[var(--shadow-pop)]"
                          : CARD,
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={clsx(
                            "text-[11.5px] font-semibold uppercase leading-tight tracking-[0.08em] [text-wrap:balance]",
                            s.closed ? "text-[#1d1a16]/65" : "text-muted",
                          )}
                        >
                          {seasonLabel(s.year, s.quarter).replace(
                            "Stagione ",
                            "",
                          )}
                        </p>
                        <IconTrophy
                          size={18}
                          className={clsx(
                            "shrink-0",
                            s.closed ? "text-[#1d1a16]/80" : "text-faint",
                          )}
                          aria-hidden
                        />
                      </div>
                      {top ? (
                        <div className="mt-3 flex min-w-0 items-center gap-2">
                          <span
                            className={clsx(
                              "shrink-0 rounded-full",
                              s.closed && "ring-2 ring-white/70",
                            )}
                          >
                            <Avatar
                              player={data.players.find(
                                (p) => p.id === top.playerId,
                              )}
                              size={34}
                              ring="none"
                            />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[14.5px] font-semibold leading-tight">
                              {name(top.playerId)}
                            </span>
                            <span
                              className={clsx(
                                "block text-[12px] font-semibold",
                                s.closed ? "text-[#1d1a16]/65" : "text-muted",
                              )}
                            >
                              {s.closed ? "Campione" : "In testa"}
                            </span>
                          </span>
                        </div>
                      ) : (
                        <p className="mt-3 text-[12.5px] text-muted">
                          Servono 3 partite
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
            <section>
              <h2 className={clsx(LABEL, "mb-2 px-1")}>Mese per mese</h2>
              <div className="flex flex-col gap-2.5">
                {engine.months.map((mo) => (
                  <div
                    key={`${mo.year}-${mo.month}`}
                    className={clsx(CARD, "p-3.5")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="title truncate text-[17px]">
                        {monthLabel(mo.year, mo.month)}
                      </p>
                      {!mo.closed && (
                        <span className="shrink-0 rounded-full bg-ball-soft px-2.5 py-0.5 text-[11.5px] font-semibold text-ball">
                          in corso
                        </span>
                      )}
                    </div>
                    {mo.mvp ? (
                      <div className="mt-3 flex items-center gap-2.5 rounded-[16px] bg-gold-soft px-3 py-2">
                        <Avatar
                          player={data.players.find(
                            (p) => p.id === mo.mvp!.playerId,
                          )}
                          size={32}
                          ring="none"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                            MVP
                          </span>
                          <span className="block truncate text-[14.5px] font-semibold leading-tight">
                            {name(mo.mvp.playerId)}
                          </span>
                        </span>
                        <IconCrown
                          size={20}
                          className="shrink-0 text-gold"
                          aria-hidden
                        />
                      </div>
                    ) : (
                      <p className="mt-2 text-[13px] text-muted">
                        Nessun MVP: servono 3 partite
                      </p>
                    )}
                    {mo.kings.length > 0 && (
                      <ul className="mt-2 grid grid-cols-2 gap-2">
                        {mo.kings.map((k) => (
                          <li
                            key={k.category}
                            className="min-w-0 rounded-[14px] bg-raised px-3 py-2"
                          >
                            <span className="block truncate text-[11.5px] text-muted">
                              {KING_LABELS[k.category]}
                            </span>
                            <span className="block truncate text-[13.5px] font-semibold">
                              {name(k.playerId)}
                            </span>
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
