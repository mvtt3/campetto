"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Rows3, Trophy, UserRound } from "lucide-react";
import { haptic } from "./ui/basics";

const ITEMS = [
  { href: "/", label: "Home", icon: House, match: (p: string) => p === "/" || p.startsWith("/organizza") },
  { href: "/classifiche", label: "Classifica", icon: Trophy, match: (p: string) => p.startsWith("/classifiche") || p.startsWith("/giocatore") },
  { href: "/partite", label: "Partite", icon: Rows3, match: (p: string) => p.startsWith("/partite") },
  {
    href: "/profilo",
    label: "Profilo",
    icon: UserRound,
    match: (p: string) => p.startsWith("/profilo") || p.startsWith("/admin") || p.startsWith("/nuova") || p.startsWith("/video") || p.startsWith("/importa"),
  },
];

/**
 * Barra in basso: quattro schede della stessa larghezza, icona e nome sempre visibili.
 * La scheda attiva cambia solo colore (niente animazioni di layout: più leggera sui telefoni economici).
 * Il cambio scheda aggiorna solo l'indirizzo: le schermate restano montate nel layout dell'app.
 */
export function BottomNav({ current, onTab }: { current?: string; onTab?: (href: string) => void }) {
  const routePath = usePathname();
  const path = current ?? routePath;
  const index = ITEMS.findIndex((it) => it.match(path));
  return (
    <nav aria-label="Navigazione principale" data-tour="nav" className="safe-bottom shrink-0 px-4 pb-3 pt-1">
      <ul className="sticker relative mx-auto grid h-[66px] max-w-md grid-cols-4 gap-1 rounded-[24px] bg-surface p-1.5">
        {/* La pillola blu scorre da una scheda all'altra (e segue il dito durante lo swipe). */}
        {index >= 0 && (
          <span
            aria-hidden
            data-nav-pill
            className="nav-pill pointer-events-none absolute bottom-1.5 left-1.5 top-1.5 rounded-[18px] border-2 border-edge bg-court"
            style={{ ["--i" as string]: index }}
          />
        )}
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(path);
          return (
            <li key={href} className="relative flex">
              <Link
                href={href}
                prefetch
                scroll={false}
                onClick={(e) => {
                  haptic(6);
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  // Le quattro schede sono già montate nel layout: basta cambiare l'indirizzo,
                  // senza far ripartire la navigazione di Next (più veloce sui telefoni lenti).
                  e.preventDefault();
                  if (path === href) return;
                  if (onTab) onTab(href);
                  else window.history.pushState(null, "", href);
                }}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex w-full flex-col items-center justify-center gap-0.5 rounded-[18px] text-[11.5px] font-bold transition-colors duration-300",
                  active ? "text-court-ink" : "text-muted",
                )}
              >
                <Icon size={21} strokeWidth={active ? 2.4 : 2} aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
