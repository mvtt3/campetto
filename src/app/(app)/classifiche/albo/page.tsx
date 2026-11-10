"use client";

import clsx from "clsx";
import { IconCrown } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { Character, characterOf } from "@/components/character";
import { MatchSheet } from "@/components/match-sheet";
import { Avatar } from "@/components/ui/avatar";
import { Chips, EmptyState, ScreenHeader } from "@/components/ui/basics";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useData } from "@/lib/data/provider";
import { monthLabel, seasonLabel } from "@/lib/periods";
import { KING_LABELS } from "@/lib/stats/awards";
import { groupRecords } from "@/lib/stats/records";
import { shortName, type Match } from "@/lib/types";

type Tab = "record" | "albo";

const TABS: { value: Tab; label: string }[] = [
  { value: "record", label: "Record" },
  { value: "albo", label: "Albo d'oro" },
];

const LABEL =
  "mb-2 px-1 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted";

const LIST = "overflow-hidden rounded-[22px] bg-surface shadow-[var(--shadow)]";

export default function HallPage() {
  const { data, engine } = useData();
  const [tab, setTab] = useState<Tab>("record");
  const [openMatch, setOpenMatch] = useState<Match | null>(null);
  const records = useMemo(() => groupRecords(data.matches), [data.matches]);
  const player = (id: string) => data.players.find((p) => p.id === id);
  const name = (id: string) => shortName(player(id), data.players);

  return (
    <>
      <ScreenHeader title="Albo" back="/classifiche" />
      <div className="shrink-0 px-5 pb-3">
        <Chips value={tab} onChange={setTab} options={TABS} scroll />
      </div>
      <PullToRefresh className="px-5 pb-6 pt-1">
        {tab === "record" ? (
          records.length === 0 ? (
            <EmptyState
              title="Ancora nessun record"
              text="I primati del gruppo compaiono dopo le prime partite"
            />
          ) : (
            <ul className={LIST}>
              {records.map((r) => (
                <li
                  key={r.key}
                  className="border-b border-line last:border-b-0"
                >
                  <button
                    disabled={!r.matchId}
                    onClick={() =>
                      setOpenMatch(
                        data.matches.find((m) => m.id === r.matchId) ?? null,
                      )
                    }
                    className="press flex w-full items-center gap-3 px-3 py-2.5 text-left"
                  >
                    <span className="flex shrink-0 -space-x-3">
                      {r.playerIds.slice(0, 3).map((id) => (
                        <span
                          key={id}
                          className="rounded-full ring-2 ring-surface"
                        >
                          <Avatar
                            player={player(id)}
                            size={34}
                            href={false}
                            ring="none"
                          />
                        </span>
                      ))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold">
                        {r.playerIds.map(name).join(", ")}
                      </span>
                      <span className="block truncate text-[12px] text-muted">
                        {r.label}
                      </span>
                    </span>
                    <span className="num shrink-0 whitespace-nowrap text-[17px]">
                      {r.display}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : engine.months.length === 0 ? (
          <EmptyState
            title="Albo ancora vuoto"
            text="Ogni mese qui finiscono l'MVP e i migliori, ogni tre mesi chi vince la stagione prende un trofeo per sempre"
          />
        ) : (
          <>
            <section aria-label="Stagioni">
              <h2 className={LABEL}>Stagioni</h2>
              <div className="grid grid-cols-2 gap-2.5">
                {engine.seasons.map((s) => {
                  const top = s.ranking[0];
                  const champ = top && player(top.playerId);
                  return (
                    <div
                      key={`${s.year}-${s.quarter}`}
                      className={clsx(
                        "relative isolate flex min-w-0 flex-col items-center overflow-hidden rounded-[22px] px-2 pb-3 pt-3 text-center",
                        s.closed
                          ? "bg-linear-to-b from-[#ffd65c] via-[#ffad33] to-[#e9781a] text-[#1d1a16]"
                          : "bg-surface shadow-[var(--shadow)]",
                      )}
                    >
                      <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] opacity-70">
                        {seasonLabel(s.year, s.quarter).replace(
                          "Stagione ",
                          "",
                        )}
                      </p>
                      {champ ? (
                        <>
                          <span className="relative mt-2">
                            <Character
                              id={characterOf(champ)}
                              outfit={champ.outfit}
                              number={champ.jerseyNumber}
                              height={72}
                              title={name(top.playerId)}
                            />
                            <span className="absolute -bottom-1 left-1/2 -z-10 h-3 w-14 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(29_26_22/0.35),transparent)]" />
                          </span>
                          <p className="mt-2 w-full truncate text-[14.5px] font-semibold leading-tight">
                            {name(top.playerId)}
                          </p>
                          <p
                            className={clsx(
                              "mt-0.5 text-[12px] font-semibold",
                              s.closed ? "opacity-70" : "text-muted",
                            )}
                          >
                            {s.closed ? "Campione" : "In testa"}
                          </p>
                        </>
                      ) : (
                        <p className="my-auto pt-2 text-[12.5px] text-muted">
                          Servono 3 partite
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
            <section aria-label="Mese per mese" className="mt-6">
              <h2 className={LABEL}>Mese per mese</h2>
              <ul className={LIST}>
                {engine.months.map((mo) => (
                  <li
                    key={`${mo.year}-${mo.month}`}
                    className="border-b border-line px-3 py-3 last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        player={mo.mvp ? player(mo.mvp.playerId) : undefined}
                        size={34}
                        href={false}
                        ring="none"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-[14.5px] font-semibold">
                          <span className="truncate">
                            {monthLabel(mo.year, mo.month)}
                          </span>
                          {!mo.closed && (
                            <span className="shrink-0 rounded-full bg-ball-soft px-2 py-0.5 text-[11px] font-semibold text-ball">
                              in corso
                            </span>
                          )}
                        </p>
                        <p className="truncate text-[12px] text-muted">
                          {mo.mvp
                            ? `MVP ${name(mo.mvp.playerId)}`
                            : "Nessun MVP: servono 3 partite"}
                        </p>
                      </div>
                      {mo.mvp && (
                        <IconCrown
                          size={19}
                          className="shrink-0 text-gold"
                          aria-hidden
                        />
                      )}
                    </div>
                    {mo.kings.length > 0 && (
                      <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 pl-[46px]">
                        {mo.kings.map((k) => (
                          <div key={k.category} className="min-w-0">
                            <dt className="truncate text-[11px] text-muted">
                              {KING_LABELS[k.category]}
                            </dt>
                            <dd className="truncate text-[13px] font-semibold">
                              {name(k.playerId)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </PullToRefresh>
      <MatchSheet match={openMatch} onClose={() => setOpenMatch(null)} />
    </>
  );
}
