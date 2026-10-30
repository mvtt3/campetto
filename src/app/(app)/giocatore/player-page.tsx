"use client";

import clsx from "clsx";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { StatsDashboard } from "@/components/profile/stats-dashboard";
import { Form, KeyRings } from "@/components/profile/key-stats";
import { ProfileHeader } from "@/components/profile/profile-header";
import { EmptyState, ScreenHeader, Segmented } from "@/components/ui/basics";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useData } from "@/lib/data/provider";
import { headToHead } from "@/lib/stats/relations";
import { shortName } from "@/lib/types";
import { Character, characterOf } from "@/components/character";

/**
 * Il profilo di un giocatore. L'indirizzo è /giocatore?id=…: una pagina sola, già
 * pronta sul telefono, così aprire un compagno è immediato anche con poca rete.
 */
export function PlayerPage() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const { data, me } = useData();
  const router = useRouter();
  // "Come ti vedono gli altri": il proprio profilo nella versione pubblica.
  const preview = params.get("anteprima") === "1";
  const self = me?.id === id;
  const player = data.players.find((p) => p.id === id);
  const [tab, setTab] = useState<"panoramica" | "numeri">("panoramica");
  const h = useMemo(
    () => (me ? headToHead(me.id, id, data.matches) : null),
    [me, id, data.matches],
  );

  useEffect(() => {
    if (self && !preview) router.replace("/profilo");
  }, [self, preview, router]);

  if (!player) {
    return (
      <>
        <ScreenHeader title="Giocatore" back="/classifiche" />
        <EmptyState
          title="Giocatore non trovato"
          text="Forse è stato tolto dal gruppo"
        />
      </>
    );
  }
  const name = shortName(player, data.players);
  const lead =
    h && h.games
      ? h.winsA > h.winsB
        ? "me"
        : h.winsA < h.winsB
          ? "lui"
          : "pari"
      : null;

  return (
    <>
      <ScreenHeader
        title={self ? "Come ti vedono" : name}
        subtitle={self ? "Il tuo profilo, visto dagli altri" : undefined}
        back={() => router.back()}
      />
      <div className="shrink-0 px-5">
        <ProfileHeader player={player} />
        <Segmented
          className="mt-3"
          value={tab}
          onChange={setTab}
          options={[
            { value: "panoramica", label: "Panoramica" },
            { value: "numeri", label: "Numeri" },
          ]}
        />
      </div>
      {tab === "panoramica" ? (
        <PullToRefresh scroll={false} className="px-5 pb-2 pt-3">
          <div className="flex h-full flex-col gap-3 short:gap-2">
            <KeyRings playerId={player.id} />
            {me && h && !self && (
              <div className="card flex items-center gap-3 px-4 py-3 short:py-1.5">
                <Character
                  id={characterOf(me)}
                  number={me.jerseyNumber}
                  height={64}
                  className="short:h-10 short:w-auto"
                />
                <div className="min-w-0 flex-1 text-center">
                  <p className="text-[12.5px] font-semibold text-muted">
                    Testa a testa
                  </p>
                  {h.games ? (
                    <p
                      className="score text-[36px] short:text-[28px]"
                      aria-label={`Tu ${h.winsA}, ${name} ${h.winsB}`}
                    >
                      <span className={clsx(lead === "me" && "text-court")}>
                        {h.winsA}
                      </span>
                      <span className="text-faint">–</span>
                      <span className={clsx(lead === "lui" && "text-ball")}>
                        {h.winsB}
                      </span>
                    </p>
                  ) : (
                    <p className="text-[14px]">Non vi siete ancora sfidati</p>
                  )}
                </div>
                <Character
                  id={characterOf(player)}
                  number={player.jerseyNumber}
                  height={64}
                  className="short:h-10 short:w-auto"
                />
              </div>
            )}
            <Form playerId={player.id} />
          </div>
        </PullToRefresh>
      ) : (
        <PullToRefresh className="px-5 pb-4 pt-3">
          <StatsDashboard playerId={player.id} />
        </PullToRefresh>
      )}
    </>
  );
}
