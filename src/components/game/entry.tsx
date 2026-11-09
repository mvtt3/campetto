"use client";

import { IconDeviceGamepad2 } from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { NewDot } from "@/components/new-dot";
import { gameAllowed } from "@/lib/config";
import { useData } from "@/lib/data/provider";
import { dailyStatus, refillTokens, romeDay } from "@/lib/game/economy";
import { unreadCount } from "@/lib/game/messages";
import { readLocalGame } from "./store";

/**
 * L'ingresso di Campetto Star nella Home: il pallino rosso se c'è qualcosa che ti
 * aspetta (il premio del giorno, un messaggio) o se non hai ancora giocato.
 */
export function GameHomeButton() {
  const { me } = useData();
  const [dot, setDot] = useState(false);
  useEffect(() => {
    if (!me) return;
    const check = () => {
      const g = readLocalGame(me.id);
      if (!g) return setDot(true);
      const r = refillTokens(g, Date.now());
      setDot(!dailyStatus(r, romeDay(Date.now())).claimed || unreadCount(r) > 0);
    };
    check();
    const on = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", on);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", on);
      window.removeEventListener("focus", check);
    };
  }, [me]);
  if (!gameAllowed(me)) return null;
  return (
    <Link
      href="/gioca"
      aria-label={dot ? "Campetto Star, qualcosa ti aspetta" : "Campetto Star"}
      className="press relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ball text-ball-ink"
      data-testid="game-home"
    >
      <IconDeviceGamepad2 size={21} aria-hidden />
      {dot && <NewDot className="absolute -right-0.5 -top-0.5 !border-surface" />}
    </Link>
  );
}
