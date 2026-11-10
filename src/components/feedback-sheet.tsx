"use client";

import clsx from "clsx";
import { IconBug, IconBulb, IconMessageCircle } from "@tabler/icons-react";
import { useState } from "react";
import { Button, haptic } from "@/components/ui/basics";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useData } from "@/lib/data/provider";
import { play } from "@/lib/sound";
import { say } from "@/lib/voice";

type Kind = "problema" | "idea" | "altro";
const KINDS: {
  value: Kind;
  label: string;
  icon: typeof IconBug;
  placeholder: string;
}[] = [
  {
    value: "problema",
    label: "Qualcosa non va",
    icon: IconBug,
    placeholder: "Cosa stavi facendo e cosa è successo?",
  },
  {
    value: "idea",
    label: "Un'idea",
    icon: IconBulb,
    placeholder: "Cosa ti piacerebbe trovare nell'app?",
  },
  {
    value: "altro",
    label: "Altro",
    icon: IconMessageCircle,
    placeholder: "Scrivimi pure",
  },
];

/** L'ultima schermata vista prima delle impostazioni, per capire dove è successo. */
export const LAST_SCREEN_KEY = "campetto:ultima-schermata";

function deviceInfo(): string {
  const ua = navigator.userAgent;
  const model =
    ua
      .match(/\(([^)]+)\)/)?.[1]
      ?.split(";")
      .slice(0, 3)
      .join(";") ?? "";
  return `${model} · ${window.innerWidth}×${window.innerHeight} · ${document.documentElement.dataset.theme ?? ""}`.slice(
    0,
    200,
  );
}

/** Segnala un problema o suggerisci un'idea: arriva a chi aggiusta l'app. */
const LABEL =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted";

export function FeedbackSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
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
      await backend.sendFeedback({
        kind,
        message: text,
        screen,
        device: deviceInfo(),
        appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
      });
      void backend.notify({ type: "feedback", kind });
      haptic(12);
      play("success");
      toast(
        kind === "idea"
          ? "Grazie! Ho segnato la tua idea"
          : "Grazie! L'ho passato a chi aggiusta l'app",
      );
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
        <Button variant="primary" block onClick={send} disabled={!ok || busy}>
          {busy ? "Invio…" : "Invia"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <h3 className={LABEL}>Di cosa si tratta</h3>
        <div
          className="-mt-2 grid grid-cols-3 gap-2"
          role="radiogroup"
          aria-label="Di cosa si tratta"
        >
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
                "press flex flex-col items-center justify-center gap-2 rounded-[22px] bg-surface px-1 py-3.5 text-center text-[13px] font-semibold shadow-[var(--shadow)] ring-2 transition-shadow duration-200",
                kind === value ? "ring-ball" : "ring-transparent",
              )}
            >
              <span
                className={clsx(
                  "grid h-10 w-10 place-items-center rounded-[12px] transition-colors duration-200",
                  kind === value
                    ? "bg-ball text-ball-ink"
                    : "bg-ball-soft text-ball",
                )}
              >
                <Icon size={20} aria-hidden />
              </span>
              {label}
            </button>
          ))}
        </div>
        <label className="block">
          <span className={clsx(LABEL, "mb-2 block")}>Messaggio</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 2000))}
            placeholder={current.placeholder}
            rows={5}
            className="block w-full resize-none rounded-[22px] bg-surface px-4 py-3.5 text-[15px] leading-snug shadow-[var(--shadow)] outline-none placeholder:text-faint focus:ring-2 focus:ring-ball"
          />
        </label>
        <p className="px-1 text-[12.5px] text-muted">
          Insieme al messaggio mando il modello del telefono e la schermata in
          cui eri
        </p>
      </div>
    </Sheet>
  );
}
