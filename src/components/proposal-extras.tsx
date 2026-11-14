"use client";

import clsx from "clsx";
import { useState } from "react";
import { IconChevronDown, IconPlus } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { Avatar, AvatarStack } from "./ui/avatar";
import { Button, Segmented } from "./ui/basics";
import { TimeField } from "./ui/pickers";
import { Sheet } from "./ui/sheet";
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
 * i nomi. Sta tutto nella scheda, senza scorrere.
 */
export function RosterPanel({ proposal }: { proposal: Proposal }) {
  const { data, me } = useData();
  const byId = new Map(
    [...data.players, ...(data.extras ?? [])].map((p) => [p.id, p]),
  );
  const addedBy = new Map(
    proposal.responses.map((r) => [r.playerId, r.addedBy ?? null]),
  );
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
      tone: "bg-volt",
    },
    {
      title: "Forse",
      short: "Forse",
      players: by("forse"),
      tone: "bg-ball",
    },
    {
      title: "Non ci sono",
      short: "No",
      players: by("no"),
      tone: "bg-danger",
    },
    {
      title: "Non hanno ancora risposto",
      short: "In attesa",
      players: waiting,
      tone: "bg-line-strong",
    },
  ];
  const name = (p: Player) =>
    p.id === me?.id ? "Tu" : shortName(p, data.players);
  const [open, setOpen] = useState<string | null>(null);
  const now = useNow();
  const canBring =
    !!me &&
    proposal.status === "aperta" &&
    new Date(proposal.startsAt).getTime() > now.getTime() - 3 * 3600e3;
  return (
    <div className="flex flex-col gap-1.5" aria-label="Chi c'è" role="group">
      {groups
        .filter((g) => g.players.length)
        .map((g) => {
          const isOpen = open === g.title;
          return (
            <section key={g.title} aria-label={g.title} className="min-w-0">
              {/* Un tocco sulla riga e si aprono tutti i nomi, per intero; un altro la richiude. */}
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : g.title)}
                className="press -mx-1 flex w-[calc(100%+0.5rem)] min-w-0 items-center gap-2 rounded-full px-1 py-0.5 text-left"
              >
                <span className="flex w-[100px] shrink-0 items-center gap-2 whitespace-nowrap text-[12.5px] font-semibold">
                  <span
                    className={clsx("h-2 w-2 shrink-0 rounded-full", g.tone)}
                  />
                  {g.short}
                  <span className="tnum ml-auto pr-1 text-muted">
                    {g.players.length}
                  </span>
                </span>
                <AvatarStack players={g.players} size={22} max={4} />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted">
                  {g.players.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && ", "}
                      <span
                        className={clsx(
                          "font-semibold",
                          p.id === me?.id ? "text-ball" : "text-text",
                        )}
                      >
                        {name(p)}
                      </span>
                    </span>
                  ))}
                </span>
                <IconChevronDown
                  size={15}
                  className={clsx(
                    "shrink-0 text-faint transition-transform duration-200",
                    isOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.ul
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                    className="flex flex-wrap gap-1.5 overflow-hidden pl-1 pt-1.5"
                  >
                    {g.players.map((p) => (
                      <li
                        key={p.id}
                        className={clsx(
                          "flex items-center gap-1.5 rounded-full border border-line bg-surface py-0.5 pl-0.5 pr-2.5 text-[13px] font-semibold",
                          p.id === me?.id && "!border-ball bg-ball-soft",
                        )}
                      >
                        <Avatar player={p} size={22} href={false} ring="none" />
                        {name(p)}
                        {p.extra && (
                          <ExtraTag
                            by={
                              addedBy.get(p.id)
                                ? byId.get(addedBy.get(p.id)!)
                                : undefined
                            }
                          />
                        )}
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </section>
          );
        })}
      {canBring && <BringExtra proposal={proposal} />}
    </div>
  );
}

function ExtraTag({ by }: { by?: Player }) {
  return (
    <span className="rounded-full bg-raised px-1.5 py-[1px] text-[10.5px] font-bold text-muted">
      extra{by ? ` · di ${shortName(by)}` : ""}
    </span>
  );
}

function BringExtra({ proposal }: { proposal: Proposal }) {
  const { data, me, backend, mutate, refresh } = useData();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const extras = data.extras ?? [];
  const inIds = new Set(
    proposal.responses
      .filter((r) => r.response === "si")
      .map((r) => r.playerId),
  );

  const setIn = async (playerId: string, on: boolean, extra?: Player) => {
    if (!me) return;
    mutate((d) => ({
      ...d,
      extras:
        extra && !(d.extras ?? []).some((x) => x.id === extra.id)
          ? [...(d.extras ?? []), extra]
          : d.extras,
      proposals: d.proposals.map((x) =>
        x.id !== proposal.id
          ? x
          : {
              ...x,
              responses: [
                ...x.responses.filter((r) => r.playerId !== playerId),
                ...(on
                  ? [
                      {
                        playerId,
                        response: "si" as const,
                        updatedAt: new Date().toISOString(),
                        addedBy: me.id,
                      },
                    ]
                  : []),
              ],
            },
      ),
    }));
    await backend.respondFor(proposal.id, playerId, on ? "si" : null);
  };

  const toggle = async (p: Player) => {
    const on = !inIds.has(p.id);
    try {
      await setIn(p.id, on);
      if (on) toast(`${shortName(p)} c'è`, "ok");
    } catch (e) {
      toast(say(e), "error");
    }
  };
  const create = async () => {
    const n = name.trim().replace(/\s+/g, " ");
    if (!n || busy || !me) return;
    const same = extras.find(
      (x) => shortName(x).toLowerCase() === n.toLowerCase(),
    );
    if (same) {
      setName("");
      setOpen(false);
      if (!inIds.has(same.id)) void toggle(same);
      return;
    }
    setBusy(true);
    try {
      const id = await backend.createExtra(n);
      const p: Player = {
        id,
        firstName: n,
        lastName: null,
        nickname: null,
        roles: [],
        jerseyNumber: null,
        cardColor: null,
        avatarUrl: null,
        character: null,
        userId: null,
        isAdmin: false,
        showcase: [],
        notifyPrefs: me.notifyPrefs,
        archived: false,
        createdAt: new Date().toISOString(),
        extra: true,
        extraBy: me.id,
      };
      await setIn(id, true, p);
      setName("");
      setOpen(false);
      toast(`${n} c'è`, "ok");
      void refresh();
    } catch (e) {
      toast(say(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const clean = name.trim().replace(/\s+/g, " ");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press -mx-1 flex w-[calc(100%+0.5rem)] items-center gap-2 rounded-full px-1 py-0.5 text-left text-[12.5px] font-semibold text-muted"
        data-testid="porta-extra"
      >
        <span className="flex w-[100px] shrink-0 items-center gap-2">
          <IconPlus size={12} strokeWidth={3} aria-hidden />
          Extra
        </span>
        <span className="truncate">Porta chi gioca senza l&apos;app</span>
      </button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Porta un extra"
        description="Gioca e ha il suo tabellino, ma non entra in classifiche e record"
        footer={
          <Button
            block
            variant="primary"
            disabled={!clean || busy}
            onClick={() => void create()}
          >
            {clean ? `Porta ${clean}` : "Scrivi il suo nome"}
          </Button>
        }
      >
        <form
          className="flex flex-col gap-4 pb-1 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <input
            aria-label="Nome dell'extra"
            value={name}
            maxLength={24}
            autoCapitalize="words"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="Il suo nome"
            onChange={(e) => setName(e.target.value)}
            className="sticker-sm h-14 w-full rounded-[18px] bg-surface px-4 text-center text-[20px] font-semibold outline-none placeholder:text-faint focus-visible:ring-4 focus-visible:ring-court/30"
          />
          {extras.length > 0 && (
            <section aria-label="Già venuti">
              <p className="mb-2 text-[13px] font-semibold text-muted">
                Già venuti
              </p>
              <ul className="flex flex-col gap-2">
                {extras.map((p) => {
                  const on = inIds.has(p.id);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => void toggle(p)}
                        className="press sticker-sm flex h-14 w-full items-center gap-3 rounded-[18px] bg-surface px-2.5 text-left"
                      >
                        <Avatar player={p} size={36} href={false} ring="none" />
                        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                          {shortName(p)}
                        </span>
                        <span
                          className={clsx(
                            "rounded-full px-3 py-1 text-[13px] font-bold",
                            on ? "bg-text text-bg" : "bg-raised text-muted",
                          )}
                        >
                          {on ? "C'è" : "Porta"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </form>
      </Sheet>
    </>
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
      className="flex flex-col gap-3 rounded-[18px] border border-line p-3"
      role="group"
      aria-label={
        mode === "move" ? "Sposta la partita" : "Proponi un'alternativa"
      }
    >
      <p className="text-[13px] font-semibold text-muted">
        {mode === "move"
          ? "Stesso giorno, avviso io chi c'è"
          : `Stesso giorno, lo dico a ${shortName(creator, data.players)}`}
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
