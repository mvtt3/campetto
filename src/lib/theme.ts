"use client";

export type ThemePref = "system" | "dark" | "light";
const KEY = "campetto:theme";

export function getThemePref(): ThemePref {
  try {
    return (localStorage.getItem(KEY) as ThemePref) || "light";
  } catch {
    return "light";
  }
}

export function applyTheme(pref: ThemePref) {
  const dark =
    pref === "dark" ||
    (pref === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const meta = document.querySelectorAll('meta[name="theme-color"]');
  meta.forEach((m) => m.setAttribute("content", dark ? "#17130f" : "#f2e8d5"));
}

export function setThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* ignore */
  }
  applyTheme(pref);
}

/**
 * Cambia tema con l'onda: il nuovo si allarga a cerchio dal punto toccato.
 * Se il colore non cambia davvero, o il telefono non lo supporta, cambia e basta.
 */
export function switchThemeWithWave(
  pref: ThemePref,
  at?: { x: number; y: number },
) {
  const willDark =
    pref === "dark" ||
    (pref === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const isDark = document.documentElement.dataset.theme === "dark";
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { ready: Promise<void> };
  };
  if (
    !at ||
    willDark === isDark ||
    typeof doc.startViewTransition !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return setThemePref(pref);
  const r = Math.hypot(
    Math.max(at.x, window.innerWidth - at.x),
    Math.max(at.y, window.innerHeight - at.y),
  );
  const vt = doc.startViewTransition(() => setThemePref(pref));
  vt.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${at.x}px ${at.y}px)`,
            `circle(${r}px at ${at.x}px ${at.y}px)`,
          ],
        },
        {
          duration: 520,
          easing: "cubic-bezier(0.23, 1, 0.32, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => undefined);
}

/** Resize and convert a picked photo to a square WebP (max 512px) before upload. */
export async function compressAvatar(file: File, size = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  const out = Math.min(size, side);
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    out,
    out,
  );
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Immagine non valida"))),
      "image/webp",
      0.86,
    ),
  );
}
