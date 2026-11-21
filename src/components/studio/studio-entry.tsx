"use client";

import { IconDeviceTv, IconPlayerPlayFilled } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { CourtLines } from "@/components/ui/basics";
import { useData } from "@/lib/data/provider";
import { STUDIO_LATEST, STUDIO_LIST, STUDIO_PREVIEW } from "@/lib/studio";
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

let previewed: Promise<StudioLatest | null> | null = null;
/**
 * La puntata in anteprima (/studio/anteprima.json): la prova di una serata nuova che vede solo
 * l'amministratore, come se fosse già uscita, prima di pubblicarla per tutti.
 */
function loadPreview(): Promise<StudioLatest | null> {
  previewed ??= fetch(STUDIO_PREVIEW, { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<StudioLatest>) : null))
    .then((l) => (l && typeof l.id === "string" && typeof l.day === "string" ? l : null))
    .catch(() => null);
  return previewed;
}

/** Chi vede l'anteprima: l'amministratore vero (anche quando guarda l'app "da giocatore" no). */
function usePreviewAllowed(): boolean {
  const { me, playerView } = useData();
  return Boolean(me?.isAdmin) && playerView.available && !playerView.on;
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
  const preview = usePreviewAllowed();
  const [latest, setLatest] = useState<StudioLatest | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void (preview ? loadPreview() : Promise.resolve(null))
      .then((p) => p ?? loadLatest())
      .then((l) => alive && setLatest(l));
    return () => {
      alive = false;
    };
  }, [enabled, preview]);
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
  const preview = usePreviewAllowed();
  const [list, setList] = useState<StudioLatest[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void Promise.all([loadEpisodes(), preview ? loadPreview() : Promise.resolve(null)]).then(
      ([l, p]) => alive && setList(p && !l.some((e) => e.id === p.id) ? [p, ...l] : l),
    );
    return () => {
      alive = false;
    };
  }, [enabled, preview]);
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
  const minutes = Math.max(1, Math.round(latest.duration / 60));
  return (
    <>
      <button
        type="button"
        className="press relative flex w-full items-center gap-3 overflow-hidden rounded-[18px] bg-linear-to-br from-court to-court-deep px-3.5 py-3 text-left text-court-ink"
        data-testid="studio-night-card"
        onClick={() => {
          setStudioSeen(latest.id);
          setOpen(true);
        }}
      >
        <CourtLines className="pointer-events-none absolute inset-0 h-full w-full opacity-25" />
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-[200px] opacity-55">
          <span className="absolute -bottom-5 right-[104px] w-[80px] -rotate-6">
            <Presenter who="lei" />
          </span>
          <span className="absolute -bottom-7 right-[34px] w-[88px] rotate-[7deg]">
            <Presenter who="lui" />
          </span>
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-volt">
            Studio Campetto
          </span>
          <span className="block truncate text-[15px] font-semibold leading-snug">
            La giornata in studio
          </span>
          <span className="block truncate text-[12.5px] text-court-ink/75">
            Risultati, MVP e giocate · {minutes} min
          </span>
        </span>
        <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-court-ink text-court-deep shadow-[0_4px_12px_-4px_rgb(0_0_0/0.35)]">
          <IconPlayerPlayFilled size={16} className="ml-px" aria-hidden />
        </span>
      </button>
      {open && <StudioShowLoader id={latest.id} onClose={() => setOpen(false)} />}
    </>
  );
}
