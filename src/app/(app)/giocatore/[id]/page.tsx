"use client";

import { useParams, useRouter } from "next/navigation";
import { Trophy } from "lucide-react";
import { useEffect, useMemo } from "react";
import { ProfileHeader } from "@/components/profile/profile-header";
import { Card, EmptyState, fmt, pct, ScreenHeader, StatBlock } from "@/components/ui/basics";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useData } from "@/lib/data/provider";
import { seasonLabel } from "@/lib/periods";
import { trophiesOf } from "@/lib/stats/awards";
import { computePlayerStats } from "@/lib/stats/player";
import { headToHead } from "@/lib/stats/relations";
import { shortName } from "@/lib/types";

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const { data, me, engine } = useData();
  const router = useRouter();
  const player = data.players.find((p) => p.id === id);
  const s = useMemo(() => computePlayerStats(id, data.matches), [id, data.matches]);
  const h = useMemo(() => (me ? headToHead(me.id, id, data.matches) : null), [me, id, data.matches]);

  useEffect(() => {
    if (me?.id === id) router.replace("/profilo");
  }, [me, id, router]);

  if (!player) {
    return (
      <>
        <ScreenHeader title="Giocatore" back="/classifiche" />
        <EmptyState title="Giocatore non trovato" />
      </>
    );
  }
  const trophies = trophiesOf(player.id, engine.seasons);
  const name = shortName(player, data.players);

  return (
    <>
      <ScreenHeader title={name} back={() => router.back()} />
      <PullToRefresh scroll={false} className="px-4 pb-3">
        <div className="flex h-full flex-col gap-3">
          <ProfileHeader player={player} />
          <Card className="grid grid-cols-5 gap-1 px-3 py-3">
            <StatBlock value={s.wins} label="Vittorie" />
            <StatBlock value={s.statGames ? fmt(s.avg.pts) : "—"} label="Punti" />
            <StatBlock value={s.statGames ? fmt(s.avg.ast) : "—"} label="Assist" />
            <StatBlock value={s.statGames ? fmt(s.rebAvg) : "—"} label="Rimbalzi" />
            <StatBlock value={s.totals.fg3a ? pct(s.fg3Pct) : "—"} label="Da tre" />
          </Card>
          {me && h && (
            <Card className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-muted">Il vostro testa a testa</p>
                <p className="mt-0.5 text-[14px]">
                  {h.games === 0
                    ? "Non vi siete ancora sfidati da avversari."
                    : h.winsA > h.winsB
                      ? `Sei avanti tu, su ${h.games} sfide.`
                      : h.winsA < h.winsB
                        ? `È avanti ${name}, su ${h.games} sfide.`
                        : `Siete pari, su ${h.games} sfide.`}
                </p>
              </div>
              {h.games > 0 && (
                <p className="num shrink-0 text-[34px]" aria-label={`Tu ${h.winsA}, ${name} ${h.winsB}`}>
                  {h.winsA}
                  <span className="text-faint">–</span>
                  {h.winsB}
                </p>
              )}
            </Card>
          )}
          {trophies.length > 0 && (
            <Card className="flex items-center gap-3 px-4 py-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gold-soft text-gold">
                <Trophy size={19} />
              </span>
              <p className="text-[14px]">
                Campione di {trophies.length === 1 ? "una stagione" : `${trophies.length} stagioni`}:{" "}
                <span className="text-muted">{trophies.map((t) => seasonLabel(t.year, t.quarter).replace("Stagione ", "")).join(", ")}</span>
              </p>
            </Card>
          )}
          <p className="px-1 text-[12.5px] text-faint">
            {s.games} partite giocate{s.statGames ? `, ${s.statGames} con tabellino` : ""}.
          </p>
        </div>
      </PullToRefresh>
    </>
  );
}
