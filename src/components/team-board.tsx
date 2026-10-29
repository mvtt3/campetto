"use client";

import clsx from "clsx";
import { Crown } from "lucide-react";
import { useMemo, useState } from "react";
import { Character, characterOf } from "@/components/character";
import { AvatarStack } from "@/components/ui/avatar";
import { CourtLines, EmptyState, Segmented } from "@/components/ui/basics";
import { InfoTip } from "@/components/ui/info";
import { useData } from "@/lib/data/provider";
import { TEAM_MIN_GAMES, teamRecords, type TeamRecord } from "@/lib/stats/relations";
import { FORMATS, shortName, type Format, type Match, type Player } from "@/lib/types";

const EMPTY: Record<Format, string> = {
  "1v1": `Nell'1 contro 1 nessuno ha ancora giocato ${TEAM_MIN_GAMES} partite in questo periodo`,
  "2v2": `Nel 2 contro 2 nessuna coppia ha ancora giocato ${TEAM_MIN_GAMES} partite insieme in questo periodo`,
  "3v3": `Nel 3 contro 3 nessun trio ha ancora giocato ${TEAM_MIN_GAMES} partite insieme in questo periodo`,
  "4v4": `Nel 4 contro 4 nessuna squadra ha ancora giocato ${TEAM_MIN_GAMES} partite insieme in questo periodo`,
};

export const TEAMS_INFO = `Gli stessi giocatori, insieme, nello stesso formato: conta solo vinte e perse. Con un cambio è un'altra squadra. Prima chi ha più vittorie che sconfitte. Servono almeno ${TEAM_MIN_GAMES} partite insieme`;

/** Il formato con più partite nel periodo: è quello che si apre. */
function busiestFormat(matches: Match[]): Format {
  const n = new Map<Format, number>();
  for (const m of matches) n.set(m.format, (n.get(m.format) ?? 0) + 1);
  return [...FORMATS].sort((a, b) => (n.get(b) ?? 0) - (n.get(a) ?? 0))[0];
}

function names(r: TeamRecord, players: Player[]): string {
  const nm = (id: string) => shortName(players.find((p) => p.id === id), players);
  const base = r.ids.filter((id) => !r.subs.includes(id)).map(nm).join(" · ");
  return r.subs.length ? `${base} + ${r.subs.map(nm).join(", ")}` : base;
}

const pctLabel = (r: TeamRecord) => `${Math.round(r.winPct * 100)}% vinte`;

/** La classifica delle squadre: per ogni formato, i record di chi gioca insieme. */
export function TeamBoard({ matches }: { matches: Match[] }) {
  const { data, me } = useData();
  const [format, setFormat] = useState<Format>(() => busiestFormat(matches));
  const rows = useMemo(() => teamRecords(matches, format), [matches, format]);
  const [best, ...rest] = rows;
  const team = (r: TeamRecord) => r.ids.map((id) => data.players.find((p) => p.id === id)).filter((p): p is Player => Boolean(p));
  const isMine = (r: TeamRecord) => !!me && r.ids.includes(me.id);

  return (
    <div className="relative" data-tour="rank-teams">
      <div className="mb-3 flex items-center gap-2">
        <Segmented<Format> className="flex-1" size="sm" value={format} onChange={setFormat} options={FORMATS.map((f) => ({ value: f, label: f }))} />
        <InfoTip label="Come funziona la classifica delle squadre">{TEAMS_INFO}</InfoTip>
      </div>

      {!best ? (
        <EmptyState
          title="Nessuna squadra, per ora"
          text={EMPTY[format]}
          size={92}
        />
      ) : (
        <div key={format} className="tab-enter-right flex flex-col gap-2">
          {/* La squadra più forte: i suoi personaggi, uno accanto all'altro. */}
          <section className="court relative flex items-center gap-3 overflow-hidden rounded-[26px] py-3 pl-3 pr-4" aria-label="La squadra più forte">
            <CourtLines className="absolute inset-0 h-full w-full opacity-60" />
            <div className="relative flex shrink-0 items-end" aria-hidden>
              {team(best).map((p, i) => (
                <span key={p.id} style={{ marginLeft: i ? (best.ids.length > 2 ? -14 : -8) : 0 }}>
                  <Character id={characterOf(p)} number={p.jerseyNumber} height={best.ids.length > 2 ? 66 : 76} />
                </span>
              ))}
            </div>
            <div className="relative min-w-0 flex-1 text-center">
              <p className="flex items-center justify-center gap-1 text-[12.5px] font-bold text-volt">
                <Crown size={14} aria-hidden /> {best.wins <= best.losses ? "In testa, per ora" : format === "1v1" ? "Il re dell'1 contro 1" : "La squadra più forte"}
              </p>
              <p className="title mt-0.5 text-[15px] leading-tight">{names(best, data.players)}</p>
              <p className="score mt-1 text-[28px] leading-none">
                {best.wins}–{best.losses}
              </p>
              <p className="mt-0.5 text-[12.5px] font-semibold text-court-ink/80">{pctLabel(best)}</p>
            </div>
          </section>

          <ol className="flex flex-col gap-2" aria-label="Le altre squadre">
            {rest.map((r, i) => (
              <li key={r.ids.join("|")} className={clsx("card flex items-center gap-3 px-3 py-2.5", isMine(r) && "!bg-court-soft")}>
                <span className="num w-6 shrink-0 text-center text-[18px] text-muted">{i + 2}</span>
                <AvatarStack players={team(r)} size={r.ids.length > 2 ? 30 : 36} max={4} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-semibold leading-tight [overflow-wrap:anywhere]">{names(r, data.players)}</p>
                  <p className="truncate text-[12.5px] text-muted">
                    {r.games} partite, {pctLabel(r)}
                  </p>
                </div>
                <span className="num shrink-0 text-[22px]">
                  {r.wins}–{r.losses}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
