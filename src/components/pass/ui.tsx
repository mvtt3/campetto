"use client";

import clsx from "clsx";
import { IconBolt } from "@tabler/icons-react";
import { useState, type CSSProperties } from "react";
import { Photo } from "@/components/c3d/viewer";
import type { Outfit, Preset } from "@/components/c3d/build";
import type { Framing } from "@/components/c3d/stage";
import { Sheet } from "@/components/ui/sheet";
import { CountUp } from "@/components/ui/basics";
import {
  PASS_LEVELS,
  PRICE,
  RARITY_LABEL,
  SPICCHI_PER_EXTRA_LEVEL,
  SPICCHI_PER_MATCH,
  type Item,
  type Rarity,
  type Reward,
  type Slot,
} from "@/lib/pass/catalog";
import type { PassProgress } from "@/lib/pass/engine";

/** Lo Spicchio: una moneta col disegno del pallone. */
export function SpicchioIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={clsx("shrink-0", className)} aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#e8a100" />
      <circle cx="12" cy="12" r="9" fill="#ffc531" />
      <circle cx="12" cy="12" r="6.6" fill="#f26a1b" />
      <path
        d="M12 5.4V18.6M5.4 12H18.6M7.6 7.3Q12 12 7.6 16.7M16.4 7.3Q12 12 16.4 16.7"
        stroke="#1d1a16"
        strokeWidth="1.15"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Il saldo degli Spicchi; un tocco spiega da dove arrivano. */
export function SpicchiChip({
  prog,
  tone = "glass",
  className,
}: {
  prog: PassProgress;
  tone?: "glass" | "solid";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`${prog.spicchi} Spicchi, da dove arrivano`}
        data-testid="spicchi"
        className={clsx(
          "press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full pl-1.5 pr-3 text-[14px] font-bold",
          tone === "glass" ? "border border-white/20 bg-white/15 text-white backdrop-blur-md" : "sticker bg-surface text-text",
          className,
        )}
      >
        <SpicchioIcon size={22} />
        <span className="num text-[15px]">
          <CountUp value={prog.spicchi} />
        </span>
      </button>
      <SpicchiSheet open={open} onOpenChange={setOpen} prog={prog} />
    </>
  );
}

export function SpicchiSheet({
  open,
  onOpenChange,
  prog,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prog: PassProgress;
}) {
  const f = prog.spicchiFrom;
  const rows: [string, number][] = [
    [`Partite giocate (${SPICCHI_PER_MATCH} a partita)`, f.partite],
    ["Premi del pass", f.pass],
    ["Tiro del giorno e doppioni", f.bonus],
    [`Livelli oltre il 30 (${SPICCHI_PER_EXTRA_LEVEL} l'uno)`, f.extra],
  ];
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="I tuoi Spicchi" description="La moneta del campetto: si guadagna giocando e si spende alla bancarella">
      <div className="flex items-center justify-center gap-2 py-2">
        <SpicchioIcon size={40} />
        <span className="score text-[48px]">{prog.spicchi}</span>
      </div>
      <div className="card mt-3 divide-y divide-line">
        {rows.map(([l, v]) => (
          <div key={l} className="flex items-center justify-between gap-3 px-4 py-3 text-[14px]">
            <span className="text-muted">{l}</span>
            <span className="num text-[16px]">+{v}</span>
          </div>
        ))}
        {f.spent > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-[14px]">
            <span className="text-muted">Spesi alla bancarella</span>
            <span className="num text-[16px] text-danger">−{f.spent}</span>
          </div>
        )}
      </div>
      <p className="mt-4 px-1 text-[13px] font-semibold text-muted">Quanto costa un oggetto</p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {(Object.keys(PRICE) as Rarity[]).map((r) => (
          <div key={r} className={clsx("rounded-[16px] px-2 py-2.5 text-center text-white", `rar-${r}`)}>
            <p className="num text-[16px]">{PRICE[r]}</p>
            <p className="mt-0.5 text-[11px] font-semibold opacity-85">{RARITY_LABEL[r]}</p>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

export function RarityTag({ rarity, className }: { rarity: Rarity; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-white",
        `rar-${rarity}`,
        className,
      )}
    >
      {RARITY_LABEL[rarity]}
    </span>
  );
}

/** Da dove si inquadra un oggetto addosso al personaggio. */
export const FRAMING_OF: Record<Slot, Framing> = {
  skin: "full",
  testa: "testa",
  viso: "testa",
  gioielli: "collo",
  busto: "busto",
  braccio: "braccio",
  gambe: "gambe",
  piedi: "piedi",
  pallone: "pallone",
};

/** La foto di un oggetto, addosso al tuo personaggio. */
export function ItemPhoto({
  item,
  preset,
  size = 176,
  className,
  make,
  persist,
  fallback,
}: {
  item: Item;
  preset: Preset;
  size?: number;
  className?: string;
  make?: boolean;
  persist?: boolean;
  fallback?: React.ReactNode;
}) {
  const look = item.look;
  const p = look.kind === "skin" ? look.preset : preset;
  const outfit: Outfit = look.kind === "skin" ? {} : { [item.slot]: look };
  return (
    <Photo
      preset={p}
      outfit={outfit}
      framing={FRAMING_OF[item.slot]}
      size={size}
      className={className}
      alt={item.name}
      make={make}
      persist={persist}
      fallback={fallback}
    />
  );
}

/** Dove si prende un oggetto, in breve. */
export function sourceOf(item: Item): string {
  if (item.id === "skin-bomber") return "Si sblocca coi badge";
  const lv = PASS_LEVELS.find((l) => l.reward.kind === "item" && l.reward.id === item.id);
  if (lv) return item.esclusivo ? `Solo nel pass, livello ${lv.n}` : `Pass livello ${lv.n} o bancarella`;
  return "Bancarella o tiro del giorno";
}

export function BoostIcon({ size = 20, className }: { size?: number; className?: string }) {
  return <IconBolt size={size} className={className} fill="currentColor" strokeWidth={1.6} aria-hidden />;
}

export function rewardLabel(r: Reward, item?: Item) {
  if (r.kind === "spicchi") return `${r.amount} Spicchi`;
  if (r.kind === "boost") return "Boost";
  return item?.name ?? "Oggetto";
}

/** Coriandoli leggeri per i momenti belli. */
export function Confetti({ seed = 1 }: { seed?: number }) {
  const colors = ["#ffc531", "#f26a1b", "#fffaf0", "#3d8bff", "#2e9e5b", "#e5412d"];
  return (
    <span className="confetti pointer-events-none absolute inset-0" aria-hidden>
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2 + seed;
        const d = 90 + ((i * 37) % 60);
        return (
          <i
            key={i}
            style={
              {
                background: colors[i % colors.length],
                "--x": `${Math.cos(a) * d}px`,
                "--y": `${Math.sin(a) * d - 30}px`,
                "--r": `${(i % 2 ? 1 : -1) * (180 + i * 20)}deg`,
                animationDelay: `${(i % 4) * 30}ms`,
              } as CSSProperties
            }
          />
        );
      })}
    </span>
  );
}
