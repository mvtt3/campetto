"use client";

import clsx from "clsx";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconChevronLeft,
  IconChevronRight,
  IconMapPin,
  IconPlus,
  IconX,
} from "@tabler/icons-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RainedOut } from "@/components/rained-out";
import { ProposalCard, useRespond } from "@/components/proposal-card";
import { StatsComing } from "@/components/stats-coming";
import { neededPlayers } from "@/lib/notifications/grouping";
import { proposalPhase, rainedOutVisible } from "@/lib/proposals";
import {
  Button,
  Card,
  EmptyState,
  Segmented,
} from "@/components/ui/basics";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { DayStrip, dayLabel, TimeField } from "@/components/ui/pickers";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useData } from "@/lib/data/provider";
import { FORMATS, PLACES, isPlace, type Format, type Place } from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { say } from "@/lib/voice";

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const localIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const LABEL =
  "mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted";

const PLACE_KEY = "campetto:ultimo-campetto";
/** L'ultima via usata per Indoor: di solito la palestra è sempre quella. */
const ADDRESS_KEY = "campetto:via-indoor";

function NewProposalSheet({
  open,
  onClose,
  initialDay,
}: {
  open: boolean;
  onClose: () => void;
  initialDay: Date;
}) {
  const { backend, refresh, mutate, me } = useData();
  const toast = useToast();
  const [day, setDay] = useState(() =>
    localIso(
      initialDay < new Date(new Date().setHours(0, 0, 0, 0))
        ? new Date()
        : initialDay,
    ),
  );
  const [time, setTime] = useState("18:00");
  const [format, setFormat] = useState<Format | "any">("any");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // Il campetto: si riparte dall'ultimo scelto, quasi sempre è quello.
  const [place, setPlace] = useState<Place>(() => {
    try {
      const v = localStorage.getItem(PLACE_KEY);
      return isPlace(v) ? v : "niche";
    } catch {
      return "niche";
    }
  });
  const [address, setAddress] = useState(() => {
    try {
      return localStorage.getItem(ADDRESS_KEY) ?? "";
    } catch {
      return "";
    }
  });

  // Da oggi a sei settimane avanti (o oltre il giorno scelto nel calendario).
  const days = useMemo(() => {
    const today = new Date();
    const start = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const span = Math.max(
      42,
      Math.round((initialDay.getTime() - start.getTime()) / 86_400_000) + 14,
    );
    return Array.from(
      { length: span },
      (_, i) =>
        new Date(today.getFullYear(), today.getMonth(), today.getDate() + i),
    );
  }, [initialDay]);

  const submit = async () => {
    const [h, m] = time.split(":").map(Number);
    const [y, mo, d] = day.split("-").map(Number);
    const startsAt = new Date(y, mo - 1, d, h, m);
    if (startsAt.getTime() < Date.now() - 60 * 60_000)
      return toast(
        "Questo orario è già passato: scegline uno più avanti",
        "error",
      );
    setBusy(true);
    try {
      const input = {
        startsAt: startsAt.toISOString(),
        format: format === "any" ? null : format,
        note: note.trim() || null,
        place,
        address: place === "indoor" ? address.trim().slice(0, 120) || null : null,
      };
      try {
        localStorage.setItem(PLACE_KEY, place);
        if (input.address) localStorage.setItem(ADDRESS_KEY, input.address);
      } catch {
        /* ignore */
      }
      const id = await backend.createProposal(input);
      void backend.notify({ type: "proposal_new", proposalId: id });
      // Compare subito nel calendario: i dati del server arrivano dopo, senza farti aspettare.
      if (me) {
        const now = new Date().toISOString();
        mutate((d) =>
          d.proposals.some((p) => p.id === id)
            ? d
            : {
                ...d,
                proposals: [
                  ...d.proposals,
                  {
                    id,
                    ...input,
                    createdBy: me.id,
                    status: "aperta",
                    createdAt: now,
                    responses: [
                      { playerId: me.id, response: "si", updatedAt: now },
                    ],
                  },
                ],
              },
        );
      }
      void refresh();
      toast("Fatto, ho avvisato tutti");
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
      title="Proponi una partita"
      description="Arriva una notifica a tutti"
      footer={
        <Button variant="primary" block onClick={submit} disabled={busy}>
          {busy ? "Invio…" : "Proponi"}
        </Button>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <section>
          <h3 className={`${LABEL} flex items-baseline justify-between`}>
            Giorno{" "}
            <span className="text-[13px] font-semibold normal-case tracking-normal text-text">
              {dayLabel(day)}
            </span>
          </h3>
          <DayStrip
            value={day}
            onChange={setDay}
            min={days[0]}
            max={days[days.length - 1]}
            newestFirst={false}
          />
        </section>
        <section>
          <h3 className={LABEL}>Ora</h3>
          <TimeField value={time} onChange={setTime} />
        </section>
        <section>
          <h3 className={LABEL}>Dove</h3>
          <Segmented
            value={place}
            onChange={setPlace}
            options={PLACES.map((x) => ({ value: x.value, label: x.label }))}
          />
          {place === "indoor" && (
            <div className="fade-in mt-2 flex h-12 items-center gap-2 rounded-2xl bg-raised pl-3.5 pr-1.5 focus-within:ring-2 focus-within:ring-ball">
              <IconMapPin size={18} strokeWidth={2.4} className="shrink-0 text-ball" aria-hidden />
              <input
                aria-label="Via della palestra"
                value={address}
                maxLength={120}
                autoComplete="street-address"
                enterKeyHint="done"
                onChange={(e) => setAddress(e.target.value)}
                style={{ outline: "none" }}
                placeholder="Via della palestra, es. Via Torino 12"
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint focus-visible:outline-none"
              />
              {address && (
                <button
                  type="button"
                  onClick={() => setAddress("")}
                  aria-label="Cancella la via"
                  className="press grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted"
                >
                  <IconX size={17} />
                </button>
              )}
            </div>
          )}
        </section>
        <section>
          <h3 className={LABEL}>Formato</h3>
          <Segmented
            value={format}
            onChange={setFormat}
            options={[
              { value: "any" as const, label: "Libero" },
              ...FORMATS.map((f) => ({ value: f, label: f })),
            ]}
          />
        </section>
        <section>
          <label
            htmlFor="note"
            className={`${LABEL} block`}
          >
            Nota
          </label>
          <input
            id="note"
            value={note}
            maxLength={140}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Facoltativa, es. porto io il pallone"
            className="h-12 w-full rounded-2xl bg-raised px-4 text-[15px] outline-none placeholder:text-faint"
          />
        </section>
      </div>
    </Sheet>
  );
}

function OrganizeInner() {
  const { data } = useData();
  const router = useRouter();
  const params = useSearchParams();
  // ?giorno=AAAA-MM-GG apre il calendario già su quel giorno (dalla Home).
  const [selected, setSelected] = useState<Date | null>(() => {
    const g = params.get("giorno")?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return g ? new Date(+g[1], +g[2] - 1, +g[3]) : null;
  });
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(selected ?? new Date()),
  );
  const creating = params.get("nuova") === "1";
  const respond = useRespond();
  const handled = useRef(false);

  // Risposta arrivata dai pulsanti della notifica (?p=ID&r=si).
  useEffect(() => {
    const pid = params.get("p");
    const r = params.get("r");
    if (handled.current || !pid || !r || !["si", "forse", "no"].includes(r))
      return;
    const prop = data.proposals.find((x) => x.id === pid);
    if (!prop) return;
    handled.current = true;
    void respond(prop, r as "si" | "forse" | "no");
    router.replace("/organizza");
  }, [params, data.proposals, respond, router]);

  // ?p=ID senza risposta: si evidenzia quella proposta (dagli annunci e dalle notizie).
  const focus = params.get("r") ? null : params.get("p");
  const scrolled = useRef(false);
  const scrollOnce = useCallback((el: HTMLDivElement | null) => {
    if (!el || scrolled.current) return;
    scrolled.current = true;
    window.setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
  }, []);

  const today = useNow();
  // Una partita finita (o mai confermata e ormai iniziata) esce dal calendario: si torna a proporre.
  // Annullata per pioggia: resta quel giorno e la notte fino alle 2, con Spicchio sotto la nuvola.
  const open = data.proposals.filter(
    (p) =>
      (p.status === "aperta" &&
        proposalPhase(p, today, neededPlayers(p.format)) !== "over") ||
      rainedOutVisible(p, today),
  );
  const days = Array.from(
    { length: 7 },
    (_, i) =>
      new Date(
        weekStart.getFullYear(),
        weekStart.getMonth(),
        weekStart.getDate() + i,
      ),
  );
  const weekEnd = new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate() + 7,
  );
  const thisWeek = sameDay(weekStart, startOfWeek(today));

  const list = open
    .filter((p) => {
      const d = new Date(p.startsAt);
      if (selected) return sameDay(d, selected);
      return (
        d >= weekStart &&
        d < weekEnd &&
        (p.status === "annullata" ||
          d.getTime() > today.getTime() - 3 * 3_600_000)
      );
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return (
    <>
      <h1 className="sr-only">Calendario</h1>
      <div className="safe-top shrink-0 px-5 pb-4 pt-5">
        <div className="mb-3 flex items-center justify-between">
          <button
            aria-label="Settimana precedente"
            disabled={thisWeek}
            onClick={() => {
              setSelected(null);
              setWeekStart(
                new Date(
                  weekStart.getFullYear(),
                  weekStart.getMonth(),
                  weekStart.getDate() - 7,
                ),
              );
            }}
            className="press grid h-10 w-10 place-items-center rounded-full bg-surface shadow-[var(--shadow)] disabled:opacity-30"
          >
            <IconChevronLeft size={20} />
          </button>
          <p className="title text-[17px]">
            {thisWeek
              ? "Questa settimana"
              : `Dal ${days[0].toLocaleDateString("it-IT", { day: "numeric", month: "long" })}`}
          </p>
          <button
            aria-label="Settimana successiva"
            onClick={() => {
              setSelected(null);
              setWeekStart(weekEnd);
            }}
            className="press grid h-10 w-10 place-items-center rounded-full bg-surface shadow-[var(--shadow)]"
          >
            <IconChevronRight size={20} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const count = open.filter((p) =>
              sameDay(new Date(p.startsAt), d),
            ).length;
            const isSel = selected && sameDay(selected, d);
            const past =
              d <
              new Date(today.getFullYear(), today.getMonth(), today.getDate());
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelected(isSel ? null : d)}
                aria-pressed={Boolean(isSel)}
                className={clsx(
                  "press flex h-[64px] flex-col items-center justify-center rounded-[18px] transition-colors",
                  isSel
                    ? "bg-text text-bg shadow-[var(--shadow)]"
                    : sameDay(d, today)
                      ? "bg-ball-soft"
                      : "bg-surface",
                  past && !isSel && "opacity-45",
                )}
              >
                <span className="sr-only">
                  {d.toLocaleDateString("it-IT", {
                    weekday: "long",
                    day: "numeric",
                  })}
                  {count
                    ? `, ${count} ${count === 1 ? "proposta" : "proposte"}`
                    : ""}
                </span>
                <span
                  className="text-[11px] font-semibold opacity-70"
                  aria-hidden
                >
                  {d.toLocaleDateString("it-IT", { weekday: "narrow" })}
                </span>
                <span className="num text-[20px]" aria-hidden>
                  {d.getDate()}
                </span>
                <span
                  className={clsx(
                    "mt-0.5 h-1.5 w-1.5 rounded-full",
                    count ? "bg-ball" : "bg-transparent",
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>
      <PullToRefresh className="px-5 pb-6">
        {/* Senza partite in lista sta in cima, così si vede anche sui telefoni piccoli. */}
        {list.length === 0 && <StatsComing first />}
        {list.length === 0 ? (
          <EmptyState
            title={
              selected
                ? "Nessuna partita in questo giorno"
                : "Nessuna partita in programma"
            }
            text="Proponi un giorno e un orario: arriva una notifica a tutti"
          />
        ) : (
          <div className="flex flex-col gap-3">
            {list.map((p) =>
              p.status === "annullata" ? (
                // Saltata per pioggia: la scheda ha già il suo fondo, niente riquadro attorno.
                <div
                  key={p.id}
                  className={clsx(p.id === focus && "focus-pulse")}
                  ref={p.id === focus ? scrollOnce : undefined}
                  data-focus={p.id === focus || undefined}
                >
                  <RainedOut proposal={p} />
                </div>
              ) : (
                <Card
                  key={p.id}
                  className={clsx("p-4", p.id === focus && "focus-pulse")}
                  // Arrivati da un avviso: la proposta giusta, al centro, pronta per "Ci sono".
                  ref={p.id === focus ? scrollOnce : undefined}
                  data-focus={p.id === focus || undefined}
                >
                  <ProposalCard proposal={p} />
                </Card>
              ),
            )}
          </div>
        )}
        <button
          onClick={() => router.push("/organizza?nuova=1")}
          className="card press mt-3 flex w-full items-center gap-3.5 p-3 text-left"
        >
          <span className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-[18px] bg-ball text-ball-ink">
            <IconPlus size={24} strokeWidth={2.6} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="title block text-[16px]">Proponi una partita</span>
            <span className="block truncate text-[13px] text-muted">
              {selected ? dayLabel(localIso(selected)) : "Scegli giorno e orario"}
            </span>
          </span>
          <IconChevronRight size={20} className="shrink-0 text-faint" aria-hidden />
        </button>
        {list.length > 0 && <StatsComing />}
      </PullToRefresh>
      {creating && (
        <NewProposalSheet
          open
          onClose={() => router.replace("/organizza")}
          initialDay={selected ?? today}
        />
      )}
    </>
  );
}

export default function OrganizePage() {
  return (
    <Suspense>
      <OrganizeInner />
    </Suspense>
  );
}
