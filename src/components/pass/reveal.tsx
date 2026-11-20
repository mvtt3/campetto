"use client";

import clsx from "clsx";
import { IconX } from "@tabler/icons-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Statuina } from "@/components/c3d/viewer";
import type { Outfit, Preset } from "@/components/c3d/build";
import { Button, haptic } from "@/components/ui/basics";
import { play } from "@/lib/sound";
import type { Item } from "@/lib/pass/catalog";
import { Confetti, FRAMING_OF, RarityTag, SpicchioIcon } from "./ui";

/**
 * Il momento del premio: il tuo personaggio con l'oggetto addosso, che entra girando.
 * Prima inquadra la parte del corpo, poi si allarga su tutto il personaggio.
 */
export function RewardReveal({
  item,
  preset,
  outfit,
  number,
  kicker,
  refund,
  owned,
  onEquip,
  onClose,
  extra,
}: {
  item: Item;
  preset: Preset;
  outfit: Outfit;
  number?: string;
  /** La riga sopra al nome: "Livello 5", "Tiro del giorno"… */
  kicker: string;
  /** Era un doppione: tornano questi Spicchi. */
  refund?: number;
  owned?: boolean;
  onEquip?: () => void;
  onClose: () => void;
  extra?: ReactNode;
}) {
  const skin = item.look.kind === "skin" ? item.look.preset : null;
  const wear: Outfit = skin ? outfit : { ...outfit, [item.slot]: item.look };
  const [wide, setWide] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    play(item.rarity === "leggendario" || item.rarity === "epico" ? "unlock" : "success");
    haptic([12, 40, 18]);
  }, [item]);
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => setWide(true), 1400);
    return () => window.clearTimeout(t);
  }, [ready]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reveal-title"
      className="fade-in fixed inset-0 z-[80] flex items-center justify-center bg-[#1d1a16]/80 px-5"
      data-testid="reveal"
    >
      <div className={clsx("relative w-full max-w-sm overflow-hidden rounded-[32px] text-center text-white shadow-[var(--shadow-pop)]", `rar-${item.rarity}`)}>
        <span className="rays absolute left-1/2 top-[34%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2" aria-hidden />
        {item.natale && <span className="snow slow" aria-hidden />}
        <Confetti />
        <button
          onClick={onClose}
          aria-label="Chiudi"
          className="press absolute right-3.5 top-3.5 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/20 text-white backdrop-blur-md"
        >
          <IconX size={17} strokeWidth={2.4} />
        </button>
        <p className="relative mt-6 text-[13px] font-semibold uppercase tracking-[0.08em] text-white/85">{kicker}</p>
        <div className="relative mx-auto -mt-1 h-[min(300px,40dvh)] w-full">
          <Statuina
            preset={skin ?? preset}
            outfit={wear}
            number={number}
            framing={wide ? "full" : FRAMING_OF[item.slot]}
            onReady={() => setReady(true)}
          />
        </div>
        <div className="relative mt-1 px-6 pb-6">
          <RarityTag rarity={item.rarity} className="!bg-white/25 [background-image:none]" />
          <h2 id="reveal-title" className="display mt-2 text-[28px]">
            {item.name}
          </h2>
          <p className="mx-auto mt-1 max-w-[30ch] text-[14px] text-white/85">{item.blurb}</p>
          {refund ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[13.5px] font-semibold">
              Ce l&apos;avevi già: tornano <SpicchioIcon size={16} /> {refund}
            </p>
          ) : null}
          {extra}
          <div className="mt-5 flex gap-2">
            {onEquip && !refund ? (
              <>
                <Button variant="light" className="flex-1 text-text" onClick={onClose}>
                  Dopo
                </Button>
                <Button variant="primary" className="flex-[1.4]" onClick={onEquip} data-testid="reveal-equip">
                  {owned ? "Indossalo" : "Mettilo addosso"}
                </Button>
              </>
            ) : (
              <Button variant="light" block className="text-text" onClick={onClose}>
                Fatto
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
