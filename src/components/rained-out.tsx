"use client";

import clsx from "clsx";
import {
  IconCalendarEvent,
  IconChevronRight,
  IconCloudRain,
  IconPlus,
} from "@tabler/icons-react";
import Link from "next/link";
import { Mascot } from "./mascot";
import { placeLabel, type Proposal } from "@/lib/types";

const TZ = "Europe/Rome";
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
/** "mer 11" */
const shortDay = (iso: string) =>
  new Date(iso)
    .toLocaleDateString("it-IT", { weekday: "short", day: "numeric", timeZone: TZ })
    .replace(".", "");

const dayParam = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));

/**
 * La partita di oggi saltata per la pioggia, al posto di "si gioca adesso".
 * Come le schede meteo e le prenotazioni annullate delle app sportive: lo stato in alto,
 * cosa è successo in una riga, quando e dove (con l'ora barrata), e una sola cosa da fare dopo:
 * la prossima partita, o proporne un'altra se non c'è.
 */
export function RainedOut({
  proposal,
  next,
  compact,
}: {
  proposal: Proposal;
  /** La prossima partita aperta (in Home): il passo successivo naturale. */
  next?: Proposal | null;
  compact?: boolean;
}) {
  const place = proposal.place ? placeLabel(proposal.place) : null;

  return (
    <div
      data-testid="rained-out"
      role="group"
      aria-label={`Partita di ${shortDay(proposal.startsAt)} alle ${time(proposal.startsAt)} annullata per pioggia`}
      className={clsx(
        "storm relative overflow-hidden rounded-[26px] text-white",
        compact ? "p-4" : "p-5",
      )}
    >
      {/* La pioggia: un solo strato che scorre (solo transform), fermo con "riduci movimento". */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[26px]"
      >
        <span className="rain-fall absolute -left-8 -right-2" />
        <span className="blob -right-12 -top-16 h-48 w-48 bg-[radial-gradient(circle,rgb(255_255_255/0.22),transparent_68%)]" />
        <span className="absolute -bottom-10 right-0 h-28 w-40 rounded-full bg-[radial-gradient(ellipse,rgb(160_196_255/0.25),transparent_70%)]" />
      </div>

      <span
        aria-hidden
        className={clsx(
          "absolute drop-shadow-[0_10px_16px_rgb(0_0_0/0.3)]",
          compact ? "right-2 top-3" : "right-4 top-4",
        )}
      >
        <Mascot pose="triste" size={compact ? 74 : 92} />
      </span>

      <div className={clsx("relative", compact ? "pr-[78px]" : "pr-[96px]")}>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[12px] font-semibold">
          <IconCloudRain size={14} stroke={2.2} aria-hidden />
          Annullata
        </span>
        <p
          className={clsx(
            "title mt-2.5 leading-[1.1]",
            compact ? "text-[22px]" : "text-[26px]",
          )}
        >
          Stop per pioggia
        </p>
        <p className="tnum mt-1.5 text-[13.5px] font-medium text-white/75">
          <span className="capitalize">{shortDay(proposal.startsAt)}</span>
          {" · "}
          <s className="decoration-white/60 decoration-[1.5px]">
            {time(proposal.startsAt)}
          </s>
          {place && ` · ${place}`}
        </p>
        <p className="mt-2 text-[14px] leading-snug text-white/90">
          Campo fradicio: ci rifacciamo alla prossima.
        </p>
      </div>

      {next !== undefined &&
        (next ? (
          <Link
            href={`/organizza?giorno=${dayParam(next.startsAt)}&p=${next.id}`}
            className="press relative mt-4 flex min-h-14 items-center gap-3 rounded-2xl bg-white px-3.5 py-2 text-[#22324d]"
          >
            <IconCalendarEvent
              size={20}
              className="shrink-0 text-ball"
              aria-hidden
            />
            {/* Due righe: l'etichetta e il quando-dove, così non si taglia neanche sugli schermi stretti. */}
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-medium leading-tight text-[#22324d]/60">
                Prossima partita
              </span>
              <span className="tnum block truncate text-[14.5px] font-semibold leading-snug">
                <span className="capitalize">{shortDay(next.startsAt)}</span>
                {" · "}
                {time(next.startsAt)}
                {next.place ? ` · ${placeLabel(next.place)}` : ""}
              </span>
            </span>
            <IconChevronRight size={18} className="shrink-0 opacity-50" aria-hidden />
          </Link>
        ) : (
          <Link
            href="/organizza?nuova=1"
            className="press relative mt-4 flex min-h-14 items-center gap-3 rounded-2xl bg-white px-3.5 py-2 text-[#22324d]"
          >
            <IconPlus size={20} className="shrink-0 text-ball" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-medium leading-tight text-[#22324d]/60">
                Nessuna partita in programma
              </span>
              <span className="block truncate text-[14.5px] font-semibold leading-snug">
                Proponi un altro giorno
              </span>
            </span>
            <IconChevronRight size={18} className="shrink-0 opacity-50" aria-hidden />
          </Link>
        ))}
    </div>
  );
}
