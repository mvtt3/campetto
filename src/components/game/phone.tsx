"use client";

import clsx from "clsx";
import {
  CalendarDays,
  Camera,
  Car,
  ChevronLeft,
  Dices,
  FileSignature,
  House,
  Landmark,
  Map as MapIcon,
  MessageCircle,
  PawPrint,
  ShoppingBag,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Character } from "@/components/character";
import { PresetAvatar } from "@/components/avatar-presets";
import { Button } from "@/components/ui/basics";
import { play } from "@/lib/sound";
import { CONSUMABLES, ITEMS, SLOTS, SLOT_NAMES, type Item } from "@/lib/game/catalog";
import {
  DAY_NAMES,
  LEVELS,
  LEVEL_ORDER,
  dow,
  fmtEuro,
  seasonSummary,
  shortEuro,
  weeklyGross,
  weeklyNet,
} from "@/lib/game/economy";
import { EVENTS, MOOD_LABEL, TONES, answer, mood } from "@/lib/game/messages";
import { acceptOffer, buyConsumable, buyItem, canBuy, consumablePrice, levelIndex } from "@/lib/game/state";
import type { Contact } from "@/lib/game/types";
import { Instacampo, Mappa, Motori } from "./apps";
import { mapEvent } from "@/lib/game/life";
import { useGame } from "./store";
import { Coach, Meter, Sheet, Tip, useToast } from "./ui";
import type { View } from "./game";

const ROLE_LABEL: Record<Contact["role"], string> = {
  mamma: "Mamma",
  ragazza: "La tua ragazza",
  coach: "Allenatore",
  amico: "Amico",
  socio: "Amico del campetto",
  agente: "Procuratore",
  ex: "Ex 💔",
  nuova: "Nuovo contatto",
};

const ROLE_COLOR: Record<Contact["role"], string> = {
  mamma: "#E2557A",
  ragazza: "#E5412D",
  coach: "#2D5BE3",
  amico: "#7C4DCC",
  socio: "#2E9E5B",
  agente: "#1D3B66",
  ex: "#9A8B73",
  nuova: "#F26A1B",
};

/** Il telefono del personaggio: si apre a tutto schermo, con le sue app. */
export function Phone({ app, go, back }: { app: string | null; go: (v: View) => void; back: () => void }) {
  const { game } = useGame();
  const [kind, arg] = (app ?? "").split(":");
  const time = `${DAY_NAMES[dow(game.day)].slice(0, 3)} ${String(8 + (game.day % 12)).padStart(2, "0")}:${String((game.day * 17) % 60).padStart(2, "0")}`;
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#14110e] text-[#f6eedc]" data-testid="phone">
      <div className="flex shrink-0 items-center justify-between px-5 pb-1 pt-[max(8px,env(safe-area-inset-top))] text-[13px] font-bold">
        <span className="num">{time}</span>
        <span className="flex items-center gap-1.5">
          <span>Campetto Mobile</span>
          <span className="relative h-3.5 w-7 rounded-[4px] border-2 border-[#f6eedc]/80">
            <span className="absolute inset-y-0 left-0 rounded-[2px] bg-[#f6eedc]" style={{ width: `${Math.max(8, game.energy)}%` }} />
          </span>
        </span>
      </div>
      {!kind ? (
        <PhoneHome go={go} back={back} />
      ) : (
        <div className="mx-2 mb-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[26px] bg-bg text-text">
          {kind === "messaggi" && !arg && <Messages go={go} back={back} />}
          {kind === "messaggi" && arg && <Chat id={arg} back={back} />}
          {kind === "banca" && <Bank back={back} />}
          {kind === "contratti" && <Contracts back={back} />}
          {kind === "shopping" && <Shopping back={back} />}
          {kind === "calendario" && <Calendar back={back} />}
          {kind === "instacampo" && <Instacampo back={back} />}
          {kind === "mappa" && <Mappa back={back} go={go} />}
          {kind === "motori" && <Motori back={back} />}
        </div>
      )}
    </div>
  );
}

function AppHeader({ title, back, sub }: { title: ReactNode; back: () => void; sub?: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b-2 border-line px-3 py-2.5">
      <button onClick={back} aria-label="Indietro" className="press sticker-sm grid h-11 w-11 place-items-center rounded-full bg-surface">
        <ChevronLeft size={22} />
      </button>
      <div className="min-w-0 flex-1">
        <h2 className="display truncate text-[22px]">{title}</h2>
        {sub && <p className="truncate text-[12.5px] font-semibold text-muted">{sub}</p>}
      </div>
    </div>
  );
}

function PhoneHome({ go, back }: { go: (v: View) => void; back: () => void }) {
  const { game } = useGame();
  const toast = useToast();
  const unread = game.contacts.reduce((a, c) => a + c.unread, 0);
  const soon = (name: string) => () => {
    play("tap");
    toast(`${name}: arriva presto`, "info");
  };
  const apps: { name: string; icon: ReactNode; bg: string; badge?: number; on: () => void; testId?: string }[] = [
    { name: "Messaggi", icon: <MessageCircle size={30} />, bg: "#2E9E5B", badge: unread, on: () => go("telefono:messaggi"), testId: "app-messaggi" },
    { name: "Banca", icon: <Landmark size={30} />, bg: "#1D3B66", badge: game.badges.banca, on: () => go("telefono:banca"), testId: "app-banca" },
    { name: "Contratti", icon: <FileSignature size={30} />, bg: "#7C4DCC", badge: game.badges.contratti, on: () => go("telefono:contratti"), testId: "app-contratti" },
    { name: "Shopping", icon: <ShoppingBag size={30} />, bg: "#F26A1B", on: () => go("telefono:shopping"), testId: "app-shopping" },
    { name: "Calendario", icon: <CalendarDays size={30} />, bg: "#E5412D", on: () => go("telefono:calendario") },
    { name: "Instacampo", icon: <Camera size={30} />, bg: "#C93B78", on: () => go("telefono:instacampo"), testId: "app-instacampo" },
    { name: "Mappa", icon: <MapIcon size={30} />, bg: "#1597A6", badge: mapEvent(game) ? 1 : 0, on: () => go("telefono:mappa"), testId: "app-mappa" },
    { name: "Motori", icon: <Car size={30} />, bg: "#3A342D", on: () => go("telefono:motori"), testId: "app-motori" },
    { name: "Case", icon: <House size={30} />, bg: "#8A5A2B", on: soon("Le case") },
    { name: "Scommesse", icon: <Dices size={30} />, bg: "#B3261E", on: soon("Le scommesse") },
    { name: "Cucciolo", icon: <PawPrint size={30} />, bg: "#E8A80C", on: soon("Il tuo cucciolo") },
  ];
  const tut = game.tutorial.step;
  return (
    <div
      className="relative mx-2 mb-2 flex min-h-0 flex-1 flex-col overflow-y-auto rounded-[26px] px-3 pb-4 pt-6"
      style={{
        background: "linear-gradient(160deg, #2d5be3, #1f2a52 70%)",
        backgroundImage: "radial-gradient(rgb(0 0 0 / 0.2) 1.1px, transparent 1.5px), linear-gradient(160deg, #2d5be3, #1f2a52 70%)",
        backgroundSize: "7px 7px, 100% 100%",
      }}
    >
      <p className="display text-center text-[44px] leading-none text-white">{fmtEuro(game.money)}</p>
      <p className="mt-1 text-center text-[13px] font-semibold text-white/80">sul conto</p>
      <div className="mt-6 grid grid-cols-4 gap-x-2 gap-y-5">
        {apps.map((a) => (
          <button key={a.name} onClick={a.on} className="press flex flex-col items-center gap-1.5" data-testid={a.testId}>
            <span
              className={clsx(
                "relative grid h-[62px] w-[62px] place-items-center rounded-[18px] border-[2.5px] border-[#1d1a16] text-white",
                ((tut === 2 && a.name === "Messaggi") || (tut === 3 && a.name === "Shopping")) && "game-glow",
              )}
              style={{ background: a.bg, boxShadow: "3px 3px 0 #1d1a16" }}
            >
              {a.icon}
              {!!a.badge && (
                <span className="num absolute -right-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full border-2 border-[#1d1a16] bg-danger px-1 text-[13px]">
                  {a.badge > 9 ? "9+" : a.badge}
                </span>
              )}
            </span>
            <span className="text-[12px] font-semibold text-white">{a.name}</span>
          </button>
        ))}
      </div>
      <div className="mt-auto pt-6">
        {tut === 2 && <Coach className="mb-3">Apri Messaggi: Mamma ti ha scritto</Coach>}
        {tut === 3 && <Coach className="mb-3">Apri Shopping e compra le scarpe</Coach>}
        <Tip id="telefono" className="mb-3" />
        <button
          onClick={back}
          className="press mx-auto block h-14 w-full max-w-[220px] rounded-full border-[2.5px] border-[#1d1a16] bg-[#f6eedc] text-[16px] font-bold text-[#1d1a16]"
          style={{ boxShadow: "3px 3px 0 #1d1a16" }}
        >
          Chiudi il telefono
        </button>
      </div>
    </div>
  );
}

function Initials({ c, size = 48 }: { c: Contact; size?: number }) {
  return (
    <span
      className="num grid shrink-0 place-items-center rounded-full border-[2.5px] border-edge text-white"
      style={{ width: size, height: size, background: ROLE_COLOR[c.role], fontSize: size * 0.42 }}
    >
      {c.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function Messages({ go, back }: { go: (v: View) => void; back: () => void }) {
  const { game } = useGame();
  const list = useMemo(
    () =>
      game.contacts
        .filter((c) => c.thread.length)
        .map((c) => ({ c, last: c.thread.at(-1)! }))
        .sort((a, b) => b.last.day - a.last.day || b.c.unread - a.c.unread),
    [game.contacts],
  );
  return (
    <>
      <AppHeader title="Messaggi" back={back} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Tip id="messaggi" className="m-3" />
        {game.tutorial.step === 2 && <Coach className="mx-3 mt-2">Apri la chat di Mamma</Coach>}
        {list.map(({ c, last }) => (
          <button
            key={c.id}
            onClick={() => go(`telefono:messaggi:${c.id}`)}
            className={clsx(
              "flex w-full items-center gap-3 border-b-2 border-line px-3 py-3 text-left active:bg-raised",
              game.tutorial.step === 2 && c.role === "mamma" && "bg-volt/40",
            )}
            data-testid={`chat-${c.id}`}
          >
            <Initials c={c} />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className="truncate text-[16px] font-bold">{c.name}</span>
                <span className="shrink-0 text-[12px] font-semibold text-muted">{ROLE_LABEL[c.role]}</span>
              </span>
              <span className={clsx("block truncate text-[14px]", c.unread ? "font-semibold" : "text-muted")}>
                {last.from === "me" ? "Tu: " : ""}
                {last.text}
              </span>
            </span>
            {c.unread > 0 && (
              <span className="num grid h-7 min-w-7 place-items-center rounded-full border-2 border-edge bg-ok px-1.5 text-[14px] text-white">{c.unread}</span>
            )}
          </button>
        ))}
        {!list.length && <p className="p-6 text-center text-muted">Ancora nessun messaggio</p>}
      </div>
    </>
  );
}

function Chat({ id, back }: { id: string; back: () => void }) {
  const { game, update } = useGame();
  const toast = useToast();
  const c = game.contacts.find((x) => x.id === id);
  const [typing, setTyping] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  // Aperta la chat, i messaggi sono letti.
  useEffect(() => {
    if (c && c.unread)
      update((s) => ({ ...s, contacts: s.contacts.map((x) => (x.id === id ? { ...x, unread: 0 } : x)) }));
  }, [c, id, update]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [c?.thread.length, typing]);
  if (!c) return null;
  const ev = c.pending ? EVENTS[c.pending.event] : null;
  const m = mood(c);
  const thread = typing ? c.thread.slice(0, -1) : c.thread;

  const reply = (k: number) => {
    const before = game.money;
    const next = answer(game, c.id, k);
    const lastThem = next.contacts.find((x) => x.id === id)!.thread.at(-1)!.from === "them";
    update((s) => {
      let r = answer(s, c.id, k);
      if (r.tutorial.step === 2 && c.role === "mamma") r = { ...r, tutorial: { ...r.tutorial, step: 3 } };
      return r;
    });
    play("whoosh");
    if (lastThem) {
      setTyping(true);
      window.setTimeout(() => {
        setTyping(false);
        play("message");
      }, 800);
    }
    if (next.money !== before)
      toast(`${next.money > before ? "+" : ""}${fmtEuro(next.money - before)}`, next.money > before ? "ok" : "info", next.money > before ? "coins" : undefined);
  };

  return (
    <>
      <AppHeader
        title={c.name}
        back={back}
        sub={
          <>
            {ROLE_LABEL[c.role]} · {MOOD_LABEL[m]}
          </>
        }
      />
      <div className="flex shrink-0 items-center gap-2 border-b-2 border-line px-3 py-1.5 text-[12px] font-bold text-muted">
        Rapporto
        <Meter value={c.rel} min={-100} max={100} color={c.rel >= 0 ? "var(--ok)" : "var(--danger)"} className="flex-1" label="Rapporto" />
        <span className="num w-8 text-right text-[14px] text-text">{c.rel > 0 ? `+${c.rel}` : c.rel}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3" data-testid="chat-thread">
        <div className="flex flex-col gap-1.5">
          {thread.map((msg, k) => {
            const newDay = k === 0 || thread[k - 1].day !== msg.day;
            return (
              <div key={k} className="flex flex-col">
                {newDay && (
                  <p className="my-1 self-center rounded-full bg-raised px-2.5 py-0.5 text-[11.5px] font-bold text-muted">
                    {msg.day === game.day ? "Oggi" : `${DAY_NAMES[dow(msg.day)]} · giorno ${msg.day}`}
                  </p>
                )}
                <p
                  className={clsx(
                    "max-w-[82%] rounded-[18px] border-2 border-edge px-3 py-2 text-[15px] leading-snug",
                    msg.from === "me" ? "self-end rounded-br-md bg-court text-court-ink" : "self-start rounded-bl-md bg-surface",
                  )}
                >
                  {msg.text}
                </p>
              </div>
            );
          })}
          {typing && (
            <p className="self-start rounded-[18px] rounded-bl-md border-2 border-edge bg-surface px-3 py-2 text-[15px] text-muted">
              sta scrivendo…
            </p>
          )}
          <div ref={end} />
        </div>
      </div>
      <div className="shrink-0 border-t-2 border-line bg-surface px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
        {game.tutorial.step === 2 && c.role === "mamma" && ev && (
          <Coach className="mb-2">Scegli come rispondere: ogni tono cambia il rapporto</Coach>
        )}
        {ev && !typing ? (
          <div className="flex flex-col gap-2" data-testid="chat-choices">
            {ev.choices.map((ch, k) => {
              const text = typeof ch.text === "function" ? ch.text({ s: game, c, data: c.pending?.data ?? {} }) : ch.text;
              return (
                <button
                  key={k}
                  onClick={() => reply(k)}
                  className="press sticker-sm flex min-h-[54px] items-center gap-2 rounded-2xl bg-bg px-3 py-2 text-left"
                >
                  <span className="flex w-[74px] shrink-0 flex-col items-center text-[11.5px] font-bold text-muted">
                    <span className="text-[20px] leading-none">{TONES[ch.tone].emoji}</span>
                    {TONES[ch.tone].label}
                  </span>
                  <span className="text-[15px] font-semibold leading-snug">{text}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="py-2 text-center text-[13.5px] text-muted">{typing ? "…" : "Niente a cui rispondere, per ora"}</p>
        )}
      </div>
    </>
  );
}

function Bank({ back }: { back: () => void }) {
  const { game, update } = useGame();
  useEffect(() => {
    if (game.badges.banca) update((s) => ({ ...s, badges: { ...s.badges, banca: 0 } }));
  }, [game.badges.banca, update]);
  const lv = LEVELS[game.contract.level];
  const gross = weeklyGross(game.contract);
  return (
    <>
      <AppHeader title="Banca" back={back} />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <Tip id="banca" className="mb-3" />
        <div className="card bg-[#1D3B66] px-4 py-4 text-white">
          <p className="text-[13px] font-semibold opacity-80">Saldo</p>
          <p className="display text-[40px] leading-tight" data-testid="bank-balance">{fmtEuro(game.money)}</p>
          <p className="mt-2 text-[14px]">
            Stipendio {fmtEuro(gross)} a settimana{lv.tax ? ` · tasse ${Math.round(lv.tax * 100)}%` : ""} →{" "}
            <b>{fmtEuro(weeklyNet(game.contract))}</b> netti
          </p>
          {game.contract.sponsor ? <p className="text-[13px] opacity-85">di cui sponsor {fmtEuro(game.contract.sponsor)}</p> : null}
        </div>
        <p className="mb-1.5 mt-4 px-1 text-[13px] font-bold uppercase tracking-wide text-muted">Movimenti</p>
        <div className="card divide-y-2 divide-line">
          {[...game.bank].reverse().slice(0, 40).map((t, k) => (
            <div key={k} className="flex items-center gap-2 px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-semibold">{t.label}</span>
                <span className="text-[12px] text-muted">
                  {DAY_NAMES[dow(t.day)]} · giorno {t.day}
                </span>
              </span>
              <span className={clsx("num text-[16px]", t.amount > 0 ? "text-ok" : "text-text")}>
                {t.amount > 0 ? "+" : ""}
                {fmtEuro(t.amount)}
              </span>
            </div>
          ))}
          {!game.bank.length && <p className="p-4 text-center text-muted">Nessun movimento</p>}
        </div>
      </div>
    </>
  );
}

function Contracts({ back }: { back: () => void }) {
  const { game, update } = useGame();
  const toast = useToast();
  const [confirm, setConfirm] = useState<string | null>(null);
  useEffect(() => {
    if (game.badges.contratti) update((s) => ({ ...s, badges: { ...s.badges, contratti: 0 } }));
  }, [game.badges.contratti, update]);
  const sum = seasonSummary(game);
  const up = LEVELS[game.contract.level].up;
  const offer = game.offers.find((o) => o.id === confirm);
  return (
    <>
      <AppHeader title="Contratti" back={back} />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <Tip id="contratti" className="mb-3" />
        <div className="card px-4 py-3">
          <p className="text-[12.5px] font-bold uppercase tracking-wide text-muted">Contratto attuale</p>
          <p className="display mt-1 text-[22px] leading-tight">{game.contract.team}</p>
          <p className="text-[14.5px]">
            {LEVELS[game.contract.level].name} · {fmtEuro(game.contract.salary)} a settimana
          </p>
          {up && (
            <p className="mt-2 text-[13.5px] text-muted">
              Per salire in {LEVELS[LEVELS[game.contract.level].next!].name}: voto medio {String(up.rating).replace(".", ",")}
              {up.or ? " oppure " : " e "}fama {up.fame}. Ora: voto {sum.avg.toLocaleString("it-IT")}, fama {game.fame}.
            </p>
          )}
        </div>
        {game.offers.length > 0 ? (
          <>
            <p className="mb-1.5 mt-4 px-1 text-[13px] font-bold uppercase tracking-wide text-muted">Le offerte</p>
            <div className="flex flex-col gap-2">
              {game.offers.map((o) => (
                <div key={o.id} className={clsx("card px-4 py-3", o.promotion && "bg-gold-soft")}>
                  {o.promotion && <p className="text-[12.5px] font-bold uppercase tracking-wide">🚀 Promozione</p>}
                  <p className="display text-[21px] leading-tight">{o.team}</p>
                  <p className="text-[14.5px]">
                    {LEVELS[o.level].name} · <b>{fmtEuro(o.salary)}</b> a settimana
                  </p>
                  <p className="mt-0.5 text-[13.5px] italic text-muted">“{o.note}”</p>
                  <Button variant={o.promotion ? "primary" : "court"} block className="mt-2" onClick={() => setConfirm(o.id)} data-testid={`sign-${o.id}`}>
                    Firma
                  </Button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-4 px-2 text-center text-[14px] text-muted">Le offerte arrivano a fine stagione, qui e dal procuratore.</p>
        )}
      </div>
      <Sheet open={!!offer} onClose={() => setConfirm(null)} title="Firmi?">
        {offer && (
          <>
            <p className="text-[15.5px]">
              <b>{offer.team}</b>, {LEVELS[offer.level].name}, {fmtEuro(offer.salary)} a settimana. La stagione nuova parte lunedì.
            </p>
            <Button
              variant="primary"
              size="lg"
              block
              className="mt-4"
              onClick={() => {
                const promoted = LEVEL_ORDER.indexOf(offer.level) > levelIndex(game);
                update((s) => acceptOffer(s, offer.id, Math.random));
                setConfirm(null);
                play(promoted ? "unlock" : "success");
                toast(promoted ? `Benvenuto in ${LEVELS[offer.level].name}!` : "Firmato!", "ok");
                back();
              }}
            >
              Firma il contratto
            </Button>
          </>
        )}
      </Sheet>
    </>
  );
}

function ItemPreview({ it }: { it: Item }) {
  const { charId, me } = useGame();
  const outfit = { [it.slot]: it.id };
  if (it.slot === "scarpe" || it.slot === "polso" || it.slot === "maglia")
    // Scarpe e orologio: si inquadrano gambe o polso del personaggio intero.
    return (
      <span className="flex h-[64px] w-[64px] shrink-0 justify-center overflow-hidden rounded-2xl border-2 border-edge bg-raised">
        <Character
          id={charId}
          outfit={outfit}
          number={me.jerseyNumber}
          height={it.slot === "maglia" ? 96 : 116}
          noBall
          className={it.slot === "scarpe" ? "-mt-[50px] shrink-0" : it.slot === "polso" ? "-mt-[38px] shrink-0" : "-mt-[30px] shrink-0"}
        />
      </span>
    );
  return (
    <span className="h-[64px] w-[64px] shrink-0 overflow-hidden rounded-2xl border-2 border-edge">
      <PresetAvatar id={charId} outfit={outfit} />
    </span>
  );
}

function Shopping({ back }: { back: () => void }) {
  const { game, update } = useGame();
  const toast = useToast();
  const [tab, setTab] = useState<"vestiti" | "extra">("vestiti");
  const buy = (it: Item) => {
    update((s) => {
      let r = buyItem(s, it.id, Math.random);
      if (r !== s && r.tutorial.step === 3 && it.slot === "scarpe") r = { ...r, tutorial: { ...r.tutorial, step: 4 } };
      return r;
    });
    toast(game.tutorial.step === 3 && it.slot === "scarpe" ? "Scarpe nuove! Il tutorial è finito: buona carriera" : `Comprato: ${it.name}. Lo indossi già`, "ok", "coins");
  };
  return (
    <>
      <AppHeader title="Shopping" back={back} sub={`Hai ${fmtEuro(game.money)}`} />
      <div className="flex shrink-0 gap-2 px-3 pt-3">
        {(["vestiti", "extra"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx("press sticker-sm h-11 flex-1 rounded-full text-[15px] font-bold", tab === t ? "bg-court text-court-ink" : "bg-surface")}
          >
            {t === "vestiti" ? "Vestiti e accessori" : "Extra"}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <Tip id="shopping" className="mb-3" />
        {game.tutorial.step === 3 && <Coach className="mb-2">Compra le Scarpe da campetto: 80 €</Coach>}
        {tab === "vestiti" ? (
          SLOTS.map((slot) => (
            <div key={slot} className="mb-4">
              <p className="mb-1.5 px-1 text-[13px] font-bold uppercase tracking-wide text-muted">{SLOT_NAMES[slot]}</p>
              <div className="flex flex-col gap-2">
                {ITEMS.filter((i) => i.slot === slot && (!i.prize || game.owned.includes(i.id))).map((it) => {
                  const can = canBuy(game, it.id);
                  const owned = game.owned.includes(it.id);
                  const locked = LEVEL_ORDER.indexOf(it.level) > levelIndex(game);
                  return (
                    <div key={it.id} className={clsx("card flex items-center gap-3 px-3 py-2.5", locked && "opacity-60")} data-testid={`item-${it.id}`}>
                      <ItemPreview it={it} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-bold leading-tight">{it.name}</span>
                        <span className="block text-[12.5px] leading-snug text-muted">{it.line}</span>
                        <span className="num mt-0.5 block text-[16px]">{it.prize ? "Premio" : shortEuro(it.price)}</span>
                      </span>
                      {owned ? (
                        <span className="shrink-0 rounded-full bg-ok px-3 py-1.5 text-[13px] font-bold text-white">Tuo ✓</span>
                      ) : locked ? (
                        <span className="shrink-0 text-center text-[12px] font-bold text-muted">
                          🔒<br />
                          {LEVELS[it.level].name}
                        </span>
                      ) : (
                        <Button variant="primary" size="sm" disabled={!can.ok} onClick={() => buy(it)} className={clsx(game.tutorial.step === 3 && it.id === "scarpe-campetto" && "game-glow")}>
                          Compra
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col gap-2">
            {CONSUMABLES.map((c) => {
              const price = consumablePrice(game, c.id);
              const done = !!c.perk && game.perks[c.perk];
              return (
                <div key={c.id} className="card flex items-center gap-3 px-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold">{c.name}</span>
                    <span className="block text-[13px] text-muted">{c.line}</span>
                    <span className="num mt-0.5 block text-[16px]">{shortEuro(price)}</span>
                  </span>
                  {done ? (
                    <span className="rounded-full bg-ok px-3 py-1.5 text-[13px] font-bold text-white">Preso ✓</span>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={game.money < price}
                      onClick={() => {
                        update((s) => buyConsumable(s, c.id));
                        toast(c.perk ? `${c.name}: fatto!` : `${c.name}: ${c.line.toLowerCase()}`, "ok", "coins");
                      }}
                    >
                      Compra
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function Calendar({ back }: { back: () => void }) {
  const { game } = useGame();
  return (
    <>
      <AppHeader title="Calendario" back={back} sub={`${LEVELS[game.contract.level].name} · stagione ${game.season.n}`} />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="card divide-y-2 divide-line">
          {game.season.matches.map((m, k) => {
            const today = m.day === game.day;
            const r = m.result;
            return (
              <div key={k} className={clsx("flex items-center gap-2 px-3 py-2.5", today && "bg-volt/35")}>
                <span className="num w-7 text-[15px] text-muted">{k + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{m.opponent}</span>
                  <span className="text-[12px] text-muted">
                    {DAY_NAMES[dow(m.day)]} · {m.home ? "casa" : "fuori"}
                    {today ? " · oggi" : ""}
                  </span>
                </span>
                {r ? (
                  <span className={clsx("num rounded-full px-2.5 py-1 text-[14px] text-white", r.us > r.them ? "bg-ok" : "bg-danger")}>
                    {r.us}–{r.them}
                  </span>
                ) : (
                  <span className="text-[12.5px] font-semibold text-muted">da giocare</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
