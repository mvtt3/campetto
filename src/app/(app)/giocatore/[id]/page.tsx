"use client";

import clsx from "clsx";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Form, KeyRings } from "@/components/profile/key-stats";
import { ProfileHeader } from "@/components/profile/profile-header";
import { TrendChart } from "@/components/profile/trend-chart";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState, ScreenHeader } from "@/components/ui/basics";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useData } from "@/lib/data/provider";
import { headToHead } from "@/lib/stats/relations";
import { shortName } from "@/lib/types";

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const { data, me } = useData();
  const router = useRouter();
  const player = data.players.find((p) => p.id === id);
  const h = useMemo(() => (me ? headToHead(me.id, id, data.matches) : null), [me, id, data.matches]);

  useEffect(() => {
    if (me?.id === id) router.replace("/profilo");
  }, [me, id, router]);

  if (!player) {
    return (
      <>
        <ScreenHeader title="Giocatore" back="/classifiche" />
        <EmptyState title="Giocatore non trovato" text="Forse è stato tolto dal gruppo" />
      </>
    );
  }
  const name = shortName(player, data.players);
  const lead = h && h.games ? (h.winsA > h.winsB ? "me" : h.winsA < h.winsB ? "lui" : "pari") : null;

  return (
    <>
      <ScreenHeader title={name} back={() => router.back()} />
      <PullToRefresh scroll={false} className="px-5 pb-2">
        <div className="flex h-full flex-col gap-3 short:gap-2">
          <ProfileHeader player={player} />
          <KeyRings playerId={player.id} />
          {me && h && (
            <div className="card flex items-center gap-3 px-4 py-3">
              <Avatar player={me} size={36} href={false} ring="none" />
              <div className="min-w-0 flex-1 text-center">
                <p className="text-[12.5px] font-semibold text-muted">Testa a testa</p>
                {h.games ? (
                  <p className="score text-[36px]" aria-label={`Tu ${h.winsA}, ${name} ${h.winsB}`}>
                    <span className={clsx(lead === "me" && "text-court")}>{h.winsA}</span>
                    <span className="text-faint">–</span>
                    <span className={clsx(lead === "lui" && "text-ball")}>{h.winsB}</span>
                  </p>
                ) : (
                  <p className="text-[14px]">Non vi siete ancora sfidati</p>
                )}
              </div>
              <Avatar player={player} size={36} href={false} ring="none" />
            </div>
          )}
          <Form playerId={player.id} />
          <div className="card min-h-0 flex-1 p-4 short:hidden">
            <TrendChart playerId={player.id} />
          </div>
        </div>
      </PullToRefresh>
    </>
  );
}
