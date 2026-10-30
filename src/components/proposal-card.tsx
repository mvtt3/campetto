"use client";

import { play } from "@/lib/sound";
import clsx from "clsx";
import { Shuffle, X } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { TeamsSheet } from "./teams-sheet";
import { neededPlayers } from "@/lib/notifications/grouping";
import { useData } from "@/lib/data/provider";
import { shortName, type Proposal, type ResponseKind } from "@/lib/types";
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
              .toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" })
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
  const progress = Math.min(1, yes.length / needed);

  return (
    <div
      data-testid="proposal-card"
      className={clsx("flex flex-col", compact ? "gap-3 short:gap-2" : "gap-4")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="title truncate text-[19px]">
            {proposalWhen(proposal.startsAt)}
          </p>
          <p
            className={clsx(
              "mt-0.5 truncate text-[13px] text-muted",
              compact && "short:hidden",
            )}
          >
            {proposal.format ? `${proposal.format}, ` : ""}proposta da{" "}
            {shortName(creator, data.players)}
            {proposal.note ? `. ${proposal.note}` : ""}
          </p>
        </div>
        <WeatherChip at={proposal.startsAt} className="shrink-0" />
      </div>

      <div className="flex items-center gap-3">
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
      </div>

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
