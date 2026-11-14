"use client";

import clsx from "clsx";

import { IconCrown } from "@tabler/icons-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { BADGE_BY_KEY, type BadgeUnlock } from "@/lib/badges";
import { useData } from "@/lib/data/provider";
import { play } from "@/lib/sound";
import { matchMvp } from "@/lib/stats/match-mvp";
import { normalizeBox, teamOf } from "@/lib/stats/player";
import { sortChrono } from "@/lib/periods";
import { winnerOf, type NewsPost, type Proposal } from "@/lib/types";
import {
  pregameTargets,
  previewProposal,
  type PregameTarget,
} from "@/lib/stats/pregame";
import { PregameBody } from "./pregame-preview";
import { StudioShowLoader } from "./studio/studio-show";
import {
  setStudioSeen,
  StudioHosts,
  studioDay,
  studioSeen,
  useStudioEnabled,
  useStudioLatest,
  type StudioLatest,
} from "./studio/studio-entry";
import { useRouter } from "next/navigation";
import { say } from "@/lib/voice";
import {
  AVATAR_PRESETS,
  RARITY,
  type AvatarPresetId,
  type Rarity,
} from "./avatar-presets";
import { BadgeMedal, TIER_STYLE } from "./badge-medal";
import { characterProgress } from "./character";
import { Character3D } from "./character-card";
import { useIntroDone } from "./intro";
import { isNewcomer } from "./rewards";
import { Mascot } from "./mascot";
import { Button, CourtLines } from "./ui/basics";
import { useToast } from "./ui/toast";

const badgeKey = (u: BadgeUnlock) => `${u.key}:${u.tier}`;

interface ResultItem {
  kind: "result";
  id: string;
  won: number;
  lost: number;
  /** L'ultima partita nuova: punteggio, dalla tua parte. */
  mine: number;
  theirs: number;
  line: string | null;
  elo: number | null;
  /** Nell'ultima partita sei stato l'MVP. */
  mvp: boolean;
}
type Item =
  | ResultItem
  | { kind: "badge"; id: string; unlock: BadgeUnlock }
  | { kind: "character"; id: AvatarPresetId }
  | { kind: "news"; id: string; post: NewsPost }
  | { kind: "preview"; id: string; proposal: Proposal; targets: PregameTarget[] }
  | { kind: "studio"; id: string; latest: StudioLatest };

/** L'anteprima si vede una volta per partita: la sera prima o la mattina, la prima apertura. */
const previewKey = (meId: string) => `campetto:anteprima:${meId}`;
function previewSeen(meId: string, proposalId: string): boolean {
  try {
    const list = JSON.parse(localStorage.getItem(previewKey(meId)) ?? "[]");
    return Array.isArray(list) && list.includes(proposalId);
  } catch {
    return false;
  }
}
function setPreviewSeen(meId: string, proposalId: string) {
  try {
    const list = JSON.parse(localStorage.getItem(previewKey(meId)) ?? "[]");
    const next = [...(Array.isArray(list) ? list : []), proposalId].slice(-20);
    localStorage.setItem(previewKey(meId), JSON.stringify(next));
  } catch {
    /* niente: al massimo ricompare */
  }
}

/** L'annuncio "Dopo" vale per questa apertura dell'app: alla prossima torna, finché serve. */
const laterKey = (id: string) => `campetto:annuncio-dopo:${id}`;
function later(id: string): boolean {
  try {
    return sessionStorage.getItem(laterKey(id)) === "1";
  } catch {
    return false;
  }
}
function setLater(id: string) {
  try {
    sessionStorage.setItem(laterKey(id), "1");
  } catch {
    /* niente: al massimo ricompare */
  }
}

/** Legge e aggiorna una lista "già visti" sul telefono. null = telefono nuovo. */
function seenList(key: string, all: string[]): string[] | null {
  let seen: string[] | null = null;
  try {
    seen = JSON.parse(localStorage.getItem(key) ?? "null");
    localStorage.setItem(key, JSON.stringify(all));
  } catch {
    return null;
  }
  return Array.isArray(seen) ? seen : null;
}

/**
 * Le piccole feste dopo una partita, la prima volta che apri l'app: com'è andata,
 * i badge nuovi e i personaggi appena sbloccati. Una alla volta, con il loro suono.
 * Su un telefono nuovo tutto quello che c'era già conta come visto.
 */
export function BadgeCelebration() {
  const { me, engine, data, loading, backend, mutate } = useData();
  const toast = useToast();
  const router = useRouter();
  const [queue, setQueue] = useState<Item[]>([]);
  const badges = useMemo(
    () => (me ? engine.badges(me.id) : null),
    [me, engine],
  );
  // Prima finisce l'apertura con Spicchio, poi la festa (e il suo suono).
  const introDone = useIntroDone();
  // Lo Studio Campetto: per ora solo l'amministratore, per provarlo.
  const studio = useStudioLatest(useStudioEnabled());
  const [studioOpen, setStudioOpen] = useState<string | null>(null);
  const [studioFrom, setStudioFrom] = useState(0);
  useEffect(() => {
    // ?studio=1 apre subito l'ultima puntata.
    const q = new URLSearchParams(window.location.search);
    if (!studio || q.get("studio") !== "1") return;
    setStudioSeen(studio.id);
    // ?t=45 parte da quel secondo (per riguardare o provare un momento preciso).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStudioFrom(Math.max(0, Number(q.get("t")) || 0));
    setStudioOpen(studio.id);
  }, [studio]);

  useEffect(() => {
    if (!me || loading || !badges || !introDone) return;
    const items: Item[] = [];
    // 0. Gli annunci da non perdere (per esempio: rispondi entro giovedì), prima di tutto.
    //    Finché non hai risposto alla proposta e non è scaduto, ricompaiono a ogni apertura.
    const nowIso = new Date().toISOString();
    for (const post of data.news ?? []) {
      if (!post.popup || (post.until && post.until <= nowIso) || later(post.id)) continue;
      if (post.proposalId) {
        const prop = data.proposals.find((x) => x.id === post.proposalId);
        if (!prop || prop.status !== "aperta") continue;
        const mine = prop.responses.find((r) => r.playerId === me.id)?.response;
        if (mine === "si" || mine === "no") continue;
      }
      items.push({ kind: "news", id: `n:${post.id}`, post });
    }
    // Telefono nuovo: chi gioca da poco si gode le feste di quello che ha già fatto;
    // chi c'è da tempo e cambia telefono no (sarebbero troppe e vecchie).
    const newcomer = isNewcomer(me.id, data.matches);
    const seenOr = (key: string, all: string[]) =>
      seenList(key, all) ?? (newcomer ? [] : null);

    // 1. Com'è andata: le partite giocate che non hai ancora visto.
    const played = sortChrono(data.matches).filter((m) => teamOf(m, me.id));
    const seenMatches = seenOr(
      `campetto:seen-matches:${me.id}`,
      played.map((m) => m.id),
    );
    if (seenMatches) {
      const fresh = played.filter(
        (m) => !seenMatches.includes(m.id) && winnerOf(m),
      );
      if (fresh.length) {
        const last = fresh[fresh.length - 1];
        const t = teamOf(last, me.id)!;
        const won = fresh.filter(
          (m) => winnerOf(m) === teamOf(m, me.id),
        ).length;
        const lineRow = last.players.find((p) => p.playerId === me.id);
        let line: string | null = null;
        if (lineRow?.hasStats) {
          const b = normalizeBox(lineRow.box);
          line = `${b.pts} punti · ${b.oreb + b.dreb} rimbalzi · ${b.ast} assist`;
        }
        const hist = engine.elo.history.get(me.id) ?? [];
        const firstPoint = hist.find((h) => h.matchId === fresh[0].id);
        const lastPoint = hist.find((h) => h.matchId === last.id);
        items.push({
          kind: "result",
          id: `r:${last.id}`,
          won,
          lost: fresh.length - won,
          mine: t === "A" ? last.scoreA : last.scoreB,
          theirs: t === "A" ? last.scoreB : last.scoreA,
          line,
          elo:
            firstPoint && lastPoint
              ? Math.round(lastPoint.after - firstPoint.before)
              : null,
          mvp: matchMvp(last)?.playerId === me.id,
        });
      }
    }

    // 2. I badge nuovi: solo il livello più alto per badge, i tre più recenti.
    const seenBadges = seenOr(
      `campetto:seen-badges:${me.id}`,
      badges.unlocks.map(badgeKey),
    );
    if (seenBadges) {
      const fresh = badges.unlocks.filter(
        (u) => !seenBadges.includes(badgeKey(u)),
      );
      const best = new Map<string, BadgeUnlock>();
      for (const u of fresh)
        if (!best.has(u.key) || best.get(u.key)!.tier < u.tier)
          best.set(u.key, u);
      [...best.values()]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 3)
        .forEach((u) =>
          items.push({ kind: "badge", id: `b:${badgeKey(u)}`, unlock: u }),
        );
    }

    // 3. I personaggi appena sbloccati.
    const open = AVATAR_PRESETS.filter(
      (p) =>
        p.rarity !== "base" && characterProgress(p.id, badges.states).unlocked,
    ).map((p) => p.id as string);
    const seenChars = seenOr(`campetto:personaggi:${me.id}`, open);
    if (seenChars) {
      open
        .filter((id) => !seenChars.includes(id))
        .slice(-2)
        .forEach((id) =>
          items.push({ kind: "character", id: id as AvatarPresetId }),
        );
    }

    const previewOn = process.env.NEXT_PUBLIC_DEMO !== "1";
    const force =
      me.isAdmin &&
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("anteprima") === "1";
    const prop = force
      ? (data.proposals
          .filter(
            (p) =>
              p.status === "aperta" &&
              p.startsAt > nowIso &&
              p.responses.some((r) => r.playerId === me.id && r.response === "si"),
          )
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null)
      : previewOn
      ? previewProposal(data.proposals, me.id, new Date())
      : null;
    if (prop && (force || !previewSeen(me.id, prop.id))) {
      const targets = pregameTargets({
        meId: me.id,
        playerIds: engine.playerIds,
        matches: data.matches,
        proposal: prop,
        elo: engine.elo,
      });
      // Prova: ?obiettivo=traguardo|record mette davanti il primo di quel tipo.
      const lead = force
        ? new URLSearchParams(window.location.search).get("obiettivo")
        : null;
      if (lead)
        targets.sort((a, b) => Number(b.kind === lead) - Number(a.kind === lead));
      if (targets.length)
        items.push({ kind: "preview", id: `a:${prop.id}`, proposal: prop, targets });
    }

    // 5. La nuova puntata dello Studio Campetto, una volta.
    if (studio && !studioSeen(studio.id))
      items.push({ kind: "studio", id: `s:${studio.id}`, latest: studio });

    if (items.length) {
      // Le feste rispondono ai dati appena arrivati.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQueue((q) => [
        ...q,
        ...items.filter((i) => !q.some((x) => x.id === i.id)),
      ]);
    }
  }, [me, badges, loading, data.matches, data.news, data.proposals, engine.elo, engine.playerIds, introDone, studio]);

  const current = queue[0];

  // Il suono di ogni festa, quando compare.
  useEffect(() => {
    if (!current) return;
    const t = window.setTimeout(() => {
      if (current.kind === "result")
        play(current.won >= current.lost ? "win" : "loss");
      else if (current.kind === "preview" || current.kind === "studio") play("whistle");
      else play("unlock");
    }, 180);
    return () => window.clearTimeout(t);
  }, [current]);

  const player = studioOpen && (
    <StudioShowLoader id={studioOpen} startAt={studioFrom} onClose={() => {
      setStudioOpen(null);
      setStudioFrom(0);
    }} />
  );
  if (!current || !me) return player || null;
  const next = () => {
    if (current.kind === "news") setLater(current.post.id);
    if (current.kind === "studio") setStudioSeen(current.latest.id);
    if (current.kind === "preview") setPreviewSeen(me.id, current.proposal.id);
    setQueue((q) => q.slice(1));
  };
  const more = queue.length > 1;

  return (
    <>
    {player}
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="party-title"
      className={clsx(
        "fade-in fixed inset-0 z-[70] grid place-items-center px-8",
        // L'anteprima: la pagina dietro resta visibile, sfocata, sotto una scheda di vetro.
        current.kind === "preview" ? "preview-backdrop" : "bg-[#1d1a16]/75",
      )}
      onClick={next}
    >
      <motion.div
        key={current.id}
        initial={current.kind === "preview" ? { opacity: 0, scale: 0.9, y: 70, rotateX: 30 } : { opacity: 0, scale: 0.88, y: 24 }}
        animate={current.kind === "preview" ? { opacity: 1, scale: 1, y: 0, rotateX: 0 } : { opacity: 1, scale: 1, y: 0 }}
        transition={current.kind === "preview" ? { type: "spring", stiffness: 140, damping: 18 } : { type: "spring", stiffness: 200, damping: 22 }}
        style={current.kind === "preview" ? { transformPerspective: 900, perspective: 900 } : undefined}
        className={
          current.kind === "preview"
            ? // L'anteprima è la più alta: sui telefoni piccolissimi scorre invece di uscire dallo schermo.
              "preview-glass relative flex max-h-[calc(100dvh-24px)] w-full max-w-xs flex-col items-center overflow-y-auto overscroll-contain rounded-[32px] px-6 pb-6 pt-7 text-center"
            : "court relative flex w-full max-w-xs flex-col items-center overflow-hidden rounded-[32px] px-6 pb-6 pt-7 text-center"
        }
        // Il tocco sulla scheda resta qui: avanzano solo i pulsanti o il tocco fuori (prima saltava una festa).
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nell'anteprima, più alta, il campo resta in alto attorno al numero. */}
        <CourtLines
          arcOnly={current.kind === "preview"}
          className={
            current.kind === "preview"
              ? "absolute inset-x-0 top-0 h-[250px] w-full"
              : "absolute inset-0 h-full w-full"
          }
        />
        {current.kind === "result" && <ResultBody item={current} />}
        {current.kind === "badge" && <BadgeBody unlock={current.unlock} />}
        {current.kind === "character" && <CharacterBody id={current.id} />}
        {current.kind === "news" && <NewsBody post={current.post} />}
        {current.kind === "preview" && (
          <>
            <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[32px]" aria-hidden>
              <span className="preview-light -left-16 -top-14 h-48 w-48 bg-[radial-gradient(circle,rgb(255_197_49/0.42),transparent_68%)]" aria-hidden />
              <span className="preview-light -bottom-20 -right-16 h-56 w-56 bg-[radial-gradient(circle,rgb(242_106_27/0.36),transparent_70%)] [animation-delay:-4s]" aria-hidden />
            </span>
            <div className="preview-float relative w-full">
              <PregameBody proposal={current.proposal} targets={current.targets} />
            </div>
          </>
        )}
        {current.kind === "studio" && <StudioBody latest={current.latest} />}
        {current.kind === "studio" ? (
          <div className="relative mt-5 flex w-full gap-2">
            <Button variant="light" className="flex-1 text-court" onClick={next}>
              Dopo
            </Button>
            <Button
              variant="primary"
              className="flex-[1.6] whitespace-nowrap"
              data-testid="studio-guarda"
              onClick={() => {
                const id = current.latest.id;
                next();
                setStudioOpen(id);
              }}
            >
              Guarda ora
            </Button>
          </div>
        ) : current.kind === "preview" ? (
          <div className="relative mt-5 flex w-full gap-2">
            <Button
              variant="light"
              className="flex-1 text-court"
              onClick={() => {
                next();
                router.push("/classifiche");
              }}
            >
              Classifiche
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              data-testid="anteprima-ok"
              onClick={next}
            >
              Ci provo
            </Button>
          </div>
        ) : current.kind === "news" ? (
          <div className="relative mt-5 flex w-full gap-2">
            <Button variant="light" className="flex-1 text-court" onClick={next}>
              Dopo
            </Button>
            <Button
              variant="primary"
              className="flex-[1.6] whitespace-nowrap"
              data-testid="annuncio-vai"
              onClick={() => {
                const to = current.post.link;
                next();
                if (to) router.push(to);
              }}
            >
              {current.post.cta ?? "Vai"}
            </Button>
          </div>
        ) : current.kind === "character" ? (
          <div className="relative mt-5 flex w-full gap-2">
            <Button
              variant="light"
              className="flex-1 text-court"
              onClick={next}
            >
              Dopo
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={async () => {
                const id = current.id;
                next();
                mutate((d) => ({
                  ...d,
                  players: d.players.map((p) =>
                    p.id === me.id ? { ...p, character: id } : p,
                  ),
                }));
                try {
                  await backend.updateMe({ character: id });
                  toast(
                    `Ora sei ${AVATAR_PRESETS.find((p) => p.id === id)?.name}, gran scelta`,
                  );
                } catch (e) {
                  toast(say(e), "error");
                }
              }}
            >
              Usalo
            </Button>
          </div>
        ) : (
          <Button
            block
            variant="light"
            className="relative mt-6 text-court"
            onClick={next}
          >
            {more ? "Avanti" : "Grande!"}
          </Button>
        )}
      </motion.div>
    </div>
    </>
  );
}

/** La nuova puntata dello Studio Campetto: i due presentatori e cosa raccontano. */
function StudioBody({ latest }: { latest: StudioLatest }) {
  return (
    <>
      <div className="relative">
        <StudioHosts size={96} />
      </div>
      <p className="relative mt-3 text-[14px] font-semibold text-volt">Nuova puntata</p>
      <h2 id="party-title" className="display relative mt-1 text-[28px] leading-tight">
        Studio Campetto
      </h2>
      <p className="relative mt-2 text-[14.5px] leading-snug text-white/90">
        La serata di {studioDay(latest.day)} raccontata in studio: risultati, record e i canestri più belli.
      </p>
    </>
  );
}

function ResultBody({ item }: { item: ResultItem }) {
  const total = item.won + item.lost;
  const good = item.won >= item.lost;
  const title =
    total === 1
      ? item.won
        ? "Vittoria!"
        : "Persa, alla prossima"
      : item.won === total
        ? `${total} su ${total}, che serata!`
        : good
          ? `${item.won} vinte su ${total}`
          : `${item.won} vinte su ${total}, si riparte`;
  return (
    <>
      <div className="relative">
        <Mascot pose={good ? "esulta" : "boh"} size={96} />
      </div>
      <p className="relative mt-3 text-[14px] font-semibold text-volt">
        {total === 1 ? "La tua ultima partita" : "Le partite nuove"}
      </p>
      <h2
        id="party-title"
        className="display relative mt-1 text-[28px] leading-tight"
      >
        {title}
      </h2>
      <p className="score relative mt-2 text-[44px] leading-none">
        {item.mine}–{item.theirs}
      </p>
      {total > 1 && (
        <p className="relative mt-1 text-[12.5px] font-semibold text-white/75">
          L&apos;ultima, dalla tua parte
        </p>
      )}
      {item.mvp && (
        <p className="sticker-sm relative mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-volt px-3 py-1 text-[13.5px] font-bold text-volt-ink">
          <IconCrown size={15} aria-hidden /> Sei l&apos;MVP della partita
        </p>
      )}
      {item.line && (
        <p className="relative mt-2 text-[14px] font-semibold text-white/90">
          {item.line}
        </p>
      )}
      {item.elo !== null && item.elo !== 0 && (
        <p className="relative mt-1.5 inline-flex rounded-full bg-white/15 px-3 py-0.5 text-[13px] font-bold">
          {item.elo > 0 ? `+${item.elo}` : `−${Math.abs(item.elo)}`} ELO
        </p>
      )}
    </>
  );
}

/** L'annuncio da non perdere: Spicchio che saluta, il messaggio, e chi ha già risposto. */
function NewsBody({ post }: { post: NewsPost }) {
  const { data } = useData();
  const prop = post.proposalId ? data.proposals.find((x) => x.id === post.proposalId) : null;
  const yes = prop ? prop.responses.filter((r) => r.response === "si").length : null;
  return (
    <>
      <div className="relative">
        <Mascot pose="ciao" size={92} />
      </div>
      <p className="relative mt-3 text-[14px] font-semibold text-volt">📣 Avviso</p>
      <h2 id="party-title" className="display relative mt-1 text-[22px] leading-tight">
        {post.title}
      </h2>
      <p className="relative mt-2 text-[14.5px] leading-snug text-white/90">{post.body}</p>
      {yes !== null && (
        <p className="sticker-sm relative mt-3 inline-flex rounded-full bg-volt px-3 py-1 text-[13.5px] font-bold text-volt-ink">
          {yes === 0 ? "Ancora nessuno ha detto ci sono" : yes === 1 ? "Finora 1 ha detto ci sono" : `Finora ${yes} hanno detto ci sono`}
        </p>
      )}
    </>
  );
}

function BadgeBody({ unlock }: { unlock: BadgeUnlock }) {
  const def = BADGE_BY_KEY.get(unlock.key);
  if (!def) return null;
  return (
    <>
      <div className="relative flex items-end gap-1">
        <Mascot pose="esulta" size={86} />
        <BadgeMedal icon={def.icon} tier={unlock.tier} size={92} animate />
      </div>
      <p className="relative mt-4 text-[14px] font-semibold text-volt">
        Badge sbloccato
      </p>
      <h2 id="party-title" className="display relative mt-1 text-[28px]">
        {def.name}
      </h2>
      <p className="relative mt-1 font-bold">{TIER_STYLE[unlock.tier].label}</p>
      <p className="relative mt-2 text-[14px] text-white/85">
        {def.description}
      </p>
    </>
  );
}

function CharacterBody({ id }: { id: AvatarPresetId }) {
  const { me } = useData();
  const p = AVATAR_PRESETS.find((x) => x.id === id)!;
  const rarity = p.rarity as Rarity;
  return (
    <>
      <p className="relative text-[14px] font-semibold text-volt">
        Nuovo personaggio!
      </p>
      <div className="relative mt-1">
        <Character3D
          id={id}
          number={me?.jerseyNumber}
          name={me?.nickname ?? me?.firstName}
          height={168}
          intro="spin"
        />
      </div>
      <h2 id="party-title" className="display relative mt-1 text-[28px]">
        {p.name}
      </h2>
      <span className="relative mt-1 inline-flex items-center gap-1.5 rounded-full border-2 border-[#1d1a16] bg-[#fffaf0] px-2.5 py-0.5 text-[12px] font-bold text-[#1d1a16]">
        <span
          className="h-2 w-2 rounded-full border border-[#1d1a16]"
          style={{ background: RARITY[rarity].ring }}
          aria-hidden
        />
        {RARITY[rarity].one}
      </span>
    </>
  );
}
