"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/** I vecchi indirizzi /giocatore/<id>/badge portano alla pagina nuova. */
export default function OldPlayerBadgesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(
    () => router.replace(`/giocatore/badge?id=${encodeURIComponent(id)}`),
    [id, router],
  );
  return null;
}
