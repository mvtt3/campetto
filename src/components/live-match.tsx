"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Mascot } from "./mascot";
import { AvatarStack } from "./ui/avatar";
import { useData } from "@/lib/data/provider";
import { namesList } from "@/lib/proposals";
import { useNow } from "@/lib/use-now";
import { placeLabel, shortName, type Proposal } from "@/lib/types";

/** Le azioni della cronaca: brevi, come le direbbe uno a bordo campo. */
const ACTIONS: ((other: string) => string)[] = [
  () => "sta palleggiando",
  () => "tira da tre…",
  () => "va in terzo tempo",
  () => "stoppa tutto",
  () => "ruba palla!",
  () => "prende il rimbalzo",
  (o) => `passa a ${o}`,
  () => "chiede la palla",
  () => "segna da sotto",
  (o) => `difende su ${o}`,
  () => "prova la tripla",
  () => "fa un crossover",
];

/**
 * La partita in corso, come il "live" delle app di sport: bollino rosso che pulsa, da quanto
 * si gioca e una cronaca finta che gira coi nomi di chi è in campo, mentre Spicchio palleggia.
 * Solo animazioni CSS leggere; chi chiede meno movimento vede tutto fermo.
 */
export function LiveMatch({
  proposal,
  compact,
}: {
  proposal: Proposal;
  compact?: boolean;
}) {
  const { data, me } = useData();
  const now = useNow(30_000);
  const players = proposal.responses
    .filter((r) => r.response === "si")
    .map((r) => data.players.find((p) => p.id === r.playerId))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const names = players.map((p) => shortName(p, data.players));
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((x) => x + 1), 2600);
    return () => window.clearInterval(t);
  }, []);
  const n = Math.max(1, names.length);
  const who = names[(i * 5 + 1) % n] ?? "Spicchio";
  const other = names[(i * 5 + 3) % n] ?? "Spicchio";
  const line = `${who} ${ACTIONS[(i * 7 + 2) % ACTIONS.length](other === who ? (names[(i * 5 + 4) % n] ?? "Spicchio") : other)}`;
  const minutes = Math.max(
    0,
    Math.floor(
      (now.getTime() - new Date(proposal.startsAt).getTime()) / 60_000,
    ),
  );
  const since =
    minutes < 1
      ? "è appena iniziata"
      : `da ${minutes} ${minutes === 1 ? "minuto" : "minuti"}`;

  const scoreHref = `/nuova?players=${players.map((p) => p.id).join(",")}${proposal.format ? `&format=${proposal.format}` : ""}`;

  return (
    <div
      data-testid="live-match"
      className="relative isolate -m-4 overflow-hidden rounded-[20px] bg-linear-to-br from-[#1d1a16] via-[#2a1d14] to-[#7a3410] p-4 text-white"
      role="group"
      aria-label="Partita in corso"
    >
      <span
        aria-hidden
        className="blob hero-drift -right-16 -top-20 -z-10 h-56 w-56 bg-[radial-gradient(circle,rgb(242_106_27/0.45),transparent_68%)]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -right-14 -z-10 h-56 w-56"
      >
        <svg
          viewBox="0 0 200 200"
          className="court-lines draw ball-spin h-full w-full opacity-60"
        >
          <circle cx="100" cy="100" r="96" />
          <path d="M100 4v192" />
          <path d="M4 100h192" />
          <path d="M32 32c30 30 30 106 0 136" />
          <path d="M168 32c-30 30-30 106 0 136" />
        </svg>
      </span>

      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-danger px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] shadow-[0_0_18px_rgb(229_57_53/0.55)]">
          <span
            className="live-dot h-2 w-2 rounded-full bg-white"
            aria-hidden
          />
          In corso
        </span>
        <span className="truncate text-[12.5px] font-semibold text-white/65">
          {proposal.place ? placeLabel(proposal.place) : "Al campetto"}
        </span>
      </div>

      <div
        className={clsx("flex items-end gap-3", compact ? "mt-2.5" : "mt-3.5")}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/55">
            Partita in corso
          </p>
          <p
            className={clsx(
              "score mt-1 leading-none",
              compact ? "text-[40px]" : "text-[52px]",
            )}
          >
            {minutes < 1 ? "0" : minutes}
            <span className="text-volt">&apos;</span>
          </p>
          <p className="sr-only">{since}</p>
          <p
            key={i}
            className="live-line mt-2 truncate text-[13.5px] font-semibold text-white/85"
            aria-hidden
          >
            {line}
          </p>
          <p className="sr-only">In campo: {namesList(names, names.length)}</p>
        </div>
        <div
          className={clsx(
            "live-stage relative shrink-0",
            compact ? "h-[84px] w-[72px]" : "h-[112px] w-[96px]",
          )}
          aria-hidden
        >
          <span className="live-shadow absolute bottom-0 left-1/2 h-2 w-3/5 -translate-x-1/2 rounded-[50%] bg-black/40" />
          <span className="live-bounce absolute inset-x-0 bottom-1.5 flex justify-center">
            <Mascot pose="esulta" size={compact ? 70 : 94} animate={false} />
          </span>
        </div>
      </div>

      {!compact && (
        <div className="mt-3.5 flex items-center gap-3 border-t border-white/10 pt-3.5">
          <AvatarStack players={players} size={30} max={8} />
          <p className="min-w-0 flex-1 truncate text-[12.5px] text-white/60">
            In campo{" "}
            <span className="font-semibold text-white">
              {namesList(names, 4)}
            </span>
          </p>
        </div>
      )}
      {!compact && me?.isAdmin && (
        <Link
          href={scoreHref}
          className="press mt-3.5 flex h-11 items-center justify-center rounded-full bg-volt text-[14px] font-bold text-volt-ink shadow-[0_8px_20px_-8px_rgb(255_197_49/0.8)]"
        >
          Segna il risultato
        </Link>
      )}
    </div>
  );
}
