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
import { groupRecords } from "@/lib/stats/records";
import { shortName, type Match } from "@/lib/types";

const LABEL =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted";

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
        <span className="truncate">{hero}</span>
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
          "mt-1.5 line-clamp-2 min-h-[2.5em] w-full text-[12.5px] font-semibold leading-tight [text-wrap:balance]",
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
            <div className={GRID}>
              {records.map((r) => (
                <Tile
                  key={r.key}
                  label={r.label}
                  hero={r.display}
                  playerIds={r.playerIds}
                  caption={r.playerIds.map(name).join(", ")}
                  onClick={
                    r.matchId
                      ? () =>
                          setOpenMatch(
                            data.matches.find((m) => m.id === r.matchId) ??
                              null,
                          )
                      : undefined
                  }
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
              <div className={GRID}>
                {engine.seasons.map((s) => {
                  const top = s.ranking[0];
                  return (
                    <Tile
                      key={`${s.year}-${s.quarter}`}
                      label={seasonLabel(s.year, s.quarter).replace(
                        "Stagione ",
                        "",
                      )}
                      hero={top ? name(top.playerId) : "—"}
                      playerIds={top ? [top.playerId] : []}
                      caption={
                        top
                          ? s.closed
                            ? "Campione"
                            : "In testa"
                          : "Servono 3 partite"
                      }
                      gold={s.closed && !!top}
                      icon={<IconTrophy size={16} aria-hidden />}
                    />
                  );
                })}
              </div>
            </section>
            {engine.months.map((mo) => (
              <section key={`${mo.year}-${mo.month}`}>
                <h2
                  className={clsx(LABEL, "mb-2 flex items-center gap-2 px-1")}
                >
                  {monthLabel(mo.year, mo.month)}
                  {!mo.closed && (
                    <span className="rounded-full bg-ball-soft px-2 py-0.5 text-[10.5px] text-ball">
                      in corso
                    </span>
                  )}
                </h2>
                <div className={GRID}>
                  <Tile
                    label="MVP del mese"
                    hero={mo.mvp ? name(mo.mvp.playerId) : "—"}
                    playerIds={mo.mvp ? [mo.mvp.playerId] : []}
                    caption={
                      mo.mvp
                        ? `Punteggio ${Math.round(mo.mvp.score * 100)}`
                        : "Servono 3 partite"
                    }
                    gold={mo.closed && !!mo.mvp}
                    icon={<IconCrown size={16} aria-hidden />}
                  />
                  {mo.kings.map((k) => (
                    <Tile
                      key={k.category}
                      label={KING_LABELS[k.category]}
                      hero={name(k.playerId)}
                      playerIds={[k.playerId]}
                      caption={k.label}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </PullToRefresh>
      <MatchSheet match={openMatch} onClose={() => setOpenMatch(null)} />
    </>
  );
}
