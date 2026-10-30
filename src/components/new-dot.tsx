"use client";

import clsx from "clsx";

/** Il pallino rosso delle novità (come nei giochi): con il numero, o solo il punto. */
export function NewDot({
  count,
  className,
}: {
  count?: number;
  className?: string;
}) {
  if (count !== undefined && count <= 0) return null;
  return (
    <span
      aria-hidden
      className={clsx(
        "new-dot pointer-events-none grid place-items-center rounded-full border-2 border-[#1d1a16] bg-danger font-bold leading-none text-white",
        count === undefined
          ? "h-3.5 w-3.5"
          : "h-[19px] min-w-[19px] px-1 text-[11px] tnum",
        className,
      )}
    >
      {count !== undefined && (count > 9 ? "9+" : count)}
    </span>
  );
}

/** L'etichetta "Nuovo" sulle tessere da aprire. */
export function NewTag({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "new-tag pointer-events-none absolute z-10 rounded-full border-2 border-[#1d1a16] bg-danger px-1.5 py-[1px] text-[10px] font-extrabold uppercase tracking-wide text-white",
        className,
      )}
    >
      Nuovo
    </span>
  );
}
