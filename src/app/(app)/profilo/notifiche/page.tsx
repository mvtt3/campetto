"use client";

import { BellRing, Moon } from "lucide-react";
import { ScreenHeader, Spinner, Toggle } from "@/components/ui/basics";
import { useToast } from "@/components/ui/toast";
import { useData } from "@/lib/data/provider";
import {
  pushSupported,
  isIos,
  isStandalone,
} from "@/lib/notifications/push-client";
import { usePush } from "@/lib/notifications/use-push";
import {
  DEFAULT_NOTIFY_PREFS,
  NOTIFY_GROUPS,
  type NotifyPrefs,
} from "@/lib/types";

/** Cosa ricevere: un interruttore per ogni tipo di notifica, come nelle app di oggi. */
export default function NotificationsPage() {
  const { me, backend, mutate } = useData();
  const toast = useToast();
  const push = usePush();
  if (!me) return null;
  const prefs: NotifyPrefs = { ...DEFAULT_NOTIFY_PREFS, ...me.notifyPrefs };
  const supported = pushSupported();
  const iosNeedsHome = isIos() && !isStandalone();

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
        <section className="card mb-4 flex items-center gap-3 px-4 py-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-edge bg-volt text-volt-ink">
            <BellRing size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold">Su questo telefono</p>
            <p className="text-[12.5px] text-muted">
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
        </section>

        {NOTIFY_GROUPS.map((g) => (
          <section key={g.title} className="mb-4">
            <h2 className="title mb-2 px-1 text-[15px]">{g.title}</h2>
            <div className="card overflow-hidden">
              {g.items.map((it) => (
                <div
                  key={it.kind}
                  className="flex min-h-[62px] items-center gap-3 border-t border-line px-4 py-2.5 first:border-t-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold">{it.label}</p>
                    <p className="text-[12.5px] text-muted">{it.hint}</p>
                  </div>
                  <Toggle
                    label={it.label}
                    checked={prefs[it.kind]}
                    onChange={(v) => void set({ [it.kind]: v })}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="mb-4">
          <h2 className="title mb-2 px-1 text-[15px]">Quando</h2>
          <div className="card flex min-h-[62px] items-center gap-3 px-4 py-2.5">
            <Moon size={18} className="shrink-0 text-court" aria-hidden />
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
        </section>
        {!push.on && supported && (
          <p className="px-2 text-center text-[13px] text-muted">
            Le scelte valgono quando accendi le notifiche qui sopra
          </p>
        )}
      </main>
    </>
  );
}
