"use client";

import { BadgeCollection } from "@/components/badge-collection";
import { ScreenHeader } from "@/components/ui/basics";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useData } from "@/lib/data/provider";

export default function MyBadgesPage() {
  const { me } = useData();
  if (!me) return null;
  return (
    <>
      <ScreenHeader title="I tuoi badge" back="/profilo" />
      <PullToRefresh className="px-4 pb-4">
        <BadgeCollection playerId={me.id} editable />
      </PullToRefresh>
    </>
  );
}
