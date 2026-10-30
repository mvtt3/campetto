"use client";

import clsx from "clsx";
import { useState } from "react";
import { AvatarStack } from "./ui/avatar";
import { Button, Segmented } from "./ui/basics";
import { TimeField } from "./ui/pickers";
import { useToast } from "./ui/toast";
import { useData } from "@/lib/data/provider";
import {
  PLACES,
  shortName,
  type Place,
  type Player,
  type Proposal,
} from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { say } from "@/lib/voice";

/**
 * Chi c'è, chi forse, chi no e chi deve ancora rispondere: una riga per gruppo, con le facce e
 * i nomi, come gli inviti delle app di oggi. Sta tutto nella scheda, senza scorrere.
 */
export function RosterPanel({ proposal }: { proposal: Proposal }) {
  const { data, me } = useData();
  const byId = new Map(data.players.map((p) => [p.id, p]));
  const by = (k: "si" | "forse" | "no") =>
    proposal.responses
      .filter((r) => r.response === k)
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .map((r) => byId.get(r.playerId))
      .filter((p): p is Player => Boolean(p));
  const answered = new Set(proposal.responses.map((r) => r.playerId));
  const waiting = data.players.filter(
    (p) => !p.archived && !answered.has(p.id),
  );
  const groups: {
    title: string;
    short: string;
    players: Player[];
    tone: string;
  }[] = [
    {
      title: "Ci sono",
      short: "Ci sono",
      players: by("si"),
      tone: "bg-volt text-volt-ink",
    },
    {
      title: "Forse",
      short: "Forse",
      players: by("forse"),
      tone: "bg-court text-court-ink",
    },
    {
      title: "Non ci sono",
      short: "No",
      players: by("no"),
      tone: "bg-raised text-text",
    },
    {
      title: "Non hanno ancora risposto",
      short: "In attesa",
      players: waiting,
      tone: "bg-raised text-muted",
    },
  ];
  const name = (p: Player) =>
    p.id === me?.id ? "Tu" : shortName(p, data.players);
  return (
    <div
      className="flex flex-col gap-1.5 border-t-2 border-dashed border-line-strong pt-2.5"
      aria-label="Chi c'è"
      role="group"
    >
      {groups
        .filter((g) => g.players.length)
        .map((g) => (
          <section
            key={g.title}
            aria-label={g.title}
            className="flex min-w-0 items-center gap-2"
          >
            <span
              className={clsx(
                "flex h-6 w-[86px] shrink-0 items-center justify-between rounded-full border-2 border-edge pl-2 pr-1.5 text-[11.5px] font-bold",
                g.tone,
              )}
            >
              {g.short}
              <span className="tnum">{g.players.length}</span>
            </span>
            <AvatarStack players={g.players} size={22} max={4} />
            <p className="min-w-0 flex-1 truncate text-[12.5px] text-muted">
              {g.players.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && ", "}
                  <span
                    className={clsx(
                      "font-semibold",
                      p.id === me?.id ? "text-court" : "text-text",
                    )}
                  >
                    {name(p)}
                  </span>
                </span>
              ))}
            </p>
          </section>
        ))}
    </div>
  );
}

/**
 * Un altro orario o l'altro campetto, sempre lo stesso giorno. Per chi ha detto "ci sono" è una
 * controproposta (la vede chi ha proposto); per chi l'ha proposta sposta subito la partita.
 */
export function AltForm({
  proposal,
  mode,
  onClose,
}: {
  proposal: Proposal;
  mode: "alt" | "move";
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
    <div
      className="flex flex-col gap-3 rounded-[20px] border-2 border-edge bg-raised p-3"
      role="group"
      aria-label={
        mode === "move" ? "Sposta la partita" : "Proponi un'alternativa"
      }
    >
      <p className="text-[13px] font-semibold text-muted">
        {mode === "move"
          ? "Stesso giorno: cambia orario, campetto o tutti e due. Avviso io chi c'è"
          : `Stesso giorno: un altro orario, l'altro campetto o tutti e due. Lo dico a ${shortName(creator, data.players)}`}
      </p>
      <TimeField value={time} onChange={setTime} />
      <Segmented
        value={place}
        onChange={setPlace}
        options={PLACES.map((x) => ({ value: x.value, label: x.label }))}
      />
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onClose} className="flex-1">
          Chiudi
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          onClick={submit}
          disabled={busy || unchanged || past}
        >
          {busy
            ? "Invio…"
            : past
              ? "Già passato"
              : mode === "move"
                ? "Sposta"
                : "Proponi"}
        </Button>
      </div>
    </div>
  );
}
