"use client";

import clsx from "clsx";
import { Check, ImagePlus } from "lucide-react";
import { useRef } from "react";
import {
  AVATAR_PRESETS,
  PresetAvatar,
  presetOf,
  presetUrl,
} from "@/components/avatar-presets";
import { haptic, Spinner } from "@/components/ui/basics";

/**
 * Scelta della foto profilo: le sei figurine dell'app oppure una foto dalla galleria
 * (i personaggi da sbloccare sono a parte, a figura intera).
 * `value` è l'avatarUrl attuale ("preset:…", un indirizzo o null).
 */
export function AvatarPicker({
  value,
  onPreset,
  onFile,
  uploading = false,
  initialsLabel,
  onInitials,
}: {
  value: string | null;
  onPreset: (url: string) => void;
  onFile: (f: File) => void;
  uploading?: boolean;
  /** Se presente, mostra anche "solo iniziali". */
  initialsLabel?: string;
  onInitials?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const current = presetOf(value);
  const isPhoto = !!value && !current;
  const items = AVATAR_PRESETS.filter((p) => p.rarity === "base");
  return (
    <div>
      <div
        className="grid grid-cols-3 gap-3"
        role="radiogroup"
        aria-label="Figurine"
      >
        {items.map((p) => {
          const on = current === p.id;
          return (
            <button
              key={p.id}
              role="radio"
              aria-checked={on}
              aria-label={`Figurina ${p.name}`}
              onClick={() => {
                haptic(6);
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
                <span className="block h-full w-full">
                  <PresetAvatar id={p.id} />
                </span>
              </span>
              <span
                className={clsx(
                  "flex items-center gap-1 text-[12.5px] font-bold",
                  on ? "text-text" : "text-muted",
                )}
              >
                {on && <Check size={13} strokeWidth={3} className="text-ok" />}
                {p.name}
              </span>
            </button>
          );
        })}
      </div>
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
              !value
                ? "sticker bg-volt text-volt-ink"
                : "sticker-sm bg-surface",
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
