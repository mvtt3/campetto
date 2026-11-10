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
  IconShirt,
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

const LABEL =
  "mb-2 mt-6 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted";

const TILE =
  "flex min-h-[112px] flex-col gap-3 rounded-[22px] bg-surface p-3.5 shadow-[var(--shadow)]";

const THEMES: { value: ThemePref; label: string; preview: string }[] = [
  { value: "light", label: "Chiaro", preview: "#f6ecdc" },
  { value: "dark", label: "Scuro", preview: "#1d1a16" },
  {
    value: "system",
    label: "Auto",
    preview: "linear-gradient(135deg, #f6ecdc 50%, #1d1a16 50%)",
  },
];

function Group({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-[22px] bg-surface shadow-[var(--shadow)]">
      {children}
    </div>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-ball-soft text-ball">
      {children}
    </span>
  );
}

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-[64px] items-center gap-3 px-4 py-3">
      <Icon>{icon}</Icon>
      {children}
    </div>
  );
}

function LinkRow({
  href,
  icon,
  title,
  text,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="press flex min-h-[64px] items-center gap-3 px-4 py-3"
    >
      <Icon>{icon}</Icon>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="block text-[12.5px] text-muted">{text}</span>
      </span>
      <IconChevronRight size={18} className="shrink-0 text-faint" />
    </Link>
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
  const tint = playerColor(me);
  const ink = isLightColor(tint) ? "text-[#1d1a16]" : "text-white";

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
        <section
          className="relative isolate mt-3 overflow-hidden rounded-[26px] shadow-[var(--shadow)]"
          style={{ backgroundColor: tint }}
        >
          <span
            aria-hidden
            className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_60%_at_8%_0%,rgb(255_255_255/0.32),transparent_60%),linear-gradient(165deg,transparent_40%,rgb(0_0_0/0.5))]"
          />
          <span
            aria-hidden
            className="display pointer-events-none absolute -right-2 -top-6 -z-10 text-[150px] leading-none text-white/15"
          >
            {me.jerseyNumber ?? ""}
          </span>
          <div className={clsx("flex items-end gap-2 px-4 pt-4", ink)}>
            <div className="min-w-0 flex-1 pb-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-70">
                {me.jerseyNumber !== null && `#${me.jerseyNumber} · `}
                {me.roles[0] ?? "Giocatore"}
              </p>
              <p className="display mt-1 truncate text-[30px] uppercase leading-none">
                {me.nickname}
              </p>
              <Link
                href={playerHref(me.id, true)}
                className="press mt-3 inline-flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1.5 text-[12.5px] font-semibold text-white backdrop-blur-sm"
              >
                <IconEye size={15} aria-hidden />
                Come ti vedono gli altri
              </Link>
            </div>
            <button
              onClick={() => setCharacters(true)}
              data-tour="settings-character"
              className="press relative -mb-1 shrink-0"
            >
              <span className="sr-only">Apri la collezione dei personaggi</span>
              <NewDot
                count={newChars || -1}
                className="absolute right-2 top-1 z-10"
              />
              <Character
                id={characterOf(me)}
                outfit={me.outfit}
                number={me.jerseyNumber}
                height={140}
              />
            </button>
          </div>
          <div
            className="grid grid-cols-8 gap-1.5 bg-black/20 px-4 py-3 backdrop-blur-sm"
            role="radiogroup"
            aria-label="Sfondo della figurina"
          >
            {CARD_COLORS.map((c) => {
              const on = tint.toLowerCase() === c.value.toLowerCase();
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
                    "press grid aspect-square w-full max-w-[30px] place-items-center justify-self-center rounded-full ring-2 transition-transform",
                    on ? "scale-110 ring-white" : "ring-white/30",
                  )}
                  style={{ background: c.value }}
                >
                  {on && (
                    <IconCheck
                      size={14}
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
        </section>

        <h2 className={LABEL}>Il tuo giocatore</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setPicking(true)}
            className={clsx(TILE, "press text-left")}
          >
            <span className="relative self-start">
              <Avatar player={me} size={40} href={false} />
              <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-surface bg-ball text-ball-ink">
                {uploading ? <Spinner size={9} /> : <IconCamera size={11} />}
              </span>
            </span>
            <span className="mt-auto">
              <span className="block text-[14.5px] font-semibold">
                Foto profilo
              </span>
              <span className="block text-[12px] text-muted">
                Figurina o foto
              </span>
            </span>
          </button>
          <button
            onClick={() => setCharacters(true)}
            className={clsx(TILE, "press text-left")}
          >
            <span className="flex items-start justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-ball-soft text-ball">
                <IconShirt size={20} aria-hidden />
              </span>
              <NewDot count={newChars || -1} />
            </span>
            <span className="mt-auto">
              <span className="block text-[14.5px] font-semibold">
                Il tuo personaggio
              </span>
              <span className="block truncate text-[12px] text-muted">
                {newChars
                  ? newChars === 1
                    ? "Uno nuovo da aprire"
                    : `${newChars} nuovi da aprire`
                  : AVATAR_PRESETS.find((p) => p.id === characterOf(me))?.name}
              </span>
            </span>
          </button>
          <button
            onClick={() => setNaming(true)}
            className={clsx(TILE, "press text-left")}
          >
            <span className="flex items-start justify-between">
              <span className="text-[12px] font-semibold text-muted">
                Nome nell&apos;app
              </span>
              {nameUnlockDate(me) && (
                <IconLock
                  size={15}
                  className="text-faint"
                  aria-label="bloccato per ora"
                />
              )}
            </span>
            <span className="title mt-auto truncate text-[22px] leading-tight">
              {me.nickname}
            </span>
          </button>
          <label htmlFor="jersey" className={clsx(TILE, "cursor-text")}>
            <span className="text-[12px] font-semibold text-muted">
              Numero di maglia
            </span>
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
              className="score mt-auto w-full bg-transparent text-[34px] leading-none text-ball outline-none placeholder:text-faint"
            />
          </label>
        </div>

        <h2 className={LABEL}>Aspetto</h2>
        <div
          className="grid grid-cols-3 gap-3"
          role="radiogroup"
          aria-label="Tema"
        >
          {THEMES.map((t) => (
            <button
              key={t.value}
              role="radio"
              aria-checked={theme === t.value}
              onClick={() => {
                setTheme(t.value);
                setThemePref(t.value);
              }}
              className={clsx(
                "press flex flex-col items-center gap-2 rounded-[22px] bg-surface p-2.5 shadow-[var(--shadow)] ring-2 transition-shadow",
                theme === t.value ? "ring-ball" : "ring-transparent",
              )}
            >
              <span
                aria-hidden
                className="flex h-16 w-full flex-col gap-1.5 overflow-hidden rounded-[14px] p-2"
                style={{ background: t.preview }}
              >
                <span className="h-2 w-2/3 rounded-full bg-[#f26a1b]" />
                <span className="h-2 w-full rounded-full bg-[#8a7a66]/40" />
                <span className="h-2 w-4/5 rounded-full bg-[#8a7a66]/40" />
              </span>
              <span className="text-[13px] font-semibold">{t.label}</span>
            </button>
          ))}
        </div>

        <h2 className={LABEL}>Preferenze</h2>
        <Group>
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
          <div className="px-4 py-3.5" data-testid="hl-end">
            <div className="flex items-center gap-3">
              <Icon>
                {hlEnd === "loop" ? (
                  <IconRepeat size={18} />
                ) : (
                  <IconMovie size={18} />
                )}
              </Icon>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">
                  Fine di un highlight
                </span>
                <span className="block text-[12.5px] text-muted">
                  {hlEnd === "loop"
                    ? "Ricomincia quello che stai guardando"
                    : "Parte subito il prossimo, come nei Reels"}
                </span>
              </span>
            </div>
            <Segmented
              className="mt-3"
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
          </div>
          <LinkRow
            href="/profilo/notifiche"
            icon={<IconBell size={18} />}
            title="Notifiche"
            text={
              push.on
                ? "Attive, scegli cosa ricevere"
                : "Spente, tocca per sceglierle"
            }
          />
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

        <h2 className={LABEL}>Aiuto</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setGuide(true)}
            className={clsx(TILE, "press text-left")}
          >
            <Icon>
              <IconCompass size={20} />
            </Icon>
            <span className="mt-auto">
              <span className="block text-[14.5px] font-semibold">
                Guida all&apos;app
              </span>
              <span className="block text-[12px] text-muted">
                Spicchio ti rimostra tutto
              </span>
            </span>
          </button>
          <button
            onClick={() => setFeedback(true)}
            className={clsx(TILE, "press text-left")}
          >
            <Icon>
              <IconMessageReport size={20} />
            </Icon>
            <span className="mt-auto">
              <span className="block text-[14.5px] font-semibold">
                Segnala un problema
              </span>
              <span className="block text-[12px] text-muted">
                O suggerisci un&apos;idea
              </span>
            </span>
          </button>
        </div>

        {(playerView.available || me.isAdmin) && (
          <>
            <h2 className={LABEL}>Gruppo</h2>
            <Group>
              {me.isAdmin && (
                <LinkRow
                  href="/admin"
                  icon={<IconShield size={18} />}
                  title="Gestione del gruppo"
                  text="Giocatori, richieste e partite"
                />
              )}
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
            </Group>
          </>
        )}

        <button
          onClick={async () => {
            await backend.signOut();
            router.replace("/login");
            await reinit();
          }}
          className="press mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-danger/10 text-[15px] font-semibold text-danger"
        >
          <IconLogout size={18} aria-hidden />
          Esci
        </button>
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
