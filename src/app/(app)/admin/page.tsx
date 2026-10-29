"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClipboardPaste, Copy, Link2, Plus, Share2, UserCheck, UserX, Video } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button, EmptyState, ScreenHeader, Segmented, Toggle } from "@/components/ui/basics";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import type { PendingUser, PlayerPrivate } from "@/lib/data/backend";
import { useData } from "@/lib/data/provider";
import { playerName, type Player } from "@/lib/types";

const ROLES = ["Play", "Guardia", "Ala piccola", "Ala grande", "Centro"];

function PlayerSheet({
  player,
  priv,
  onClose,
  onChanged,
}: {
  player: Player | "new" | null;
  priv: PlayerPrivate | undefined;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { backend, me, refresh } = useData();
  const toast = useToast();
  const isNew = player === "new";
  const p = player && player !== "new" ? player : null;
  const [first, setFirst] = useState(p?.firstName ?? "");
  const [last, setLast] = useState(p?.lastName ?? "");
  const [roles, setRoles] = useState<string[]>(p?.roles ?? []);
  const [archived, setArchived] = useState(p?.archived ?? false);
  const [email, setEmail] = useState(priv?.linkEmail ?? "");
  const [busy, setBusy] = useState(false);
  const link = priv ? `${typeof window !== "undefined" ? window.location.origin : ""}/invito/${priv.inviteToken}` : "";

  const save = async () => {
    if (!first.trim()) return toast("Serve almeno il nome.", "error");
    setBusy(true);
    try {
      const id = await backend.upsertPlayer({ id: p?.id, firstName: first, lastName: last || null, roles, archived });
      if ((priv?.linkEmail ?? "") !== email.trim().toLowerCase()) await backend.setLinkEmail(id, email || null);
      await refresh();
      onChanged();
      toast(isNew ? "Giocatore aggiunto" : "Giocatore aggiornato");
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={Boolean(player)}
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? "Nuovo giocatore" : playerName(p)}
      description={p ? (p.userId ? "Account collegato" : "Non ha ancora fatto l'accesso") : "Poi mandagli il suo link d'invito"}
      footer={
        <Button variant="primary" block onClick={save} disabled={busy}>
          {isNew ? "Aggiungi giocatore" : "Salva"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            aria-label="Nome"
            placeholder="Nome"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            className="h-12 rounded-2xl bg-raised px-4 outline-none"
          />
          <input
            aria-label="Cognome"
            placeholder="Cognome (facoltativo)"
            value={last}
            onChange={(e) => setLast(e.target.value)}
            className="h-12 rounded-2xl bg-raised px-4 outline-none"
          />
        </div>
        <div>
          <p className="mb-2 text-[13px] font-semibold text-muted">Ruoli</p>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <button
                key={r}
                aria-pressed={roles.includes(r)}
                onClick={() => setRoles((xs) => (xs.includes(r) ? xs.filter((x) => x !== r) : [...xs, r]))}
                className={clsx("h-9 rounded-full px-3.5 text-[14px] font-semibold", roles.includes(r) ? "bg-court text-court-ink" : "bg-raised")}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="link-email" className="mb-2 block text-[13px] font-semibold text-muted">
            Email Google, per collegarlo da solo al primo accesso
          </label>
          <input
            id="link-email"
            type="email"
            inputMode="email"
            placeholder="facoltativa"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 w-full rounded-2xl bg-raised px-4 outline-none placeholder:text-faint"
          />
        </div>
        {priv && !p?.userId && (
          <div className="rounded-2xl bg-raised p-3.5">
            <p className="text-[13px] font-semibold text-muted">Link d&apos;invito personale</p>
            <p className="mt-1 break-all font-mono text-[12px]">{link}</p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={async () => {
                  await navigator.clipboard.writeText(link);
                  toast("Link copiato");
                }}
              >
                <Copy size={15} /> Copia
              </Button>
              {typeof navigator !== "undefined" && "share" in navigator && (
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => void navigator.share({ title: "Campetto", text: `Ciao ${p?.firstName}, entra nel Campetto:`, url: link }).catch(() => {})}
                >
                  <Share2 size={15} /> Condividi
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await backend.regenerateInvite(p!.id);
                  onChanged();
                  toast("Nuovo link creato: quello vecchio non vale più");
                }}
              >
                <Link2 size={15} /> Nuovo
              </Button>
            </div>
          </div>
        )}
        {p && (
          <div className="flex items-center justify-between rounded-2xl bg-raised px-3.5 py-3">
            <div>
              <p className="text-[15px] font-semibold">Archiviato</p>
              <p className="text-[12.5px] text-muted">Non compare più nelle squadre; le sue partite restano</p>
            </div>
            <Toggle label="Archiviato" checked={archived} onChange={setArchived} />
          </div>
        )}
        {p?.userId && p.id !== me?.id && (
          <Button
            variant="danger"
            onClick={async () => {
              try {
                await backend.unlinkPlayer(p.id);
                await refresh();
                onChanged();
                toast("Account scollegato");
                onClose();
              } catch (e) {
                toast((e as Error).message, "error");
              }
            }}
          >
            <UserX size={17} /> Scollega account Google
          </Button>
        )}
      </div>
    </Sheet>
  );
}

export default function AdminPage() {
  const { me, data, backend, refresh } = useData();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"giocatori" | "attesa">("giocatori");
  const [priv, setPriv] = useState<PlayerPrivate[]>([]);
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [open, setOpen] = useState<Player | "new" | null>(null);
  const [linking, setLinking] = useState<PendingUser | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([backend.listPrivate(), backend.listPending()]);
      setPriv(a);
      setPending(b);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }, [backend, toast]);

  useEffect(() => {
    if (me && !me.isAdmin) router.replace("/profilo");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else void load();
  }, [me, router, load]);

  if (!me?.isAdmin) return null;
  const unlinked = data.players.filter((p) => !p.userId && !p.archived);

  return (
    <>
      <ScreenHeader
        title="Gestione"
        back="/profilo/impostazioni"
        action={
          tab === "giocatori" ? (
            <button onClick={() => setOpen("new")} aria-label="Aggiungi giocatore" className="press flex h-11 items-center gap-1.5 rounded-full bg-surface px-4 text-[14px] font-semibold sticker-sm">
              <Plus size={18} strokeWidth={2.6} /> Giocatore
            </button>
          ) : undefined
        }
      />
      <div className="grid shrink-0 grid-cols-3 gap-2 px-5 pb-3">
        {[
          { href: "/nuova", label: "Aggiungi partita", icon: Plus, cls: "bg-ball text-ball-ink" },
          { href: "/importa", label: "Importa statistiche", icon: ClipboardPaste, cls: "bg-court text-court-ink" },
          { href: "/video", label: "Segna dal video", icon: Video, cls: "bg-text text-bg" },
        ].map(({ href, label, icon: Icon, cls }) => (
          <Link key={href} href={href} className={clsx("press flex h-[84px] flex-col justify-between rounded-3xl p-3 text-[13px] font-semibold leading-tight", cls)}>
            <Icon size={20} />
            {label}
          </Link>
        ))}
      </div>
      <div className="shrink-0 px-5 pb-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "giocatori", label: "Giocatori" },
            { value: "attesa", label: `In attesa${pending.length ? ` (${pending.length})` : ""}` },
          ]}
        />
      </div>
      <main className="scroll-area min-h-0 flex-1 px-5 pb-4">
        {tab === "giocatori" ? (
          <div className="flex flex-col gap-2">
            {data.players.map((p) => (
              <button
                key={p.id}
                onClick={() => setOpen(p)}
                className={clsx("card press flex items-center gap-3 px-3 py-2.5 text-left", p.archived && "opacity-50")}
              >
                <Avatar player={p} size={40} href={false} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">
                    {playerName(p)} {p.isAdmin && <span className="text-[12px] font-normal text-ball">admin</span>}
                  </p>
                  <p className="truncate text-[12.5px] text-muted">{p.roles.join(", ") || "Nessun ruolo"}</p>
                </div>
                <span className={clsx("shrink-0 text-[12px] font-semibold", p.userId ? "text-ok" : "text-muted")}>
                  {p.archived ? "Archiviato" : p.userId ? "Collegato" : "Da invitare"}
                </span>
              </button>
            ))}
          </div>
        ) : pending.length === 0 ? (
          <EmptyState title="Nessuno in attesa" text="Chi entra con Google senza invito compare qui: lo colleghi a un giocatore con un tocco." />
        ) : (
          <div className="flex flex-col gap-2">
            {pending.map((u) => (
              <div key={u.userId} className="card px-4 py-3">
                <p className="truncate text-[15px] font-semibold">{u.fullName ?? u.email}</p>
                <p className="truncate text-[12.5px] text-muted">{u.email}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="primary" className="flex-1" onClick={() => setLinking(u)}>
                    <UserCheck size={15} /> Collega a un giocatore
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={async () => {
                      await backend.resolvePending(u.userId, null);
                      await load();
                      toast("Richiesta rifiutata");
                    }}
                  >
                    Rifiuta
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      {open && (
        <PlayerSheet
          key={open === "new" ? "new" : open.id}
          player={open}
          priv={open !== "new" ? priv.find((x) => x.playerId === open.id) : undefined}
          onClose={() => setOpen(null)}
          onChanged={() => void load()}
        />
      )}
      <Sheet open={Boolean(linking)} onOpenChange={(o) => !o && setLinking(null)} title="Chi è?" description={linking?.email ?? undefined}>
        <div className="flex flex-col gap-2 pb-2">
          {unlinked.length === 0 && <p className="text-[14px] text-muted">Tutti i giocatori hanno già un account. Aggiungi prima un nuovo giocatore.</p>}
          {unlinked.map((p) => (
            <button
              key={p.id}
              onClick={async () => {
                try {
                  await backend.resolvePending(linking!.userId, p.id);
                  await Promise.all([load(), refresh()]);
                  toast(`${p.firstName} è dentro`);
                  setLinking(null);
                } catch (e) {
                  toast((e as Error).message, "error");
                }
              }}
              className="flex items-center gap-3 rounded-2xl bg-raised px-3 py-2.5 text-left"
            >
              <Avatar player={p} size={36} href={false} />
              <span className="text-[15px] font-semibold">{playerName(p)}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
