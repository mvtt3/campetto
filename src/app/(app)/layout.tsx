"use client";

import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { flushSync } from "react-dom";
import { WifiOff } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { BadgeCelebration } from "@/components/badge-celebration";
import { Mascot } from "@/components/mascot";
import { Onboarding } from "@/components/onboarding";
import { HomeScreen } from "@/components/screens/home-screen";
import { MatchesScreen } from "@/components/screens/matches-screen";
import { ProfileScreen } from "@/components/screens/profile-screen";
import { RankingScreen } from "@/components/screens/ranking-screen";
import { useTabSwipe } from "@/components/tab-swipe";
import { TutorialProvider } from "@/components/tutorial/tutorial";
import { Button, Spinner } from "@/components/ui/basics";
import { useData } from "@/lib/data/provider";

/** Pagine riservate all'amministratore: inserire, importare, segnare dal video, gestire il gruppo. */
const ADMIN_ONLY = ["/admin", "/nuova", "/importa", "/video"];

/**
 * Le quattro schede principali restano montate e si nascondono soltanto:
 * passare da una all'altra non ricostruisce niente, quindi è immediato anche
 * sui telefoni economici. Quelle non ancora aperte si preparano quando il
 * telefono è libero.
 */
// memo: cambiare scheda non deve ridisegnare anche le schermate nascoste.
const TABS: { path: string; Screen: ComponentType }[] = [
  { path: "/", Screen: memo(HomeScreen) },
  { path: "/classifiche", Screen: memo(RankingScreen) },
  { path: "/partite", Screen: memo(MatchesScreen) },
  { path: "/profilo", Screen: memo(ProfileScreen) },
];
const TAB_PATHS = TABS.map((t) => t.path);

function useKeptTabs(active: string | null, ready: boolean) {
  const [mounted, setMounted] = useState<string[]>(() =>
    active ? [active] : [],
  );
  if (active && !mounted.includes(active)) setMounted((m) => [...m, active]);
  useEffect(() => {
    if (!ready) return;
    const todo = TABS.map((t) => t.path).filter((p) => !mounted.includes(p));
    if (!todo.length) return;
    const idle =
      window.requestIdleCallback ??
      ((cb: () => void) => window.setTimeout(cb, 300));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = idle(
      () =>
        startTransition(() =>
          setMounted((m) => (m.includes(todo[0]) ? m : [...m, todo[0]])),
        ),
      { timeout: 2500 },
    );
    return () => cancel(id);
  }, [ready, mounted]);
  const ensure = useCallback((paths: string[]) => {
    setMounted((m) =>
      paths.every((p) => m.includes(p))
        ? m
        : [...m, ...paths.filter((p) => !m.includes(p))],
    );
  }, []);
  return [mounted, ensure] as const;
}

function Splash() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4">
      <Spinner size={30} />
    </div>
  );
}

function Message({
  title,
  text,
  children,
}: {
  title: string;
  text: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="safe-top mx-auto flex h-dvh max-w-sm flex-col items-center justify-center px-8 text-center">
      <Mascot pose="boh" size={120} />
      <h1 className="display mt-4 text-[26px]">{title}</h1>
      <p className="mt-3 text-[15px] text-muted">{text}</p>
      <div className="mt-8 flex w-full flex-col gap-2">{children}</div>
    </main>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { auth, online, me, backend, reinit } = useData();
  const router = useRouter();
  const path = usePathname();
  const flushed = useRef(false);
  const adminOnly = ADMIN_ONLY.some((p) => path.startsWith(p));
  // Il cambio scheda si vede subito: non aspetta che il router aggiorni l'indirizzo.
  const [pending, setPending] = useState<{ from: string; to: string } | null>(null);
  const activeTab = pending && pending.from === path ? pending.to : TABS.some((t) => t.path === path) ? path : null;
  const pathRef = useRef(path);
  useEffect(() => {
    pathRef.current = path;
    // Arrivato il nuovo indirizzo, la scheda "in anticipo" non serve più
    // (altrimenti il tasto indietro riporterebbe la scheda sbagliata).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPending((p) => (p && p.from !== path ? null : p));
  }, [path]);
  const appReady =
    auth.status === "ready" && !!me?.nickname && !(adminOnly && !me.isAdmin);
  const [kept, ensureTabs] = useKeptTabs(activeTab, appReady);
  const pager = useRef<HTMLDivElement>(null);
  const goTab = useCallback((p: string) => {
    if (p === pathRef.current) return;
    flushSync(() => setPending({ from: pathRef.current, to: p }));
    window.history.pushState(null, "", p);
  }, []);
  useTabSwipe({
    pager,
    paths: TAB_PATHS,
    active: appReady ? activeTab : null,
    onCommit: goTab,
    onPrepare: ensureTabs,
  });

  useEffect(() => {
    if (auth.status === "signed-out")
      router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [auth.status, router, path]);

  useEffect(() => {
    if (me && !me.isAdmin && adminOnly) router.replace("/");
  }, [me, adminOnly, router]);

  // Prepara subito le altre schede, così aprirle è immediato anche sui telefoni lenti.
  useEffect(() => {
    if (auth.status !== "ready") return;
    const pages = [
      "/",
      "/classifiche",
      "/partite",
      "/profilo",
      "/organizza",
      "/classifiche/albo",
      "/profilo/badge",
      "/profilo/impostazioni",
      "/profilo/notifiche",
    ];
    const t = setTimeout(() => pages.forEach((p) => router.prefetch(p)), 600);
    return () => clearTimeout(t);
  }, [auth.status, router]);

  // Al primo avvio invia eventuali riepiloghi delle proposte rimasti in coda.
  useEffect(() => {
    if (auth.status !== "ready" || flushed.current) return;
    flushed.current = true;
    const last = Number(localStorage.getItem("campetto:last-flush") ?? 0);
    if (Date.now() - last > 10 * 60_000) {
      localStorage.setItem("campetto:last-flush", String(Date.now()));
      void backend.notify({ type: "flush" });
    }
  }, [auth.status, backend]);

  const signOut = async () => {
    await backend.signOut();
    await reinit();
    router.replace("/login");
  };

  if (auth.status === "loading" || auth.status === "signed-out")
    return <Splash />;
  if (auth.status === "pending")
    return (
      <Message
        title="Quasi dentro"
        text={
          <>
            Ti ho riconosciuto{auth.email ? ` come ${auth.email}` : ""}, ma non so ancora chi sei in campo. Chiedi a Matteo il tuo link
            d&apos;invito e aprilo da qui
          </>
        }
      >
        <Button variant="court" onClick={() => void reinit()}>
          Controlla di nuovo
        </Button>
        <Button variant="ghost" onClick={signOut}>
          Esci
        </Button>
      </Message>
    );
  if (auth.status === "error")
    return (
      <Message title="Non sono riuscito a farti entrare" text={auth.message}>
        <Button variant="court" onClick={() => void reinit()}>
          Riprova
        </Button>
        <Button variant="ghost" onClick={signOut}>
          Esci
        </Button>
      </Message>
    );
  if (!me || (adminOnly && !me.isAdmin)) return <Splash />;
  if (!me.nickname) return <Onboarding me={me} />;

  return (
    <TutorialProvider me={me}>
      <div className="mx-auto flex h-dvh max-w-lg flex-col">
        {!online && (
          <div className="safe-top flex items-center justify-center gap-2 bg-ball px-4 py-1.5 text-[12.5px] font-semibold text-ball-ink">
            <WifiOff size={14} /> Sei offline: ti mostro gli ultimi dati che ho salvato
          </div>
        )}
        <div
          ref={pager}
          className={
            activeTab
              ? "relative flex min-h-0 flex-1 flex-col overflow-hidden"
              : "hidden"
          }
        >
          {TABS.filter((t) => kept.includes(t.path)).map(
            ({ path: p, Screen }) => (
              <div
                key={p}
                data-tab={p}
                className={
                  activeTab === p ? "flex min-h-0 flex-1 flex-col" : "hidden"
                }
              >
                <Screen />
              </div>
            ),
          )}
        </div>
        {!activeTab && (
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        )}
        <BottomNav current={activeTab ?? path} onTab={goTab} />
        <BadgeCelebration />
      </div>
    </TutorialProvider>
  );
}
