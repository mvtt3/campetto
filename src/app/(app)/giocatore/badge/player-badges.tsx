"use client";

import { useSearchParams } from "next/navigation";
import { BadgeCollection } from "@/components/badge-collection";
import { ScreenHeader } from "@/components/ui/basics";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { playerHref } from "@/lib/types";

export function PlayerBadgesPage() {
  const id = useSearchParams().get("id") ?? "";
  return (
    <>
      <ScreenHeader title="Badge" back={playerHref(id)} />
      <PullToRefresh className="px-4 pb-4">
        <BadgeCollection playerId={id} />
      </PullToRefresh>
    </>
  );
}
