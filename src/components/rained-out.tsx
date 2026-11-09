"use client";

import clsx from "clsx";
import { IconCalendar, IconCloudRain } from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Mascot } from "./mascot";
import { dayLabel } from "@/lib/notifications/grouping";
import { placeLabel, type Proposal } from "@/lib/types";

/** Le frasi sotto il titolo: girano come la cronaca della partita in corso, ma col muso lungo. */
const LINES = [
  "Il campetto oggi è un lago",
  "Il pallone resta all'asciutto",
  "Spicchio aspetta che smetta",
  "Niente canestri, solo pozzanghere",
  "Ci rifacciamo alla prossima",
];

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });

const dayParam = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * La partita di oggi annullata per pioggia, al posto del "live": etichetta "Annullata",
 * Spicchio sotto la nuvoletta e una frase che cambia. In Home, sotto, la prossima partita.
 */
export function RainedOut({
  proposal,
  next,
  compact,
}: {
  proposal: Proposal;
  /** La prossima partita aperta, da proporre come ripartenza (solo in Home). */
  next?: Proposal | null;
  compact?: boolean;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((x) => x + 1), 2800);
    return () => window.clearInterval(t);
  }, []);
  const line = LINES[i % LINES.length];
  const where = proposal.place ? `${placeLabel(proposal.place)} · ` : "";

  return (
    <div
      data-testid="rained-out"
      className={clsx("flex flex-col", compact ? "gap-2.5" : "gap-3.5")}
      role="group"
      aria-label="Partita annullata per pioggia"
    >
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full border-2 border-edge bg-court px-2.5 py-0.5 text-[12px] font-bold uppercase tracking-wide text-court-ink">
          <IconCloudRain size={14} strokeWidth={2.6} aria-hidden />
          Annullata
        </span>
        <span className="truncate text-[13px] font-semibold text-muted">
          {where}
          <s className="decoration-2">oggi alle {time(proposal.startsAt)}</s>
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div
          className={clsx(
            "relative flex shrink-0 items-end justify-center",
            compact ? "h-[86px] w-[64px]" : "h-[118px] w-[90px]",
          )}
          aria-hidden
        >
          <Mascot pose="triste" size={compact ? 58 : 82} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={clsx(
              "title leading-tight",
              compact ? "text-[17px]" : "text-[20px]",
            )}
          >
            Annullata per pioggia
          </p>
          <p
            key={i}
            className="live-line mt-1 truncate text-[14px] font-semibold text-muted"
            aria-hidden
          >
            {line}
          </p>
          <p className="sr-only">
            Oggi non si gioca per il meteo. Ci rifacciamo alla prossima.
          </p>
        </div>
      </div>

      {next && (
        <Link
          href={`/organizza?giorno=${dayParam(next.startsAt)}&p=${next.id}`}
          className="sticker-sm press flex h-11 items-center justify-center gap-2 rounded-full bg-surface px-4 text-[14px] font-bold"
        >
          <IconCalendar size={17} className="shrink-0 text-ball" aria-hidden />
          <span className="truncate">
            Prossima: {dayLabel(next.startsAt)}
            {next.place ? `, ${placeLabel(next.place)}` : ""}
          </span>
        </Link>
      )}
    </div>
  );
}
