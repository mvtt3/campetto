"use client";

import { useState } from "react";
import { Button, haptic, Segmented } from "@/components/ui/basics";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useData } from "@/lib/data/provider";
import { play } from "@/lib/sound";
import { say } from "@/lib/voice";

type Kind = "problema" | "idea" | "altro";
const KINDS: {
  value: Kind;
  label: string;
  placeholder: string;
}[] = [
  {
    value: "problema",
    label: "Problema",
    placeholder: "Cosa stavi facendo e cosa è successo?",
  },
  {
    value: "idea",
    label: "Idea",
    placeholder: "Cosa ti piacerebbe trovare nell'app?",
  },
  {
    value: "altro",
    label: "Altro",
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
      description="O suggerisci un'idea: leggo tutto"
      footer={
        <Button variant="primary" block onClick={send} disabled={!ok || busy}>
          {busy ? "Invio…" : "Invia"}
        </Button>
      }
    >
      <div className="flex flex-col gap-3 pb-2">
        <Segmented
          value={kind}
          onChange={setKind}
          options={KINDS.map(({ value, label }) => ({ value, label }))}
        />
        <textarea
          aria-label="Messaggio"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 2000))}
          placeholder={current.placeholder}
          rows={6}
          className="block w-full resize-none rounded-[22px] bg-surface px-4 py-3.5 text-[15px] leading-snug shadow-[var(--shadow)] outline-none placeholder:text-faint focus:ring-2 focus:ring-ball"
        />
        <p className="px-1 text-[12px] text-faint">
          Con il messaggio mando anche il modello del telefono e la schermata in
          cui eri
        </p>
      </div>
    </Sheet>
  );
}
