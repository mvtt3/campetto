"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useData } from "@/lib/data/provider";
import {
  IconHome,
  IconLayoutRows,
  IconTrophy,
  IconUser,
} from "@tabler/icons-react";
import { haptic } from "./ui/basics";
import { NewDot } from "./new-dot";
import { useNewRewards } from "./rewards";

const ITEMS = [
  {
    href: "/",
    label: "Home",
    icon: IconHome,
    match: (p: string) => p === "/" || p.startsWith("/organizza"),
  },
  {
    href: "/classifiche",
    label: "Classifica",
    icon: IconTrophy,
    match: (p: string) =>
      p.startsWith("/classifiche") || p.startsWith("/giocatore"),
  },
  {
    href: "/partite",
    label: "Partite",
    icon: IconLayoutRows,
    match: (p: string) => p.startsWith("/partite"),
  },
  {
    href: "/profilo",
    label: "Profilo",
    icon: IconUser,
    match: (p: string) =>
      p.startsWith("/profilo") ||
      p.startsWith("/admin") ||
      p.startsWith("/nuova") ||
      p.startsWith("/video") ||
      p.startsWith("/importa"),
  },
];

/**
 * Barra in basso: quattro schede della stessa larghezza, icona e nome sempre visibili.
 * La scheda attiva cambia solo colore (niente animazioni di layout: più leggera sui telefoni economici).
 * Il cambio scheda aggiorna solo l'indirizzo: le schermate restano montate nel layout dell'app.
 */
export function BottomNav({
  current,
  onTab,
}: {
  current?: string;
  onTab?: (href: string) => void;
}) {
  const routePath = usePathname();
  const raw = current ?? routePath;
  // Le statistiche avanzate stanno sotto il Profilo se sono le tue, sotto la Classifica se sono di un altro.
  const { me } = useData();
  const [statsOf, setStatsOf] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatsOf(new URLSearchParams(window.location.search).get("id"));
  }, [raw]);
  const path = raw.startsWith("/statistiche")
    ? statsOf && statsOf !== me?.id
      ? "/giocatore"
      : "/profilo"
    : raw;
  const index = ITEMS.findIndex((it) => it.match(path));
  // Badge e personaggi nuovi da aprire: il pallino rosso sul Profilo.
  const news = useNewRewards().total;
  return (
    <nav
      aria-label="Navigazione principale"
      data-tour="nav"
      className="safe-bottom shrink-0 px-4 pb-3 pt-1"
    >
      <ul className="sticker relative mx-auto grid h-16 max-w-[340px] grid-cols-4 gap-1 rounded-full bg-surface p-1.5">
        {/* La pillola blu scorre da una scheda all'altra (e segue il dito durante lo swipe). */}
        {index >= 0 && (
          <span
            aria-hidden
            data-nav-pill
            className="nav-pill pointer-events-none absolute bottom-1.5 left-1.5 top-1.5 rounded-full bg-court"
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
                aria-label={
                  href === "/profilo" && news
                    ? `${label}, ${news === 1 ? "una novità" : `${news} novità`}`
                    : label
                }
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex w-full items-center justify-center rounded-full transition-colors duration-300",
                  active ? "text-court-ink" : "text-muted",
                )}
              >
                <span className="relative">
                  <Icon size={24} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                  {href === "/profilo" && (
                    <NewDot count={news} className="absolute -right-3 -top-2" />
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
