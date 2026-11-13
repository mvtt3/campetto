"use client";

import { IconDeviceTv, IconPlayerPlayFilled } from "@tabler/icons-react";
import clsx from "clsx";
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

/**
 * Chi vede lo Studio per ora: solo l'amministratore, per provarlo; mai nella demo pubblica.
 * Con i dati finti (prove e test) solo se si chiede con ?studio=1.
 */
export function useStudioEnabled(): boolean {
  const { me, backend } = useData();
  if (!me?.isAdmin || process.env.NEXT_PUBLIC_DEMO === "1") return false;
  if (backend.kind !== "mock") return true;
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("studio") === "1";
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
 * Il bollino dello Studio nella riga di una serata, accanto al numero di partite. Non è un
 * pulsante a parte (la riga è già un pulsante): è la riga a riconoscere il tocco su
 * [data-studio-badge] e ad aprire la puntata. L'area di tocco è più grande del bollino.
 */
export function StudioNightBadge({ fresh }: { fresh: boolean }) {
  return (
    <span
      data-studio-badge
      title="Guarda la puntata dello Studio"
      data-testid="studio-night"
      className="studio-badge press relative inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full pl-1 pr-2.5 text-[12.5px] font-semibold text-court-deep before:absolute before:-inset-x-1.5 before:-inset-y-2.5 before:content-[''] dark:text-[#b9c8ff]"
    >
      <span className="studio-badge-tv grid h-5 w-5 place-items-center rounded-full text-volt">
        <IconDeviceTv size={13} stroke={2.2} aria-hidden />
      </span>
      Studio
      {fresh && <span aria-hidden className={clsx("new-dot absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-ball")} />}
    </span>
  );
}

export const studioDay = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
export const studioLength = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

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

/** In cima alle notizie: la puntata dello Studio Campetto, da aprire quando si vuole. */
export function StudioNewsCard({ latest }: { latest: StudioLatest }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="press relative flex items-center gap-3 overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,#0C1736,#1C3576)] p-3 text-left text-white"
        onClick={() => {
          setStudioSeen(latest.id);
          setOpen(true);
        }}
      >
        <span className="-mb-3 shrink-0">
          <StudioHosts size={46} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-semibold text-volt">Studio Campetto</span>
          <span className="block text-[14.5px] font-semibold leading-snug">La puntata di {studioDay(latest.day)}</span>
          <span className="block text-[12.5px] text-white/70">Risultati, record e canestri · {studioLength(latest.duration)}</span>
        </span>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#0C1736]">
          <IconPlayerPlayFilled size={18} aria-hidden />
        </span>
      </button>
      {open && <StudioShowLoader id={latest.id} onClose={() => setOpen(false)} />}
    </>
  );
}

