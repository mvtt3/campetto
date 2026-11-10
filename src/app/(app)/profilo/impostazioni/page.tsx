"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconBell,
  IconCamera,
  IconCheck,
  IconChevronRight,
  IconCompass,
  IconDownload,
  IconEye,
  IconLock,
  IconLogout,
  IconMessageReport,
  IconMovie,
  IconPalette,
  IconRepeat,
  IconShield,
  IconUsers,
  IconVolume,
  IconVolumeOff,
} from "@tabler/icons-react";
import { useEffect, useState, type ReactNode } from "react";
import { AvatarPicker } from "@/components/avatar-picker";
import {
  AVATAR_PRESETS,
  type AvatarPresetId,
} from "@/components/avatar-presets";
import { Character, characterOf } from "@/components/character";
import { CharacterCard, CharacterGrid } from "@/components/character-card";
import { NewDot } from "@/components/new-dot";
import { useNewRewards } from "@/components/rewards";
import { FeedbackSheet } from "@/components/feedback-sheet";
import { SECTION_IDS, sections } from "@/components/tutorial/model";
import { useTutorial } from "@/components/tutorial/tutorial";
import { Sheet } from "@/components/ui/sheet";
import { nameUnlockDate, playerHref } from "@/lib/types";
import { NameSheet } from "@/components/name-sheet";
import {
  Avatar,
  CARD_COLORS,
  isLightColor,
  playerColor,
} from "@/components/ui/avatar";
import {
  Button,
  ScreenHeader,
  Segmented,
  Spinner,
  Toggle,
} from "@/components/ui/basics";
import { useToast } from "@/components/ui/toast";
import { useData } from "@/lib/data/provider";
import { isIos, isStandalone } from "@/lib/notifications/push-client";
import { usePush } from "@/lib/notifications/use-push";
import {
  compressAvatar,
  getThemePref,
  setThemePref,
  type ThemePref,
} from "@/lib/theme";
import {
  highlightEnd,
  setHighlightEnd,
  type HighlightEnd,
} from "@/lib/highlights-prefs";
import { onSoundChange, play, setSoundOn, soundOn } from "@/lib/sound";
import { say } from "@/lib/voice";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
        {title}
      </h2>
      <div className="divide-y divide-line overflow-hidden rounded-[22px] bg-surface shadow-[var(--shadow)]">
        {children}
      </div>
    </section>
  );
}

function Row({
  icon,
  danger,
  children,
}: {
  icon?: ReactNode;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
      {icon && (
        <span
          className={clsx(
            "grid h-9 w-9 shrink-0 place-items-center rounded-[12px]",
            danger ? "bg-danger/12 text-danger" : "bg-ball-soft text-ball",
          )}
        >
          {icon}
        </span>
      )}
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { me, backend, mutate, reinit, playerView } = useData();
  const router = useRouter();
  const toast = useToast();
  const [theme, setTheme] = useState<ThemePref>("light");
  const push = usePush();
  const [naming, setNaming] = useState(false);
  const [jersey, setJersey] = useState("");
  const [uploading, setUploading] = useState(false);
  const [install, setInstall] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(true);
  const [picking, setPicking] = useState(false);
  const newChars = useNewRewards().characters.size;
  const [characters, setCharacters] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [card, setCard] = useState<AvatarPresetId | null>(null);
  const [guide, setGuide] = useState(false);
  const [sounds, setSounds] = useState(true);
  const [hlEnd, setHlEnd] = useState<HighlightEnd>("next");
  const tour = useTutorial();

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setTheme(getThemePref());
    setStandalone(isStandalone());
    setSounds(soundOn());
    setHlEnd(highlightEnd());
    // Arrivando dal personaggio nel profilo: la collezione è già aperta.
    if (new URLSearchParams(window.location.search).get("personaggi")) {
      setCharacters(true);
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname,
      );
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    const h = (e: Event) => {
      e.preventDefault();
      setInstall(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", h);
    const off = onSoundChange(setSounds);
    return () => {
      window.removeEventListener("beforeinstallprompt", h);
      off();
    };
  }, []);

  useEffect(() => {
    if (!me) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setJersey(me.jerseyNumber !== null ? String(me.jerseyNumber) : "");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [me]);

  if (!me) return null;

  const patchMe = async (
    patch: Parameters<typeof backend.updateMe>[0],
    ok?: string,
  ) => {
    mutate((d) => ({
      ...d,
      players: d.players.map((p) => (p.id === me.id ? { ...p, ...patch } : p)),
    }));
    try {
      await backend.updateMe(patch);
      if (ok) toast(ok);
    } catch (e) {
      toast(say(e), "error");
    }
  };

  return (
    <>
      <ScreenHeader title="Impostazioni" back="/profilo" />
      <main className="scroll-area min-h-0 flex-1 px-5 pb-6 pt-1">
        <button
          className="press relative isolate mb-5 flex w-full items-end gap-3 overflow-hidden rounded-[26px] px-4 pb-4 pt-5 text-left shadow-[var(--shadow)]"
          style={{ backgroundColor: playerColor(me) }}
          onClick={() => setCharacters(true)}
          data-tour="settings-character"
        >
          <span
            aria-hidden
            className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_60%_at_10%_0%,rgb(255_255_255/0.3),transparent_60%),linear-gradient(170deg,transparent_35%,rgb(0_0_0/0.45))]"
          />
          <span
            className={clsx(
              "min-w-0 flex-1",
              isLightColor(playerColor(me)) ? "text-[#1d1a16]" : "text-white",
            )}
          >
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] opacity-70">
              Il tuo personaggio
            </span>
            <span className="display mt-1 flex items-center gap-2 text-[28px] uppercase leading-none">
              {AVATAR_PRESETS.find((p) => p.id === characterOf(me))?.name}
              <NewDot count={newChars || -1} />
            </span>
            <span className="mt-2 block text-[13px] opacity-80">
              {newChars
                ? newChars === 1
                  ? "Ne hai sbloccato uno nuovo: aprilo"
                  : `Ne hai sbloccati ${newChars} nuovi: aprili`
                : "Con i badge ne sblocchi di speciali"}
            </span>
          </span>
          <span className="-mb-4 shrink-0">
            <Character
              id={characterOf(me)}
              outfit={me.outfit}
              number={me.jerseyNumber}
              height={128}
            />
          </span>
        </button>

        <Group title="Profilo">
          <button
            className="press flex w-full items-center gap-3 px-4 py-3 text-left"
            onClick={() => setPicking(true)}
          >
            <span className="relative">
              <Avatar player={me} size={44} href={false} />
              <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border-2 border-surface bg-ball text-ball-ink">
                {uploading ? <Spinner size={10} /> : <IconCamera size={12} />}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">
                Foto profilo
              </span>
              <span className="block text-[12.5px] text-muted">
                Una figurina o una tua foto
              </span>
            </span>
            <IconChevronRight size={18} className="text-faint" />
          </button>
          <div className="px-4 py-3.5">
            <p className="mb-3 text-[15px] font-semibold">
              Sfondo della figurina
            </p>
            <div
              className="grid grid-cols-8 gap-1.5"
              role="radiogroup"
              aria-label="Sfondo della figurina"
            >
              {CARD_COLORS.map((c) => {
                const on =
                  playerColor(me).toLowerCase() === c.value.toLowerCase();
                return (
                  <button
                    key={c.value}
                    role="radio"
                    aria-checked={on}
                    aria-label={c.name}
                    onClick={() =>
                      void patchMe(
                        { cardColor: c.value },
                        `Sfondo ${c.name.toLowerCase()}, ottima scelta`,
                      )
                    }
                    className={clsx(
                      "press grid aspect-square w-full max-w-[36px] place-items-center justify-self-center rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] transition-transform",
                      on &&
                        "scale-110 ring-2 ring-text ring-offset-2 ring-offset-surface",
                    )}
                    style={{ background: c.value }}
                  >
                    {on && (
                      <IconCheck
                        size={16}
                        strokeWidth={3.2}
                        className={
                          isLightColor(c.value)
                            ? "text-[#1d1a16]"
                            : "text-[#fffaf0]"
                        }
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <Row>
            <button
              className="press flex min-h-10 min-w-0 flex-1 items-center gap-2 text-left"
              onClick={() => setNaming(true)}
            >
              <span className="shrink-0 text-[15px] font-semibold">
                Nome nell&apos;app
              </span>
              <span className="min-w-0 flex-1 truncate text-right text-[15px] text-muted">
                {me.nickname}
              </span>
              {nameUnlockDate(me) ? (
                <IconLock
                  size={16}
                  className="shrink-0 text-faint"
                  aria-label="bloccato per ora"
                />
              ) : (
                <IconChevronRight size={18} className="shrink-0 text-faint" />
              )}
            </button>
          </Row>
          <Row>
            <label
              htmlFor="jersey"
              className="shrink-0 text-[15px] font-semibold"
            >
              Numero di maglia
            </label>
            <input
              id="jersey"
              inputMode="numeric"
              value={jersey}
              placeholder="—"
              onChange={(e) =>
                setJersey(e.target.value.replace(/\D/g, "").slice(0, 2))
              }
              onBlur={() => {
                const v = jersey === "" ? null : Number(jersey);
                if (v !== me.jerseyNumber)
                  void patchMe({ jerseyNumber: v }, "Ho salvato il numero");
              }}
              className="num ml-auto h-10 w-16 rounded-[12px] bg-raised text-center text-[18px] outline-none placeholder:text-faint focus:ring-2 focus:ring-ball"
            />
          </Row>
          <Row icon={<IconEye size={18} />}>
            <Link
              href={playerHref(me.id, true)}
              className="flex min-w-0 flex-1 items-center gap-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">
                  Come ti vedono gli altri
                </span>
                <span className="block text-[12.5px] text-muted">
                  Il tuo profilo, nella versione per il gruppo
                </span>
              </span>
              <IconChevronRight size={18} className="shrink-0 text-faint" />
            </Link>
          </Row>
        </Group>

        <Group title="App">
          <Row icon={<IconPalette size={18} />}>
            <Segmented
              className="flex-1"
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
          <Row
            icon={
              sounds ? <IconVolume size={18} /> : <IconVolumeOff size={18} />
            }
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">Suoni</span>
              <span className="block text-[12.5px] text-muted">
                {sounds
                  ? "Fischio, canestri e vittorie, sempre leggeri"
                  : "Spenti, l'app resta in silenzio"}
              </span>
            </span>
            <Toggle
              label="Suoni"
              checked={sounds}
              onChange={(on) => {
                setSoundOn(on);
                if (on) window.setTimeout(() => play("swish"), 160);
              }}
            />
          </Row>
          <Row
            icon={
              hlEnd === "loop" ? (
                <IconRepeat size={18} />
              ) : (
                <IconMovie size={18} />
              )
            }
          >
            <span className="min-w-0 flex-1" data-testid="hl-end">
              <span className="block text-[15px] font-semibold">
                Fine di un highlight
              </span>
              <span className="block text-[12.5px] text-muted">
                {hlEnd === "loop"
                  ? "Ricomincia quello che stai guardando"
                  : "Parte subito il prossimo, come nei Reels"}
              </span>
              <Segmented
                className="mt-2"
                size="sm"
                value={hlEnd}
                onChange={(v) => {
                  setHlEnd(v);
                  setHighlightEnd(v);
                }}
                options={[
                  { value: "next", label: "Il prossimo" },
                  { value: "loop", label: "Ricomincia" },
                ]}
              />
            </span>
          </Row>
          <Row icon={<IconBell size={18} />}>
            <Link
              href="/profilo/notifiche"
              className="flex min-w-0 flex-1 items-center gap-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">
                  Notifiche
                </span>
                <span className="block text-[12.5px] text-muted">
                  {push.on
                    ? "Attive, scegli cosa ricevere"
                    : "Spente, tocca per sceglierle"}
                </span>
              </span>
              <IconChevronRight size={18} className="shrink-0 text-faint" />
            </Link>
          </Row>
          {!standalone && (
            <Row icon={<IconDownload size={18} />}>
              <p className="min-w-0 flex-1 text-[13.5px] text-muted">
                {isIos()
                  ? "In Safari: Condividi, poi “Aggiungi alla schermata Home”"
                  : "Mettila nella Home: si apre a schermo intero"}
              </p>
              {install && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => void install.prompt()}
                >
                  Installa
                </Button>
              )}
            </Row>
          )}
        </Group>

        <Group title="Aiuto">
          <Row icon={<IconCompass size={18} />}>
            <button
              onClick={() => setGuide(true)}
              className="flex flex-1 items-center text-left text-[15px] font-semibold"
            >
              Guida all&apos;app
              <IconChevronRight size={18} className="ml-auto text-faint" />
            </button>
          </Row>
          <Row icon={<IconMessageReport size={18} />}>
            <button
              onClick={() => setFeedback(true)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">
                  Segnala un problema
                </span>
                <span className="block text-[12.5px] text-muted">
                  O suggerisci un&apos;idea
                </span>
              </span>
              <IconChevronRight size={18} className="shrink-0 text-faint" />
            </button>
          </Row>
        </Group>

        <Group title="Account">
          {playerView.available && (
            <Row icon={<IconUsers size={18} />}>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">
                  Usa l&apos;app come un giocatore
                </span>
                <span className="block text-[12.5px] text-muted">
                  Vedi quello che vedono gli altri, senza i tuoi strumenti
                </span>
              </span>
              <Toggle
                label="Usa l'app come un giocatore"
                checked={playerView.on}
                onChange={(on) => {
                  playerView.set(on);
                  toast(
                    on
                      ? "Ora vedi l'app come gli altri: per tornare tocca Esci in alto"
                      : "Bentornato, hai di nuovo i tuoi strumenti",
                  );
                }}
              />
            </Row>
          )}
          {me.isAdmin && (
            <Row icon={<IconShield size={18} />}>
              <Link
                href="/admin"
                className="flex flex-1 items-center text-[15px] font-semibold"
              >
                Gestione del gruppo
                <IconChevronRight size={18} className="ml-auto text-faint" />
              </Link>
            </Row>
          )}
          <Row icon={<IconLogout size={18} />} danger>
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
      <Sheet
        open={guide}
        onOpenChange={setGuide}
        title="Guida all'app"
        description="Spicchio ti rimostra come funziona"
      >
        <div className="flex flex-col gap-3 pb-2">
          <Button
            variant="court"
            block
            onClick={() => {
              setGuide(false);
              window.setTimeout(() => tour?.restart(), 350);
            }}
          >
            Ricomincia da capo
          </Button>
          <div className="divide-y divide-line overflow-hidden rounded-[22px] bg-surface shadow-[var(--shadow)]">
            {SECTION_IDS.map((id) => {
              const sec = sections(me.isAdmin)[id];
              return (
                <button
                  key={id}
                  onClick={() => {
                    setGuide(false);
                    window.setTimeout(() => tour?.begin(id), 350);
                  }}
                  className="flex min-h-[56px] w-full items-center gap-3 px-4 text-left active:bg-raised"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">
                      Solo {sec.title}
                    </span>
                    <span className="block text-[12.5px] text-muted">
                      {sec.steps.length} passaggi brevi
                    </span>
                  </span>
                  <IconChevronRight size={18} className="text-faint" />
                </button>
              );
            })}
          </div>
        </div>
      </Sheet>
      <Sheet
        open={picking}
        onOpenChange={setPicking}
        title="Foto profilo"
        description="Scegli una figurina o una tua foto"
      >
        <div className="pb-2">
          <AvatarPicker
            value={me.avatarUrl}
            uploading={uploading}
            onPreset={(url) =>
              void patchMe({ avatarUrl: url }, "Ho cambiato la figurina")
            }
            onInitials={() =>
              void patchMe({ avatarUrl: null }, "Ora uso le tue iniziali")
            }
            onFile={async (f) => {
              setUploading(true);
              try {
                const url = await backend.uploadAvatar(await compressAvatar(f));
                await patchMe({ avatarUrl: url }, "Ho messo la tua foto");
              } catch (err) {
                toast(say(err), "error");
              } finally {
                setUploading(false);
              }
            }}
          />
        </div>
      </Sheet>
      <Sheet
        open={characters}
        onOpenChange={setCharacters}
        title="Il tuo personaggio"
        description="Compare nelle sfide e nel tuo profilo"
      >
        <div className="pb-2">
          <CharacterGrid onOpen={setCard} />
        </div>
      </Sheet>
      <CharacterCard
        id={card}
        onClose={() => setCard(null)}
        onUse={(id) => {
          void patchMe(
            { character: id },
            `Ora sei ${AVATAR_PRESETS.find((p) => p.id === id)?.name}, gran scelta`,
          );
          setCard(null);
        }}
      />
      <FeedbackSheet open={feedback} onClose={() => setFeedback(false)} />
      {/* Rimontato a ogni apertura, così riparte dal nome attuale. */}
      {naming && <NameSheet me={me} open onClose={() => setNaming(false)} />}
    </>
  );
}
