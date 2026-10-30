"use client";

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

interface Nav {
  push: (href: string) => void;
}

const NavContext = createContext<Nav | null>(null);

/**
 * Per andare a un'altra pagina senza ridisegnare la schermata a ogni cambio di
 * indirizzo (useRouter lo fa): le schede principali restano ferme quando ti sposti.
 */
export function NavProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const ref = useRef(router);
  useEffect(() => {
    ref.current = router;
  }, [router]);
  const value = useMemo<Nav>(() => ({ push: (href) => ref.current.push(href) }), []);
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error("useNav fuori da NavProvider");
  return nav;
}
