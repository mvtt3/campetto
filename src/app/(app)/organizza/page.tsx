"use client";

import clsx from "clsx";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ProposalCard, useRespond } from "@/components/proposal-card";
import { Button, Card, EmptyState, ScreenHeader, Segmented } from "@/components/ui/basics";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { DayStrip, dayLabel, TimeField } from "@/components/ui/pickers";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useData } from "@/lib/data/provider";
import { FORMATS, type Format } from "@/lib/types";
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

function NewProposalSheet({ open, onClose, initialDay }: { open: boolean; onClose: () => void; initialDay: Date }) {
  const { backend, refresh, mutate, me } = useData();
  const toast = useToast();
  const [day, setDay] = useState(() => localIso(initialDay < new Date(new Date().setHours(0, 0, 0, 0)) ? new Date() : initialDay));
  const [time, setTime] = useState("18:00");
  const [format, setFormat] = useState<Format | "any">("any");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Da oggi a sei settimane avanti (o oltre il giorno scelto nel calendario).
  const days = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const span = Math.max(42, Math.round((initialDay.getTime() - start.getTime()) / 86_400_000) + 14);
    return Array.from({ length: span }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));
  }, [initialDay]);

  const submit = async () => {
    const [h, m] = time.split(":").map(Number);
    const [y, mo, d] = day.split("-").map(Number);
    const startsAt = new Date(y, mo - 1, d, h, m);
    if (startsAt.getTime() < Date.now() - 60 * 60_000) return toast("Questo orario è già passato: scegline uno più avanti", "error");
    setBusy(true);
    try {
      const input = { startsAt: startsAt.toISOString(), format: format === "any" ? null : format, note: note.trim() || null };
      const id = await backend.createProposal(input);
      void backend.notify({ type: "proposal_new", proposalId: id });
      // Compare subito nel calendario: i dati del server arrivano dopo, senza farti aspettare.
      if (me) {
        const now = new Date().toISOString();
        mutate((d) =>
          d.proposals.some((p) => p.id === id)
            ? d
            : { ...d, proposals: [...d.proposals, { id, ...input, createdBy: me.id, status: "aperta", createdAt: now, responses: [{ playerId: me.id, response: "si", updatedAt: now }] }] },
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
      description="Tutti ricevono una notifica e rispondono con un tocco"
      footer={
        <Button variant="primary" block onClick={submit} disabled={busy}>
          {busy ? "Invio…" : "Proponi"}
        </Button>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <section>
          <h3 className="mb-2 flex items-baseline justify-between text-[13px] font-semibold text-muted">
            Giorno <span className="text-[14px] font-bold text-text">{dayLabel(day)}</span>
          </h3>
          <DayStrip value={day} onChange={setDay} min={days[0]} max={days[days.length - 1]} newestFirst={false} />
        </section>
        <section>
          <h3 className="mb-2 text-[13px] font-semibold text-muted">Ora</h3>
          <TimeField value={time} onChange={setTime} />
        </section>
        <section>
          <h3 className="mb-2 text-[13px] font-semibold text-muted">Formato</h3>
          <Segmented
            value={format}
            onChange={setFormat}
            options={[{ value: "any" as const, label: "Libero" }, ...FORMATS.map((f) => ({ value: f, label: f }))]}
          />
        </section>
        <section>
          <label htmlFor="note" className="mb-2 block text-[13px] font-semibold text-muted">
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
  const [weekStart, setWeekStart] = useState(() => startOfWeek(selected ?? new Date()));
  const creating = params.get("nuova") === "1";
  const respond = useRespond();
  const handled = useRef(false);

  // Risposta arrivata dai pulsanti della notifica (?p=ID&r=si).
  useEffect(() => {
    const pid = params.get("p");
    const r = params.get("r");
    if (handled.current || !pid || !r || !["si", "forse", "no"].includes(r)) return;
    const prop = data.proposals.find((x) => x.id === pid);
    if (!prop) return;
    handled.current = true;
    void respond(prop, r as "si" | "forse" | "no");
    router.replace("/organizza");
  }, [params, data.proposals, respond, router]);

  const open = data.proposals.filter((p) => p.status === "aperta");
  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i));
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
  const today = useNow();
  const thisWeek = sameDay(weekStart, startOfWeek(today));

  const list = open
    .filter((p) => {
      const d = new Date(p.startsAt);
      if (selected) return sameDay(d, selected);
      return d >= weekStart && d < weekEnd && d.getTime() > today.getTime() - 3 * 3_600_000;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return (
    <>
      <ScreenHeader
        title="Calendario"
        back="/"
        action={
          <button
            onClick={() => router.push("/organizza?nuova=1")}
            aria-label="Proponi una partita"
            className="sticker press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ball text-ball-ink"
          >
            <Plus size={22} strokeWidth={2.8} />
          </button>
        }
      />
      <div className="shrink-0 px-4 pb-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            aria-label="Settimana precedente"
            disabled={thisWeek}
            onClick={() => {
              setSelected(null);
              setWeekStart(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - 7));
            }}
            className="grid h-10 w-10 place-items-center rounded-full active:bg-raised disabled:opacity-25"
          >
            <ChevronLeft size={20} />
          </button>
          <p className="title text-[17px]">
            {thisWeek ? "Questa settimana" : `Dal ${days[0].toLocaleDateString("it-IT", { day: "numeric", month: "long" })}`}
          </p>
          <button
            aria-label="Settimana successiva"
            onClick={() => {
              setSelected(null);
              setWeekStart(weekEnd);
            }}
            className="grid h-10 w-10 place-items-center rounded-full active:bg-raised"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const count = open.filter((p) => sameDay(new Date(p.startsAt), d)).length;
            const isSel = selected && sameDay(selected, d);
            const past = d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelected(isSel ? null : d)}
                aria-pressed={Boolean(isSel)}
                className={clsx(
                  "flex h-[62px] flex-col items-center justify-center rounded-2xl",
                  isSel ? "bg-text text-bg" : sameDay(d, today) ? "bg-ball-soft ring-1 ring-ball/40 ring-inset" : "card",
                  past && !isSel && "opacity-45",
                )}
              >
                <span className="sr-only">
                  {d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric" })}
                  {count ? `, ${count} ${count === 1 ? "proposta" : "proposte"}` : ""}
                </span>
                <span className="text-[11px] font-semibold opacity-70" aria-hidden>
                  {d.toLocaleDateString("it-IT", { weekday: "narrow" })}
                </span>
                <span className="num text-[20px]" aria-hidden>
                  {d.getDate()}
                </span>
                <span className={clsx("mt-0.5 h-1.5 w-1.5 rounded-full", count ? (isSel ? "bg-bg" : "bg-ball") : "bg-transparent")} />
              </button>
            );
          })}
        </div>
      </div>
      <PullToRefresh className="px-4 pb-4">
        {list.length === 0 ? (
          <EmptyState
            title={selected ? "Nessuna partita in questo giorno" : "Nessuna partita in programma"}
            text="Proponi un giorno e un orario: arriva una notifica a tutti"
            action={
              <Button variant="primary" onClick={() => router.push("/organizza?nuova=1")}>
                Proponi una partita
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {list.map((p) => (
              <Card key={p.id} className="p-4">
                <ProposalCard proposal={p} />
              </Card>
            ))}
          </div>
        )}
      </PullToRefresh>
      {creating && <NewProposalSheet open onClose={() => router.replace("/organizza")} initialDay={selected ?? today} />}
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
