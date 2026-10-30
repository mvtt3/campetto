"use client";

import clsx from "clsx";
import Link from "next/link";
import {
  CalendarDays,
  Crown,
  Flame,
  Layers2,
  Lock,
  Megaphone,
  Newspaper,
  Sparkles,
  Trophy,
  X,
  Zap,
} from "lucide-react";
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

const ICON: Record<NewsIcon, typeof Flame> = {
  record: Trophy,
  fire: Flame,
  double: Layers2,
  streak: Zap,
  crown: Crown,
  calendar: CalendarDays,
  season: Sparkles,
  megaphone: Megaphone,
  leader: Trophy,
};
const TINT: Record<NewsIcon, string> = {
  record: "bg-volt text-volt-ink",
  fire: "bg-ball text-ball-ink",
  double: "bg-[#6b46b8] text-white",
  streak: "bg-volt text-volt-ink",
  crown: "bg-volt text-volt-ink",
  calendar: "bg-court text-court-ink",
  season: "bg-ball text-ball-ink",
  megaphone: "bg-court text-court-ink",
  leader: "bg-ok text-white",
};

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
  const unseen = stories.filter((s) => s.date > (seen || floor)).length;
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
  return { stories, unseen, markSeen };
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
      aria-label={unseen ? `Notizie, ${unseen} nuove` : "Notizie"}
      className="sticker-sm press relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface"
    >
      <Newspaper size={20} />
      {unseen > 0 && (
        <span className="new-dot absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-surface bg-danger px-1 text-[10px] font-bold leading-none text-white">
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
      className="overflow-hidden rounded-[20px] border-[2.5px] border-edge bg-court text-court-ink"
      aria-hidden
    >
      <div className="halftone relative px-3 pb-3 pt-2.5">
        <div className="flex items-center justify-between">
          <span className="display text-[17px] leading-none">
            Pass di stagione
          </span>
          <span className="rotate-[-4deg] rounded-md border-2 border-[#1d1a16] bg-volt px-1.5 py-0.5 text-[10.5px] font-bold text-volt-ink">
            Presto
          </span>
        </div>
        {/* Il percorso: sei tappe con i premi coperti, la prima già illuminata. */}
        <div className="relative mt-3 flex items-center justify-between">
          <span className="absolute inset-x-3 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#fffaf0]/25" />
          <span className="absolute left-3 top-1/2 h-1.5 w-[14%] -translate-y-1/2 rounded-full bg-volt" />
          {tiers.map((t) => (
            <span
              key={t}
              className={clsx(
                "relative grid h-10 w-10 place-items-center rounded-[12px] border-2 border-[#1d1a16]",
                t === 1
                  ? "bg-volt text-volt-ink"
                  : "bg-[#fffaf0] text-[#1d1a16]/45",
                t === 6 && "h-12 w-12 bg-ball text-ball-ink",
              )}
            >
              {t === 1 ? (
                <Sparkles size={18} />
              ) : t === 6 ? (
                <Crown size={20} />
              ) : (
                <Lock size={15} />
              )}
              <span className="absolute -bottom-2 rounded-full border border-[#1d1a16] bg-[#fffaf0] px-1 text-[9px] font-bold text-[#1d1a16]">
                {t}
              </span>
            </span>
          ))}
        </div>
        <p className="mt-3.5 text-[11.5px] font-semibold opacity-90">
          Gioca, sali di livello, sblocca premi
        </p>
      </div>
    </div>
  );
}

function StoryCard({ s, onGo }: { s: NewsStory; onGo: () => void }) {
  const Icon = ICON[s.icon];
  const body = (
    <>
      <span
        className={clsx(
          "grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-edge",
          TINT[s.icon],
        )}
      >
        <Icon size={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-bold leading-snug">
          {s.title}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-muted">
          {s.body}
        </span>
        <span className="mt-1 block text-[11.5px] font-semibold text-faint">
          {when(s.date)}
        </span>
      </span>
    </>
  );
  return s.href ? (
    <Link
      href={s.href}
      onClick={onGo}
      className="card press flex items-start gap-3 p-3 text-left"
    >
      {body}
    </Link>
  ) : (
    <div className="card flex items-start gap-3 p-3">{body}</div>
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
}: {
  open: boolean;
  onClose: () => void;
  stories: NewsStory[];
}) {
  const now = useNow();
  const before = now < SEASONS_START;
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
          className="safe-top fixed inset-y-0 right-0 z-50 flex w-[88vw] max-w-[420px] flex-col rounded-l-[28px] border-[2.5px] border-r-0 border-edge bg-bg outline-none will-change-transform [contain:layout_paint]"
        >
          <div className="flex shrink-0 items-center gap-3 px-4 pb-2 pt-3">
            <Newspaper size={22} className="text-court" aria-hidden />
            <Drawer.Title className="display flex-1 text-[24px]">
              Notizie
            </Drawer.Title>
            <Drawer.Close
              aria-label="Chiudi"
              className="press grid h-9 w-9 place-items-center rounded-full border-2 border-edge bg-surface"
            >
              <X size={18} strokeWidth={2.4} />
            </Drawer.Close>
          </div>
          <div
            className="scroll-area safe-bottom flex min-h-0 flex-1 flex-col gap-2.5 px-4 pb-6"
            data-vaul-no-drag=""
          >
            {/* Le stagioni: un'anteprima, i dettagli a dicembre. */}
            <section
              className="card flex flex-col gap-2.5 p-3"
              aria-label="Arrivano le stagioni"
            >
              <div className="flex items-start gap-3">
                <span
                  className={clsx(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-edge",
                    TINT.season,
                  )}
                >
                  <Sparkles size={18} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-bold leading-snug">
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
              <p className="px-2 py-8 text-center text-[14px] text-muted">
                Le notizie arrivano con le prime partite: record, serate e chi
                va più forte
              </p>
            ) : (
              stories.map((s) => <StoryCard key={s.id} s={s} onGo={onClose} />)
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
