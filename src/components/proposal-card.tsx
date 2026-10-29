"use client";

import clsx from "clsx";
import Link from "next/link";
import { Shuffle, X } from "lucide-react";
import { useState } from "react";
import { neededPlayers } from "@/lib/notifications/grouping";
import { useData } from "@/lib/data/provider";
import { shortName, type Proposal, type ResponseKind } from "@/lib/types";
import { AvatarStack } from "./ui/avatar";
import { haptic } from "./ui/basics";
import { useToast } from "./ui/toast";
import { WeatherChip } from "./weather-chip";

export function proposalWhen(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((day - today) / 86_400_000);
  const time = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  const name =
    diff === 0
      ? "Oggi"
      : diff === 1
        ? "Domani"
        : d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
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
                ...(next ? [{ playerId: me.id, response: next, updatedAt: new Date().toISOString() }] : []),
              ],
            },
      ),
    }));
    try {
      await backend.respond(p.id, next);
      if (next === "si") void backend.notify({ type: "proposal_response", proposalId: p.id });
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
}

export function ProposalCard({ proposal, compact }: { proposal: Proposal; compact?: boolean }) {
  const { data, me, backend, mutate } = useData();
  const respond = useRespond();
  const toast = useToast();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const byId = new Map(data.players.map((p) => [p.id, p]));
  const yes = proposal.responses.filter((r) => r.response === "si").map((r) => byId.get(r.playerId)!).filter(Boolean);
  const maybe = proposal.responses.filter((r) => r.response === "forse").map((r) => byId.get(r.playerId)!).filter(Boolean);
  const mine = proposal.responses.find((r) => r.playerId === me?.id)?.response;
  const needed = neededPlayers(proposal.format);
  const full = yes.length >= needed;
  const creator = byId.get(proposal.createdBy);
  const isToday = new Date(proposal.startsAt).toDateString() === new Date().toDateString();
  const canCancel = me && (me.id === proposal.createdBy || me.isAdmin);
  const teamsHref = `/nuova?players=${yes.map((p) => p.id).join(",")}${proposal.format ? `&format=${proposal.format}` : ""}`;

  return (
    <div data-testid="proposal-card" className={clsx("flex flex-col", compact ? "gap-3" : "gap-4")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="title truncate text-[19px]">{proposalWhen(proposal.startsAt)}</p>
          <p className="mt-0.5 truncate text-[13px] text-muted">
            {proposal.format ? `${proposal.format}, ` : ""}proposta da {shortName(creator, data.players)}
            {proposal.note ? `. ${proposal.note}` : ""}
          </p>
        </div>
        <WeatherChip at={proposal.startsAt} className="shrink-0" />
      </div>

      <div className="flex items-center gap-3">
        {yes.length ? <AvatarStack players={yes} size={compact ? 28 : 32} /> : null}
        <p className="text-[14px]">
          <span className={clsx("num-wide font-bold", full && "text-ball")}>{yes.length}</span>
          <span className="text-muted">
            {" "}
            di {needed} {full ? ": si gioca!" : `per ${proposal.format ? `il ${proposal.format}` : "giocare"}`}
          </span>
          {maybe.length > 0 && <span className="text-muted">, {maybe.length} forse</span>}
        </p>
      </div>

      <div className="flex gap-2" role="group" aria-label="La tua risposta">
        {RESPONSES.map((r) => (
          <button
            key={r.value}
            aria-pressed={mine === r.value}
            onClick={() => void respond(proposal, r.value)}
            className={clsx(
              "h-11 flex-1 rounded-[14px] text-[14px] font-semibold transition-colors active:scale-[0.97]",
              mine === r.value
                ? r.value === "si"
                  ? "bg-ball text-ball-ink"
                  : "bg-text text-bg"
                : "bg-raised text-text ring-1 ring-line ring-inset",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {!compact && (isToday || full || canCancel) && (
        <div className="flex gap-2">
          {(isToday || full) && yes.length >= 2 && (
            <Link
              href={teamsHref}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[14px] bg-text text-[14px] font-semibold text-bg"
            >
              <Shuffle size={17} /> Fai le squadre
            </Link>
          )}
          {canCancel &&
            (confirmCancel ? (
              <button
                className="h-11 flex-1 rounded-[14px] bg-raised text-[14px] font-semibold text-danger ring-1 ring-line ring-inset"
                onClick={async () => {
                  mutate((d) => ({ ...d, proposals: d.proposals.filter((x) => x.id !== proposal.id) }));
                  try {
                    await backend.cancelProposal(proposal.id);
                    toast("Proposta annullata");
                  } catch (e) {
                    toast((e as Error).message, "error");
                  }
                }}
              >
                Conferma annullamento
              </button>
            ) : (
              <button
                aria-label="Annulla la proposta"
                className="grid h-11 w-11 place-items-center rounded-[14px] bg-raised text-muted ring-1 ring-line ring-inset"
                onClick={() => setConfirmCancel(true)}
              >
                <X size={18} />
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
