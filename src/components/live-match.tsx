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

  return (
    <div
      data-testid="live-match"
      className={clsx("flex flex-col", compact ? "gap-2.5" : "gap-3.5")}
      role="group"
      aria-label="Partita in corso"
    >
      <div className="flex items-center gap-2">
        <span className="live-pill flex items-center gap-1.5 rounded-full border-2 border-edge bg-danger px-2.5 py-0.5 text-[12px] font-bold uppercase tracking-wide text-white">
          <span
            className="live-dot h-2 w-2 rounded-full bg-white"
            aria-hidden
          />
          In corso
        </span>
        <span className="truncate text-[13px] font-semibold text-muted">
          {proposal.place ? `${placeLabel(proposal.place)} · ` : ""}
          {since}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Spicchio palleggia: un saltello schiacciato a terra, con l'ombra che respira. */}
        <div
          className={clsx(
            "live-stage relative shrink-0",
            compact ? "h-[74px] w-[64px]" : "h-[104px] w-[90px]",
          )}
          aria-hidden
        >
          <span className="live-shadow absolute bottom-0 left-1/2 h-2 w-3/5 -translate-x-1/2 rounded-[50%] bg-[#1d1a16]/20" />
          <span className="live-bounce absolute inset-x-0 bottom-1.5 flex justify-center">
            <Mascot pose="esulta" size={compact ? 62 : 88} animate={false} />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={clsx(
              "title leading-tight",
              compact ? "text-[17px]" : "text-[20px]",
            )}
          >
            Partita in corso
          </p>
          {/* La cronaca: una riga che cambia, letta dagli screen reader solo a richiesta. */}
          <p
            key={i}
            className="live-line mt-1 truncate text-[14px] font-semibold"
            aria-hidden
          >
            {line}
          </p>
          <p className="sr-only">In campo: {namesList(names, names.length)}</p>
        </div>
      </div>

      {!compact && (
        <div className="flex items-center gap-3">
          <AvatarStack players={players} size={30} max={8} />
          <p className="min-w-0 flex-1 truncate text-[13px] text-muted">
            In campo:{" "}
            <span className="font-semibold text-text">
              {namesList(names, 4)}
            </span>
          </p>
        </div>
      )}
      {!compact && me?.isAdmin && (
        <Link
          href="/nuova"
          className="sticker press flex h-11 items-center justify-center rounded-full bg-court text-[14px] font-bold text-court-ink"
        >
          Segna il risultato
        </Link>
      )}
    </div>
  );
}
