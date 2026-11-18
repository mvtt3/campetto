"use client";

import { IconDeviceTv, IconPlayerPlayFilled } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useData } from "@/lib/data/provider";
import { STUDIO_LATEST, STUDIO_LIST } from "@/lib/studio";
import { Presenter } from "./presenter";
import { StudioShowLoader } from "./studio-show";

export interface StudioLatest {
  id: string;
  day: string;
  duration: number;
}

let cached: Promise<StudioLatest | null> | null = null;
/** La puntata più recente, se c'è (una sola richiesta per apertura dell'app). */
function loadLatest(): Promise<StudioLatest | null> {
  cached ??= fetch(STUDIO_LATEST, { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<StudioLatest>) : null))
    .catch(() => null);
  return cached;
}

/** Lo Studio è per tutti quelli del gruppo. Nei dati di prova si accende con ?studio=1 (o =popup, senza aprirlo subito). */
export function useStudioEnabled(): boolean {
  const { me, backend } = useData();
  if (!me) return false;
  if (backend.kind !== "mock") return true;
  const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("studio") : null;
  return q === "1" || q === "popup";
}

export function useStudioLatest(enabled: boolean): StudioLatest | null {
  const [latest, setLatest] = useState<StudioLatest | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void loadLatest().then((l) => alive && setLatest(l));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return latest;
}

const seenKey = "campetto:studio-visto";
/** Le puntate già aperte (prima si salvava solo l'ultima: si legge anche quel formato). */
function seenList(): string[] {
  try {
    const v = localStorage.getItem(seenKey);
    if (!v) return [];
    if (!v.startsWith("[")) return [v];
    const l: unknown = JSON.parse(v);
    return Array.isArray(l) ? l.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
export function studioSeen(id: string): boolean {
  return seenList().includes(id);
}
export function setStudioSeen(id: string) {
  try {
    localStorage.setItem(seenKey, JSON.stringify([id, ...seenList().filter((x) => x !== id)].slice(0, 40)));
  } catch {
    /* niente: al massimo ricompare */
  }
}

let listed: Promise<StudioLatest[]> | null = null;
/** L'elenco delle puntate; se non c'è ancora, almeno l'ultima. */
function loadEpisodes(): Promise<StudioLatest[]> {
  listed ??= fetch(STUDIO_LIST, { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<unknown>) : Promise.reject(new Error(String(r.status)))))
    .then((l) => (Array.isArray(l) ? (l as StudioLatest[]) : Promise.reject(new Error("elenco"))))
    .catch(() => loadLatest().then((l) => (l ? [l] : [])));
  return listed;
}

/** La puntata di una serata (giorno "aaaa-mm-gg"), se c'è e se lo Studio è visibile. */
export function useStudioEpisode(day: string): StudioLatest | null {
  const enabled = useStudioEnabled();
  const [list, setList] = useState<StudioLatest[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void loadEpisodes().then((l) => alive && setList(l));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return enabled ? (list.find((e) => e.day === day) ?? null) : null;
}

/**
 * Il segno dello Studio sulla data di una serata (come un bollino su una miniatura): dice che
 * c'è la puntata; la scheda per guardarla è in cima alla serata aperta.
 */
export function StudioDateBadge() {
  return (
    <span
      title="C'è la puntata dello Studio"
      data-testid="studio-night"
      className="studio-badge-tv pointer-events-none absolute -bottom-1.5 -right-1.5 grid h-[22px] w-[22px] place-items-center rounded-full text-volt ring-[2.5px] ring-surface"
    >
      <IconDeviceTv size={13} stroke={2.2} aria-hidden />
    </span>
  );
}

export const studioDay = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });

/** I due presentatori, piccoli, uno accanto all'altra: la copertina della puntata. */
export function StudioHosts({ size = 92 }: { size?: number }) {
  return (
    <span className="relative flex items-end" aria-hidden>
      <span style={{ width: size, marginRight: -size * 0.18 }}>
        <Presenter who="lei" />
      </span>
      <span style={{ width: size }}>
        <Presenter who="lui" />
      </span>
    </span>
  );
}

export function StudioNewsCard({ latest }: { latest: StudioLatest }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="card press relative flex w-full items-center gap-3 p-3 text-left"
        onClick={() => {
          setStudioSeen(latest.id);
          setOpen(true);
        }}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-court-soft text-court">
          <IconDeviceTv size={19} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold leading-snug">
            La puntata di {studioDay(latest.day)}
          </span>
          <span className="mt-0.5 block text-[13px] leading-snug text-muted">
            Studio Campetto: risultati, MVP e le giocate più belle
          </span>
        </span>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-court text-court-ink">
          <IconPlayerPlayFilled size={15} className="ml-px" aria-hidden />
        </span>
      </button>
      {open && <StudioShowLoader id={latest.id} onClose={() => setOpen(false)} />}
    </>
  );
}

export function StudioNightCard({ latest }: { latest: StudioLatest }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="press flex h-12 w-full items-center gap-3 rounded-[18px] bg-linear-to-br from-court to-court-deep pl-1.5 pr-4 text-left text-[14px] font-semibold text-court-ink"
        data-testid="studio-night-card"
        onClick={() => {
          setStudioSeen(latest.id);
          setOpen(true);
        }}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[13px] bg-volt text-volt-ink">
          <IconDeviceTv size={17} aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate">Studio Campetto · la puntata della giornata</span>
        <IconPlayerPlayFilled size={15} className="shrink-0" aria-hidden />
      </button>
      {open && <StudioShowLoader id={latest.id} onClose={() => setOpen(false)} />}
    </>
  );
}
