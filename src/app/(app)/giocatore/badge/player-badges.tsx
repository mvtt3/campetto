"use client";

import { useSearchParams } from "next/navigation";
import { BadgeCollection } from "@/components/badge-collection";
import { ScreenHeader } from "@/components/ui/basics";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useData } from "@/lib/data/provider";
import { playerHref, shortName } from "@/lib/types";

export function PlayerBadgesPage() {
  const id = useSearchParams().get("id") ?? "";
  const { data } = useData();
  const p = data.players.find((x) => x.id === id);
  return (
    <>
      <ScreenHeader title={`Badge di ${shortName(p, data.players)}`} back={playerHref(id)} />
      <PullToRefresh className="px-4 pb-4">
        <BadgeCollection playerId={id} />
      </PullToRefresh>
    </>
  );
}
