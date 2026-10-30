"use client";

import clsx from "clsx";
import { Clock, Lock, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/basics";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useData } from "@/lib/data/provider";
import { nickIdeas } from "@/lib/nickname-filter";
import {
  NAME_COOLDOWN_DAYS,
  NAME_MAX,
  nameError,
  nameUnlockDate,
  OFFENSIVE_NAME,
  type Player,
} from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { say } from "@/lib/voice";

const dayLong = (d: Date) =>
  d.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

/**
 * Cambiare il nome nell'app, come nei social: anteprima dal vivo, un avviso chiaro prima di
 * salvare e poi una pausa di 14 giorni. Se il nome è bloccato, dice da quando si può cambiare.
 */
export function NameSheet({
  me,
  open,
  onClose,
}: {
  me: Player;
  open: boolean;
  onClose: () => void;
}) {
  const { data, backend, mutate } = useData();
  const toast = useToast();
  const [name, setName] = useState(me.nickname ?? "");
  const [busy, setBusy] = useState(false);
  const clean = name.trim().replace(/\s+/g, " ");
  const changed = clean !== (me.nickname ?? "");
  const error = changed ? nameError(clean, data.players, me.id) : null;
  const now = useNow();
  const unlock = nameUnlockDate(me, now);
  const nextFree = new Date(now.getTime() + NAME_COOLDOWN_DAYS * 86_400_000);
  const preview: Player = { ...me, nickname: clean || me.nickname };

  const save = async () => {
    if (!changed || error) return;
    setBusy(true);
    try {
      await backend.updateMe({ nickname: clean });
      const at = new Date().toISOString();
      mutate((d) => ({
        ...d,
        players: d.players.map((p) =>
          p.id === me.id ? { ...p, nickname: clean, nicknameChangedAt: at } : p,
        ),
      }));
      toast(`Ora sei ${clean}`);
      onClose();
    } catch (e) {
      toast(say(e), "error");
    } finally {
      setBusy(false);
    }
  };

  if (unlock) {
    const left = Math.max(
      1,
      Math.ceil((unlock.getTime() - now.getTime()) / 86_400_000),
    );
    const pct = 1 - left / NAME_COOLDOWN_DAYS;
    return (
      <Sheet
        open={open}
        onOpenChange={(o) => !o && onClose()}
        title="Nome bloccato per ora"
        footer={
          <Button block variant="primary" onClick={onClose}>
            Ho capito
          </Button>
        }
      >
        <div className="flex flex-col items-center gap-3 pb-2 pt-1 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-raised text-muted">
            <Lock size={28} aria-hidden />
          </span>
          <p className="max-w-[30ch] text-[15px] leading-snug">
            Hai già cambiato nome di recente. Potrai cambiarlo di nuovo da{" "}
            <b>{dayLong(unlock)}</b>
          </p>
          <div className="w-full max-w-[260px]">
            <div
              className="h-2 overflow-hidden rounded-full bg-raised"
              aria-hidden
            >
              <div
                className="h-full rounded-full bg-court"
                style={{ width: `${Math.round(pct * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[13px] font-semibold text-muted">
              {left === 1 ? "Manca 1 giorno" : `Mancano ${left} giorni`}
            </p>
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Il tuo nome nell'app"
      description="È il nome che vede tutto il gruppo"
      footer={
        <Button
          block
          variant="primary"
          disabled={!changed || !!error || busy}
          onClick={() => void save()}
        >
          Salva il nome
        </Button>
      }
    >
      <form
        className="flex flex-col items-center gap-3 pb-1 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {/* L'anteprima: come ti vedranno gli altri, mentre scrivi. */}
        <div
          className="flex items-center gap-3 rounded-full bg-raised py-1.5 pl-1.5 pr-5"
          aria-hidden
        >
          <Avatar player={preview} size={40} href={false} />
          <span className="title max-w-[200px] truncate text-[19px]">
            {clean || "…"}
          </span>
        </div>
        <input
          aria-label="Nuovo nome"
          value={name}
          maxLength={NAME_MAX}
          autoCapitalize="words"
          autoComplete="nickname"
          enterKeyHint="done"
          onChange={(e) => setName(e.target.value)}
          className={clsx(
            "sticker-sm h-14 w-full rounded-[18px] bg-surface px-4 text-center text-[20px] font-semibold outline-none focus-visible:ring-4 focus-visible:ring-court/30",
            error && "text-danger",
          )}
        />
        {error === OFFENSIVE_NAME ? (
          <div
            className="nick-warn w-full rounded-[16px] border-2 border-line-strong px-3 py-2.5 text-center"
            role="alert"
          >
            <p className="flex items-center justify-center gap-1.5 text-[13.5px] font-bold text-danger">
              <ShieldAlert size={15} aria-hidden /> {OFFENSIVE_NAME}
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {nickIdeas(
                me.firstName,
                data.players.map((p) => p.nickname ?? ""),
              ).map((x) => (
                <button
                  key={x}
                  type="button"
                  onClick={() => setName(x)}
                  className="press rounded-full bg-volt px-3 py-1 text-[13px] font-bold text-volt-ink"
                >
                  {x}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p
            className={clsx(
              "h-5 text-[13px] font-semibold",
              error ? "text-danger" : "text-muted",
            )}
            role="status"
          >
            {error ?? `${clean.length}/${NAME_MAX}`}
          </p>
        )}
        <p className="flex w-full items-start gap-2 rounded-[16px] bg-court-soft px-3 py-2.5 text-left text-[13px] leading-snug">
          <Clock size={16} className="mt-px shrink-0 text-court" aria-hidden />
          <span>
            Il nome si cambia una volta ogni {NAME_COOLDOWN_DAYS} giorni: dopo
            questo, il prossimo cambio sarà possibile da {dayLong(nextFree)}
          </span>
        </p>
      </form>
    </Sheet>
  );
}
