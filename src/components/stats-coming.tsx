"use client";

import { AvatarStack } from "./ui/avatar";
import { useData } from "@/lib/data/provider";
import { neededPlayers } from "@/lib/notifications/grouping";
import { awaitingStats, namesList } from "@/lib/proposals";
import { placeLabel, shortName } from "@/lib/types";
import { useNow } from "@/lib/use-now";

const BARS = [45, 80, 60];

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
  const names = players.map((x) => shortName(x, data.players));
  return (
    <div
      role="status"
      className={`${first ? "mb-3 mt-1" : "mt-4"} relative isolate overflow-hidden rounded-[22px] bg-linear-to-br from-[#1d1a16] via-[#25201a] to-[#4a2c14] p-4 text-white shadow-[var(--shadow)]`}
    >
      <span
        aria-hidden
        className="blob -right-16 -top-20 -z-10 h-48 w-48 bg-[radial-gradient(circle,rgb(255_197_49/0.22),transparent_68%)]"
      />
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em]">
          <span className="h-2 w-2 rounded-full bg-volt" aria-hidden />
          Finita alle {time}
        </span>
        <span className="truncate text-[12.5px] font-semibold text-white/60">
          {p.place ? placeLabel(p.place) : "Al campetto"}
        </span>
      </div>
      <div className="mt-3.5 flex items-end gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/55">
            Statistiche in arrivo
          </p>
          <p className="title mt-1 flex items-end text-[19px] leading-tight">
            Sto preparando le statistiche
            <TypingDots />
          </p>
          <p className="mt-1.5 text-[12.5px] leading-snug text-white/65">
            Appena c&apos;è il risultato la trovi in Partite
          </p>
        </div>
        <div className="flex h-14 shrink-0 items-end gap-1.5" aria-hidden>
          {BARS.map((h, i) => (
            <span
              key={h}
              className="skeleton w-3 rounded-full bg-volt"
              style={{ height: `${h}%`, animationDelay: `${i * 0.25}s` }}
            />
          ))}
        </div>
      </div>
      {players.length > 0 && (
        <div className="mt-3.5 flex items-center gap-3 border-t border-white/10 pt-3.5">
          <AvatarStack players={players} size={28} max={6} />
          <p className="min-w-0 flex-1 truncate text-[12.5px] text-white/60">
            Hanno giocato{" "}
            <span className="font-semibold text-white">
              {namesList(names, 3)}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
