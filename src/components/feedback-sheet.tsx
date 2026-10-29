"use client";

import clsx from "clsx";
import { Bug, Lightbulb, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Button, haptic } from "@/components/ui/basics";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useData } from "@/lib/data/provider";
import { say } from "@/lib/voice";

type Kind = "problema" | "idea" | "altro";
const KINDS: { value: Kind; label: string; icon: typeof Bug; placeholder: string }[] = [
  { value: "problema", label: "Qualcosa non va", icon: Bug, placeholder: "Cosa stavi facendo e cosa è successo?" },
  { value: "idea", label: "Un'idea", icon: Lightbulb, placeholder: "Cosa ti piacerebbe trovare nell'app?" },
  { value: "altro", label: "Altro", icon: MessageCircle, placeholder: "Scrivimi pure" },
];

/** L'ultima schermata vista prima delle impostazioni, per capire dove è successo. */
export const LAST_SCREEN_KEY = "campetto:ultima-schermata";

function deviceInfo(): string {
  const ua = navigator.userAgent;
  const model = ua.match(/\(([^)]+)\)/)?.[1]?.split(";").slice(0, 3).join(";") ?? "";
  return `${model} · ${window.innerWidth}×${window.innerHeight} · ${document.documentElement.dataset.theme ?? ""}`.slice(0, 200);
}

/** Segnala un problema o suggerisci un'idea: arriva a chi aggiusta l'app. */
export function FeedbackSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { backend } = useData();
  const toast = useToast();
  const [kind, setKind] = useState<Kind>("problema");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const current = KINDS.find((k) => k.value === kind)!;
  const ok = text.trim().length >= 3;

  const send = async () => {
    if (!ok) return;
    setBusy(true);
    try {
      let screen: string | null = null;
      try {
        screen = sessionStorage.getItem(LAST_SCREEN_KEY);
      } catch {
        /* nessuna schermata */
      }
      await backend.sendFeedback({ kind, message: text, screen, device: deviceInfo(), appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? null });
      haptic(12);
      toast(kind === "idea" ? "Grazie! Ho segnato la tua idea" : "Grazie! L'ho passato a chi aggiusta l'app");
      setText("");
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
      title="Segnala un problema"
      description="Oppure suggerisci un'idea: leggo tutto"
      footer={
        <Button variant="court" block onClick={send} disabled={!ok || busy}>
          {busy ? "Invio…" : "Invia"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Di cosa si tratta">
          {KINDS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              role="radio"
              aria-checked={kind === value}
              onClick={() => {
                haptic(5);
                setKind(value);
              }}
              className={clsx(
                "press flex flex-col items-center justify-center gap-1 rounded-[18px] border-2 border-edge px-1 py-2.5 text-center text-[12.5px] font-bold transition-colors duration-300",
                kind === value ? "sticker-sm bg-volt text-volt-ink" : "bg-surface text-muted",
              )}
            >
              <Icon size={19} aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="sr-only">Messaggio</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 2000))}
            placeholder={current.placeholder}
            rows={5}
            className="block w-full resize-none rounded-[18px] border-2 border-edge bg-surface px-4 py-3 text-[15px] leading-snug outline-none placeholder:text-faint focus:ring-4 focus:ring-court/25"
          />
        </label>
        <p className="text-center text-[12.5px] text-muted">Insieme al messaggio mando il modello del telefono e la schermata in cui eri</p>
      </div>
    </Sheet>
  );
}
