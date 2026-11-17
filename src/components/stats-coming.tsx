"use client";

import clsx from "clsx";
import { IconClockExclamation, IconSparkles } from "@tabler/icons-react";
import { Avatar } from "./ui/avatar";
import { Mascot } from "./mascot";
import { useData } from "@/lib/data/provider";
import { neededPlayers } from "@/lib/notifications/grouping";
import { awaitingStats } from "@/lib/proposals";
import { delayVisibleUntil, statsDelayFor } from "@/lib/stats-delay";
import { placeLabel, type Proposal } from "@/lib/types";
import { useNow } from "@/lib/use-now";

export function StatsComing({ first }: { first?: boolean }) {
  const { data } = useData();
  const now = useNow(60_000);
  const p = awaitingStats(
    data.proposals,
    data.matches,
    now,
    (x) => neededPlayers(x.format),
    (x) => delayVisibleUntil(x.startsAt),
  );
  if (!p) return null;
  const delay = statsDelayFor(p.startsAt);
  if (delay) return <StatsDelayed proposal={p} eta={delay.eta} now={now} first={first} />;
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
          Calcolo statistiche in corso
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

const TZ = "Europe/Rome";
const hm = (d: Date) =>
  d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const romeDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
/** "lun 16" */
const shortDay = (d: Date) =>
  d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", timeZone: TZ }).replace(".", "");

/** "Stasera alle 21:00", "Domani sera alle 21:00", "Mar 17 alle 21:00". */
function whenLabel(eta: Date, now: Date): string {
  const evening = Number(eta.toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: TZ })) >= 18;
  const tomorrow = new Date(now.getTime() + 24 * 3_600_000);
  if (romeDay(eta) === romeDay(now)) return `${evening ? "Stasera" : "Oggi"} alle ${hm(eta)}`;
  if (romeDay(eta) === romeDay(tomorrow)) return `Domani${evening ? " sera" : ""} alle ${hm(eta)}`;
  const d = shortDay(eta);
  return `${d.charAt(0).toUpperCase()}${d.slice(1)} alle ${hm(eta)}`;
}


/**
 * I risultati di una giornata in ritardo, al posto di "calcolo in corso": come gli avvisi di
 * ritardo delle app di consegne e trasporti, prima lo stato, poi cosa è successo in una riga e
 * soprattutto quando, con l'ora precisa.
 * Passata l'ora, se i risultati non ci sono ancora, diventa "in arrivo".
 */
function StatsDelayed({
  proposal,
  eta: etaIso,
  now,
  first,
}: {
  proposal: Proposal;
  eta: string;
  now: Date;
  first?: boolean;
}) {
  const start = new Date(proposal.startsAt);
  const eta = new Date(etaIso);
  const left = eta.getTime() - now.getTime();
  const late = left <= 0;
  const place = proposal.place ? placeLabel(proposal.place) : null;
  const when = whenLabel(eta, now);

  return (
    <div
      role="status"
      data-testid="stats-delayed"
      aria-label={
        late
          ? `Risultati di ${shortDay(start)} in arrivo`
          : `Risultati di ${shortDay(start)} in ritardo: ${when.toLowerCase()}`
      }
      className={clsx(
        first ? "mb-3 mt-1" : "mt-4",
        "relative overflow-hidden rounded-[26px] bg-linear-to-br from-[#1d1a16] via-[#2a2119] to-[#5a2f12] p-5 text-white shadow-[var(--shadow-pop)]",
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[26px]">
        <span className="blob hero-drift -right-14 -top-16 h-48 w-48 bg-[radial-gradient(circle,rgb(242_106_27/0.45),transparent_68%)]" />
        <span className="blob hero-drift -bottom-20 -left-10 h-40 w-40 bg-[radial-gradient(circle,rgb(255_197_49/0.2),transparent_70%)] [animation-delay:-6s]" />
      </div>

      <span aria-hidden className="absolute right-3 top-3 drop-shadow-[0_10px_16px_rgb(0_0_0/0.35)]">
        <Mascot pose={late ? "ciao" : "triste"} cloud={false} size={86} />
      </span>

      <div className="relative pr-[88px]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-volt px-2.5 py-1 text-[12px] font-semibold text-volt-ink">
          {late ? (
            <IconSparkles size={14} stroke={2.2} aria-hidden />
          ) : (
            <IconClockExclamation size={14} stroke={2.2} aria-hidden />
          )}
          {late ? "Quasi pronti" : "In ritardo"}
        </span>
        <p className="title mt-2.5 text-[24px] leading-[1.1]">
          {late ? "Risultati in arrivo" : "Risultati in ritardo"}
        </p>
        <p className="tnum mt-1.5 text-[13.5px] font-medium text-white/70">
          <span className="capitalize">{shortDay(start)}</span>
          {" · "}
          {hm(start)}
          {place && ` · ${place}`}
        </p>
        <p className="mt-2 text-[14px] leading-snug text-white/90">
          {late
            ? "Ultimi ritocchi: tra poco punteggi e statistiche sono qui."
            : "Un intoppo tecnico ha bloccato il caricamento di punteggi e statistiche. Grazie per la pazienza!"}
        </p>
      </div>

      <div className="relative mt-4 flex items-center gap-3 rounded-2xl bg-white/12 p-3.5 backdrop-blur-sm">
        <WaitClock />
        <span className="min-w-0">
          <span className="block text-[12px] font-medium text-white/60">
            {late ? "Previsti per le" : "Li trovi qui"}
          </span>
          <span className="tnum block truncate text-[18px] font-bold leading-tight">
            {late ? hm(eta) : when}
          </span>
        </span>
      </div>
    </div>
  );
}

/**
 * Un orologio che va avanti piano: la lancetta lunga fa un giro in 12 secondi, la corta in un
 * minuto e mezzo. Dice "si sta aspettando" senza fretta. Fermo con "riduci movimento".
 */
function WaitClock() {
  return (
    <svg viewBox="0 0 24 24" width={26} height={26} className="shrink-0 text-volt" aria-hidden>
      <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="2" />
      {[0, 90, 180, 270].map((r) => (
        <line key={r} x1="12" y1="4.6" x2="12" y2="5.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" transform={`rotate(${r} 12 12)`} />
      ))}
      <line className="wait-clock-hour" x1="12" y1="12" x2="12" y2="8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <line className="wait-clock-min" x1="12" y1="12" x2="12" y2="6.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    </svg>
  );
}
