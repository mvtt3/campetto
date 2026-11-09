"use client";

import { play } from "@/lib/sound";
import clsx from "clsx";
import {
  IconArrowUpRight,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconCircleCheck,
  IconCloudRain,
  IconMapPin,
  IconRepeat,
  IconX,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { dayLabel, neededPlayers } from "@/lib/notifications/grouping";
import { useData } from "@/lib/data/provider";
import { useNow } from "@/lib/use-now";
import {
  alternativesOf,
  altLabel,
  CONFIRM_MIN,
  namesList,
  proposalPhase,
} from "@/lib/proposals";
import {
  mapsUrl,
  placeLabel,
  shortName,
  type Proposal,
  type ResponseKind,
} from "@/lib/types";
import { AltForm, RosterPanel } from "./proposal-extras";
import { LiveMatch } from "./live-match";
import { AvatarStack } from "./ui/avatar";
import { haptic } from "./ui/basics";
import { useToast } from "./ui/toast";
import { WeatherChip } from "./weather-chip";
import { say } from "@/lib/voice";

export function proposalWhen(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const diff = Math.round((day - today) / 86_400_000);
  const time = d.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const name =
    diff === 0
      ? "Oggi"
      : diff === 1
        ? "Domani"
        : // Come i calendari: entro la settimana basta il giorno ("Domenica"), più in là la data corta
          // ("Dom 8 nov"). Così sta sempre su una riga, senza puntini.
          diff > 1 && diff < 7
          ? d.toLocaleDateString("it-IT", { weekday: "long" })
          : d
              .toLocaleDateString("it-IT", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })
              .replace(/\./g, "");
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}, ${time}`;
}

const RESPONSES: { value: ResponseKind; label: string }[] = [
  { value: "si", label: "Ci sono" },
  { value: "forse", label: "Forse" },
  { value: "no", label: "No" },
];

export function useRespond() {
  const { backend, me, mutate } = useData();
  const toast = useToast();
  return async (p: Proposal, value: ResponseKind) => {
    if (!me) return;
    const mine = p.responses.find((r) => r.playerId === me.id)?.response;
    const next = mine === value ? null : value;
    haptic(10);
    mutate((d) => ({
      ...d,
      proposals: d.proposals.map((x) =>
        x.id !== p.id
          ? x
          : {
              ...x,
              responses: [
                ...x.responses.filter((r) => r.playerId !== me.id),
                ...(next
                  ? [
                      {
                        playerId: me.id,
                        response: next,
                        updatedAt: new Date().toISOString(),
                      },
                    ]
                  : []),
              ],
            },
      ),
    }));
    try {
      await backend.respond(p.id, next);
      if (next === "si") play("success");
      if (next === "si")
        void backend.notify({ type: "proposal_response", proposalId: p.id });
    } catch (e) {
      toast(say(e), "error");
    }
  };
}

export function ProposalCard({
  proposal,
  compact,
}: {
  proposal: Proposal;
  compact?: boolean;
}) {
  const { data, me, backend, mutate } = useData();
  const respond = useRespond();
  const toast = useToast();
  const now = useNow();
  const [confirmCancel, setConfirmCancel] = useState(false);
  // Annullata per il meteo: resta visibile quel giorno come "annullata per pioggia".
  const [rain, setRain] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const byId = new Map(data.players.map((p) => [p.id, p]));
  const yes = proposal.responses
    .filter((r) => r.response === "si")
    .map((r) => byId.get(r.playerId)!)
    .filter(Boolean);
  const maybe = proposal.responses
    .filter((r) => r.response === "forse")
    .map((r) => byId.get(r.playerId)!)
    .filter(Boolean);
  const mine = proposal.responses.find((r) => r.playerId === me?.id)?.response;
  const needed = neededPlayers(proposal.format);
  const full = yes.length >= needed;
  /** La via della palestra, se si gioca Indoor. */
  const indoorVia = proposal.place === "indoor" ? proposal.address?.trim() || null : null;
  const creator = byId.get(proposal.createdBy);
  const canCancel = me && (me.id === proposal.createdBy || me.isAdmin);

  // L'alternativa si scrive lì dentro la scheda, senza finestre: ogni apertura riparte da capo.
  const [altForm, setAltForm] = useState<{
    mode: "alt" | "move";
    n: number;
    open: boolean;
  }>({ mode: "alt", n: 0, open: false });
  const [confirmMove, setConfirmMove] = useState<string | null>(null);
  const progress = Math.min(1, yes.length / needed);
  const future = new Date(proposal.startsAt).getTime() > now.getTime();
  const isCreator = me?.id === proposal.createdBy;
  const canMove = !!me && (isCreator || me.isAdmin) && future;
  const myResp = proposal.responses.find((r) => r.playerId === me?.id);
  const myAltKey =
    myResp?.altStartsAt || myResp?.altPlace
      ? `${new Date(myResp.altStartsAt ?? proposal.startsAt).getTime()}|${myResp.altPlace ?? proposal.place ?? ""}`
      : null;
  const alts = compact ? [] : alternativesOf(proposal);

  const openAlt = (mode: "alt" | "move") =>
    setAltForm((s) => ({ mode, n: s.n + 1, open: true }));

  // "Anch'io" su una controproposta, o la ritiro se è già la mia.
  const backAlt = async (startsAt: string, place: Proposal["place"]) => {
    if (!me) return;
    const mineToo =
      myAltKey ===
      `${new Date(startsAt).getTime()}|${place ?? proposal.place ?? ""}`;
    const alt = mineToo
      ? null
      : {
          startsAt:
            new Date(startsAt).getTime() ===
            new Date(proposal.startsAt).getTime()
              ? null
              : startsAt,
          place: place === (proposal.place ?? null) ? null : (place ?? null),
        };
    haptic(8);
    mutate((d) => ({
      ...d,
      proposals: d.proposals.map((x) =>
        x.id !== proposal.id
          ? x
          : {
              ...x,
              responses: x.responses.map((r) =>
                r.playerId === me.id
                  ? {
                      ...r,
                      altStartsAt: alt?.startsAt ?? null,
                      altPlace: alt?.place ?? null,
                    }
                  : r,
              ),
            },
      ),
    }));
    try {
      await backend.setAlternative(proposal.id, alt);
      if (alt)
        void backend.notify({
          type: "proposal_alternative",
          proposalId: proposal.id,
        });
    } catch (e) {
      toast(say(e), "error");
    }
  };

  const moveTo = async (startsAt: string, place: Proposal["place"]) => {
    setConfirmMove(null);
    const next = place ?? proposal.place ?? null;
    mutate((d) => ({
      ...d,
      proposals: d.proposals.map((x) =>
        x.id !== proposal.id
          ? x
          : {
              ...x,
              startsAt,
              place: next,
              responses: x.responses.map((r) =>
                new Date(r.altStartsAt ?? startsAt).getTime() ===
                  new Date(startsAt).getTime() && (r.altPlace ?? next) === next
                  ? { ...r, altStartsAt: null, altPlace: null }
                  : r,
              ),
            },
      ),
    }));
    try {
      await backend.moveProposal(proposal.id, startsAt, next);
      void backend.notify({ type: "proposal_moved", proposalId: proposal.id });
      play("success");
      toast("Spostata, ho avvisato chi c'è");
    } catch (e) {
      toast(say(e), "error");
    }
  };

  const showAlt = !altForm.open && future && (canMove || mine === "si");
  const altAria = canMove
    ? "Cambia orario o campetto"
    : myAltKey
      ? "Cambia la tua alternativa"
      : "Proponi un altro orario o campetto";

  // Al completo, o in 4 a meno di 12 ore: confermata. Iniziata: in corso, con la cronaca.
  const phase = proposalPhase(proposal, now, needed);
  const minYes = Math.min(CONFIRM_MIN, needed);
  const missing = minYes - yes.length;
  const who = (
    <WhoRow compact={compact}>
      {yes.length ? (
        <AvatarStack players={yes} size={compact ? 28 : 32} />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px]">
          <span className="tnum font-bold">
            {Math.min(yes.length, needed)}
          </span>
          <span className="text-muted">
            {" "}
            di {needed}
            {full
              ? ""
              : ` per ${proposal.format ? `il ${proposal.format}` : "giocare"}`}
          </span>
          {full && <span className="font-bold text-ok"> al completo</span>}
          {yes.length > needed && (
            <span className="font-semibold text-muted">
              {" "}
              +{yes.length - needed}{" "}
              {proposal.format === "1v1"
                ? "in attesa"
                : yes.length - needed === 1
                  ? "cambio"
                  : "cambi"}
            </span>
          )}
          {maybe.length > 0 && (
            <span className="text-muted">, {maybe.length} forse</span>
          )}
        </p>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised"
          aria-hidden
        >
          <motion.div
            className={clsx(
              "h-full rounded-full",
              full ? "bg-ok" : "bg-court",
            )}
            initial={false}
            animate={{ width: `${progress * 100}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 26 }}
          />
        </div>
      </div>
      {compact && (
        <IconChevronRight size={18} className="shrink-0 text-faint" aria-hidden />
      )}
    </WhoRow>
  );

  const answers = (
    <div
      className="flex gap-1 rounded-full bg-raised p-1"
      role="group"
      aria-label="La tua risposta"
    >
      {RESPONSES.map((r) => {
        const on = mine === r.value;
        return (
          <button
            key={r.value}
            aria-pressed={on}
            onClick={() => void respond(proposal, r.value)}
            className={clsx(
              "press h-10 flex-1 rounded-full text-[14px] font-semibold transition-colors short:h-9",
              on
                ? r.value === "si"
                  ? "bg-volt text-volt-ink shadow-[var(--shadow)]"
                  : r.value === "no"
                    ? "bg-text text-bg shadow-[var(--shadow)]"
                    : "bg-court text-court-ink shadow-[var(--shadow)]"
                : "text-muted",
            )}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );

  if (phase === "live")
    return <LiveMatch proposal={proposal} compact={compact} />;

  if (compact) {
    const at = new Date(proposal.startsAt);
    const days = Math.round(
      (new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime() -
        new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
        86_400_000,
    );
    const weekday = at.toLocaleDateString("it-IT", { weekday: "long" });
    const when =
      days === 0
        ? "Oggi"
        : days === 1
          ? "Domani"
          : weekday[0].toUpperCase() + weekday.slice(1);
    const time = at.toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      <div
        data-testid="proposal-card"
        data-phase={phase}
        className="flex flex-col gap-4 short:gap-3"
      >
        <div className="flex items-center gap-3.5">
          <div className="flex h-[58px] w-[54px] shrink-0 flex-col items-center justify-center rounded-[18px] bg-ball-soft">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ball">
              {at.toLocaleDateString("it-IT", { weekday: "short" })}
            </span>
            <span className="num text-[24px] leading-none">{at.getDate()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="title truncate text-[19px]">
              {when}
              <span className="font-medium text-faint"> · </span>
              <span className="tnum">{time}</span>
            </p>
            <p className="mt-1 flex min-w-0 items-center gap-1 text-[13px] text-muted">
              {proposal.place && (
                <IconMapPin size={14} className="shrink-0 text-ball" aria-hidden />
              )}
              {indoorVia ? (
                <a
                  href={mapsUrl(indoorVia)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="truncate font-semibold text-text underline decoration-dotted underline-offset-2"
                  data-testid="indoor-address"
                >
                  {indoorVia}
                </a>
              ) : (
                proposal.place && (
                  <span className="shrink-0 font-semibold text-text">
                    {placeLabel(proposal.place)}
                  </span>
                )
              )}
              {proposal.format && (
                <span className="shrink-0">
                  {proposal.place ? " · " : ""}
                  {proposal.format}
                </span>
              )}
            </p>
          </div>
          <WeatherChip at={proposal.startsAt} className="shrink-0 self-start" />
        </div>
        <p className="-mt-1 truncate text-[13px] text-muted">
          Proposta da{" "}
          <span className="font-semibold text-text">
            {shortName(creator, data.players)}
          </span>
          {proposal.note ? ` · ${proposal.note}` : ""}
        </p>
        <div className="h-px bg-line" aria-hidden />
        {who}
        {answers}
      </div>
    );
  }

  return (
    <div
      data-testid="proposal-card"
      data-phase={phase}
      className={clsx(
        "flex flex-col",
        "gap-3 short:gap-2.5",
      )}
    >
      {phase === "confirmed" && (
        <div
          className="-mx-4 -mt-4 flex items-center gap-2 rounded-t-[19px] bg-ok px-4 py-2.5 text-white"
          role="status"
        >
          <IconCircleCheck size={19} strokeWidth={2.6} aria-hidden />
          <span className="title text-[15.5px]">Partita confermata</span>
          <span className="ml-auto truncate text-[12.5px] font-semibold opacity-90">
            {full ? "al completo" : `siete in ${yes.length}, si gioca`}
          </span>
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="title truncate text-[19px]">
            {proposalWhen(proposal.startsAt)}
          </p>
          {proposal.note ? (
            // Con la nota: la riga si apre con la freccetta, così si legge tutta.
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                haptic(5);
                setNoteOpen((o) => !o);
              }}
              // Il nome del bottone è il testo che si vede; aria-expanded dice se è aperta.
              aria-expanded={noteOpen}
              className="mt-0.5 flex w-full min-w-0 items-start gap-1 text-left text-[13px] text-muted"
              data-testid="proposal-note"
            >
              <span className={clsx("min-w-0 flex-1", noteOpen ? "whitespace-pre-wrap break-words" : "truncate")}>
                {proposal.place && (
                  <>
                    <PlaceTag place={proposal.place} />
                    {" · "}
                  </>
                )}
                {proposal.format ? `${proposal.format}, ` : ""}proposta da {shortName(creator, data.players)}
                {". "}
                <span className={clsx(noteOpen && "font-semibold text-text")}>{proposal.note}</span>
              </span>
              <IconChevronDown
                size={15}
                className={clsx("mt-0.5 shrink-0 text-faint transition-transform duration-200", noteOpen && "rotate-180")}
                aria-hidden
              />
            </button>
          ) : (
            <p className="mt-0.5 truncate text-[13px] text-muted">
              {proposal.place && (
                <>
                  <PlaceTag place={proposal.place} />
                  {" · "}
                </>
              )}
              {proposal.format ? `${proposal.format}, ` : ""}proposta da{" "}
              {shortName(creator, data.players)}
            </p>
          )}
        </div>
        <WeatherChip at={proposal.startsAt} className="shrink-0" />
      </div>
      {/* Indoor nel calendario: la via ben visibile, un tocco e si apre nelle mappe. */}
      {indoorVia && (
        <a
          href={mapsUrl(indoorVia)}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="press -mt-1 flex min-w-0 items-center gap-2 rounded-2xl bg-raised px-3 py-2 text-[14px] font-semibold"
          data-testid="indoor-address"
        >
          <IconMapPin size={17} strokeWidth={2.6} className="shrink-0 text-ball" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{indoorVia}</span>
          <span className="flex shrink-0 items-center gap-0.5 text-[12.5px] text-muted">
            Indicazioni
            <IconArrowUpRight size={15} strokeWidth={2.4} aria-hidden />
          </span>
        </a>
      )}

      {who}

      {answers}

      {/* Le controproposte: piccole, sotto le risposte. Chi ha proposto la sposta con un tocco. */}
      {alts.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="Controproposte">
          {alts.map((g) => {
            const mineToo = myAltKey === g.key;
            const names = g.playerIds.map((id) =>
              id === me?.id ? "tu" : shortName(byId.get(id), data.players),
            );
            return (
              <li
                key={g.key}
                className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-line-strong py-1.5 pl-2.5 pr-1.5"
              >
                <IconRepeat size={18} className="shrink-0 text-ball" aria-hidden />
                <p className="min-w-0 flex-1 truncate text-[13.5px] leading-tight">
                  <span className="font-bold">{altLabel(proposal, g)}</span>
                  <span className="text-muted">
                    {" · "}
                    {g.playerIds.length === 1
                      ? "la preferisce"
                      : "la preferiscono"}{" "}
                    {namesList(names)}
                  </span>
                </p>
                {canMove ? (
                  <button
                    onClick={() =>
                      confirmMove === g.key
                        ? void moveTo(g.startsAt, g.place)
                        : setConfirmMove(g.key)
                    }
                    className={clsx(
                      "sticker-sm press h-8 shrink-0 rounded-full px-3 text-[13px] font-bold",
                      confirmMove === g.key
                        ? "bg-ok text-white"
                        : "bg-court text-court-ink",
                    )}
                  >
                    {confirmMove === g.key ? "Confermi?" : "Sposta qui"}
                  </button>
                ) : mine === "si" && future ? (
                  <button
                    onClick={() => void backAlt(g.startsAt, g.place)}
                    aria-pressed={mineToo}
                    className={clsx(
                      "sticker-sm press h-8 shrink-0 rounded-full px-3 text-[13px] font-bold",
                      mineToo
                        ? "bg-surface text-muted"
                        : "bg-volt text-volt-ink",
                    )}
                  >
                    {mineToo ? "Ritira" : "Anch'io"}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {/* Un altro orario o l'altro campetto, stesso giorno: per chi c'è, e per chi l'ha proposta. */}
      <AnimatePresence initial={false}>
        {altForm.open && (
          <motion.div
            key={`alt-${altForm.n}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className="-m-1 overflow-hidden p-1"
          >
            <AltForm
              proposal={proposal}
              mode={altForm.mode}
              onClose={() => setAltForm((s) => ({ ...s, open: false }))}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {canCancel && confirmCancel && (
        <button
          type="button"
          aria-pressed={rain}
          onClick={() => setRain((r) => !r)}
          className={clsx(
            "press flex min-h-10 items-center gap-2.5 rounded-2xl border-2 px-3.5 py-2 text-left text-[13.5px] font-semibold",
            rain ? "border-court bg-court-soft" : "border-line-strong",
          )}
        >
          <span
            className={clsx(
              "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2",
              rain ? "border-court bg-court text-court-ink" : "border-line-strong text-court",
            )}
            aria-hidden
          >
            {rain ? <IconCheck size={14} strokeWidth={3} /> : <IconCloudRain size={13} strokeWidth={2.6} />}
          </span>
          <span className="min-w-0">
            È per la pioggia
            <span className="block text-[12.5px] font-normal text-muted">
              Fino a sera tutti vedono che oggi non si gioca
            </span>
          </span>
        </button>
      )}
      {/* Una riga sola per le azioni: squadre, orario o campetto, annulla. */}
      {(showAlt || canCancel) && (
        <div className="flex gap-2">
          {showAlt && !confirmCancel && (
            <button
              type="button"
              onClick={() => openAlt(canMove ? "move" : "alt")}
              aria-label={altAria}
              className={clsx(
                "sticker-sm press flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-full bg-surface px-3.5 text-[13.5px] font-bold",
                "flex-1",
              )}
            >
              <IconRepeat size={16} className="shrink-0 text-ball" aria-hidden />
              <span className="truncate">{altAria}</span>
            </button>
          )}
          {canCancel &&
            (confirmCancel ? (
              <>
                <button
                  className="sticker-sm press h-10 flex-1 rounded-full bg-surface text-[13.5px] font-bold text-muted"
                  onClick={() => {
                    setConfirmCancel(false);
                    setRain(false);
                  }}
                >
                  Lascia stare
                </button>
                <button
                  className="sticker-sm press h-10 flex-1 rounded-full bg-danger text-[13.5px] font-bold text-white"
                  onClick={async () => {
                    const reason = rain ? ("meteo" as const) : undefined;
                    mutate((d) => ({
                      ...d,
                      proposals: reason
                        ? d.proposals.map((x) =>
                            x.id === proposal.id
                              ? {
                                  ...x,
                                  status: "annullata" as const,
                                  cancelReason: reason,
                                  cancelledAt: new Date().toISOString(),
                                }
                              : x,
                          )
                        : d.proposals.filter((x) => x.id !== proposal.id),
                    }));
                    try {
                      await backend.cancelProposal(proposal.id, reason);
                      void backend.notify({
                        type: "proposal_cancelled",
                        proposalId: proposal.id,
                      });
                      toast(
                        reason
                          ? "Annullata per pioggia: ho avvisato chi aveva risposto"
                          : "Ho annullato la proposta e avvisato chi aveva risposto",
                      );
                    } catch (e) {
                      toast(say(e), "error");
                    }
                  }}
                >
                  Annulla la proposta
                </button>
              </>
            ) : (
              // Da sola la X non si capisce: se c'è spazio ha anche la scritta.
              <button
                aria-label="Annulla la proposta"
                className={clsx(
                  "sticker-sm press flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-surface text-muted",
                  showAlt ? "w-10" : "flex-1 px-4 text-[13.5px] font-semibold",
                )}
                onClick={() => setConfirmCancel(true)}
              >
                <IconX size={18} />
                {!showAlt && "Annulla la proposta"}
              </button>
            ))}
        </div>
      )}
      {/* Tutti i nomi, sotto, nello spazio del calendario: niente da aprire. */}
      {<RosterPanel proposal={proposal} />}
    </div>
  );
}

/** La riga di chi c'è: nella Home è un collegamento al calendario, nel calendario è solo da leggere. */
function WhoRow({
  compact,
  children,
}: {
  compact?: boolean;
  children: ReactNode;
}) {
  return compact ? (
    <Link
      href="/organizza"
      className="press -mx-1 flex items-center gap-3 rounded-2xl px-1 text-left"
    >
      <span className="sr-only">Chi c&apos;è, apri il calendario: </span>
      {children}
    </Link>
  ) : (
    <div className="flex items-center gap-3">{children}</div>
  );
}

/** Il campetto: puntina arancione e nome, ben leggibile. */
function PlaceTag({
  place,
}: {
  place: NonNullable<Proposal["place"]>;
}) {
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[13px] font-bold text-text"
    >
      <IconMapPin size={13} strokeWidth={2.6} className="text-ball" aria-hidden />
      {placeLabel(place)}
    </span>
  );
}
