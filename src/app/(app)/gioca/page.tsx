"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Game } from "@/components/game/game";
import { gameAllowed } from "@/lib/config";
import { useData } from "@/lib/data/provider";

/** Campetto Star: il gioco, a tutto schermo sopra all'app. */
export default function GiocaPage() {
  const { me } = useData();
  const router = useRouter();
  const ok = gameAllowed(me);
  useEffect(() => {
    if (me && !ok) router.replace("/");
  }, [me, ok, router]);
  if (!me || !ok) return null;
  return <Game me={me} />;
}
