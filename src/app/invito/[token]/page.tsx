"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { GoogleButton } from "@/components/google-button";
import { Button, CourtArc, Spinner } from "@/components/ui/basics";
import { INVITE_KEY, useData } from "@/lib/data/provider";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { auth, backend, reinit } = useData();
  const router = useRouter();
  const claimed = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(INVITE_KEY, token);
    } catch {
      /* ignore */
    }
  }, [token]);

  // Già dentro: usa subito l'invito.
  useEffect(() => {
    if (claimed.current) return;
    if (auth.status === "pending" || auth.status === "ready") {
      claimed.current = true;
      void reinit().then(() => router.replace("/"));
    }
  }, [auth.status, reinit, router]);

  return (
    <main className="safe-top safe-bottom mx-auto flex h-dvh max-w-lg flex-col px-6">
      <div className="relative flex flex-1 flex-col justify-end pb-10">
        <CourtArc className="absolute left-1/2 top-[14%] w-[118%] -translate-x-1/2 text-court" />
        <div className="relative">
          <p className="text-[15px] font-semibold text-ball">Sei stato invitato</p>
          <h1 className="title mt-2 text-[44px] leading-[0.95]" style={{ fontStretch: "78%" }}>
            Entra nel Campetto
          </h1>
          <p className="mt-4 max-w-[30ch] text-[16px] text-muted">
            Accedi con Google: il tuo profilo è già pronto, con tutte le partite giocate finora.
          </p>
        </div>
      </div>
      <div className="pb-8">
        {auth.status === "error" ? (
          <div className="text-center">
            <p className="mb-4 text-[14px] text-danger">{auth.message}</p>
            <Button block onClick={() => router.replace("/")}>
              Vai all&apos;app
            </Button>
          </div>
        ) : auth.status === "signed-out" ? (
          <GoogleButton onClick={() => backend.signIn(`/invito/${token}`)} label="Accedi con Google" />
        ) : (
          <div className="flex justify-center">
            <Spinner />
          </div>
        )}
      </div>
    </main>
  );
}
