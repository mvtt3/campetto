"use client";

/** Modello del telefono, misure dello schermo e tema: quanto basta per capire dove succede un problema. */
export function deviceInfo(): string {
  const ua = navigator.userAgent;
  const model =
    ua
      .match(/\(([^)]+)\)/)?.[1]
      ?.split(";")
      .slice(0, 3)
      .join(";") ?? "";
  const browser =
    ua.match(/(SamsungBrowser|Firefox|EdgA|OPR|Chrome|Version)\/[\d]+/)?.[0] ??
    "";
  return `${model} · ${browser} · ${window.innerWidth}×${window.innerHeight} · ${document.documentElement.dataset.theme ?? ""}`.slice(
    0,
    200,
  );
}
