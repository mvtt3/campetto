"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { WifiOff } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { BadgeCelebration } from "@/components/badge-celebration";
import { Button, CourtArc, Spinner } from "@/components/ui/basics";
import { useData } from "@/lib/data/provider";

function Splash() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-6">
      <CourtArc className="w-44 text-court" />
      <Spinner size={22} />
    </div>
  );
}

function Pending({ email }: { email: string | null }) {
  const { backend, reinit } = useData();
  const router = useRouter();
  return (
    <main className="safe-top flex h-dvh flex-col items-center justify-center px-8 text-center">
      <CourtArc className="mb-6 w-44 text-court" />
      <h1 className="title text-[26px]">In attesa di approvazione</h1>
      <p className="mt-3 max-w-[32ch] text-[15px] text-muted">
        Hai fatto l&apos;accesso{email ? ` come ${email}` : ""}, ma il tuo account non è ancora collegato a un giocatore.
        Chiedi a Matteo il tuo link d&apos;invito, oppure aspetta che ti approvi.
      </p>
      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <Button variant="primary" onClick={() => void reinit()}>
          Controlla di nuovo
        </Button>
        <Button variant="ghost" onClick={async () => { await backend.signOut(); await reinit(); router.replace("/login"); }}>
          Esci
        </Button>
      </div>
    </main>
  );
}

function ErrorScreen({ message }: { message: string }) {
  const { reinit, backend } = useData();
  const router = useRouter();
  return (
    <main className="safe-top flex h-dvh flex-col items-center justify-center px-8 text-center">
      <h1 className="title text-[24px]">Accesso non riuscito</h1>
      <p className="mt-3 max-w-[32ch] text-[15px] text-muted">{message}</p>
      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <Button variant="primary" onClick={() => void reinit()}>
          Riprova
        </Button>
        <Button variant="ghost" onClick={async () => { await backend.signOut(); await reinit(); router.replace("/login"); }}>
          Esci
        </Button>
      </div>
    </main>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { auth, online, me, backend } = useData();
  const router = useRouter();
  const path = usePathname();
  const flushed = useRef(false);

  useEffect(() => {
    if (auth.status === "signed-out") router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [auth.status, router, path]);

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

  if (auth.status === "loading" || auth.status === "signed-out") return <Splash />;
  if (auth.status === "pending") return <Pending email={auth.email} />;
  if (auth.status === "error") return <ErrorScreen message={auth.message} />;
  if (!me) return <Splash />;

  return (
    <div className="mx-auto flex h-dvh max-w-lg flex-col">
      {!online && (
        <div className="safe-top flex items-center justify-center gap-2 bg-raised px-4 py-1.5 text-[12px] text-muted">
          <WifiOff size={14} /> Sei offline: vedi gli ultimi dati salvati
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <BottomNav />
      <BadgeCelebration />
    </div>
  );
}
