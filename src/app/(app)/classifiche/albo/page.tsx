"use client";

import clsx from "clsx";
import { IconCrown, IconTrophy } from "@tabler/icons-react";
import { useMemo, useState, type ReactNode } from "react";
import { MatchSheet } from "@/components/match-sheet";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState, ScreenHeader, Segmented } from "@/components/ui/basics";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useData } from "@/lib/data/provider";
import { monthLabel, seasonLabel } from "@/lib/periods";
import { KING_LABELS } from "@/lib/stats/awards";
import { groupRecords, type GroupRecord } from "@/lib/stats/records";
import { shortName } from "@/lib/types";

const LABEL =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted";

const CARD = "rounded-[22px] bg-surface shadow-[var(--shadow)]";

const GRID = "grid auto-rows-fr grid-cols-2 gap-2.5";

const GOLD =
  "bg-linear-to-b from-[#ffd65c] via-[#ffad33] to-[#e9781a] text-[#1d1a16] shadow-[var(--shadow-pop)]";

function Tile({
  label,
  hero,
  playerIds,
  caption,
  gold = false,
  icon,
  onClick,
}: {
  label: string;
  hero: string;
  playerIds: string[];
  caption: string;
  gold?: boolean;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  const { data } = useData();
  const soft = gold ? "text-[#1d1a16]/65" : "text-muted";
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={clsx(
        "press relative flex min-w-0 flex-col items-center rounded-[22px] px-3 pb-3.5 pt-3.5 text-center",
        gold ? GOLD : "bg-surface shadow-[var(--shadow)]",
      )}
    >
      {icon && (
        <span className={clsx("absolute right-3 top-3", soft)}>{icon}</span>
      )}
      <p
        className={clsx(
          LABEL,
          "flex min-h-[2.6em] items-center px-4 leading-tight [text-wrap:balance]",
          soft,
        )}
      >
        {label}
      </p>
      <p
        className={clsx(
          "num mt-2 flex h-8 w-full items-center justify-center truncate whitespace-nowrap leading-none",
          hero.length > 12
            ? "text-[17px]"
            : hero.length > 9
              ? "text-[20px]"
              : "text-[26px]",
        )}
      >
        <span className="truncate leading-[1.2]">{hero}</span>
      </p>
      <span
        className={clsx(
          "mt-3 h-px w-full",
          gold ? "bg-[#1d1a16]/15" : "bg-line",
        )}
      />
      <span className="mt-3 flex h-7 -space-x-2.5">
        {playerIds.slice(0, 3).map((id) => (
          <span
            key={id}
            className={clsx(
              "rounded-full ring-2",
              gold ? "ring-[#ffc04a]" : "ring-surface",
            )}
          >
            <Avatar
              player={data.players.find((p) => p.id === id)}
              size={28}
              href={false}
              ring="none"
            />
          </span>
        ))}
      </span>
      <p
        className={clsx(
          "mt-1.5 w-full truncate text-[12.5px] font-semibold leading-snug",
          soft,
        )}
      >
        {caption}
      </p>
    </button>
  );
}

export default function HallPage() {
  const { data, engine } = useData();
  const [tab, setTab] = useState<"record" | "albo">("record");
  const [openRecord, setOpenRecord] = useState<GroupRecord | null>(null);
  const records = useMemo(() => groupRecords(data.matches), [data.matches]);
  const name = (id: string) =>
    shortName(
      data.players.find((p) => p.id === id),
      data.players,
    );

  return (
    <>
      <ScreenHeader title="Albo" back="/classifiche" />
      <div className="shrink-0 px-5 pb-3 pt-3">
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
            <div className={GRID}>
              {records.map((r) => (
                <Tile
                  key={r.key}
                  label={r.label}
                  hero={r.display}
                  playerIds={r.playerIds}
                  caption={r.playerIds.map(name).join(", ")}
                  onClick={r.matchId ? () => setOpenRecord(r) : undefined}
                />
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
      <MatchSheet
        match={data.matches.find((m) => m.id === openRecord?.matchId) ?? null}
        record
        onClose={() => setOpenRecord(null)}
      />
    </>
  );
}
