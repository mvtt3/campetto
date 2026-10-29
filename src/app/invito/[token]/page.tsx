"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { GoogleButton } from "@/components/google-button";
import { Button, Spinner } from "@/components/ui/basics";
import { Welcome } from "@/components/welcome";
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
    <Welcome kicker="Sei stato invitato" title="Entra in campo" text="Accedi con Google: il tuo profilo è già pronto, con tutte le partite giocate finora">
      {auth.status === "error" ? (
        <div className="text-center">
          <p className="mb-4 rounded-2xl border-2 border-[#1d1a16] bg-[#fffaf0] px-4 py-3 text-[14px]">{auth.message}</p>
          <Button block onClick={() => router.replace("/")}>
            Vai all&apos;app
          </Button>
        </div>
      ) : auth.status === "signed-out" ? (
        <GoogleButton onClick={() => backend.signIn(`/invito/${token}`)} label="Accedi con Google" />
      ) : (
        <div className="flex justify-center">
          <Spinner size={26} />
        </div>
      )}
    </Welcome>
  );
}
