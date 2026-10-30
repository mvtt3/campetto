"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { playerHref } from "@/lib/types";

/** I vecchi indirizzi /giocatore/<id> portano alla pagina nuova, sempre pronta sul telefono. */
export default function OldPlayerPage() {
  const { id } = useParams<{ id: string }>();
  const preview = useSearchParams().get("anteprima") === "1";
  const router = useRouter();
  useEffect(
    () => router.replace(playerHref(id, preview)),
    [id, preview, router],
  );
  return null;
}
