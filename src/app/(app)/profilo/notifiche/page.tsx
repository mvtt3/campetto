"use client";

import clsx from "clsx";
import { IconBellOff, IconBellRinging, IconMoon } from "@tabler/icons-react";
import { ScreenHeader, Spinner, Toggle } from "@/components/ui/basics";
import { useToast } from "@/components/ui/toast";
import { useData } from "@/lib/data/provider";
import {
  pushSupported,
  isIos,
  isStandalone,
} from "@/lib/notifications/push-client";
import { usePush } from "@/lib/notifications/use-push";
import { gameAllowed } from "@/lib/config";
import {
  DEFAULT_NOTIFY_PREFS,
  NOTIFY_GROUPS,
  type NotifyPrefs,
} from "@/lib/types";

const LABEL =
  "mb-2 mt-6 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted";

const CARD =
  "divide-y divide-line overflow-hidden rounded-[22px] bg-surface shadow-[var(--shadow)]";

const ROW = "flex min-h-[64px] items-center gap-3 px-4 py-3";

export default function NotificationsPage() {
  const { me, backend, mutate } = useData();
  const toast = useToast();
  const push = usePush();
  if (!me) return null;
  const prefs: NotifyPrefs = { ...DEFAULT_NOTIFY_PREFS, ...me.notifyPrefs };
  const supported = pushSupported();
  const iosNeedsHome = isIos() && !isStandalone();
  const locked = supported && !push.on;

  const set = async (patch: Partial<NotifyPrefs>) => {
    const next = { ...prefs, ...patch };
    mutate((d) => ({
      ...d,
      players: d.players.map((p) =>
        p.id === me.id ? { ...p, notifyPrefs: next } : p,
      ),
    }));
    try {
      await backend.updateMe({ notifyPrefs: next });
    } catch {
      toast("Non sono riuscito a salvare, riprova tra poco", "error");
    }
  };

  return (
    <>
      <ScreenHeader title="Notifiche" back="/profilo/impostazioni" />
      <main className="scroll-area min-h-0 flex-1 px-5 pb-6 pt-1">
        <section
          className={clsx(
            "relative isolate mt-3 overflow-hidden rounded-[26px] p-4 shadow-[var(--shadow)] transition-colors",
            push.on
              ? "bg-linear-to-br from-[#1d1a16] via-[#2a1d14] to-[#7a3410] text-white"
              : "bg-surface",
          )}
        >
          {push.on && (
            <span
              aria-hidden
              className="blob hero-drift -right-16 -top-20 -z-10 h-48 w-48 bg-[radial-gradient(circle,rgb(242_106_27/0.45),transparent_68%)]"
            />
          )}
          <div className="flex items-center gap-3">
            <span
              className={clsx(
                "grid h-12 w-12 shrink-0 place-items-center rounded-[16px]",
                push.on ? "bg-white/10 text-volt" : "bg-ball-soft text-ball",
              )}
            >
              {push.on ? (
                <IconBellRinging size={24} />
              ) : (
                <IconBellOff size={24} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={clsx(
                  "text-[11px] font-bold uppercase tracking-[0.12em]",
                  push.on ? "text-white/55" : "text-muted",
                )}
              >
                Su questo telefono
              </p>
              <p className="title mt-0.5 text-[18px] leading-tight">
                {supported
                  ? push.on
                    ? "Attive, ti avviso io"
                    : "Spente, non ti disturbo"
                  : iosNeedsHome
                    ? "Su iPhone aggiungimi prima alla Home"
                    : "Non disponibili in questo browser"}
              </p>
            </div>
            {push.busy ? (
              <Spinner size={14} />
            ) : (
              <Toggle
                label="Notifiche su questo telefono"
                checked={push.on}
                onChange={(v) => void push.toggle(v)}
              />
            )}
          </div>
          {locked && (
            <p className="mt-3 rounded-[14px] bg-raised px-3 py-2 text-[12.5px] text-muted">
              Accendile qui: poi scegli una per una cosa ricevere
            </p>
          )}
        </section>

        {NOTIFY_GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className={LABEL}>{g.title}</h2>
            <div className={CARD}>
              {g.items
                .filter((it) => it.kind !== "gioco" || gameAllowed(me))
                .map((it) => (
                  <div key={it.kind} className={ROW}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold">{it.label}</p>
                      <p className="text-[12.5px] text-muted">{it.hint}</p>
                    </div>
                    <Toggle
                      label={it.label}
                      checked={prefs[it.kind] && !locked}
                      disabled={locked}
                      onChange={(v) => void set({ [it.kind]: v })}
                    />
                  </div>
                ))}
            </div>
          </section>
        ))}

        <section>
          <h2 className={LABEL}>Quando</h2>
          <div className={CARD}>
            <div className={ROW}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-ball-soft text-ball">
                <IconMoon size={18} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold">Silenzio di notte</p>
                <p className="text-[12.5px] text-muted">
                  Niente notifiche dalle 23 alle 8
                </p>
              </div>
              <Toggle
                label="Silenzio di notte"
                checked={prefs.notte}
                onChange={(v) => void set({ notte: v })}
              />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
