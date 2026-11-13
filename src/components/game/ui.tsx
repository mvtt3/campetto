"use client";

import clsx from "clsx";
import { IconX } from "@tabler/icons-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Mascot } from "@/components/mascot";
import { play, type SoundName } from "@/lib/sound";
import { romeDay } from "@/lib/game/economy";
import { useNow } from "@/lib/use-now";
import { useGame } from "./store";

/** I consigli di una riga: compaiono la prima volta che apri ogni parte del gioco. */
export const TIPS: Record<string, string> = {
  hub: "Ogni giorno scegli una cosa: allenarti, riposare o uscire. Mercoledì e sabato si gioca.",
  partita: "Tieni premuto Tira e lascia sul verde. Passa quando il cerchio si chiude sul compagno.",
  "partita-fatta": "Dopo la partita, dall'hub vai al giorno dopo: allenati, riposa o esci.",
  telefono: "Dal telefono rispondi ai messaggi, guardi il conto, firmi i contratti e fai shopping.",
  messaggi: "Come rispondi cambia il rapporto, e a forza di risposte cambia anche il carattere di chi ti scrive.",
  banca: "Lo stipendio arriva ogni lunedì, già senza tasse.",
  contratti: "A fine stagione scegli dove giocare. Con voti alti e fama arriva la promozione.",
  shopping: "Quello che compri lo indossi anche nell'app: profilo, classifiche e partite.",
  sfide: "Ogni tentativo costa un gettone e ogni sfida si gioca una volta ogni 2 ore. In classifica resta il tuo record: a mezzanotte chi è primo vince il premio.",
  guardaroba: "Cambia quello che indossi quando vuoi: si aggiorna anche la tua figurina nell'app.",
  carriera: "Dal Campetto alla Serie A: a fine stagione contano voto medio e fama.",
};

export function Tip({ id, text, className }: { id: string; text?: string; className?: string }) {
  const { game, update } = useGame();
  if (game.tutorial.step < 4 || game.tutorial.seen.includes(id)) return null;
  const close = () => update((s) => ({ ...s, tutorial: { ...s.tutorial, seen: [...s.tutorial.seen, id] } }));
  return (
    <div className={clsx("fade-in sticker-sm flex items-center gap-2 rounded-2xl bg-volt px-2 py-1.5 text-volt-ink", className)} role="note">
      <Mascot pose="ciao" size={38} animate={false} />
      <p className="min-w-0 flex-1 text-[13.5px] font-semibold leading-snug">{text ?? TIPS[id]}</p>
      <button onClick={close} aria-label="Ho capito" className="press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/60">
        <IconX size={18} />
      </button>
    </div>
  );
}

/** La fumetto di Spicchio che indica cosa fare durante il tutorial. */
export function Coach({ children, className, pose = "ciao" }: { children: ReactNode; className?: string; pose?: "ciao" | "esulta" }) {
  return (
    <div className={clsx("fade-in pointer-events-none flex items-end gap-1", className)} role="status">
      <Mascot pose={pose} size={58} />
      <p className="sticker-sm mb-3 rounded-2xl rounded-bl-sm bg-surface px-3 py-2 text-[14.5px] font-semibold leading-snug text-text">
        {children}
      </p>
    </div>
  );
}

/** Una barretta piena/vuota: energia, felicità, fama, rapporto. */
export function Meter({
  value,
  max = 100,
  min = 0,
  color,
  className,
  label,
}: {
  value: number;
  max?: number;
  min?: number;
  color: string;
  className?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return (
    <div
      className={clsx("h-3 overflow-hidden rounded-full border-2 border-edge bg-raised", className)}
      role="meter"
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-label={label}
    >
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct * 100}%`, background: color }} />
    </div>
  );
}

/** Pannello che sale dal basso. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[68] flex items-end justify-center bg-[#1d1a16]/55 fade-in" onClick={onClose}>
      <div
        className="sheet-up card mx-auto max-h-[86dvh] w-full max-w-lg overflow-y-auto rounded-b-none px-4 pb-[max(20px,var(--sab))] pt-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        <div className="mb-3 flex items-center gap-2">
          <h2 className="display min-w-0 flex-1 text-[24px]">{title}</h2>
          <button onClick={onClose} aria-label="Chiudi" className="press sticker-sm grid h-10 w-10 place-items-center rounded-full bg-surface">
            <IconX size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

type Toast = { id: number; text: string; tone: "ok" | "info" | "bad" };
/** `sound`: il suono al posto di quello solito (null = nessuno). */
const ToastCtx = createContext<(text: string, tone?: Toast["tone"], sound?: SoundName | null) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const n = useRef(0);
  const show = useCallback((text: string, tone: Toast["tone"] = "info", sound?: SoundName | null) => {
    const id = ++n.current;
    setList((l) => [...l.slice(-2), { id, text, tone }]);
    if (sound) play(sound);
    else if (sound === undefined && tone === "ok") play("success");
    window.setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-[max(14px,env(safe-area-inset-top))] z-[69] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {list.map((t) => (
          <p
            key={t.id}
            className={clsx(
              "toast-in sticker-sm max-w-sm rounded-full px-4 py-2 text-center text-[14.5px] font-bold",
              t.tone === "ok" ? "bg-ok text-white" : t.tone === "bad" ? "bg-danger text-white" : "bg-surface",
            )}
          >
            {t.text}
          </p>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** L'ora adesso, per i gesti (tocchi, partite): mai durante il disegno. */
export const clockNow = () => Date.now();

/** Il giorno di oggi in Italia, aggiornato ogni minuto (il premio cambia a mezzanotte). */
export function useToday(): string {
  return romeDay(useNow(60_000).getTime());
}

/** Conto alla rovescia "1:23:05" fino a un momento preciso (epoch ms); si aggiorna da solo. */
export function useClock(until: number | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [until]);
  if (until === null) return "";
  const left = Math.max(0, until - now);
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
