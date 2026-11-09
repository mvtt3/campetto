"use client";

import clsx from "clsx";
import { ChevronLeft, Heart, UserPlus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Character } from "@/components/character";
import { Button } from "@/components/ui/basics";
import { play } from "@/lib/sound";
import { fmtEuro, shortEuro } from "@/lib/game/economy";
import { girlfriend } from "@/lib/game/messages";
import { teamRoster } from "@/lib/game/career";
import {
  LOAN_WEEKS,
  PLACES,
  SPONSORS,
  VEHICLES,
  buyVehicle,
  loanPlan,
  mapEvent,
  othersFeed,
  postIdeas,
  postedToday,
  publish,
  ride,
  sellVehicle,
  toneName,
  travel,
  type Place,
  type PostIdea,
} from "@/lib/game/life";
import { SKILL_NAMES, activityCost, canAdvance, todayMatch, type Activity } from "@/lib/game/state";
import type { Post, PostTone, Skill } from "@/lib/game/types";
import { useDayAdvance } from "./day-flip";
import { useGame } from "./store";
import { Sheet, useToast } from "./ui";
import type { View } from "./game";

function Header({ title, back, sub, right }: { title: ReactNode; back: () => void; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b-2 border-line px-3 py-2.5">
      <button onClick={back} aria-label="Indietro" className="press sticker-sm grid h-11 w-11 place-items-center rounded-full bg-surface">
        <ChevronLeft size={22} />
      </button>
      <div className="min-w-0 flex-1">
        <h2 className="display truncate text-[22px]">{title}</h2>
        {sub && <p className="truncate text-[12.5px] font-semibold text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

const fmtK = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toLocaleString("it-IT", { maximumFractionDigits: 1 })}k` : String(n));

// ———————————— Instacampo ————————————

const TILE: Record<Post["kind"], string> = {
  partita: "linear-gradient(150deg,#2d5be3,#1f2a52)",
  allenamento: "linear-gradient(150deg,#2E9E5B,#1d5c37)",
  serata: "linear-gradient(150deg,#7C4DCC,#2b1650)",
  look: "linear-gradient(150deg,#F26A1B,#a53a06)",
  squadra: "linear-gradient(150deg,#E5412D,#7d1d12)",
  motori: "linear-gradient(150deg,#2B2724,#5b5248)",
  ragazza: "linear-gradient(150deg,#C93B78,#6b1a3e)",
  campetto: "linear-gradient(150deg,#1597A6,#0b4f57)",
};

const TONE_HINT: Record<PostTone, string> = {
  umile: "Piace alla società",
  spaccone: "Più like se vinci, rischio hater",
  dedica: "Il morale della squadra sale",
};

function PostTile({ emoji, kind, caption, big = false }: { emoji: string; kind: Post["kind"]; caption?: string; big?: boolean }) {
  return (
    <div
      className={clsx("relative grid place-items-center overflow-hidden rounded-2xl border-[2.5px] border-[#1d1a16]", big ? "aspect-[4/3]" : "aspect-square")}
      style={{ background: TILE[kind], backgroundImage: `radial-gradient(rgb(0 0 0 / 0.18) 1.1px, transparent 1.5px), ${TILE[kind]}`, backgroundSize: "7px 7px, 100% 100%" }}
    >
      <span className={big ? "text-[64px]" : "text-[34px]"} aria-hidden>
        {emoji}
      </span>
      {caption && <p className="absolute inset-x-2 bottom-2 line-clamp-2 rounded-lg bg-[#1d1a16]/70 px-2 py-1 text-[12.5px] font-semibold text-white">{caption}</p>}
    </div>
  );
}

const KIND_EMOJI: Record<Post["kind"], string> = {
  partita: "🏆",
  allenamento: "💪",
  serata: "🪩",
  look: "🧢",
  squadra: "🍕",
  motori: "🚗",
  ragazza: "❤️",
  campetto: "🏀",
};

export function Instacampo({ back }: { back: () => void }) {
  const { game, update, me, charId } = useGame();
  const toast = useToast();
  const [idea, setIdea] = useState<PostIdea | null>(null);
  const [fresh, setFresh] = useState<Post | null>(null);
  const ideas = postIdeas(game);
  const done = postedToday(game);
  const handle = `@${(me.nickname ?? me.firstName).toLowerCase().replace(/[^a-z0-9]/g, "")}_${me.jerseyNumber ?? 0}`;
  const next = SPONSORS[game.social.sponsor];
  const prev = SPONSORS[game.social.sponsor - 1]?.at ?? 0;
  const mamma = game.contacts.find((c) => c.role === "mamma")?.name ?? "Mamma";
  const mates = teamRoster(game).map((m) => m.name);

  const post = (tone: PostTone) => {
    if (!idea || done) return;
    const r = publish(game, idea, tone, Math.random, mamma);
    update(() => r.s);
    setFresh(r.post);
    setIdea(null);
    play(r.post.gained >= 0 ? "cheer" : "groan");
    if (r.note) window.setTimeout(() => toast(r.note!, "ok", "coins"), 900);
  };

  return (
    <>
      <Header title="Instacampo" back={back} sub={handle} />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-3" data-testid="instacampo">
        {/* Il profilo */}
        <div className="card flex items-center gap-3 px-3 py-3">
          <div className="grid h-[76px] w-[76px] shrink-0 place-items-end overflow-hidden rounded-full border-[3px] border-[#C93B78] bg-court">
            <Character id={charId} outfit={game.outfit} number={me.jerseyNumber} height={92} />
          </div>
          <div className="grid flex-1 grid-cols-3 text-center">
            {[
              ["Post", game.social.posts.length],
              ["Follower", fmtK(game.social.followers)],
              ["Sponsor", game.social.sponsor],
            ].map(([l, v]) => (
              <div key={l}>
                <p className="num text-[22px] leading-tight" data-testid={l === "Follower" ? "followers" : undefined}>
                  {v}
                </p>
                <p className="text-[11.5px] font-semibold text-muted">{l}</p>
              </div>
            ))}
          </div>
        </div>
        {next && (
          <div className="mt-2 px-1">
            <div className="flex justify-between text-[12.5px] font-semibold text-muted">
              <span>Prossimo sponsor: {next.name}</span>
              <span className="num">
                {fmtK(game.social.followers)}/{fmtK(next.at)}
              </span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full border-2 border-edge bg-raised">
              <div className="h-full rounded-full bg-[#C93B78]" style={{ width: `${Math.min(100, ((game.social.followers - prev) / (next.at - prev)) * 100)}%` }} />
            </div>
          </div>
        )}

        {/* Il post appena pubblicato */}
        {fresh && (
          <div className="card game-pop mt-3 px-3 py-3" data-testid="post-result">
            <p className="display text-[20px]">Pubblicato!</p>
            <div className="mt-2 flex items-center gap-4 text-[17px]">
              <span className="flex items-center gap-1.5">
                <Heart size={20} className="fill-danger text-danger" />
                <b className="num">{fresh.likes}</b>
              </span>
              <span className={clsx("flex items-center gap-1.5", fresh.gained >= 0 ? "text-ok" : "text-danger")}>
                <UserPlus size={20} />
                <b className="num">
                  {fresh.gained >= 0 ? "+" : ""}
                  {fresh.gained}
                </b>
              </span>
            </div>
            <ul className="mt-2 flex flex-col gap-1">
              {fresh.comments.map((c, k) => (
                <li key={k} className={clsx("text-[14px]", c.hater && "text-danger")}>
                  <b>{c.who}</b> {c.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Cosa pubblichi oggi */}
        <p className="mb-2 mt-4 px-1 text-[13px] font-bold text-muted">{done ? "Oggi hai già pubblicato: torna domani" : "Cosa pubblichi oggi?"}</p>
        {!done && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {ideas.map((i) => (
              <button
                key={i.title}
                onClick={() => {
                  play("select");
                  setIdea(i);
                }}
                className="press w-[132px] shrink-0 text-left"
                data-testid={`idea-${i.kind}`}
              >
                <PostTile emoji={i.emoji} kind={i.kind} />
                <p className="mt-1 truncate text-[13.5px] font-bold">{i.title}</p>
                <p className="text-[12px] text-muted">{"★".repeat(Math.max(1, Math.min(3, Math.round(i.quality * 2 - 0.6))))} piace</p>
              </button>
            ))}
          </div>
        )}

        {/* Il tuo profilo: i post */}
        {game.social.posts.length > 0 && (
          <>
            <p className="mb-2 mt-4 px-1 text-[13px] font-bold text-muted">I tuoi post</p>
            <div className="grid grid-cols-3 gap-1.5">
              {game.social.posts.slice(0, 9).map((p) => (
                <div key={p.id} className="relative">
                  <PostTile emoji={KIND_EMOJI[p.kind]} kind={p.kind} />
                  <span className="num absolute bottom-1 left-1 flex items-center gap-0.5 rounded-full bg-[#1d1a16]/70 px-1.5 text-[11.5px] text-white">
                    <Heart size={11} className="fill-white" /> {fmtK(p.likes)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Dal campetto */}
        <p className="mb-2 mt-4 px-1 text-[13px] font-bold text-muted">Dal campetto</p>
        <div className="flex flex-col gap-2">
          {othersFeed(game, mates).map((f, k) => (
            <div key={k} className="card flex items-center gap-3 px-3 py-2.5">
              <span className="text-[28px]" aria-hidden>
                {f.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold">{f.who}</p>
                <p className="text-[14px]">{f.text}</p>
              </div>
              <span className="num flex items-center gap-1 text-[13px] text-muted">
                <Heart size={13} /> {f.likes}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Sheet open={!!idea} onClose={() => setIdea(null)} title={idea ? idea.title : ""}>
        {idea && (
          <div className="flex flex-col gap-3">
            <PostTile emoji={idea.emoji} kind={idea.kind} big />
            <p className="text-[13px] font-bold text-muted">Scegli la didascalia: ogni tono ha le sue conseguenze</p>
            {(["umile", "spaccone", "dedica"] as PostTone[]).map((t) => (
              <button key={t} onClick={() => post(t)} className="press sticker rounded-2xl bg-surface px-4 py-3 text-left" data-testid={`tone-${t}`}>
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold text-[#C93B78]">{toneName(t)}</span>
                  <span className="text-[12px] font-semibold text-muted">{TONE_HINT[t]}</span>
                </span>
                <span className="mt-1 block text-[15px] font-semibold">“{idea.captions[t]}”</span>
              </button>
            ))}
          </div>
        )}
      </Sheet>
    </>
  );
}

// ———————————— Mappa ————————————

type PlaceAction = { label: string; line: string; act?: Activity; go?: View; energy: number; money?: number };

function placeActions(p: Place, game: ReturnType<typeof useGame>["game"]): PlaceAction[] {
  const gf = girlfriend(game);
  const t = todayMatch(game);
  switch (p.id) {
    case "casa":
      return [{ label: "Riposati", line: "+40 energia, umore su", act: { kind: "riposo" }, energy: 0 }];
    case "campetto":
      return [{ label: "Partitella", line: "Tiro e passaggio su, +felicità", act: { kind: "campetto" }, energy: 12 }];
    case "parco":
      return [{ label: "Corsa e scatti", line: "Fisico su", act: { kind: "parco" }, energy: 14 }];
    case "palestra":
      return (Object.keys(SKILL_NAMES) as Skill[]).map((k) => ({
        label: `Allenati: ${SKILL_NAMES[k].toLowerCase()}`,
        line: "Esperienza su, il coach ti vede",
        act: { kind: "allenamento", skill: k },
        energy: 18,
      }));
    case "palazzetto":
      return t && !t.match.result ? [{ label: "Vai alla partita", line: `Contro ${t.match.opponent}`, go: `partita:${t.index}`, energy: 0 }] : [];
    case "pizzeria":
      return [
        { label: "Pizza con gli amici", line: "+felicità", act: { kind: "amici" }, energy: 0, money: activityCost(game, "amici") },
        { label: "Pizza con la squadra", line: "Morale dei compagni su", act: { kind: "squadra" }, energy: 4, money: activityCost(game, "squadra") },
      ];
    case "discoteca":
      return [{ label: "Serata fuori", line: "+felicità, +fama, domani sei stanco", act: { kind: "serata" }, energy: 22, money: activityCost(game, "serata") }];
    case "centro":
      return [{ label: "Apri lo Shopping", line: "Vestiti, scarpe, accessori", go: "telefono:shopping", energy: 0 }];
    case "lei":
      return gf ? [{ label: `Esci con ${gf.name}`, line: "+felicità, più vicini", act: { kind: "ragazza" }, energy: 0, money: activityCost(game, "ragazza") }] : [];
  }
}

export function Mappa({ back, go }: { back: () => void; go: (v: View) => void }) {
  const { game } = useGame();
  const [open, setOpen] = useState<Place | null>(null);
  const day = useDayAdvance(() => go("hub"));
  const ev = mapEvent(game);
  const r = ride(game);
  const gf = girlfriend(game);
  const t = todayMatch(game);
  const places = PLACES.filter((p) => p.id !== "lei" || gf);
  const can = canAdvance(game);

  const doIt = (p: Place, a: PlaceAction) => {
    if (a.go) {
      setOpen(null);
      go(a.go);
      return;
    }
    if (!a.act) return;
    const tr = travel(game, p).energy;
    setOpen(null);
    day.run({ ...a.act, travel: tr, event: ev && ev.place === p.id ? ev.id : undefined });
  };

  return (
    <>
      <Header title="Mappa" back={back} sub={`Nichelino · ${r ? `${r.emoji} ${r.name}` : "🚶 a piedi e in bus"}`} />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-3" data-testid="mappa">
        {ev && (
          <button onClick={() => setOpen(PLACES.find((p) => p.id === ev.place)!)} className="press sticker mb-3 flex w-full items-center gap-3 rounded-2xl bg-volt px-4 py-3 text-left text-volt-ink">
            <span className="game-glow grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-[#1d1a16] bg-danger text-[18px] font-bold text-white">!</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15.5px] font-bold">Oggi: {ev.title}</span>
              <span className="block text-[12.5px] font-semibold opacity-80">{ev.line}</span>
            </span>
          </button>
        )}
        {!can && t && (
          <p className="mb-3 rounded-2xl bg-danger/15 px-4 py-2.5 text-[14px] font-semibold">Oggi si gioca: vai al palazzetto 🏟️</p>
        )}

        {/* La mappa della città, stile poster */}
        <div className="relative aspect-[10/11] w-full overflow-hidden rounded-[24px] border-[3px] border-[#1d1a16]" style={{ boxShadow: "4px 4px 0 #1d1a16" }}>
          <svg viewBox="0 0 100 110" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
            <rect width="100" height="110" fill="#F1E7D0" />
            {/* isolati */}
            {[
              [6, 6, 22, 16],
              [32, 6, 26, 14],
              [62, 4, 16, 18],
              [8, 30, 18, 20],
              [60, 40, 30, 12],
              [6, 80, 22, 24],
              [72, 76, 24, 14],
              [30, 92, 26, 14],
            ].map(([x, y, w, h], k) => (
              <rect key={k} x={x} y={y} width={w} height={h} rx="2.5" fill={k % 3 ? "#E3D6B8" : "#EAC9A8"} stroke="#1d1a16" strokeWidth="0.5" />
            ))}
            {/* il parco */}
            <ellipse cx="52" cy="64" rx="17" ry="11" fill="#9FD27A" stroke="#1d1a16" strokeWidth="0.6" />
            {/* il Sangone */}
            <path d="M-2 50 C 20 44, 30 56, 50 50 S 80 40, 102 46" fill="none" stroke="#1d1a16" strokeWidth="5.4" />
            <path d="M-2 50 C 20 44, 30 56, 50 50 S 80 40, 102 46" fill="none" stroke="#6FB4F0" strokeWidth="4" />
            {/* le strade */}
            {["M0 26 H100", "M0 74 H100", "M30 0 V110", "M66 0 V110", "M0 104 L100 88"].map((d, k) => (
              <g key={k}>
                <path d={d} stroke="#1d1a16" strokeWidth="3.6" fill="none" />
                <path d={d} stroke="#FFF8EA" strokeWidth="2.6" fill="none" />
              </g>
            ))}
            <rect width="100" height="110" fill="url(#map-dots)" />
            <defs>
              <pattern id="map-dots" width="2.2" height="2.2" patternUnits="userSpaceOnUse">
                <circle cx="1.1" cy="1.1" r="0.28" fill="#000" opacity="0.12" />
              </pattern>
            </defs>
          </svg>
          {places.map((p) => {
            const tr = travel(game, p);
            const hot = ev?.place === p.id;
            const isMatch = p.id === "palazzetto" && t && !t.match.result;
            return (
              <button
                key={p.id}
                onClick={() => {
                  play("tap");
                  setOpen(p);
                }}
                className="press absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                data-testid={`place-${p.id}`}
                aria-label={p.name}
              >
                <span
                  className={clsx("relative grid h-12 w-12 place-items-center rounded-full border-[2.5px] border-[#1d1a16] bg-[#FFF8EA] text-[24px]", (hot || isMatch) && "game-glow")}
                  style={{ boxShadow: "2px 2px 0 #1d1a16" }}
                >
                  {p.emoji}
                  {(hot || isMatch) && (
                    <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border-2 border-[#1d1a16] bg-danger text-[11px] font-bold text-white">!</span>
                  )}
                </span>
                <span className="mt-0.5 whitespace-nowrap rounded-full bg-[#1d1a16] px-1.5 py-0.5 text-[10.5px] font-bold text-[#FFF8EA]">
                  {p.dist ? `⚡−${tr.energy} · ${tr.minutes}′` : "Casa"}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-[12.5px] text-muted">
          {r ? `Con ${r.name.toLowerCase()} ti muovi spendendo meno energia.` : "A piedi e in bus ti stanchi: in Motori trovi bici, scooter e auto."} Scegliere un posto fa passare la giornata.
        </p>
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? `${open.emoji} ${open.name}` : ""}>
        {open && (
          <div className="flex flex-col gap-2">
            <p className="text-[14px] text-muted">{open.line}</p>
            {ev?.place === open.id && (
              <p className="rounded-2xl bg-volt px-3 py-2 text-[14px] font-bold text-volt-ink">
                ! {ev.title}: {ev.line}
              </p>
            )}
            {placeActions(open, game).map((a) => {
              const tr = a.act ? travel(game, open).energy : 0;
              const total = a.energy + tr;
              const tired = !!a.act && a.act.kind !== "riposo" && total > game.energy;
              const poor = !!a.money && a.money > game.money;
              const blocked = !!a.act && !can;
              return (
                <button
                  key={a.label}
                  onClick={() => doIt(open, a)}
                  disabled={tired || poor || blocked}
                  className="press sticker flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-left disabled:opacity-45"
                  data-testid={`do-${a.act?.kind ?? "vai"}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-bold">{a.label}</span>
                    <span className="block text-[12.5px] text-muted">
                      {blocked ? "Oggi c'è la partita" : tired ? "Troppo stanco" : poor ? "Non hai abbastanza soldi" : a.line}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[12.5px] font-bold">
                    {total > 0 && <span className="block text-danger">⚡−{total}</span>}
                    {!!a.money && <span className="block">{shortEuro(a.money)}</span>}
                  </span>
                </button>
              );
            })}
            {!placeActions(open, game).length && <p className="text-[14px] text-muted">Qui oggi non c&apos;è niente da fare.</p>}
          </div>
        )}
      </Sheet>
      {day.node}
    </>
  );
}

// ———————————— Motori ————————————

export function Motori({ back }: { back: () => void }) {
  const { game, update } = useGame();
  const toast = useToast();
  const buy = (id: string, financed: boolean) => {
    const r = buyVehicle(game, id, financed);
    if (!r) return;
    update(() => r.s);
    play("coins");
    toast(r.note, "ok", null);
  };
  return (
    <>
      <Header title="Motori" back={back} sub={game.garage.length ? `Il tuo garage: ${game.garage.length}` : "Bici, scooter, auto. Anche a rate"} />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-3" data-testid="motori">
        {game.garage.length > 0 && (
          <>
            <p className="mb-2 px-1 text-[13px] font-bold text-muted">Il tuo garage</p>
            <div className="mb-4 flex flex-col gap-2">
              {game.garage.map((id) => {
                const v = VEHICLES.find((x) => x.id === id)!;
                const loan = game.loans.find((l) => l.id === id);
                const using = game.ride === id;
                return (
                  <div key={id} className={clsx("card flex items-center gap-3 px-3 py-3", using && "!bg-volt/30")}>
                    <span className="text-[38px]" aria-hidden>
                      {v.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15.5px] font-bold">{v.name}</p>
                      <p className="text-[12.5px] text-muted">
                        {loan ? `Rata ${fmtEuro(loan.weekly)}/sett · ancora ${loan.weeksLeft} settimane` : "Pagato"} · spese {fmtEuro(v.weekly)}/sett
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      {!using && (
                        <Button size="sm" variant="court" onClick={() => update((s) => ({ ...s, ride: id }))}>
                          Usa
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          update((s) => sellVehicle(s, id));
                          play("coins");
                        }}
                      >
                        Vendi
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <p className="mb-2 px-1 text-[13px] font-bold text-muted">In vendita</p>
        <div className="flex flex-col gap-3">
          {VEHICLES.map((v) => {
            const owned = game.garage.includes(v.id);
            const plan = loanPlan(v);
            const cash = game.money >= v.price;
            const canLoan = game.money >= plan.down && !game.loans.some((l) => l.id === v.id);
            return (
              <div key={v.id} className={clsx("card overflow-hidden", owned && "opacity-60")} data-testid={`veicolo-${v.id}`}>
                <div className="flex items-center gap-3 px-3 pt-3">
                  <span
                    className="grid h-[68px] w-[68px] shrink-0 place-items-center rounded-2xl border-[2.5px] border-[#1d1a16] text-[40px]"
                    style={{ background: "linear-gradient(150deg,#FFC531,#F26A1B)", boxShadow: "2px 2px 0 #1d1a16" }}
                    aria-hidden
                  >
                    {v.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="display text-[19px] leading-tight">{v.name}</p>
                    <p className="text-[12.5px] text-muted">{v.line}</p>
                  </div>
                </div>
                {/* Gli effetti, in tre icone */}
                <div className="mx-3 mt-2 grid grid-cols-3 gap-1.5 text-center">
                  {[
                    ["⭐", v.fame ? `+${v.fame} fama` : "—"],
                    ["⏰", v.punctual ? "Puntuale" : "—"],
                    ["⚡", `−${Math.round((1 - v.travel) * 100)}% fatica`],
                  ].map(([i, l]) => (
                    <span key={i} className="rounded-xl bg-raised px-1 py-1.5 text-[12px] font-bold">
                      {i} {l}
                    </span>
                  ))}
                </div>
                <div className="flex items-end justify-between gap-2 px-3 pb-3 pt-2">
                  <div>
                    <p className="num text-[22px] leading-none">{fmtEuro(plan.weekly)}<span className="text-[13px]">/sett</span></p>
                    <p className="text-[12px] text-muted">
                      a rate ({LOAN_WEEKS} sett.) · o {fmtEuro(v.price)} subito
                    </p>
                  </div>
                  {owned ? (
                    <span className="rounded-full bg-ok px-3 py-1.5 text-[13px] font-bold text-white">Tuo ✓</span>
                  ) : (
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="secondary" className="whitespace-nowrap" disabled={!canLoan} onClick={() => buy(v.id, true)}>
                        A rate
                      </Button>
                      <Button size="sm" variant="primary" className="whitespace-nowrap" disabled={!cash} onClick={() => buy(v.id, false)}>
                        Compra
                      </Button>
                    </div>
                  )}
                </div>
                {!owned && !canLoan && <p className="px-3 pb-3 text-[12px] font-semibold text-danger">Per l&apos;anticipo servono {fmtEuro(plan.down)}</p>}
              </div>
            );
          })}
        </div>
        <p className="mt-3 px-1 text-[12.5px] text-muted">
          Rate, benzina e assicurazione si pagano il lunedì. Se non hai i soldi per una rata, il mezzo se lo riprendono.
        </p>
      </div>
    </>
  );
}

