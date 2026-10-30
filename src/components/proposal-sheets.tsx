"use client";

import clsx from "clsx";
import { useState } from "react";
import { Avatar } from "./ui/avatar";
import { Button, Segmented } from "./ui/basics";
import { TimeField } from "./ui/pickers";
import { Sheet } from "./ui/sheet";
import { useToast } from "./ui/toast";
import { useData } from "@/lib/data/provider";
import { altLabel } from "@/lib/proposals";
import {
  PLACES,
  shortName,
  type Place,
  type Player,
  type Proposal,
} from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { say } from "@/lib/voice";

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Chi c'è, chi forse, chi no e chi deve ancora rispondere: tutti i nomi in un colpo d'occhio,
 * come gli inviti delle app di oggi. Accanto a chi ha una controproposta, cosa preferisce.
 */
export function RosterSheet({
  proposal,
  open,
  onClose,
}: {
  proposal: Proposal;
  open: boolean;
  onClose: () => void;
}) {
  const { data, me } = useData();
  const byId = new Map(data.players.map((p) => [p.id, p]));
  const by = (k: "si" | "forse" | "no") =>
    proposal.responses
      .filter((r) => r.response === k)
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  const answered = new Set(proposal.responses.map((r) => r.playerId));
  const waiting = data.players.filter(
    (p) => !p.archived && !answered.has(p.id),
  );
  const groups: {
    title: string;
    rows: { player: Player | undefined; hint?: string }[];
    tone: string;
  }[] = [
    {
      title: "Ci sono",
      tone: "bg-volt text-volt-ink",
      rows: by("si").map((r) => ({
        player: byId.get(r.playerId),
        hint:
          r.altStartsAt || r.altPlace
            ? `preferisce: ${altLabel(proposal, {
                startsAt: r.altStartsAt ?? proposal.startsAt,
                place: r.altPlace ?? proposal.place ?? null,
              }).replace(/^./, (c) => c.toLowerCase())}`
            : r.playerId === proposal.createdBy
              ? "ha proposto"
              : undefined,
      })),
    },
    {
      title: "Forse",
      tone: "bg-court text-court-ink",
      rows: by("forse").map((r) => ({ player: byId.get(r.playerId) })),
    },
    {
      title: "Non ci sono",
      tone: "bg-raised text-text",
      rows: by("no").map((r) => ({ player: byId.get(r.playerId) })),
    },
    {
      title: "Non hanno ancora risposto",
      tone: "bg-raised text-muted",
      rows: waiting.map((p) => ({ player: p })),
    },
  ];
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Chi c'è"
      description={`${hhmm(proposal.startsAt)}${proposal.place ? ` al ${PLACES.find((x) => x.value === proposal.place)?.label}` : ""}`}
    >
      <div className="flex flex-col gap-4 pb-2">
        {groups
          .filter((g) => g.rows.length)
          .map((g) => (
            <section key={g.title} aria-label={g.title}>
              <h3 className="mb-2 flex items-center gap-2 text-[13px] font-bold">
                <span
                  className={clsx(
                    "grid h-6 min-w-6 place-items-center rounded-full border-2 border-edge px-1.5 text-[12px]",
                    g.tone,
                  )}
                >
                  {g.rows.length}
                </span>
                {g.title}
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                {g.rows.map(({ player, hint }) => (
                  <li
                    key={player?.id}
                    className={clsx(
                      "flex max-w-full items-center gap-2 rounded-full border-2 border-line-strong bg-surface py-1 pl-1 pr-3",
                      player?.id === me?.id && "!border-court bg-court-soft",
                    )}
                  >
                    <Avatar
                      player={player}
                      size={28}
                      href={false}
                      ring="none"
                    />
                    <span className="min-w-0 leading-tight">
                      <span className="block truncate text-[13.5px] font-semibold">
                        {player?.id === me?.id
                          ? "Tu"
                          : shortName(player, data.players)}
                      </span>
                      {hint && (
                        <span className="block truncate text-[11px] text-muted">
                          {hint}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </div>
    </Sheet>
  );
}

/**
 * Un altro orario o l'altro campetto, sempre lo stesso giorno. Per chi ha detto "ci sono" è una
 * controproposta (la vede chi ha proposto); per chi l'ha proposta sposta subito la partita.
 */
export function AltSheet({
  proposal,
  mode,
  open,
  onClose,
}: {
  proposal: Proposal;
  mode: "alt" | "move";
  open: boolean;
  onClose: () => void;
}) {
  const { backend, me, mutate, data } = useData();
  const toast = useToast();
  const now = useNow();
  const mineAlt = proposal.responses.find((r) => r.playerId === me?.id);
  const start = new Date(
    mode === "alt" && mineAlt?.altStartsAt
      ? mineAlt.altStartsAt
      : proposal.startsAt,
  );
  const [time, setTime] = useState(
    `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
  );
  const [place, setPlace] = useState<Place>(
    (mode === "alt" ? mineAlt?.altPlace : null) ?? proposal.place ?? "niche",
  );
  const [busy, setBusy] = useState(false);
  const [h, m] = time.split(":").map(Number);
  const day = new Date(proposal.startsAt);
  const startsAt = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    h,
    m,
  );
  const sameTime = startsAt.getTime() === day.getTime();
  const samePlace = place === (proposal.place ?? null);
  const unchanged = sameTime && samePlace;
  const past = startsAt.getTime() < now.getTime();
  const creator = data.players.find((p) => p.id === proposal.createdBy);

  const submit = async () => {
    if (unchanged || past || !me) return;
    setBusy(true);
    const iso = startsAt.toISOString();
    try {
      if (mode === "move") {
        await backend.moveProposal(proposal.id, iso, place);
        mutate((d) => ({
          ...d,
          proposals: d.proposals.map((x) =>
            x.id !== proposal.id ? x : { ...x, startsAt: iso, place },
          ),
        }));
        void backend.notify({
          type: "proposal_moved",
          proposalId: proposal.id,
        });
        toast("Spostata, ho avvisato chi c'è");
      } else {
        const alt = {
          startsAt: sameTime ? null : iso,
          place: samePlace ? null : place,
        };
        await backend.setAlternative(proposal.id, alt);
        mutate((d) => ({
          ...d,
          proposals: d.proposals.map((x) =>
            x.id !== proposal.id
              ? x
              : {
                  ...x,
                  responses: x.responses.map((r) =>
                    r.playerId === me.id
                      ? { ...r, altStartsAt: alt.startsAt, altPlace: alt.place }
                      : r,
                  ),
                },
          ),
        }));
        void backend.notify({
          type: "proposal_alternative",
          proposalId: proposal.id,
        });
        toast(`Fatto, l'ho detto a ${shortName(creator, data.players)}`);
      }
      onClose();
    } catch (e) {
      toast(say(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={mode === "move" ? "Sposta la partita" : "Proponi un'alternativa"}
      description={
        mode === "move"
          ? "Stesso giorno: cambia orario, campetto o tutti e due. Avviso io chi c'è"
          : `Stesso giorno: un altro orario, l'altro campetto o tutti e due. Lo dico a ${shortName(creator, data.players)}`
      }
      footer={
        <Button
          variant="primary"
          block
          onClick={submit}
          disabled={busy || unchanged || past}
        >
          {busy
            ? "Invio…"
            : unchanged
              ? "Cambia orario o campetto"
              : past
                ? "Questo orario è già passato"
                : mode === "move"
                  ? "Sposta"
                  : "Proponi"}
        </Button>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <section>
          <h3 className="mb-2 text-[13px] font-semibold text-muted">Ora</h3>
          <TimeField value={time} onChange={setTime} />
        </section>
        <section>
          <h3 className="mb-2 text-[13px] font-semibold text-muted">Dove</h3>
          <Segmented
            value={place}
            onChange={setPlace}
            options={PLACES.map((x) => ({ value: x.value, label: x.label }))}
          />
        </section>
      </div>
    </Sheet>
  );
}
