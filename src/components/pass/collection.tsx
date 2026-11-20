"use client";

import clsx from "clsx";
import Link from "next/link";
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconHandFinger,
  IconLock,
  IconSnowflake,
  IconX,
} from "@tabler/icons-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { Statuina } from "@/components/c3d/viewer";
import type { Outfit, Preset } from "@/components/c3d/build";
import { Button, Chips, haptic } from "@/components/ui/basics";
import { play } from "@/lib/sound";
import {
  ITEMS,
  PASS_LEVELS,
  PRICE,
  RARITIES,
  RARITY_LABEL,
  SLOTS,
  type Item,
  type Slot,
} from "@/lib/pass/catalog";
import { FRAMING_OF, ItemPhoto, RarityTag, SpicchioIcon, sourceOf } from "./ui";

const rise = (i: number) => ({ "--i": Math.min(i, 12) }) as CSSProperties;
const SHORT: Partial<Record<Slot, string>> = {
  skin: "Personaggi",
  piedi: "Scarpe",
  pallone: "Palloni",
};
const RANK: Record<string, number> = Object.fromEntries(
  RARITIES.map((r, i) => [r, i]),
);

/** Dove si trova, in due parole: sta sulla targhetta di una carta che non hai. */
export function shortSource(item: Item): string {
  if (item.id === "skin-bomber") return "Coi badge";
  const lv = PASS_LEVELS.find(
    (l) => l.reward.kind === "item" && l.reward.id === item.id,
  );
  if (lv) return `Pass · liv. ${lv.n}`;
  return "Bancarella";
}

/** Le tacche della rarità sotto al nome: una per il comune, quattro per il leggendario. */
function Pips({ n, className }: { n: number; className?: string }) {
  return (
    <span className={clsx("flex gap-[3px]", className)} aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <i
          key={i}
          className={clsx(
            "h-[5px] w-[5px] rounded-full",
            i <= n ? "bg-white" : "bg-white/25",
          )}
        />
      ))}
    </span>
  );
}

/**
 * Una carta della collezione, come quelle di Clash Royale: cornice del colore della rarità,
 * l'oggetto addosso al tuo personaggio, il nome su una targhetta. Quelle che non hai sono
 * spente, col lucchetto e dove si trovano.
 */
export function CollectCard({
  item,
  mine,
  on,
  preset,
  onOpen,
  index = 0,
}: {
  item: Item;
  mine: boolean;
  on: boolean;
  preset: Preset;
  onOpen: () => void;
  index?: number;
}) {
  return (
    <button
      onClick={onOpen}
      className="press rise coll-card min-w-0 text-left"
      style={rise(index)}
      data-testid={`card-${item.id}`}
      aria-label={`${item.name}, ${RARITY_LABEL[item.rarity]}${mine ? (on ? ", lo indossi" : "") : ", da trovare"}`}
    >
      <span
        className={clsx(
          "coll-frame",
          `frame-${item.rarity}`,
          !mine && "is-locked",
        )}
      >
        <span
          className={clsx(
            "coll-art",
            `rar-${item.rarity}`,
            mine && item.rarity === "leggendario" && "shine",
          )}
        >
          <ItemPhoto
            item={item}
            preset={preset}
            size={200}
            persist
            className={clsx("absolute inset-0", !mine && "coll-off")}
          />
          {mine &&
            (item.rarity === "epico" || item.rarity === "leggendario") && (
              <span className="coll-foil" aria-hidden />
            )}
          {!mine && (
            <span
              className="absolute inset-0 grid place-items-center"
              aria-hidden
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm">
                <IconLock size={17} />
              </span>
            </span>
          )}
          {on && (
            <span className="pop-in absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-volt px-1.5 py-0.5 text-[10px] font-bold text-volt-ink">
              <IconCheck size={11} strokeWidth={3.2} aria-hidden /> Addosso
            </span>
          )}
          {item.natale && (
            <span
              className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-white/25 text-white backdrop-blur-sm"
              aria-hidden
            >
              <IconSnowflake size={12} />
            </span>
          )}
        </span>
        <span className="coll-plate">
          <span className="block truncate text-[12px] font-bold leading-tight">
            {item.name}
          </span>
          {mine ? (
            <Pips n={RANK[item.rarity]} className="mt-1" />
          ) : (
            <span className="mt-0.5 block truncate text-[10.5px] font-semibold text-white/75">
              {shortSource(item)}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

type Filter = "tutte" | Slot;

/** La collezione: quante ne hai, i filtri per parte del corpo, le carte trovate e quelle da trovare. */
export function Collection({
  owned,
  wornId,
  preset,
  onOpen,
}: {
  owned: Set<string>;
  wornId: (s: Slot) => string | null;
  preset: Preset;
  onOpen: (item: Item, list: Item[]) => void;
}) {
  const [filter, setFilter] = useState<Filter>("tutte");
  const sorted = useMemo(
    () =>
      [...ITEMS].sort(
        (a, b) =>
          RANK[b.rarity] - RANK[a.rarity] ||
          SLOTS.findIndex((s) => s.id === a.slot) -
            SLOTS.findIndex((s) => s.id === b.slot),
      ),
    [],
  );
  const shown = sorted.filter((i) => filter === "tutte" || i.slot === filter);
  const found = shown.filter((i) => owned.has(i.id));
  const missing = shown.filter((i) => !owned.has(i.id));
  const total = ITEMS.length;
  const have = ITEMS.filter((i) => owned.has(i.id)).length;
  const ordered = [...found, ...missing];

  return (
    <div data-testid="collezione">
      <div className="card flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-muted">
            Carte trovate
          </p>
          <p className="num text-[22px] leading-tight">
            {have}
            <span className="text-[15px] text-faint">/{total}</span>
          </p>
        </div>
        <div className="w-[46%]">
          <div
            className="h-2.5 overflow-hidden rounded-full bg-raised"
            aria-hidden
          >
            <span
              className="bar-in block h-full rounded-full bg-volt"
              style={{ width: `${(have / total) * 100}%` }}
            />
          </div>
          <p className="mt-1 text-right text-[11.5px] text-muted">
            {total - have ? `ne mancano ${total - have}` : "Tutte tue!"}
          </p>
        </div>
      </div>

      <Chips
        scroll
        className="mt-3"
        value={filter}
        onChange={(f) => {
          setFilter(f);
          haptic(4);
        }}
        options={[
          { value: "tutte" as Filter, label: "Tutte" },
          ...SLOTS.map((s) => ({
            value: s.id as Filter,
            label: SHORT[s.id] ?? s.label,
          })),
        ]}
      />

      {found.length > 0 && (
        <>
          <p className="mb-2 mt-4 px-1 text-[12.5px] font-semibold text-muted">
            Le tue · {found.length}
          </p>
          <div
            className="grid grid-cols-3 gap-x-2.5 gap-y-3"
            data-testid="coll-found"
          >
            {found.map((it, i) => (
              <CollectCard
                key={it.id}
                item={it}
                mine
                on={wornId(it.slot) === it.id}
                preset={preset}
                index={i}
                onOpen={() => onOpen(it, ordered)}
              />
            ))}
          </div>
        </>
      )}
      {missing.length > 0 && (
        <>
          <p className="mb-2 mt-5 px-1 text-[12.5px] font-semibold text-muted">
            Da trovare · {missing.length}
          </p>
          <div
            className="grid grid-cols-3 gap-x-2.5 gap-y-3"
            data-testid="coll-missing"
          >
            {missing.map((it, i) => (
              <CollectCard
                key={it.id}
                item={it}
                mine={false}
                on={false}
                preset={preset}
                index={found.length + i}
                onOpen={() => onOpen(it, ordered)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * La carta aperta: grande, con l'oggetto in 3D addosso al tuo personaggio che gira da solo
 * (e col dito). Da qui lo indossi, lo compri o vedi dove si vince. Le frecce passano alla
 * carta vicina, come sfogliare il raccoglitore.
 */
export function CardDetail({
  item,
  list,
  owned,
  wornId,
  preset,
  outfit,
  number,
  inStall,
  spicchi,
  onWear,
  onBuy,
  onMove,
  onClose,
  passAction,
}: {
  item: Item;
  list: Item[];
  owned: Set<string>;
  wornId: (s: Slot) => string | null;
  preset: Preset;
  outfit: Outfit;
  number?: string;
  inStall: (id: string) => boolean;
  spicchi: number;
  onWear: (item: Item) => void;
  onBuy: (item: Item) => void;
  onMove: (item: Item) => void;
  onClose: () => void;
  /** Aperta dal pass: al posto del rimando al pass, l'azione giusta (riscatta, vai al livello). */
  passAction?: (item: Item) => { label: string; onClick: () => void } | null;
}) {
  const mine = owned.has(item.id);
  const fromPass = !mine && passAction ? passAction(item) : null;
  const on = wornId(item.slot) === item.id;
  const skin = item.look.kind === "skin" ? item.look.preset : null;
  const wear: Outfit = skin ? outfit : { ...outfit, [item.slot]: item.look };
  const at = list.findIndex((i) => i.id === item.id);
  const prev = at > 0 ? list[at - 1] : null;
  const next = at >= 0 && at < list.length - 1 ? list[at + 1] : null;
  const lv = PASS_LEVELS.find(
    (l) => l.reward.kind === "item" && l.reward.id === item.id,
  );
  const price = PRICE[item.rarity];
  const [hint, setHint] = useState(true);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && prev) onMove(prev);
      if (e.key === "ArrowRight" && next) onMove(next);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose, onMove, prev, next]);
  useEffect(() => {
    const t = window.setTimeout(() => setHint(false), 2600);
    return () => window.clearTimeout(t);
  }, []);

  const go = (it: Item | null) => {
    if (!it) return;
    haptic(5);
    play("select");
    onMove(it);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-title"
      className="fade-in fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-[#1d1a16]/80 backdrop-blur-sm"
      data-testid="card-detail"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Sui telefoni bassi la carta può superare lo schermo: allora si scorre, niente resta fuori. */}
      <div
        className="flex min-h-full items-center justify-center px-4 py-5"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          key={item.id}
          className={clsx(
            "coll-open relative w-full max-w-sm",
            "coll-frame big",
            `frame-${item.rarity}`,
          )}
          onTouchStart={(e) => {
            const t = e.touches[0];
            // Solo fuori dal 3D: lì il dito gira l'oggetto.
            if ((e.target as HTMLElement).closest("canvas")) return;
            swipe.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchEnd={(e) => {
            const s = swipe.current;
            swipe.current = null;
            if (!s) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - s.x;
            if (
              Math.abs(dx) > 60 &&
              Math.abs(dx) > Math.abs(t.clientY - s.y) * 1.5
            )
              go(dx < 0 ? next : prev);
          }}
        >
          <div
            className={clsx(
              "relative overflow-hidden rounded-[26px] text-center text-white",
              `rar-${item.rarity}`,
            )}
          >
            <span
              className="rays absolute left-1/2 top-[30%] h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 opacity-60"
              aria-hidden
            />
            {item.natale && <span className="snow slow" aria-hidden />}
            {(item.rarity === "epico" || item.rarity === "leggendario") &&
              mine && <span className="coll-foil" aria-hidden />}
            <div className="relative flex items-center justify-between gap-2 px-3.5 pt-3.5">
              <RarityTag
                rarity={item.rarity}
                className="!bg-black/25 [background-image:none]"
              />
              <button
                onClick={onClose}
                aria-label="Chiudi"
                className="press grid h-9 w-9 place-items-center rounded-full bg-white/20 text-white backdrop-blur-md"
              >
                <IconX size={17} strokeWidth={2.4} />
              </button>
            </div>
            <div
              className="relative mx-auto h-[clamp(200px,38dvh,320px)] w-full"
              data-testid="card-3d"
            >
              <Statuina
                preset={skin ?? preset}
                outfit={wear}
                number={number}
                framing={FRAMING_OF[item.slot]}
                spin={0.55}
                pivot={
                  item.slot === "pallone" || item.slot === "braccio"
                    ? item.slot
                    : undefined
                }
              />
              {hint && (
                <p className="fade-in pointer-events-none absolute inset-x-0 bottom-1 mx-auto flex w-fit items-center gap-1.5 rounded-full bg-black/25 px-3 py-1 text-[12px] font-semibold backdrop-blur-sm">
                  <IconHandFinger size={14} aria-hidden /> Trascina per girarlo
                </p>
              )}
            </div>
            <div className="relative px-5 pb-5">
              <p className="text-[12px] font-semibold text-white/75">
                {SLOTS.find((s) => s.id === item.slot)?.label}
                {item.natale ? " · Season di Natale" : ""}
              </p>
              <h2
                id="card-title"
                className="display mt-0.5 text-[27px] leading-tight"
              >
                {item.name}
              </h2>
              <p className="mx-auto mt-1 max-w-[30ch] text-[14px] text-white/85">
                {item.blurb}
              </p>
              {!mine && (
                <p className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1 text-[12.5px] font-semibold">
                  <IconLock size={13} aria-hidden /> {sourceOf(item)}
                </p>
              )}
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => go(prev)}
                  disabled={!prev}
                  aria-label="Carta prima"
                  className="press grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/20 disabled:opacity-30"
                >
                  <IconChevronLeft size={20} strokeWidth={2.4} />
                </button>
                <div className="min-w-0 flex-1">
                  {mine ? (
                    skin && on ? (
                      // Non un bottone spento (si leggeva male): uno stato chiaro.
                      <p className="flex h-12 items-center justify-center gap-1.5 rounded-full bg-white/25 text-[15px] font-bold text-white" data-testid="card-worn">
                        <IconCheck size={18} strokeWidth={3} aria-hidden /> Lo stai usando
                      </p>
                    ) : skin ? (
                      <Button variant="primary" block onClick={() => onWear(item)} data-testid="card-wear">
                        Usa questo personaggio
                      </Button>
                    ) : (
                      <Button
                        variant={on ? "light" : "primary"}
                        block
                        className={on ? "text-text" : ""}
                        onClick={() => onWear(item)}
                        data-testid="card-wear"
                      >
                        {on ? "Toglilo" : "Indossalo"}
                      </Button>
                    )
                  ) : inStall(item.id) ? (
                    <Button
                      variant="primary"
                      block
                      onClick={() => onBuy(item)}
                      data-testid="card-buy"
                      sound={false}
                    >
                      {spicchi >= price ? (
                        <>
                          Compra · <SpicchioIcon size={17} /> {price}
                        </>
                      ) : (
                        `Ti mancano ${price - spicchi} Spicchi`
                      )}
                    </Button>
                  ) : fromPass ? (
                    <button
                      onClick={fromPass.onClick}
                      className="press sticker flex h-12 w-full items-center justify-center rounded-full bg-volt text-[15px] font-bold text-volt-ink"
                      data-testid="card-pass-action"
                    >
                      {fromPass.label}
                    </button>
                  ) : lv ? (
                    <Link
                      href="/pass"
                      className="press sticker flex h-12 w-full items-center justify-center rounded-full bg-volt text-[15px] font-bold text-volt-ink"
                      data-testid="card-to-pass"
                    >
                      Livello {lv.n} del pass
                    </Link>
                  ) : (
                    <p className="flex h-12 items-center justify-center rounded-full bg-black/20 px-3 text-[13px] font-semibold text-white/85">
                      {item.id === "skin-bomber"
                        ? "Si sblocca coi badge"
                        : "Oggi non è in bancarella"}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => go(next)}
                  disabled={!next}
                  aria-label="Carta dopo"
                  className="press grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/20 disabled:opacity-30"
                >
                  <IconChevronRight size={20} strokeWidth={2.4} />
                </button>
              </div>
              <p
                className="mt-2.5 text-[11.5px] font-semibold text-white/60"
                aria-live="polite"
              >
                {at + 1} di {list.length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
