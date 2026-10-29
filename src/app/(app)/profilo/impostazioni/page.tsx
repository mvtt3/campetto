"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Camera, ChevronRight, Download, LogOut, Palette, Shield } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { AvatarPicker } from "@/components/avatar-picker";
import { Sheet } from "@/components/ui/sheet";
import { NAME_MAX, nameError } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Button, ScreenHeader, Segmented, Spinner, Toggle } from "@/components/ui/basics";
import { useToast } from "@/components/ui/toast";
import { useData } from "@/lib/data/provider";
import { currentSubscription, disablePush, enablePush, isIos, isStandalone, pushSupported } from "@/lib/notifications/push-client";
import { compressAvatar, getThemePref, setThemePref, type ThemePref } from "@/lib/theme";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

function Group({ children }: { children: ReactNode }) {
  return <section className="card mb-3 overflow-hidden">{children}</section>;
}

function Row({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-[60px] items-center gap-3 border-t border-line px-4 py-2.5 first:border-t-0">
      {icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-court-soft text-court">{icon}</span>}
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { me, data, backend, mutate, reinit } = useData();
  const router = useRouter();
  const toast = useToast();
  const [theme, setTheme] = useState<ThemePref>("light");
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [nickname, setNickname] = useState("");
  const [jersey, setJersey] = useState("");
  const [uploading, setUploading] = useState(false);
  const [install, setInstall] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(true);
  const [picking, setPicking] = useState(false);

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
        toast("Notifiche spente");
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
      <main className="scroll-area min-h-0 flex-1 px-5 pb-6 pt-1">
        <Group>
          <button className="press flex w-full items-center gap-4 px-4 py-4 text-left" onClick={() => setPicking(true)} aria-label="Cambia foto profilo">
            <span className="relative">
              <Avatar player={me} size={64} href={false} />
              <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-edge bg-ball text-ball-ink">
                {uploading ? <Spinner size={10} /> : <Camera size={14} />}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="title block text-[17px]">La tua figurina</span>
              <span className="block text-[13px] text-muted">Scegline una o metti una tua foto</span>
            </span>
            <ChevronRight size={18} className="text-faint" />
          </button>
          <Row>
            <label htmlFor="nick" className="shrink-0 text-[15px]">
              Nome nell&apos;app
            </label>
            <input
              id="nick"
              value={nickname}
              maxLength={NAME_MAX}
              autoCapitalize="words"
              onChange={(e) => setNickname(e.target.value)}
              onBlur={() => {
                const clean = nickname.trim().replace(/\s+/g, " ");
                if (clean === (me.nickname ?? "")) return;
                const err = nameError(clean, data.players, me.id);
                if (err) {
                  toast(err, "error");
                  setNickname(me.nickname ?? "");
                } else void patchMe({ nickname: clean }, "Nome salvato");
              }}
              className="h-10 min-w-0 flex-1 bg-transparent text-right text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-faint"
            />
          </Row>
          <Row>
            <label htmlFor="jersey" className="shrink-0 text-[15px]">
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
              className="tnum h-10 min-w-0 flex-1 bg-transparent text-right text-[15px] font-semibold outline-none placeholder:text-faint"
            />
          </Row>
        </Group>

        <Group>
          <Row icon={<Palette size={18} />}>
            <Segmented
              className="flex-1"
              size="sm"
              value={theme}
              onChange={(t) => {
                setTheme(t);
                setThemePref(t);
              }}
              options={[
                { value: "light", label: "Chiaro" },
                { value: "dark", label: "Scuro" },
                { value: "system", label: "Auto" },
              ]}
            />
          </Row>
          <Row icon={<Bell size={18} />}>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">Notifiche</p>
              <p className="text-[12.5px] text-muted">
                {pushSupported() ? "Partite proposte, nuovo MVP, badge" : isIos() && !standalone ? "Su iPhone servono l'app nella Home" : "Non disponibili in questo browser"}
              </p>
            </div>
            {pushBusy ? <Spinner size={14} /> : <Toggle label="Notifiche" checked={pushOn} onChange={(v) => void togglePush(v)} />}
          </Row>
          {!standalone && (
            <Row icon={<Download size={18} />}>
              <p className="min-w-0 flex-1 text-[13.5px] text-muted">
                {isIos() ? "In Safari: Condividi, poi “Aggiungi alla schermata Home”." : "Mettila nella Home: si apre a schermo intero."}
              </p>
              {install && (
                <Button size="sm" variant="primary" onClick={() => void install.prompt()}>
                  Installa
                </Button>
              )}
            </Row>
          )}
        </Group>

        <Group>
          {me.isAdmin && (
            <Row icon={<Shield size={18} />}>
              <Link href="/admin" className="flex flex-1 items-center text-[15px] font-semibold">
                Gestione del gruppo
                <ChevronRight size={18} className="ml-auto text-faint" />
              </Link>
            </Row>
          )}
          <Row icon={<LogOut size={18} />}>
            <button
              onClick={async () => {
                await backend.signOut();
                router.replace("/login");
                await reinit();
              }}
              className="flex-1 text-left text-[15px] font-semibold text-danger"
            >
              Esci
            </button>
          </Row>
        </Group>

        <p className="px-1 text-center text-[12.5px] text-faint">
          <Link href="/privacy" className="underline">
            Privacy
          </Link>{" "}
          e{" "}
          <Link href="/termini" className="underline">
            termini
          </Link>
        </p>
      </main>
      <Sheet open={picking} onOpenChange={setPicking} title="La tua figurina" description="Tocca per sceglierla: si aggiorna subito.">
        <div className="pb-2">
          <AvatarPicker
            value={me.avatarUrl}
            uploading={uploading}
            onPreset={(url) => void patchMe({ avatarUrl: url }, "Figurina aggiornata")}
            onInitials={() => void patchMe({ avatarUrl: null }, "Ora hai le iniziali")}
            onFile={async (f) => {
              setUploading(true);
              try {
                const url = await backend.uploadAvatar(await compressAvatar(f));
                await patchMe({ avatarUrl: url }, "Foto aggiornata");
              } catch (err) {
                toast((err as Error).message, "error");
              } finally {
                setUploading(false);
              }
            }}
          />
        </div>
      </Sheet>
    </>
  );
}
