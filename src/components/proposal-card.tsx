"use client";

import { play } from "@/lib/sound";
import clsx from "clsx";
import { ChevronRight, MapPin, Repeat2, Shuffle, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { TeamsSheet } from "./teams-sheet";
import { neededPlayers } from "@/lib/notifications/grouping";
import { useData } from "@/lib/data/provider";
import { useNow } from "@/lib/use-now";
import { alternativesOf, altLabel, namesList } from "@/lib/proposals";
import {
  placeLabel,
  shortName,
  type Proposal,
  type ResponseKind,
} from "@/lib/types";
import { AltForm, RosterPanel } from "./proposal-extras";
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
  const creator = byId.get(proposal.createdBy);
  const isToday =
    new Date(proposal.startsAt).toDateString() === new Date().toDateString();
  const canCancel = me && (me.id === proposal.createdBy || me.isAdmin);

  const [teamsOpen, setTeamsOpen] = useState(false);
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

  return (
    <div
      data-testid="proposal-card"
      className={clsx("flex flex-col", compact ? "gap-3 short:gap-2" : "gap-4")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="title truncate text-[19px]">
            {proposalWhen(proposal.startsAt)}
            {/* Nella Home il campetto sta sulla riga dell'ora: la scheda non si allunga. */}
            {compact && proposal.place && (
              <PlaceTag place={proposal.place} inline />
            )}
          </p>
          <p
            className={clsx(
              "mt-0.5 truncate text-[13px] text-muted",
              // Nella Home, sui telefoni non alti, la riga in più toglieva spazio all'ultima partita.
              compact && "[@media(max-height:820px)]:hidden",
            )}
          >
            {!compact && proposal.place && (
              <>
                <PlaceTag place={proposal.place} />
                {" · "}
              </>
            )}
            {proposal.format ? `${proposal.format}, ` : ""}proposta da{" "}
            {shortName(creator, data.players)}
            {proposal.note ? `. ${proposal.note}` : ""}
          </p>
        </div>
        <WeatherChip at={proposal.startsAt} className="shrink-0" />
      </div>

      {/* Chi c'è: facce e conta. Nella Home porta al calendario, dove ci sono tutti i nomi. */}
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
              di {needed}{" "}
              {full
                ? ""
                : `per ${proposal.format ? `il ${proposal.format}` : "giocare"}`}
            </span>
            {full && <span className="font-bold text-ok"> si gioca!</span>}
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
            className="mt-1.5 h-2.5 overflow-hidden rounded-full border-2 border-edge bg-raised"
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
          <ChevronRight size={18} className="shrink-0 text-faint" aria-hidden />
        )}
      </WhoRow>

      <div className="flex gap-2" role="group" aria-label="La tua risposta">
        {RESPONSES.map((r) => {
          const on = mine === r.value;
          return (
            <button
              key={r.value}
              aria-pressed={on}
              onClick={() => void respond(proposal, r.value)}
              className={clsx(
                "sticker-sm press h-11 flex-1 rounded-full text-[14px] font-bold transition-colors",
                on
                  ? r.value === "si"
                    ? "bg-volt text-volt-ink"
                    : r.value === "no"
                      ? "bg-text text-bg"
                      : "bg-court text-court-ink"
                  : "bg-surface text-text",
              )}
            >
              {r.label}
            </button>
          );
        })}
      </div>

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
                className="flex items-center gap-2.5 rounded-2xl border-2 border-dashed border-line-strong px-2.5 py-2"
              >
                <Repeat2 size={18} className="shrink-0 text-ball" aria-hidden />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-[14px] font-bold">
                    {altLabel(proposal, g)}
                  </p>
                  <p className="truncate text-[12px] text-muted">
                    {g.playerIds.length === 1
                      ? "La preferisce"
                      : "La preferiscono"}{" "}
                    {namesList(names)}
                  </p>
                </div>
                {canMove ? (
                  <button
                    onClick={() =>
                      confirmMove === g.key
                        ? void moveTo(g.startsAt, g.place)
                        : setConfirmMove(g.key)
                    }
                    className={clsx(
                      "sticker-sm press h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold",
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
                      "sticker-sm press h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold",
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
        {altForm.open && !compact && (
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
      {!compact && !altForm.open && future && (canMove || mine === "si") && (
        <button
          type="button"
          onClick={() => openAlt(canMove ? "move" : "alt")}
          className="press -my-1 self-center rounded-full px-3 py-1.5 text-[13px] font-semibold text-court underline decoration-2 underline-offset-4"
        >
          {canMove
            ? "Cambia orario o campetto"
            : myAltKey
              ? "Cambia la tua alternativa"
              : "Meglio un altro orario o campetto?"}
        </button>
      )}

      {!compact && (((isToday || full) && yes.length >= 2) || canCancel) && (
        <div className="flex gap-2">
          {(isToday || full) && yes.length >= 2 && (
            <button
              onClick={() => setTeamsOpen(true)}
              className="sticker press flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-court text-[14px] font-bold text-court-ink"
            >
              <Shuffle size={17} /> Fai le squadre
            </button>
          )}
          {canCancel &&
            (confirmCancel ? (
              <button
                className="sticker-sm press h-11 flex-1 rounded-full bg-surface text-[14px] font-bold text-danger"
                onClick={async () => {
                  mutate((d) => ({
                    ...d,
                    proposals: d.proposals.filter((x) => x.id !== proposal.id),
                  }));
                  try {
                    await backend.cancelProposal(proposal.id);
                    void backend.notify({
                      type: "proposal_cancelled",
                      proposalId: proposal.id,
                    });
                    toast(
                      "Ho annullato la proposta e avvisato chi aveva risposto",
                    );
                  } catch (e) {
                    toast(say(e), "error");
                  }
                }}
              >
                Annulla la proposta
              </button>
            ) : (
              // Da sola la X non si capisce: senza "Fai le squadre" accanto ha anche la scritta.
              <button
                aria-label="Annulla la proposta"
                className={clsx(
                  "sticker-sm press flex h-11 items-center justify-center gap-1.5 rounded-full bg-surface text-muted",
                  (isToday || full) && yes.length >= 2
                    ? "w-11"
                    : "px-4 text-[13.5px] font-semibold",
                )}
                onClick={() => setConfirmCancel(true)}
              >
                <X size={18} />
                {!((isToday || full) && yes.length >= 2) &&
                  "Annulla la proposta"}
              </button>
            ))}
        </div>
      )}
      {/* Tutti i nomi, sotto, nello spazio del calendario: niente da aprire. */}
      {!compact && <RosterPanel proposal={proposal} />}
      {teamsOpen && (
        <TeamsSheet
          playerIds={yes.map((p) => p.id)}
          format={proposal.format}
          onClose={() => setTeamsOpen(false)}
        />
      )}
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
  inline,
}: {
  place: NonNullable<Proposal["place"]>;
  inline?: boolean;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-0.5 text-[13px] font-bold text-text [font-family:var(--font-sans)]",
        inline && "ml-2 align-[0.15em]",
      )}
    >
      <MapPin size={13} strokeWidth={2.6} className="text-ball" aria-hidden />
      {placeLabel(place)}
    </span>
  );
}
