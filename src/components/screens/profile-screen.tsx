"use client";

import { PlayerView } from "@/app/(app)/giocatore/player-page";
import { useData } from "@/lib/data/provider";

export function ProfileScreen() {
  const { me } = useData();
  if (!me) return null;
  return <PlayerView id={me.id} mine />;
}
