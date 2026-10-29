"use client";

import clsx from "clsx";
import { Check, ImagePlus, Lock } from "lucide-react";
import { useRef } from "react";
import { AVATAR_PRESETS, PresetAvatar, presetOf, presetUrl, RARITY, rarityProgress, type Rarity } from "@/components/avatar-presets";
import { haptic, Spinner } from "@/components/ui/basics";

/**
 * Scelta della foto profilo: le figurine dell'app (alcune si sbloccano con i badge)
 * oppure una foto dalla galleria.
 * `value` è l'avatarUrl attuale ("preset:…", un indirizzo o null).
 */
export function AvatarPicker({
  value,
  onPreset,
  onFile,
  uploading = false,
  initialsLabel,
  onInitials,
  tiers,
  onLocked,
}: {
  value: string | null;
  onPreset: (url: string) => void;
  onFile: (f: File) => void;
  uploading?: boolean;
  /** Se presente, mostra anche "solo iniziali". */
  initialsLabel?: string;
  onInitials?: () => void;
  /** Livelli dei badge del giocatore: se presenti, mostra anche le figurine da sbloccare. */
  tiers?: number[];
  onLocked?: (message: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const current = presetOf(value);
  const isPhoto = !!value && !current;
  const groups = (["base", "rara", "epica", "leggendaria"] as Rarity[]).filter((r) => r === "base" || tiers);
  return (
    <div>
      {groups.map((rarity) => {
        const prog = rarityProgress(rarity, tiers ?? []);
        const items = AVATAR_PRESETS.filter((p) => p.rarity === rarity);
        return (
          <section key={rarity} className={clsx(rarity !== "base" && "mt-5")}>
            {tiers && (
              <h3 className="mb-2.5 flex items-center justify-center gap-2 text-center text-[13px] font-bold">
                <span className="h-3 w-3 rounded-full border-2 border-edge" style={{ background: RARITY[rarity].ring }} aria-hidden />
                {RARITY[rarity].label}
                {rarity !== "base" && (
                  <span className={clsx("font-semibold", prog.unlocked ? "text-ok" : "text-muted")}>
                    {prog.unlocked ? "· sbloccate" : `· ${RARITY[rarity].rule} (${prog.have}/${prog.need})`}
                  </span>
                )}
              </h3>
            )}
            <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label={`Figurine ${RARITY[rarity].label.toLowerCase()}`}>
              {items.map((p) => {
                const on = current === p.id;
                const locked = !prog.unlocked && rarity !== "base";
                return (
                  <button
                    key={p.id}
                    role="radio"
                    aria-checked={on}
                    aria-disabled={locked}
                    aria-label={locked ? `Figurina ${p.name}, bloccata` : `Figurina ${p.name}`}
                    onClick={() => {
                      haptic(6);
                      if (locked) {
                        const left = prog.need - prog.have;
                        onLocked?.(`${p.name} la sblocchi con ${RARITY[rarity].rule}: te ne ${left === 1 ? "manca 1" : `mancano ${left}`}`);
                        return;
                      }
                      onPreset(presetUrl(p.id));
                    }}
                    className="press flex flex-col items-center gap-1.5"
                  >
                    <span
                      className={clsx(
                        "relative block aspect-square w-full max-w-[96px] overflow-hidden rounded-full border-[2.5px] border-edge transition-transform duration-150",
                        on ? "sticker scale-[1.04]" : "sticker-sm",
                      )}
                    >
                      <span className={clsx("block h-full w-full", locked && "opacity-35 grayscale")}>
                        <PresetAvatar id={p.id} />
                      </span>
                      {locked && (
                        <span className="absolute inset-0 grid place-items-center">
                          <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-edge bg-surface">
                            <Lock size={16} aria-hidden />
                          </span>
                        </span>
                      )}
                    </span>
                    <span className={clsx("flex items-center gap-1 text-[12.5px] font-bold", on ? "text-text" : "text-muted")}>
                      {on && <Check size={13} strokeWidth={3} className="text-ok" />}
                      {p.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-pressed={isPhoto}
          className={clsx(
            "press flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-4 text-[14.5px] font-bold",
            isPhoto ? "sticker bg-volt text-volt-ink" : "sticker-sm bg-surface",
          )}
        >
          {uploading ? <Spinner size={12} /> : <ImagePlus size={18} />}
          {isPhoto ? "Foto tua (cambia)" : "Dalla galleria"}
        </button>
        {onInitials && (
          <button
            onClick={() => {
              haptic(6);
              onInitials();
            }}
            aria-pressed={!value}
            className={clsx(
              "press h-12 shrink-0 rounded-full px-4 text-[14.5px] font-bold",
              !value ? "sticker bg-volt text-volt-ink" : "sticker-sm bg-surface",
            )}
          >
            {initialsLabel ?? "Iniziali"}
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="avatar-file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
    </div>
  );
}
