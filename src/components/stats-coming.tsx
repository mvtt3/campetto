"use client";

import { BarChart3 } from "lucide-react";
import { useData } from "@/lib/data/provider";
import { neededPlayers } from "@/lib/notifications/grouping";
import { awaitingStats } from "@/lib/proposals";
import { placeLabel } from "@/lib/types";
import { useNow } from "@/lib/use-now";

/** I tre puntini che saltano uno dopo l'altro, come "sta scrivendo" nelle chat. */
export function TypingDots() {
  return (
    <span
      className="typing-dots ml-0.5 inline-flex items-end gap-[3px]"
      aria-hidden
    >
      <span />
      <span />
      <span />
    </span>
  );
}

/**
 * Finita la partita, nello spazio sotto il calendario: le statistiche stanno arrivando.
 * Piccolo e tranquillo, non si tocca; sparisce da solo appena c'è il risultato.
 */
export function StatsComing({ first }: { first?: boolean }) {
  const { data } = useData();
  const now = useNow(60_000);
  const p = awaitingStats(data.proposals, data.matches, now, (x) =>
    neededPlayers(x.format),
  );
  if (!p) return null;
  const time = new Date(p.startsAt).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div
      role="status"
      className={`${first ? "mb-2 mt-1" : "mt-4"} flex items-center gap-3 rounded-[20px] border-2 border-dashed border-line-strong px-4 py-3`}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-edge bg-volt text-volt-ink">
        <BarChart3 size={18} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="title flex items-end text-[15px]">
          Sto preparando le statistiche
          <TypingDots />
        </p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-muted">
          La partita delle {time}
          {p.place ? ` al ${placeLabel(p.place)}` : ""} è finita. Appena
          c&apos;è il risultato la trovi in Partite
        </p>
      </div>
    </div>
  );
}
