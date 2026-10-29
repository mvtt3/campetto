"use client";

import Link from "next/link";
import { Camera, ChevronRight, Download, LogOut, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button, ScreenHeader, Segmented, Spinner, Toggle } from "@/components/ui/basics";
import { useToast } from "@/components/ui/toast";
import { useData } from "@/lib/data/provider";
import { currentSubscription, disablePush, enablePush, isIos, isStandalone, pushSupported } from "@/lib/notifications/push-client";
import { compressAvatar, getThemePref, setThemePref, type ThemePref } from "@/lib/theme";
import type { NotifyKind } from "@/lib/types";

const COLORS = ["#3b6e8f", "#7a5c99", "#2f7d6b", "#9a6b2f", "#8f3b4e", "#4f6b2f", "#355c9a", "#c2410c", "#0f766e", "#52525b"];

const KINDS: { key: NotifyKind; label: string; text: string }[] = [
  { key: "proposte", label: "Nuove partite proposte", text: "Quando qualcuno vuole giocare" },
  { key: "riepiloghi", label: "Chi viene", text: "Riepiloghi raggruppati e “si gioca”" },
  { key: "conferme", label: "Conferma del risultato", text: "Quando l'altra squadra segna una partita" },
  { key: "mvp", label: "Nuovo MVP", text: "Quando cambia l'MVP in carica" },
  { key: "badge", label: "Badge sbloccati", text: "Quando ne sblocchi uno" },
];

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 px-1 text-[13px] font-semibold text-muted">{title}</h2>
      <div className="rounded-[18px] bg-surface ring-1 ring-line ring-inset">{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-14 items-center gap-3 border-t border-line px-4 py-2.5 first:border-t-0">{children}</div>;
}

export default function SettingsPage() {
  const { me, backend, mutate, reinit } = useData();
  const router = useRouter();
  const toast = useToast();
  const [theme, setTheme] = useState<ThemePref>("system");
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [nickname, setNickname] = useState("");
  const [jersey, setJersey] = useState("");
  const [uploading, setUploading] = useState(false);
  const [install, setInstall] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setTheme(getThemePref());
    setStandalone(isStandalone());
    /* eslint-enable react-hooks/set-state-in-effect */
    void currentSubscription().then((s) => setPushOn(Boolean(s)));
    const h = (e: Event) => {
      e.preventDefault();
      setInstall(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  useEffect(() => {
    if (!me) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setNickname(me.nickname ?? "");
    setJersey(me.jerseyNumber !== null ? String(me.jerseyNumber) : "");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [me]);

  if (!me) return null;

  const patchMe = async (patch: Parameters<typeof backend.updateMe>[0], ok?: string) => {
    mutate((d) => ({ ...d, players: d.players.map((p) => (p.id === me.id ? { ...p, ...patch } : p)) }));
    try {
      await backend.updateMe(patch);
      if (ok) toast(ok);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const togglePush = async (on: boolean) => {
    setPushBusy(true);
    try {
      if (on) {
        const r = await enablePush(backend);
        if (r === "ok") {
          setPushOn(true);
          toast("Notifiche attive");
          void backend.notify({ type: "test" });
        } else if (r === "denied") toast("Hai bloccato le notifiche: riattivale dalle impostazioni del telefono.", "error");
        else if (r === "install") toast("Su iPhone aggiungi prima l'app alla schermata Home.", "error");
        else toast("Questo browser non supporta le notifiche.", "error");
      } else {
        await disablePush(backend);
        setPushOn(false);
        toast("Notifiche disattivate");
      }
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <>
      <ScreenHeader title="Impostazioni" back="/profilo" />
      <main className="scroll-area min-h-0 flex-1 px-4 pb-6">
        <Section title="Il tuo profilo">
          <Row>
            <Avatar player={me} size={52} href={false} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">Foto profilo</p>
              <p className="text-[12.5px] text-muted">Quadrata, la ritagliamo noi</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                setUploading(true);
                try {
                  const blob = await compressAvatar(f);
                  const url = await backend.uploadAvatar(blob);
                  await patchMe({ avatarUrl: url }, "Foto aggiornata");
                } catch (err) {
                  toast((err as Error).message, "error");
                } finally {
                  setUploading(false);
                }
              }}
            />
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Spinner size={16} /> : <Camera size={16} />} Cambia
            </Button>
          </Row>
          <Row>
            <label htmlFor="nick" className="shrink-0 whitespace-nowrap text-[15px]">
              Soprannome
            </label>
            <input
              id="nick"
              value={nickname}
              maxLength={24}
              placeholder="Facoltativo"
              onChange={(e) => setNickname(e.target.value)}
              onBlur={() => nickname !== (me.nickname ?? "") && patchMe({ nickname: nickname.trim() || null }, "Soprannome salvato")}
              className="h-10 min-w-0 flex-1 bg-transparent text-right text-[15px] outline-none placeholder:text-faint"
            />
          </Row>
          <Row>
            <label htmlFor="jersey" className="shrink-0 whitespace-nowrap text-[15px]">
              Numero di maglia
            </label>
            <input
              id="jersey"
              inputMode="numeric"
              value={jersey}
              placeholder="—"
              onChange={(e) => setJersey(e.target.value.replace(/\D/g, "").slice(0, 2))}
              onBlur={() => {
                const v = jersey === "" ? null : Number(jersey);
                if (v !== me.jerseyNumber) void patchMe({ jerseyNumber: v }, "Numero salvato");
              }}
              className="num-wide h-10 min-w-0 flex-1 bg-transparent text-right text-[15px] outline-none placeholder:text-faint"
            />
          </Row>
          <div className="border-t border-line px-4 py-3">
            <span className="text-[15px]">Colore card</span>
            <div className="mt-2.5 flex flex-wrap gap-2.5" role="radiogroup" aria-label="Colore della card">
              {COLORS.map((c) => (
                <button
                  key={c}
                  role="radio"
                  aria-checked={me.cardColor === c}
                  aria-label={c}
                  onClick={() => patchMe({ cardColor: c })}
                  className="h-8 w-8 shrink-0 rounded-full"
                  style={{ background: c, boxShadow: me.cardColor === c ? "0 0 0 2px var(--surface), 0 0 0 4px var(--text)" : undefined }}
                />
              ))}
            </div>
          </div>
          <Row>
            <Link href="/profilo/badge" className="flex flex-1 items-center justify-between text-[15px]">
              Badge in vetrina <ChevronRight size={18} className="text-faint" />
            </Link>
          </Row>
        </Section>

        <Section title="Aspetto">
          <Row>
            <Segmented
              className="flex-1"
              value={theme}
              onChange={(t) => {
                setTheme(t);
                setThemePref(t);
              }}
              options={[
                { value: "system", label: "Auto" },
                { value: "dark", label: "Scuro" },
                { value: "light", label: "Chiaro" },
              ]}
            />
          </Row>
        </Section>

        <Section title="Notifiche">
          <Row>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">Notifiche su questo telefono</p>
              <p className="text-[12.5px] text-muted">
                {pushSupported() ? "Partite proposte, chi viene, badge e MVP" : isIos() && !standalone ? "Su iPhone funzionano dopo aver aggiunto l'app alla Home" : "Non supportate da questo browser"}
              </p>
            </div>
            {pushBusy ? <Spinner /> : <Toggle label="Notifiche" checked={pushOn} onChange={(v) => void togglePush(v)} />}
          </Row>
          {KINDS.map((k) => (
            <Row key={k.key}>
              <div className="min-w-0 flex-1">
                <p className="text-[15px]">{k.label}</p>
                <p className="text-[12.5px] text-muted">{k.text}</p>
              </div>
              <Toggle
                label={k.label}
                checked={me.notifyPrefs[k.key]}
                onChange={(v) => patchMe({ notifyPrefs: { ...me.notifyPrefs, [k.key]: v } })}
              />
            </Row>
          ))}
        </Section>

        {!standalone && (
          <Section title="Installa l'app">
            <Row>
              <Download size={20} className="shrink-0 text-ball" />
              <p className="min-w-0 flex-1 text-[14px] text-muted">
                {isIos()
                  ? "Apri il menu Condividi di Safari e scegli “Aggiungi alla schermata Home”."
                  : "Aggiungila alla schermata Home: si apre a schermo intero, come un'app."}
              </p>
              {install && (
                <Button size="sm" variant="primary" onClick={() => void install.prompt()}>
                  Installa
                </Button>
              )}
            </Row>
          </Section>
        )}

        {me.isAdmin && (
          <Section title="Amministrazione">
            <Row>
              <Link href="/admin" className="flex flex-1 items-center gap-3 text-[15px]">
                <Shield size={19} className="text-ball" /> Giocatori, inviti e accessi
                <ChevronRight size={18} className="ml-auto text-faint" />
              </Link>
            </Row>
          </Section>
        )}

        <Section title="Altro">
          <Row>
            <Link href="/privacy" className="flex flex-1 items-center justify-between text-[15px]">
              Privacy <ChevronRight size={18} className="text-faint" />
            </Link>
          </Row>
          <Row>
            <Link href="/termini" className="flex flex-1 items-center justify-between text-[15px]">
              Termini <ChevronRight size={18} className="text-faint" />
            </Link>
          </Row>
          <Row>
            <button
              onClick={async () => {
                await backend.signOut();
                router.replace("/login");
                await reinit();
              }}
              className="flex flex-1 items-center gap-3 text-[15px] text-danger"
            >
              <LogOut size={19} /> Esci
            </button>
          </Row>
        </Section>
      </main>
    </>
  );
}
