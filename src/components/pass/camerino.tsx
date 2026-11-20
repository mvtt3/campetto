"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { IconCheck, IconHandFinger } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Statuina } from "@/components/c3d/viewer";
import { Button, CourtLines, ScreenHeader, Segmented, haptic } from "@/components/ui/basics";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { play } from "@/lib/sound";
import { buy, ensureStall, equip, stallOf } from "@/lib/pass/actions";
import { ITEM_BY_ID, PRICE, RARITY_LABEL, SLOTS, type Item, type Slot } from "@/lib/pass/catalog";
import { todayKey } from "@/lib/pass/store";
import { useNow } from "@/lib/use-now";
import { RewardReveal } from "./reveal";
import { CardDetail, Collection } from "./collection";
import { ItemPhoto, RarityTag, SpicchiChip, SpicchioIcon } from "./ui";
import { usePass } from "./use-pass";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;
const HINT_KEY = "campetto:camerino-gira";

export function Camerino() {
  const router = useRouter();
  const v = usePass();
  const { prog, st, playerId } = v;
  const toast = useToast();
  const now = useNow(30_000);
  const [tab, setTab] = useState<"collezione" | "bancarella">("collezione");
  const [detail, setDetail] = useState<{ item: Item; list: Item[] } | null>(null);
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

  // Arrivati da una storia dello Spogliatoio: si apre subito la carta (o la bancarella).
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || !prog) return;
    deepLinked.current = true;
    const q = new URLSearchParams(window.location.search);
    const it = q.get("carta") ? ITEM_BY_ID.get(q.get("carta")!) : undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (it) setDetail({ item: it, list: [it] });
    if (q.get("scheda") === "bancarella") setTab("bancarella");
  }, [prog]);


  if (!prog || !playerId) return null;
  const owned = prog.owned;
  const wornId = (s: Slot) => (s === "skin" ? `skin-${v.preset}` : st.outfit[s] && owned.has(st.outfit[s]!) ? st.outfit[s]! : null);
  const anyOn = (Object.keys(st.outfit) as Slot[]).some((s) => s !== "skin" && wornId(s));
  const msToMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
  const hLeft = Math.floor(msToMidnight / 3_600_000);
  const mLeft = Math.floor((msToMidnight % 3_600_000) / 60_000);

  const wear = (it: Item) => {
    haptic(8);
    if (it.slot !== "skin" && wornId(it.slot) === it.id) {
      equip(playerId, it.slot, null);
      play("toggleOff");
      return;
    }
    equip(playerId, it.slot, it.id);
    play("select");
  };

  const open = (it: Item, list: Item[]) => {
    haptic(6);
    play("select");
    setDetail({ item: it, list });
  };

  const natale = prog.season.theme === "natale";
  return (
    <div className="relative isolate flex min-h-0 flex-1 flex-col">
      {natale && (
        <div className="cielo-natale" aria-hidden>
          <span className="snow" />
        </div>
      )}
      <ScreenHeader
        center
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
          {natale && <span className="neve-tetto" aria-hidden />}
          <div className="absolute inset-0">
            <Statuina preset={v.preset} outfit={v.outfit} number={v.number} framing="full" paused={!!reveal || !!detail} />
          </div>
          {anyOn && (
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
          {hint && (
            <p className="fade-in pointer-events-none absolute inset-x-0 bottom-3 mx-auto flex w-fit items-center gap-1.5 rounded-full bg-black/25 px-3 py-1.5 text-[12.5px] font-semibold text-white backdrop-blur-md">
              <IconHandFinger size={15} aria-hidden /> Trascina per girarlo, tocca per palleggiare
            </p>
          )}
        </section>

        <Segmented
          className="rise mt-5"
          value={tab}
          onChange={(t) => setTab(t)}
          options={[
            { value: "collezione", label: "Collezione" },
            { value: "bancarella", label: "Bancarella" },
          ]}
        />

        {tab === "collezione" ? (
          <div className="fade-in mt-4" key="collezione">
            <Collection owned={owned} wornId={wornId} preset={v.preset} onOpen={open} />
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
                      onClick={() => open(it, stallIds.map((x) => ITEM_BY_ID.get(x)).filter((x): x is Item => !!x))}
                      className={clsx("press relative block aspect-square w-full overflow-hidden rounded-[16px]", `rar-${it.rarity}`, it.rarity === "leggendario" && "shine")}
                      aria-label={`Guarda ${it.name}`}
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

      {detail && (
        <CardDetail
          item={detail.item}
          list={detail.list}
          owned={owned}
          wornId={wornId}
          preset={v.preset}
          outfit={v.outfit}
          number={v.number}
          spicchi={prog.spicchi}
          inStall={(id) => stallIds.includes(id)}
          onWear={(it) => {
            wear(it);
            if (it.slot === "skin" || wornId(it.slot) !== it.id) toast(`${it.name} addosso`);
          }}
          onBuy={(it) => {
            setDetail(null);
            setBuying(it);
          }}
          onMove={(it) => setDetail((d) => (d ? { ...d, item: it } : d))}
          onClose={() => setDetail(null)}
        />
      )}
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
    </div>
  );
}
