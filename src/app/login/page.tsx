"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GoogleButton } from "@/components/google-button";
import { CourtArc } from "@/components/ui/basics";
import { useData } from "@/lib/data/provider";

export default function LoginPage() {
  const { auth, backend } = useData();
  const router = useRouter();
  const [next, setNext] = useState("/");

  useEffect(() => {
    const n = new URLSearchParams(window.location.search).get("next");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (n && n.startsWith("/") && !n.startsWith("//")) setNext(n);
  }, []);

  useEffect(() => {
    if (auth.status === "ready" || auth.status === "pending") router.replace(next);
  }, [auth.status, router, next]);

  return (
    <main className="safe-top safe-bottom mx-auto flex h-dvh max-w-lg flex-col px-6">
      <div className="relative flex flex-1 flex-col justify-end pb-10">
        <CourtArc className="absolute left-1/2 top-[14%] w-[118%] -translate-x-1/2 text-court" />
        <div className="relative">
          <h1 className="title text-[56px] leading-[0.9]" style={{ fontStretch: "75%" }}>
            Campetto
          </h1>
          <p className="mt-4 max-w-[28ch] text-[17px] text-muted">
            Le nostre partite al campetto di Nichelino: risultati, statistiche, classifiche e chi viene a giocare.
          </p>
        </div>
      </div>
      <div className="pb-8">
        <GoogleButton onClick={() => backend.signIn(next)} />
        <p className="mt-5 text-center text-[12px] text-faint">
          Entrando accetti i <Link href="/termini" className="underline">termini</Link> e l&apos;
          <Link href="/privacy" className="underline">informativa privacy</Link>.
        </p>
      </div>
    </main>
  );
}
