"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { IconCheck, IconHandFinger, IconLock, IconX } from "@tabler/icons-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Statuina } from "@/components/c3d/viewer";
import type { Outfit } from "@/components/c3d/build";
import { Button, Chips, CourtLines, ScreenHeader, Segmented, haptic } from "@/components/ui/basics";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { play } from "@/lib/sound";
import { buy, ensureStall, equip, stallOf } from "@/lib/pass/actions";
import { ITEMS, ITEM_BY_ID, PRICE, RARITY_LABEL, SLOTS, type Item, type Slot } from "@/lib/pass/catalog";
import { todayKey } from "@/lib/pass/store";
import { useNow } from "@/lib/use-now";
import { RewardReveal } from "./reveal";
import { FRAMING_OF, ItemPhoto, RarityTag, SpicchiChip, SpicchioIcon, sourceOf } from "./ui";
import { presetOf, usePass } from "./use-pass";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;
const HINT_KEY = "campetto:camerino-gira";

/** Nomi brevi per le categorie (stanno su un chip). */
const SHORT: Partial<Record<Slot, string>> = { skin: "Personaggio", piedi: "Scarpe" };

export function Camerino() {
  const router = useRouter();
  const v = usePass();
  const { prog, st, playerId } = v;
  const toast = useToast();
  const now = useNow(30_000);
  const [tab, setTab] = useState<"armadio" | "bancarella">("armadio");
  const [slot, setSlot] = useState<Slot>("skin");
  const [trying, setTrying] = useState<string | null>(null);
  const [buying, setBuying] = useState<Item | null>(null);
  const [reveal, setReveal] = useState<Item | null>(null);
  const [hint, setHint] = useState(false);
  const today = todayKey(now);

  useEffect(() => {
    if (v.playerId && !v.allowed) router.replace("/");
  }, [v.playerId, v.allowed, router]);
  useEffect(() => {
    try {
      if (!localStorage.getItem(HINT_KEY)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setHint(true);
        localStorage.setItem(HINT_KEY, "1");
      }
    } catch {
      /* niente */
    }
  }, []);

  // La bancarella si fissa per tutto il giorno la prima volta che la vedi.
  const stallIds = useMemo(() => {
    if (!prog || !playerId) return [];
    return st.stall?.day === today ? st.stall.ids : stallOf(playerId, prog.owned, today);
  }, [st.stall, today, prog, playerId]);
  useEffect(() => {
    if (playerId && stallIds.length && st.stall?.day !== today) ensureStall(playerId, stallIds, today);
  }, [playerId, stallIds, st.stall, today]);

  const tryItem = trying ? ITEM_BY_ID.get(trying) : undefined;
  const shownPreset = presetOf(tryItem) ?? v.preset;
  const shownOutfit: Outfit = useMemo(
    () => (tryItem && tryItem.slot !== "skin" ? { ...v.outfit, [tryItem.slot]: tryItem.look } : v.outfit),
    [tryItem, v.outfit],
  );

  if (!prog || !playerId) return null;
  const owned = prog.owned;
  const wornId = (s: Slot) => (s === "skin" ? `skin-${v.preset}` : st.outfit[s] && owned.has(st.outfit[s]!) ? st.outfit[s]! : null);
  const framing = tryItem ? FRAMING_OF[tryItem.slot] : tab === "armadio" ? FRAMING_OF[slot] : "full";
  const list = ITEMS.filter((i) => i.slot === slot);
  const anyOn = (Object.keys(st.outfit) as Slot[]).some((s) => s !== "skin" && wornId(s));
  const msToMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
  const hLeft = Math.floor(msToMidnight / 3_600_000);
  const mLeft = Math.floor((msToMidnight % 3_600_000) / 60_000);

  const wear = (it: Item) => {
    haptic(8);
    setTrying(null);
    if (it.slot !== "skin" && wornId(it.slot) === it.id) {
      equip(playerId, it.slot, null);
      play("toggleOff");
      return;
    }
    equip(playerId, it.slot, it.id);
    play("select");
  };

  const pick = (it: Item) => {
    if (owned.has(it.id)) wear(it);
    else {
      haptic(5);
      setTrying(trying === it.id ? null : it.id);
    }
  };

  return (
    <>
      <ScreenHeader
        title="Camerino"
        back={() => (window.history.length > 1 ? router.back() : router.push("/"))}
        action={<SpicchiChip prog={prog} tone="solid" />}
      />
      <div className="scroll-area min-h-0 flex-1 px-5 pb-10 pt-1">
        {/* Il personaggio vivo */}
        <section
          className="rise court relative h-[clamp(270px,44dvh,380px)] overflow-hidden rounded-[28px]"
          style={rise(0)}
          data-testid="camerino-stage"
        >
          <span className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_18%,rgb(255_255_255/0.32),transparent_60%)]" aria-hidden />
          <CourtLines className="absolute inset-0 h-full w-full opacity-60" />
          <div className="absolute inset-0">
            <Statuina preset={shownPreset} outfit={shownOutfit} number={v.number} framing={framing} paused={!!reveal} />
          </div>
          {anyOn && !tryItem && (
            <button
              onClick={() => {
                for (const s of SLOTS) if (s.id !== "skin") equip(playerId, s.id, null);
                play("whoosh");
                haptic(10);
              }}
              className="press absolute right-3 top-3 rounded-full border border-white/20 bg-white/15 px-3 py-1.5 text-[12.5px] font-semibold text-white backdrop-blur-md"
            >
              Togli tutto
            </button>
          )}
          {hint && !tryItem && (
            <p className="fade-in pointer-events-none absolute inset-x-0 bottom-3 mx-auto flex w-fit items-center gap-1.5 rounded-full bg-black/25 px-3 py-1.5 text-[12.5px] font-semibold text-white backdrop-blur-md">
              <IconHandFinger size={15} aria-hidden /> Trascina per girarlo, tocca per palleggiare
            </p>
          )}
          {tryItem && (
            <div
              className="fade-in absolute inset-x-3 bottom-3 flex items-center gap-2.5 rounded-[20px] border border-white/20 bg-white/20 p-2 pl-3.5 text-white backdrop-blur-md"
              data-testid="try-banner"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">In prova: {tryItem.name}</span>
                <span className="block truncate text-[12px] text-white/80">{sourceOf(tryItem)}</span>
              </span>
              {stallIds.includes(tryItem.id) && (
                <Button size="sm" variant="primary" onClick={() => setBuying(tryItem)} sound={false}>
                  <SpicchioIcon size={16} /> {PRICE[tryItem.rarity]}
                </Button>
              )}
              <button
                onClick={() => setTrying(null)}
                aria-label="Togli la prova"
                className="press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/20"
              >
                <IconX size={16} strokeWidth={2.4} />
              </button>
            </div>
          )}
        </section>

        <Segmented
          className="rise mt-5"
          value={tab}
          onChange={(t) => {
            setTab(t);
            setTrying(null);
          }}
          options={[
            { value: "armadio", label: "Armadio" },
            { value: "bancarella", label: "Bancarella" },
          ]}
        />

        {tab === "armadio" ? (
          <div className="fade-in mt-4" key="armadio">
            <Chips
              scroll
              value={slot}
              onChange={(s) => {
                setSlot(s);
                setTrying(null);
              }}
              options={SLOTS.map((s) => ({ value: s.id, label: SHORT[s.id] ?? s.label }))}
            />
            <div className="mt-3 grid grid-cols-3 gap-x-2.5 gap-y-3" data-testid="armadio">
              {slot !== "skin" && (
                <button onClick={() => {
                  setTrying(null);
                  if (wornId(slot)) {
                    equip(playerId, slot, null);
                    play("toggleOff");
                    haptic(8);
                  }
                }} className="press text-left" aria-pressed={!wornId(slot)}>
                  <span
                    className={clsx(
                      "grid aspect-square place-items-center rounded-[20px] border-2 border-dashed text-[13px] font-semibold",
                      !wornId(slot) ? "border-text text-text" : "border-line-strong text-muted",
                    )}
                  >
                    Niente
                  </span>
                  <span className="mt-1.5 block truncate px-0.5 text-[12.5px] font-semibold text-muted">Togli</span>
                </button>
              )}
              {list.map((it) => {
                const mine = owned.has(it.id);
                const on = wornId(it.slot) === it.id;
                return (
                  <button
                    key={it.id}
                    onClick={() => pick(it)}
                    aria-pressed={on}
                    data-testid={`item-${it.id}`}
                    className="press min-w-0 text-left"
                  >
                    <span
                      className={clsx(
                        "relative block aspect-square overflow-hidden rounded-[20px] text-white transition-shadow",
                        `rar-${it.rarity}`,
                        it.rarity === "leggendario" && "shine",
                        on && "shadow-[0_0_0_3px_var(--bg),0_0_0_6px_var(--volt)]",
                        trying === it.id && "shadow-[0_0_0_3px_var(--bg),0_0_0_6px_#fffaf0]",
                      )}
                    >
                      <ItemPhoto item={it} preset={v.preset} size={192} className="absolute inset-0" />
                      {!mine && <span className="absolute inset-0 bg-[#1d1a16]/35" aria-hidden />}
                      {!mine && (
                        <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/40" aria-label="Non ce l'hai">
                          <IconLock size={13} />
                        </span>
                      )}
                      {on && (
                        <span className="pop-in absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-volt text-volt-ink" aria-label="Lo indossi">
                          <IconCheck size={15} strokeWidth={3} />
                        </span>
                      )}
                    </span>
                    <span className="mt-1.5 block truncate px-0.5 text-[12.5px] font-semibold">{it.name}</span>
                    <span className="block truncate px-0.5 text-[11.5px] text-muted">
                      {mine ? RARITY_LABEL[it.rarity] : sourceOf(it)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="fade-in mt-4" key="bancarella">
            <div className="flex items-center justify-between px-1">
              <p className="min-w-0 truncate text-[13px] text-muted">Quattro oggetti al giorno</p>
              <p className="shrink-0 whitespace-nowrap rounded-full bg-raised px-2.5 py-1 text-[12px] font-semibold text-muted" data-testid="stall-timer">
                Nuovi tra {hLeft ? `${hLeft} h ` : ""}
                {mLeft} min
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3" data-testid="bancarella">
              {stallIds.map((id, i) => {
                const it = ITEM_BY_ID.get(id);
                if (!it) return null;
                const mine = owned.has(id);
                const price = PRICE[it.rarity];
                return (
                  <div key={id} className="rise card overflow-hidden p-1.5" style={rise(i)}>
                    <button
                      onClick={() => (mine ? wear(it) : setTrying(trying === id ? null : id))}
                      className={clsx("press relative block aspect-square w-full overflow-hidden rounded-[16px]", `rar-${it.rarity}`, it.rarity === "leggendario" && "shine")}
                      aria-label={mine ? `Indossa ${it.name}` : `Prova ${it.name}`}
                    >
                      <ItemPhoto item={it} preset={v.preset} size={224} className="absolute inset-0" />
                      <RarityTag rarity={it.rarity} className="absolute left-2 top-2 !bg-black/25 [background-image:none]" />
                    </button>
                    <div className="px-1.5 pb-1 pt-2">
                      <p className="truncate text-[14px] font-semibold">{it.name}</p>
                      {mine ? (
                        <p className="mt-1.5 flex h-9 items-center gap-1 text-[13px] font-semibold text-ok">
                          <IconCheck size={16} strokeWidth={3} /> Ce l&apos;hai
                        </p>
                      ) : (
                        <button
                          onClick={() => setBuying(it)}
                          data-testid={`buy-${id}`}
                          className={clsx(
                            "press sticker mt-1.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-[14px] font-bold",
                            prog.spicchi >= price ? "bg-volt text-volt-ink" : "bg-raised text-muted",
                          )}
                        >
                          <SpicchioIcon size={18} />
                          <span className="num">{price}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 px-1 text-center text-[12.5px] text-muted">
              Gli oggetti del pass di Natale non si comprano: si vincono solo salendo di livello
            </p>
          </div>
        )}
      </div>

      <Sheet
        open={!!buying}
        onOpenChange={(o) => !o && setBuying(null)}
        title={buying?.name ?? ""}
        description={buying ? `${RARITY_LABEL[buying.rarity]} · ${buying.blurb}` : undefined}
        footer={
          buying && (
            <Button
              variant="primary"
              block
              disabled={prog.spicchi < PRICE[buying.rarity]}
              data-testid="buy-confirm"
              sound={false}
              onClick={() => {
                const it = buying;
                if (!buy(playerId, it.id, prog.spicchi)) return;
                play("coins");
                setBuying(null);
                setTrying(null);
                setReveal(it);
              }}
            >
              {prog.spicchi >= PRICE[buying.rarity] ? (
                <>
                  Compra per <SpicchioIcon size={18} /> {PRICE[buying.rarity]}
                </>
              ) : (
                `Ti mancano ${PRICE[buying.rarity] - prog.spicchi} Spicchi`
              )}
            </Button>
          )
        }
      >
        {buying && (
          <>
            <div className={clsx("relative mx-auto aspect-square w-44 overflow-hidden rounded-[28px]", `rar-${buying.rarity}`)}>
              <ItemPhoto item={buying} preset={v.preset} size={352} className="absolute inset-0" />
            </div>
            <div className="mt-4 flex items-center justify-center gap-6 pb-2 text-center">
              <div>
                <p className="num text-[20px]">{prog.spicchi}</p>
                <p className="text-[12px] text-muted">Hai</p>
              </div>
              <div>
                <p className="num text-[20px] text-danger">−{PRICE[buying.rarity]}</p>
                <p className="text-[12px] text-muted">Costa</p>
              </div>
              <div>
                <p className="num text-[20px]">{Math.max(0, prog.spicchi - PRICE[buying.rarity])}</p>
                <p className="text-[12px] text-muted">Ti restano</p>
              </div>
            </div>
          </>
        )}
      </Sheet>

      {reveal && (
        <RewardReveal
          item={reveal}
          kicker="Dalla bancarella"
          preset={v.preset}
          outfit={v.outfit}
          number={v.number}
          owned
          onClose={() => setReveal(null)}
          onEquip={() => {
            equip(playerId, reveal.slot, reveal.id);
            setReveal(null);
            toast(`${reveal.name} addosso`);
          }}
        />
      )}
    </>
  );
}
