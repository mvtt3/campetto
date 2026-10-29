"use client";

import clsx from "clsx";
import { Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { FullStats } from "@/components/profile/full-stats";
import { ProfileHeader } from "@/components/profile/profile-header";
import { RelationsList } from "@/components/profile/relations-list";
import { TrendChart } from "@/components/profile/trend-chart";
import { Card, fmt, pct, Segmented, StatBlock } from "@/components/ui/basics";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useData } from "@/lib/data/provider";
import { seasonLabel } from "@/lib/periods";
import { trophiesOf } from "@/lib/stats/awards";
import { computePlayerStats } from "@/lib/stats/player";
import { form } from "@/lib/stats/relations";

type Tab = "panoramica" | "statistiche" | "compagni";

export default function MyProfilePage() {
  const { me, data, engine } = useData();
  const [tab, setTab] = useState<Tab>("panoramica");
  const s = useMemo(() => (me ? computePlayerStats(me.id, data.matches) : null), [me, data.matches]);
  if (!me || !s) return null;
  const recent = form(me.id, data.matches, 6);
  const trophies = trophiesOf(me.id, engine.seasons);

  return (
    <>
      <div className="safe-top shrink-0 px-4 pt-3">
        <ProfileHeader player={me} self />
        <Segmented
          className="mt-3"
          value={tab}
          onChange={setTab}
          options={[
            { value: "panoramica", label: "Panoramica" },
            { value: "statistiche", label: "Statistiche" },
            { value: "compagni", label: "Compagni" },
          ]}
        />
      </div>

      {tab === "panoramica" ? (
        <PullToRefresh scroll={false} className="px-4 pb-3 pt-3">
          <div className="flex h-full flex-col gap-3">
            <Card className="grid shrink-0 grid-cols-4 gap-2 px-4 py-3">
              <StatBlock value={s.games} label="Partite" />
              <StatBlock value={s.games ? pct(s.winPct) : "—"} label="Vittorie" />
              <StatBlock value={s.statGames ? fmt(s.avg.pts) : "—"} label="Punti" />
              <StatBlock value={fmt(s.effAvg)} label="Valutaz." />
            </Card>
            <div className="flex shrink-0 items-center gap-3 px-1">
              <span className="text-[13px] font-semibold text-muted">Forma</span>
              <div className="flex gap-1.5" aria-label={`Ultime partite: ${recent.join(" ") || "nessuna"}`}>
                {recent.length ? (
                  recent.map((r, i) => (
                    <span
                      key={i}
                      className={clsx(
                        "grid h-7 w-7 place-items-center rounded-full text-[11.5px] font-bold",
                        r === "V" ? "bg-text text-bg" : "text-faint ring-1 ring-line-strong ring-inset",
                      )}
                    >
                      {r}
                    </span>
                  ))
                ) : (
                  <span className="text-[13px] text-muted">nessuna partita ancora</span>
                )}
              </div>
              {trophies.length > 0 && (
                <span className="ml-auto flex items-center gap-1 text-[13px] font-semibold text-gold" title={trophies.map((t) => seasonLabel(t.year, t.quarter)).join(", ")}>
                  <Trophy size={16} /> {trophies.length}
                </span>
              )}
            </div>
            <Card className="min-h-0 flex-1 p-4">
              <TrendChart playerId={me.id} />
            </Card>
          </div>
        </PullToRefresh>
      ) : (
        <PullToRefresh className="px-4 pb-4 pt-3">
          {tab === "statistiche" ? <FullStats playerId={me.id} /> : <RelationsList playerId={me.id} />}
        </PullToRefresh>
      )}
    </>
  );
}
