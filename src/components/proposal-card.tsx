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
  IconPlus,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { dayLabel, neededPlayers } from "@/lib/notifications/grouping";
import { useData } from "@/lib/data/provider";
import { useNow } from "@/lib/use-now";
import {
  altKey,
  alternativesOf,
  CONFIRM_MIN,
  hhmm,
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
import { Avatar, AvatarStack } from "./ui/avatar";
import { haptic } from "./ui/basics";
import { useToast } from "./ui/toast";
import { WeatherChip } from "./weather-chip";
import { say } from "@/lib/voice";

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

  const canPropose = future && (canMove || mine === "si");
  const canVote = mine === "si" && future && !canMove;
  const addLabel = canMove
    ? "Cambia orario o campetto"
    : myAltKey
      ? "Cambia la tua proposta"
      : "Proponi un altro orario o campetto";
  const slotHint = canMove
    ? "Decidi tu"
    : canVote
      ? "Scegli la tua"
      : `Decide ${shortName(creator, data.players)}`;
  const altIds = new Set(alts.flatMap((g) => g.playerIds));
  const slots = [
    {
      key: altKey(proposal.startsAt, proposal.place ?? null),
      startsAt: proposal.startsAt,
      place: proposal.place ?? null,
      players: yes.filter((p) => !altIds.has(p.id)),
      current: true,
    },
    ...alts.map((g) => ({
      ...g,
      players: g.playerIds.map((id) => byId.get(id)!).filter(Boolean),
      current: false,
    })),
  ];
  const choose = (s: (typeof slots)[number]) => {
    if (!s.current) return void backAlt(s.startsAt, s.place);
    const my = alts.find((g) => g.key === myAltKey);
    if (my) void backAlt(my.startsAt, my.place);
  };

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

  const at = new Date(proposal.startsAt);
  const time = hhmm(proposal.startsAt);
  const head = (
    <div className="flex items-stretch gap-3.5">
      <div
        className={clsx(
          "flex w-[58px] shrink-0 flex-col items-center justify-center rounded-[18px]",
          compact ? "bg-court text-court-ink" : "bg-raised",
        )}
      >
        <span
          className={clsx(
            "text-[10.5px] font-semibold uppercase tracking-[0.1em]",
            compact ? "opacity-80" : "text-ball",
          )}
        >
          {at.toLocaleDateString("it-IT", { weekday: "short" })}
        </span>
        <span className="num text-[22px] leading-none">{at.getDate()}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] opacity-70">
          {at.toLocaleDateString("it-IT", { month: "short" })}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex items-center justify-between gap-2">
          <p className="score text-[36px] leading-none">{time}</p>
          <WeatherChip at={proposal.startsAt} className="shrink-0" />
        </div>
        <p className="mt-1.5 flex min-w-0 items-center gap-1 text-[13px] text-muted">
          {proposal.place && (
            <IconMapPin size={13} className="shrink-0 text-ball" aria-hidden />
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
              <span className="truncate font-semibold text-text">
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
    </div>
  );

  const confirmedBanner = phase === "confirmed" && (
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
  );

  if (compact) {
    return (
      <div
        data-testid="proposal-card"
        data-phase={phase}
        className="flex flex-col gap-3.5 short:gap-3"
      >
        {confirmedBanner}
        {head}
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
      {confirmedBanner}
      {head}
      <div className="flex items-start gap-2.5">
        {creator && <Avatar player={creator} size={30} href={false} />}
        {proposal.note ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              haptic(5);
              setNoteOpen((o) => !o);
            }}
            aria-expanded={noteOpen}
            className="flex min-w-0 flex-1 items-start gap-1 rounded-[16px] rounded-tl-[6px] bg-raised px-3 py-2 text-left text-[13.5px]"
            data-testid="proposal-note"
          >
            <span
              className={clsx(
                "min-w-0 flex-1",
                noteOpen ? "whitespace-pre-wrap break-words" : "truncate",
              )}
            >
              <span className="font-semibold">
                {shortName(creator, data.players)}
              </span>{" "}
              <span className="text-muted">{proposal.note}</span>
            </span>
            <IconChevronDown
              size={15}
              className={clsx(
                "mt-0.5 shrink-0 text-faint transition-transform duration-200",
                noteOpen && "rotate-180",
              )}
              aria-hidden
            />
          </button>
        ) : (
          <p className="min-w-0 flex-1 self-center truncate text-[13px] text-muted">
            Proposta da{" "}
            <span className="font-semibold text-text">
              {shortName(creator, data.players)}
            </span>
          </p>
        )}
      </div>
      {indoorVia && (
        <a
          href={mapsUrl(indoorVia)}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="press flex min-w-0 items-center gap-2 rounded-2xl bg-raised px-3 py-2 text-[14px] font-semibold"
          data-testid="indoor-address"
        >
          <IconMapPin size={17} className="shrink-0 text-ball" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{indoorVia}</span>
          <span className="flex shrink-0 items-center gap-0.5 text-[12.5px] text-muted">
            Indicazioni
            <IconArrowUpRight size={15} aria-hidden />
          </span>
        </a>
      )}

      <div className="rounded-[20px] bg-raised/70 p-3.5">
        <div className="flex items-baseline justify-between">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
            Formazione
          </p>
          <p className="text-[13px] text-muted">
            <span className={clsx("num text-[18px]", full ? "text-ok" : "text-text")}>
              {Math.min(yes.length, needed)}
            </span>
            /{needed}
            {yes.length > needed && (
              <span className="font-semibold">
                {" "}
                +{yes.length - needed}{" "}
                {proposal.format === "1v1"
                  ? "in attesa"
                  : yes.length - needed === 1
                    ? "cambio"
                    : "cambi"}
              </span>
            )}
          </p>
        </div>
        <ul className="mt-3 grid grid-cols-6 gap-x-1 gap-y-2.5">
          {Array.from({ length: needed }, (_, i) => {
            const p = yes[i];
            return (
              <li key={p?.id ?? `slot-${i}`} className="flex min-w-0 flex-col items-center gap-1">
                {p ? (
                  <Avatar player={p} size={40} href={false} />
                ) : (
                  <span className="grid h-10 w-10 place-items-center rounded-full border-[1.5px] border-dashed border-line-strong text-faint">
                    <IconPlus size={16} aria-hidden />
                  </span>
                )}
                <span
                  className={clsx(
                    "w-full truncate text-center text-[11px]",
                    p ? "font-semibold" : "text-faint",
                  )}
                >
                  {p ? (p.id === me?.id ? "Tu" : shortName(p, data.players)) : "Libero"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {answers}

      <RosterPanel proposal={proposal} />

      {(alts.length > 0 || canPropose) && (
        <section
          aria-label="Orario e campetto"
          className="flex flex-col gap-1.5 border-t border-line pt-3"
        >
          {alts.length > 0 && (
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                Orario e campetto
              </p>
              <p className="truncate text-[12px] text-muted">{slotHint}</p>
            </div>
          )}
          {alts.length > 0 && (
            <ul className="flex flex-col gap-1" aria-label="Controproposte">
              {slots.map((s) => {
                const chosen =
                  mine === "si" && (myAltKey ? myAltKey === s.key : s.current);
                const row = (
                  <>
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 -z-10 bg-volt/25 transition-[width] duration-300"
                      style={{
                        width: `${(s.players.length / yes.length) * 100}%`,
                      }}
                    />
                    <span className="num tnum text-[15px] leading-none">
                      {hhmm(s.startsAt)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      <span className="font-semibold">{placeLabel(s.place)}</span>
                      {s.current && <span className="text-muted"> · attuale</span>}
                    </span>
                    {s.players.length > 0 && (
                      <AvatarStack players={s.players} size={18} max={3} />
                    )}
                    <span className="tnum w-3 text-right text-[12.5px] font-semibold">
                      {s.players.length}
                    </span>
                  </>
                );
                const rowClass = clsx(
                  "relative isolate flex min-h-10 w-full items-center gap-2.5 overflow-hidden rounded-[14px] bg-raised px-3 py-1.5 text-left",
                  chosen && "outline outline-[1.5px] -outline-offset-[1.5px] outline-text",
                );
                return (
                  <li key={s.key}>
                    {canVote ? (
                      <button
                        type="button"
                        aria-pressed={chosen}
                        onClick={() => choose(s)}
                        className={clsx("press", rowClass)}
                      >
                        {row}
                        <span
                          aria-hidden
                          className={clsx(
                            "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-[1.5px]",
                            chosen
                              ? "border-text bg-text text-bg"
                              : "border-line-strong",
                          )}
                        >
                          {chosen && <IconCheck size={11} strokeWidth={3.2} />}
                        </span>
                      </button>
                    ) : (
                      <div className={rowClass}>
                        {row}
                        {canMove && !s.current && (
                          <button
                            onClick={() =>
                              confirmMove === s.key
                                ? void moveTo(s.startsAt, s.place)
                                : setConfirmMove(s.key)
                            }
                            className={clsx(
                              "press h-7 shrink-0 rounded-full px-2.5 text-[12px] font-semibold",
                              confirmMove === s.key
                                ? "bg-ok text-white"
                                : "bg-text text-bg",
                            )}
                          >
                            {confirmMove === s.key ? "Confermi?" : "Sposta qui"}
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <AnimatePresence initial={false}>
            {altForm.open ? (
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
            ) : (
              canPropose && (
                <button
                  key="add"
                  type="button"
                  onClick={() => openAlt(canMove ? "move" : "alt")}
                  className="press -ml-1 flex h-8 items-center gap-1 self-start rounded-full px-1 text-[13px] font-semibold text-muted"
                >
                  <IconPlus size={15} aria-hidden />
                  {addLabel}
                </button>
              )
            )}
          </AnimatePresence>
        </section>
      )}

      {canCancel && confirmCancel && (
        <button
          type="button"
          aria-pressed={rain}
          onClick={() => setRain((r) => !r)}
          className={clsx(
            "press flex min-h-10 items-center gap-2.5 rounded-2xl border px-3.5 py-2 text-left text-[13.5px] font-semibold",
            rain ? "border-court bg-court-soft" : "border-line-strong",
          )}
        >
          <span
            className={clsx(
              "grid h-6 w-6 shrink-0 place-items-center rounded-full border",
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
      {canCancel && (
        <div className="-mx-1 -mb-1 flex items-center justify-end gap-2 border-t border-line pt-2">
          {confirmCancel ? (
            <>
              <button
                className="press h-11 flex-1 rounded-full bg-raised text-[13.5px] font-semibold text-muted"
                onClick={() => {
                  setConfirmCancel(false);
                  setRain(false);
                }}
              >
                Lascia stare
              </button>
              <button
                className="press h-11 flex-1 rounded-full bg-danger text-[13.5px] font-semibold text-white"
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
            <button
              className="press flex h-9 shrink-0 items-center justify-center rounded-full bg-danger/10 px-4 text-[13px] font-semibold text-danger"
              onClick={() => setConfirmCancel(true)}
            >
              Annulla la proposta
            </button>
          )}
        </div>
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

