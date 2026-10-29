"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Trophy, Rows3, UserRound } from "lucide-react";
import { motion } from "motion/react";
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

/** Barra flottante: la scheda attiva si allarga e mostra il nome. */
export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Navigazione principale" className="safe-bottom pointer-events-none shrink-0 px-4 pb-3 pt-1">
      <ul className="sticker pointer-events-auto mx-auto flex h-[64px] max-w-md items-center gap-1 rounded-full bg-surface p-1.5">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(path);
          return (
            <li key={href} className={clsx("flex h-full transition-[flex-grow] duration-300", active ? "grow-[1.8]" : "grow")}>
              <Link
                href={href}
                onClick={() => haptic(6)}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "relative flex w-full items-center justify-center gap-2 rounded-full text-[14px] font-semibold",
                  active ? "text-court-ink" : "text-muted",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full border-2 border-edge bg-court"
                    transition={{ type: "spring", stiffness: 480, damping: 36 }}
                  />
                )}
                <Icon size={22} strokeWidth={active ? 2.4 : 2} className="relative" />
                {active && (
                  <motion.span
                    className="relative"
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 }}
                  >
                    {label}
                  </motion.span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
