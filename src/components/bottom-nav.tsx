"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, ListOrdered, Plus, Rows3, UserRound } from "lucide-react";
import { haptic } from "./ui/basics";

const ITEMS = [
  { href: "/", label: "Home", icon: House, match: (p: string) => p === "/" || p.startsWith("/organizza") },
  { href: "/classifiche", label: "Classifiche", icon: ListOrdered, match: (p: string) => p.startsWith("/classifiche") },
  { href: "/nuova", label: "Nuova partita", icon: Plus, primary: true, match: (p: string) => p.startsWith("/nuova") },
  {
    href: "/partite",
    label: "Partite",
    icon: Rows3,
    match: (p: string) => p.startsWith("/partite") || p.startsWith("/video") || p.startsWith("/importa"),
  },
  {
    href: "/profilo",
    label: "Profilo",
    icon: UserRound,
    match: (p: string) => p.startsWith("/profilo") || p.startsWith("/giocatore") || p.startsWith("/admin"),
  },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Navigazione principale" className="safe-bottom shrink-0 border-t border-line bg-surface/95 backdrop-blur">
      <ul className="mx-auto flex h-16 max-w-lg items-stretch justify-around px-1">
        {ITEMS.map(({ href, label, icon: Icon, primary, match }) => {
          const active = match(path);
          return (
            <li key={href} className="flex flex-1 justify-center">
              <Link
                href={href}
                onClick={() => haptic(6)}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold",
                  active ? "text-text" : "text-faint",
                )}
              >
                {primary ? (
                  <span className="grid h-12 w-12 place-items-center rounded-[16px] bg-ball text-ball-ink shadow-[0_6px_18px_-6px_var(--ball)] active:scale-95">
                    <Icon size={26} strokeWidth={2.6} />
                  </span>
                ) : (
                  <>
                    <Icon size={23} strokeWidth={active ? 2.4 : 1.9} />
                    <span>{label}</span>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
