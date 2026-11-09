"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GoogleButton } from "@/components/google-button";
import { Welcome } from "@/components/welcome";
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
    if (auth.status === "ready" || auth.status === "pending")
      router.replace(next);
  }, [auth.status, router, next]);

  return (
    <Welcome
      title="Campetto"
      text="Le nostre partite a Nichelino: risultati, statistiche, classifiche e chi viene a giocare"
    >
      <GoogleButton onClick={() => backend.signIn(next)} />
      <p className="mt-4 text-center text-[12.5px] text-[#3d342a]">
        Entrando accetti i{" "}
        <Link href="/termini" className="underline">
          termini
        </Link>{" "}
        e la{" "}
        <Link href="/privacy" className="underline">
          privacy
        </Link>
        .
      </p>
    </Welcome>
  );
}
