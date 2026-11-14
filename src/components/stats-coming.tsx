"use client";

import clsx from "clsx";
import { Avatar } from "./ui/avatar";
import { useData } from "@/lib/data/provider";
import { neededPlayers } from "@/lib/notifications/grouping";
import { awaitingStats } from "@/lib/proposals";
import { useNow } from "@/lib/use-now";

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
  const players = p.responses
    .filter((r) => r.response === "si")
    .map((r) => data.players.find((x) => x.id === r.playerId))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  return (
    <div
      role="status"
      className={`${first ? "mb-3 mt-1" : "mt-4"} flex items-center gap-3.5 rounded-[22px] bg-linear-to-br from-[#1d1a16] via-[#25201a] to-[#4a2c14] p-4 text-white shadow-[var(--shadow)]`}
    >
      <span
        aria-hidden
        className="h-9 w-9 shrink-0 animate-spin rounded-full border-[3px] border-[#f6eedc]/25 border-t-[#f6eedc]"
      />
      <div className="min-w-0 flex-1">
        <p className="title text-[17px] leading-tight">
          Sto preparando le statistiche
        </p>
        <p className="mt-0.5 text-[12.5px] text-white/60">
          Partita finita alle {time}
        </p>
      </div>
      {players.length > 0 && (
        <div className="flex shrink-0 items-center" aria-hidden>
          {players.slice(0, 3).map((x, i) => (
            <span
              key={x.id}
              className={clsx(
                "rounded-full ring-2 ring-[#25201a]",
                i > 0 && "-ml-2",
              )}
            >
              <Avatar player={x} size={26} href={false} ring="none" />
            </span>
          ))}
          {players.length > 3 && (
            <span className="tnum -ml-2 grid h-[26px] w-[26px] place-items-center rounded-full bg-white/15 text-[10.5px] font-bold ring-2 ring-[#25201a]">
              +{players.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
