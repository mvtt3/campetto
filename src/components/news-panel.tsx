"use client";

import clsx from "clsx";
import Link from "next/link";
import {
  IconBolt,
  IconCalendar,
  IconCrown,
  IconFlame,
  IconLock,
  IconMovie,
  IconNews,
  IconSparkles,
  IconSpeakerphone,
  IconStack2,
  IconTrophy,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { Drawer } from "vaul";
import { useData } from "@/lib/data/provider";
import {
  buildNews,
  SEASONS_START,
  type NewsIcon,
  type NewsStory,
} from "@/lib/news";
import { useNow } from "@/lib/use-now";
import { useHighlights } from "@/components/highlights/provider";
import { NewDot } from "@/components/new-dot";
import {
  StudioNewsCard,
  useStudioEnabled,
  useStudioLatest,
} from "@/components/studio/studio-entry";

const ICON: Record<NewsIcon, typeof IconFlame> = {
  record: IconTrophy,
  fire: IconFlame,
  double: IconStack2,
  streak: IconBolt,
  crown: IconCrown,
  calendar: IconCalendar,
  season: IconSparkles,
  megaphone: IconSpeakerphone,
  leader: IconTrophy,
  video: IconMovie,
};
const TINT: Record<NewsIcon, string> = {
  record: "bg-volt/30 text-volt-ink",
  fire: "bg-ball-soft text-ball",
  double: "bg-[#6b46b8]/15 text-[#6b46b8]",
  streak: "bg-volt/30 text-volt-ink",
  crown: "bg-volt/30 text-volt-ink",
  calendar: "bg-raised text-text",
  season: "bg-ball-soft text-ball",
  megaphone: "bg-raised text-text",
  leader: "bg-ok/15 text-ok",
  video: "bg-ball-soft text-ball",
};

const ICON_BOX =
  "grid h-10 w-10 shrink-0 place-items-center rounded-[14px]";

const SEEN_KEY = (id: string) => `campetto:notizie-viste:${id}`;

function readSeen(id: string): string {
  try {
    return localStorage.getItem(SEEN_KEY(id)) ?? "";
  } catch {
    return "";
  }
}

/** Le notizie del gruppo, già calcolate: per il pallino e per il pannello. */
export function useNews(): {
  stories: NewsStory[];
  unseen: number;
  /** Da quando le notizie contano come nuove (prima di segnarle viste): per i pallini sulle schede. */
  since: string;
  markSeen: () => void;
} {
  const { data, me, engine } = useData();
  const now = useNow();
  const stories = useMemo(
    () =>
      buildNews(data.matches, data.players, data.news ?? [], engine.elo, now),
    [data.matches, data.players, data.news, engine.elo, now],
  );
  const [seen, setSeen] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (me) setSeen(readSeen(me.id));
  }, [me]);
  // Chi entra per la prima volta non trova decine di "nuove": conta solo l'ultima settimana.
  const floor = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const since = seen || floor;
  const unseen = stories.filter((s) => s.date > since).length;
  const markSeen = () => {
    if (!me) return;
    const at = new Date().toISOString();
    try {
      localStorage.setItem(SEEN_KEY(me.id), at);
    } catch {
      /* ignore */
    }
    setSeen(at);
  };
  return { stories, unseen, since, markSeen };
}

/** Il tasto del giornale nella Home, con il pallino quando c'è qualcosa di nuovo. */
export function NewsButton({
  unseen,
  onOpen,
}: {
  unseen: number;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      data-tour="home-news"
      aria-label={
        unseen ? `Notizie, ${unseen > 9 ? "9+" : unseen} nuove` : "Notizie"
      }
      className="sticker-sm press relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface"
    >
      <IconNews size={20} />
      {unseen > 0 && (
        <span
          aria-hidden
          className="new-dot absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-surface bg-danger px-1 text-[10px] font-bold leading-none text-white"
        >
          {unseen > 9 ? "9+" : unseen}
        </span>
      )}
    </button>
  );
}

/** L'anteprima del pass delle stagioni: un biglietto con i premi ancora coperti. */
function SeasonPreview() {
  const tiers = [1, 2, 3, 4, 5, 6];
  return (
    <div
      className="overflow-hidden rounded-[18px] bg-[linear-gradient(135deg,#ffd451_0%,#ffb238_55%,#ff8f2b_100%)] text-[#1d1a16]"
      aria-hidden
    >
      <div className="relative px-3.5 pb-3.5 pt-3">
        <div className="flex items-center justify-between">
          <span className="display text-[17px] leading-none">
            Pass di stagione
          </span>
          <span className="rounded-full bg-[#1d1a16] px-2 py-0.5 text-[10.5px] font-bold text-volt">
            Presto
          </span>
        </div>
        <div className="relative mt-3.5 flex items-center justify-between">
          <span className="absolute inset-x-3 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#1d1a16]/15" />
          <span className="absolute left-3 top-1/2 h-1 w-[14%] -translate-y-1/2 rounded-full bg-[#1d1a16]" />
          {tiers.map((t) => (
            <span
              key={t}
              className={clsx(
                "relative grid h-10 w-10 place-items-center rounded-[12px]",
                t === 1
                  ? "bg-[#1d1a16] text-volt"
                  : "bg-[#fffaf0]/70 text-[#1d1a16]/40",
                t === 6 && "h-12 w-12 !bg-[#fffaf0] !text-ball",
              )}
            >
              {t === 1 ? (
                <IconSparkles size={18} />
              ) : t === 6 ? (
                <IconCrown size={20} />
              ) : (
                <IconLock size={15} />
              )}
              <span className="absolute -bottom-2 rounded-full bg-[#1d1a16] px-1.5 text-[9px] font-bold text-[#fffaf0]">
                {t}
              </span>
            </span>
          ))}
        </div>
        <p className="mt-3.5 text-[11.5px] font-semibold opacity-75">
          Gioca, sali di livello, sblocca premi
        </p>
      </div>
    </div>
  );
}

function StoryCard({
  s,
  fresh,
  onGo,
}: {
  s: NewsStory;
  /** Mai vista prima di aprire il pannello questa volta: il pallino rosso sulla scheda. */
  fresh: boolean;
  onGo: () => void;
}) {
  const Icon = ICON[s.icon];
  const hl = useHighlights();
  const body = (
    <>
      {fresh && (
        <>
          <NewDot className="absolute right-3 top-3" />
          <span className="sr-only">Nuova: </span>
        </>
      )}
      <span className={clsx(ICON_BOX, TINT[s.icon])}>
        <Icon size={19} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={clsx(
            "block text-[14.5px] font-semibold leading-snug",
            fresh && "pr-4",
          )}
        >
          {s.title}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-muted">
          {s.body}
        </span>
        <span className="mt-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">
          {when(s.date)}
        </span>
      </span>
    </>
  );
  // La novità degli highlights: il tocco chiude le notizie e apre il video più recente.
  if (s.highlights && hl.latest)
    return (
      <button
        onClick={() => {
          onGo();
          if (hl.latest) hl.open(hl.latest);
        }}
        className="card press relative flex w-full items-start gap-3 p-3 text-left"
        data-testid="news-highlights"
        data-fresh={fresh || undefined}
      >
        {body}
      </button>
    );
  return s.href ? (
    <Link
      href={s.href}
      onClick={onGo}
      className="card press relative flex items-start gap-3 p-3 text-left"
      data-testid="news-story"
      data-fresh={fresh || undefined}
    >
      {body}
    </Link>
  ) : (
    <div
      className="card relative flex items-start gap-3 p-3"
      data-testid="news-story"
      data-fresh={fresh || undefined}
    >
      {body}
    </div>
  );
}

function when(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor(
    (new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) /
      86_400_000,
  );
  if (days <= 0) return "Oggi";
  if (days === 1) return "Ieri";
  if (days < 7)
    return d
      .toLocaleDateString("it-IT", { weekday: "long" })
      .replace(/^./, (c) => c.toUpperCase());
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "long" });
}

/**
 * Il pannello delle notizie: entra da destra, sopra la Home, e si chiude con la X, toccando
 * fuori o trascinandolo verso destra. In cima l'anteprima delle stagioni.
 */
export function NewsPanel({
  open,
  onClose,
  stories,
  freshSince = null,
}: {
  open: boolean;
  onClose: () => void;
  stories: NewsStory[];
  /** Le notizie dopo questo momento hanno il pallino (solo per questa apertura del pannello). */
  freshSince?: string | null;
}) {
  const now = useNow();
  const before = now < SEASONS_START;
  // Lo Studio Campetto in cima alle notizie: per ora solo l'amministratore.
  const studio = useStudioLatest(useStudioEnabled());
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => !o && onClose()}
      direction="right"
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-[#1d1a16]/45" />
        <Drawer.Content
          aria-describedby={undefined}
          className="safe-top fixed inset-y-0 right-0 z-50 flex w-[88vw] max-w-[420px] flex-col rounded-l-[28px] bg-bg shadow-[-12px_0_40px_-12px_rgb(29_26_22/0.35)] outline-none will-change-transform [contain:layout_paint]"
        >
          <div className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-5">
            <Drawer.Title className="display flex-1 text-[26px]">
              Notizie
            </Drawer.Title>
            <Drawer.Close
              aria-label="Chiudi"
              className="press grid h-9 w-9 place-items-center rounded-full bg-surface text-muted shadow-[var(--shadow)]"
            >
              <IconX size={17} strokeWidth={2.4} />
            </Drawer.Close>
          </div>
          <div
            className="scroll-area safe-bottom flex min-h-0 flex-1 flex-col gap-2.5 px-4 pb-6"
            data-vaul-no-drag=""
          >
            {studio && <StudioNewsCard latest={studio} />}
            <section
              className="card flex flex-col gap-3 p-3"
              aria-label="Arrivano le stagioni"
            >
              <div className="flex items-start gap-3">
                <span className={clsx(ICON_BOX, TINT.season)}>
                  <IconSparkles size={19} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-semibold leading-snug">
                    {before
                      ? "Dal 1° dicembre arrivano le stagioni"
                      : "Le stagioni sono arrivate"}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-muted">
                    Ogni partita farà salire il tuo pass di stagione e lungo la
                    strada sbloccherai premi: figurine, cornici e badge
                    speciali. I dettagli a dicembre
                  </span>
                </span>
              </div>
              <SeasonPreview />
            </section>
            {stories.length === 0 ? (
              <p className="px-6 py-10 text-center text-[13.5px] text-muted">
                Le notizie arrivano con le prime partite: record, serate e chi
                va più forte
              </p>
            ) : (
              stories.map((s) => (
                <StoryCard
                  key={s.id}
                  s={s}
                  fresh={!!freshSince && s.date > freshSince}
                  onGo={onClose}
                />
              ))
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
