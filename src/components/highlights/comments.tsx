"use client";

import clsx from "clsx";
import {
  IconArrowUp,
  IconCornerUpLeft,
  IconRotate,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { haptic } from "@/components/ui/basics";
import { Mascot } from "@/components/mascot";
import { cleanComment, timeAgo } from "@/lib/highlights";
import { useNow } from "@/lib/use-now";
import {
  COMMENT_MAX,
  shortName,
  type HighlightComment,
  type Player,
} from "@/lib/types";

export interface ShownComment extends HighlightComment {
  /** In viaggio verso il database, o rimasto a metà strada. */
  state?: "sending" | "failed";
}

/**
 * I commenti di un video: un pannello che sale dal basso dentro il feed (il video
 * continua sopra). Si chiude con la X, toccando sopra, trascinando giù o col tasto indietro.
 * Con la tastiera aperta il pannello sale con lei: la casella resta sempre in vista.
 */
export function CommentsPanel({
  open,
  comments,
  loading,
  error,
  players,
  me,
  onClose,
  onSend,
  onRetry,
  onDelete,
  onReload,
}: {
  open: boolean;
  comments: ShownComment[];
  loading: boolean;
  error: boolean;
  players: Player[];
  me: Player;
  onClose: () => void;
  onSend: (body: string, replyTo: string | null) => void;
  onRetry: (c: ShownComment) => void;
  onDelete: (c: ShownComment) => void;
  onReload: () => void;
}) {
  const now = useNow(60_000);
  const [text, setText] = useState("");
  const [kb, setKb] = useState(0);
  const [vh, setVh] = useState<number | null>(null);
  const [drag, setDrag] = useState(0);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // A chi sto rispondendo (come su WhatsApp): la citazione sopra la casella.
  const [replyTo, setReplyTo] = useState<ShownComment | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const count = comments.length;
  const prevCount = useRef(count);

  // La tastiera: quanto copre lo schermo (visualViewport), per alzare il pannello.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !open) return;
    const on = () => {
      const covered = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop,
      );
      setKb(covered > 60 ? covered : 0);
      setVh(vv.height);
    };
    on();
    vv.addEventListener("resize", on);
    vv.addEventListener("scroll", on);
    return () => {
      vv.removeEventListener("resize", on);
      vv.removeEventListener("scroll", on);
    };
  }, [open]);

  // Un commento nuovo (mio o di un amico): si scende in fondo per vederlo.
  useLayoutEffect(() => {
    if (count > prevCount.current && list.current)
      list.current.scrollTop = list.current.scrollHeight;
    prevCount.current = count;
  }, [count]);

  // Riaperto: si parte dal fondo, dove ci sono i più recenti.
  useLayoutEffect(() => {
    if (open && list.current)
      list.current.scrollTop = list.current.scrollHeight;
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfirmId(null);
      setDrag(0);
      setReplyTo(null);
    }
  }, [open]);

  // La casella cresce con il testo, fino a 4 righe.
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 104)}px`;
  }, [text]);

  // "Sicuro?" sparisce da solo dopo un po'.
  useEffect(() => {
    if (!confirmId) return;
    const t = window.setTimeout(() => setConfirmId(null), 3500);
    return () => window.clearTimeout(t);
  }, [confirmId]);

  const send = () => {
    const body = cleanComment(text);
    if (!body) return;
    onSend(body, replyTo && !replyTo.id.startsWith("tmp-") ? replyTo.id : null);
    setText("");
    setReplyTo(null);
    input.current?.focus();
  };

  const startReply = (c: ShownComment) => {
    haptic(10);
    setReplyTo(c);
    input.current?.focus({ preventScroll: true });
  };

  // Tocco sulla citazione: si torna al commento originale, che si illumina un attimo.
  const goTo = (id: string) => {
    const el = list.current?.querySelector<HTMLElement>(`[data-cid="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlash(id);
    window.setTimeout(() => setFlash((f) => (f === id ? null : f)), 1200);
  };

  // Se il commento a cui rispondevo sparisce (eliminato), la citazione se ne va.
  const replyGone = replyTo && !comments.some((c) => c.id === replyTo.id);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (replyGone) setReplyTo(null);
  }, [replyGone]);

  // Trascinare giù la maniglia chiude.
  const start = useRef<number | null>(null);
  const onDown = (e: React.PointerEvent) => {
    start.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (start.current === null) return;
    setDrag(Math.max(0, e.clientY - start.current));
  };
  const onUp = () => {
    if (start.current === null) return;
    start.current = null;
    if (drag > 90) onClose();
    else setDrag(0);
  };

  const left = COMMENT_MAX - text.length;
  const height = vh ? Math.min(vh * (kb ? 0.92 : 0.68), vh - 40) : undefined;

  return (
    <div
      className={clsx(
        "hl-comments-layer absolute inset-0 z-30",
        !open && "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      <button
        className={clsx(
          "absolute inset-0 h-full w-full cursor-default bg-black/35 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
        tabIndex={-1}
        aria-label="Chiudi i commenti"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Commenti"
        className={clsx(
          "hl-comments absolute inset-x-0 mx-auto flex max-w-lg flex-col rounded-t-[28px] bg-bg text-text shadow-[0_-12px_40px_-12px_rgb(0_0_0/0.5)]",
          drag === 0 && "transition-transform duration-[260ms] ease-out",
        )}
        style={{
          bottom: kb,
          height: height ?? "68dvh",
          transform: open ? `translateY(${drag}px)` : "translateY(105%)",
        }}
        data-testid="hl-comments-panel"
      >
        <div
          className="relative shrink-0 touch-none select-none px-4 pb-3 pt-2.5"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" />
          <h3 className="title flex items-center gap-2 pr-10 text-[18px]">
            Commenti
            {count > 0 && (
              <span className="tnum rounded-full bg-raised px-2 py-0.5 text-[12px] font-semibold text-muted">
                {count}
              </span>
            )}
          </h3>
          <button
            onClick={onClose}
            aria-label="Chiudi"
            className="press absolute right-4 top-5 grid h-9 w-9 place-items-center rounded-full bg-surface text-muted shadow-[var(--shadow)]"
            data-testid="hl-comments-close"
          >
            <IconX size={18} strokeWidth={2.4} />
          </button>
        </div>

        <div
          ref={list}
          className="scroll-area min-h-0 flex-1 overscroll-contain px-4"
          data-testid="hl-comments-list"
        >
          {loading && count === 0 ? (
            <div className="flex flex-col gap-3 py-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-2.5">
                  <div className="skeleton h-9 w-9 shrink-0 rounded-full" />
                  <div className="skeleton h-12 flex-1 rounded-[14px]" />
                </div>
              ))}
            </div>
          ) : error && count === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Mascot pose="boh" size={70} animate={false} />
              <p className="text-[14px] text-muted">
                Non riesco a caricare i commenti
              </p>
              <button
                onClick={onReload}
                className="press flex h-10 items-center gap-1.5 rounded-full bg-surface px-4 text-[14px] font-semibold shadow-[var(--shadow)]"
              >
                <IconRotate size={15} aria-hidden /> Riprova
              </button>
            </div>
          ) : count === 0 ? (
            <div className="flex flex-col items-center gap-1 py-6 text-center">
              <Mascot pose="ciao" size={70} animate={false} />
              <p className="title mt-1 text-[15px]">Ancora niente</p>
              <p className="text-[13.5px] text-muted">
                Scrivi tu il primo commento
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3 py-2">
              {comments.map((c) => (
                <CommentRow
                  key={c.id}
                  c={c}
                  quoted={
                    c.replyTo
                      ? (comments.find((x) => x.id === c.replyTo) ?? null)
                      : undefined
                  }
                  players={players}
                  me={me}
                  now={now}
                  flash={flash === c.id}
                  confirming={confirmId === c.id}
                  onReply={() => startReply(c)}
                  onQuote={goTo}
                  onRetry={() => onRetry(c)}
                  onDelete={() => {
                    if (c.state === "failed" || confirmId === c.id) {
                      setConfirmId(null);
                      onDelete(c);
                    } else setConfirmId(c.id);
                  }}
                />
              ))}
            </ul>
          )}
        </div>

        {replyTo && (
          <div
            className="flex shrink-0 items-center gap-2 border-t border-line bg-surface px-3 py-2"
            data-testid="hl-reply-bar"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ball-soft text-ball">
              <IconCornerUpLeft size={15} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-bold">
                Rispondi a{" "}
                {shortName(
                  players.find((x) => x.id === replyTo.playerId),
                  players,
                )}
              </p>
              <p className="truncate text-[12.5px] text-muted">
                {replyTo.body}
              </p>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              aria-label="Non rispondere più"
              className="press grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted"
              data-testid="hl-reply-cancel"
            >
              <IconX size={17} strokeWidth={2.4} />
            </button>
          </div>
        )}
        <form
          className={clsx(
            "safe-bottom flex shrink-0 items-end gap-2 bg-surface px-3 pb-3 pt-2.5",
            !replyTo && "border-t border-line",
          )}
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <Avatar player={me} size={34} />
          <div className="relative min-w-0 flex-1">
            <textarea
              ref={input}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, COMMENT_MAX))}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              maxLength={COMMENT_MAX}
              placeholder={
                replyTo ? "Scrivi la risposta…" : "Scrivi un commento…"
              }
              aria-label={replyTo ? "Scrivi la risposta" : "Scrivi un commento"}
              enterKeyHint="send"
              className="block max-h-[104px] min-h-[40px] w-full resize-none rounded-[20px] bg-raised px-3.5 py-[9px] text-[15px] leading-snug outline-none focus:ring-1 focus:ring-ball/50"
              data-testid="hl-comment-input"
            />
            {left <= 40 && (
              <span
                className={clsx(
                  "absolute -top-5 right-2 text-[11.5px] font-semibold tnum",
                  left <= 10 ? "text-danger" : "text-muted",
                )}
              >
                {left}
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={!cleanComment(text)}
            aria-label="Invia"
            className="press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ball text-ball-ink disabled:opacity-40"
            data-testid="hl-comment-send"
          >
            <IconArrowUp size={20} strokeWidth={2.6} />
          </button>
        </form>
      </div>
    </div>
  );
}

/** Quanto trascinare a destra per rispondere (come su WhatsApp). */
const SWIPE_REPLY = 56;

/**
 * Un commento: chi, quando, il testo e, se risponde a qualcuno, la citazione (toccandola si
 * torna all'originale). Trascinandolo verso destra si risponde; sotto ci sono Rispondi ed Elimina.
 */
function CommentRow({
  c,
  quoted,
  players,
  me,
  now,
  flash,
  confirming,
  onReply,
  onQuote,
  onRetry,
  onDelete,
}: {
  c: ShownComment;
  /** undefined: non risponde a nessuno; null: rispondeva a un commento eliminato. */
  quoted: ShownComment | null | undefined;
  players: Player[];
  me: Player;
  now: Date;
  flash: boolean;
  confirming: boolean;
  onReply: () => void;
  onQuote: (id: string) => void;
  onRetry: () => void;
  onDelete: () => void;
}) {
  const who = players.find((x) => x.id === c.playerId);
  const mine = c.playerId === me.id;
  const [dx, setDxState] = useState(0);
  // Il valore vero sta nel ref: gli eventi del dito arrivano più veloci dei disegni.
  const dxRef = useRef(0);
  const setDx = (v: number) => {
    dxRef.current = v;
    setDxState(v);
  };
  const start = useRef<{ x: number; y: number; on: boolean | null } | null>(
    null,
  );
  const canReply = !c.state;

  const onDown = (e: React.PointerEvent) => {
    if (!canReply || e.pointerType === "mouse") return;
    start.current = { x: e.clientX, y: e.clientY, on: null };
  };
  const onMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    // Decide al primo movimento chiaro: in orizzontale si risponde, in verticale si scorre.
    if (s.on === null && (Math.abs(mx) > 8 || Math.abs(my) > 8))
      s.on = Math.abs(mx) > Math.abs(my) * 1.4 && mx > 0;
    if (!s.on) return;
    const next = Math.max(0, Math.min(90, mx));
    if (next >= SWIPE_REPLY && dxRef.current < SWIPE_REPLY) haptic(8);
    setDx(next);
  };
  const onUp = () => {
    const s = start.current;
    start.current = null;
    if (s?.on && dxRef.current >= SWIPE_REPLY) onReply();
    setDx(0);
  };

  const quotedName = quoted
    ? shortName(
        players.find((x) => x.id === quoted.playerId),
        players,
      )
    : null;

  return (
    <li
      data-cid={c.id}
      className={clsx(
        "hl-comment relative",
        c.state === "sending" && "opacity-60",
        flash && "hl-flash",
      )}
      data-testid="hl-comment"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      style={{ touchAction: "pan-y" }}
    >
      {/* La freccia che compare trascinando, come su WhatsApp. */}
      <span
        className="pointer-events-none absolute left-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-raised text-ball"
        style={{
          opacity: Math.min(1, dx / SWIPE_REPLY),
          transform: `translateY(-50%) scale(${0.6 + Math.min(1, dx / SWIPE_REPLY) * 0.4})`,
        }}
        aria-hidden
      >
        <IconCornerUpLeft size={16} />
      </span>
      <div
        className={clsx(
          "flex gap-2.5",
          dx === 0 && "transition-transform duration-200",
        )}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
      >
        {who ? (
          <Avatar player={who} size={34} />
        ) : (
          <span className="h-[34px] w-[34px] shrink-0 rounded-full bg-line" />
        )}
        <div className="min-w-0 flex-1">
          <div className="rounded-[18px] rounded-tl-[6px] bg-surface px-3 py-2 shadow-[var(--shadow)]">
            <p className="flex items-baseline gap-1.5 text-[12px] text-muted">
              <span className="truncate font-bold text-text">
                {shortName(who, players)}
              </span>
              <span className="shrink-0">
                {c.state === "sending" ? "invio…" : timeAgo(c.createdAt, now)}
              </span>
            </p>
            {quoted !== undefined && (
              <button
                type="button"
                onClick={() => quoted && onQuote(quoted.id)}
                disabled={!quoted}
                className="press mt-1.5 flex w-full max-w-full items-start gap-1.5 rounded-[12px] bg-raised px-2.5 py-1.5 text-left"
                data-testid="hl-quote"
              >
                <IconCornerUpLeft
                  size={13}
                  className="mt-[3px] shrink-0 text-muted"
                  aria-hidden
                />
                {quoted ? (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-bold">
                      {quotedName}
                    </span>
                    <span className="block truncate text-[12.5px] text-muted">
                      {quoted.body}
                    </span>
                  </span>
                ) : (
                  <span className="block text-[12.5px] italic text-faint">
                    Commento eliminato
                  </span>
                )}
              </button>
            )}
            <p
              className={clsx(
                "whitespace-pre-wrap break-words text-[14.5px] leading-snug [overflow-wrap:anywhere]",
                quoted !== undefined ? "mt-[5px]" : "mt-0.5",
              )}
            >
              {c.body}
            </p>
          </div>
          {c.state === "failed" ? (
            <div className="mt-1 flex gap-3 px-1 text-[12.5px] font-bold">
              <span className="text-danger">Non inviato</span>
              <button className="press underline" onClick={onRetry}>
                Riprova
              </button>
              <button className="press text-muted underline" onClick={onDelete}>
                Lascia stare
              </button>
            </div>
          ) : (
            c.state !== "sending" && (
              <div className="mt-1 flex gap-4 px-1 text-[12px] font-semibold text-muted">
                <button
                  className="press py-0.5"
                  onClick={onReply}
                  data-testid="hl-comment-reply"
                >
                  Rispondi
                </button>
                {mine && (
                  <button
                    className={clsx(
                      "press py-0.5",
                      confirming && "text-danger",
                    )}
                    onClick={onDelete}
                    data-testid="hl-comment-delete"
                  >
                    {confirming ? "Tocca ancora per eliminarlo" : "Elimina"}
                  </button>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </li>
  );
}
