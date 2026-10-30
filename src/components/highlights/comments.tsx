"use client";

import clsx from "clsx";
import { ArrowUp, RotateCcw, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
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
  onSend: (body: string) => void;
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
    onSend(body);
    setText("");
    input.current?.focus();
  };

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
          "hl-comments absolute inset-x-0 mx-auto flex max-w-lg flex-col rounded-t-[26px] border-[2.5px] border-b-0 border-edge bg-surface text-text",
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
          className="relative shrink-0 touch-none select-none px-12 pb-2 pt-3 text-center"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <div className="mx-auto mb-2 h-1.5 w-11 rounded-full bg-line-strong" />
          <h3 className="title text-[16px]">
            {count === 0
              ? "Commenti"
              : count === 1
                ? "1 commento"
                : `${count} commenti`}
          </h3>
          <button
            onClick={onClose}
            aria-label="Chiudi"
            className="press absolute right-3 top-2.5 grid h-9 w-9 place-items-center rounded-full border-2 border-edge bg-surface text-text"
            data-testid="hl-comments-close"
          >
            <X size={18} strokeWidth={2.4} />
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
                className="press flex h-10 items-center gap-1.5 rounded-full border-2 border-edge bg-surface px-4 text-[14px] font-bold"
              >
                <RotateCcw size={15} aria-hidden /> Riprova
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
            <ul className="flex flex-col gap-3.5 py-2">
              {comments.map((c) => {
                const who = players.find((x) => x.id === c.playerId);
                const mine = c.playerId === me.id;
                return (
                  <li
                    key={c.id}
                    className={clsx(
                      "flex gap-2.5",
                      c.state === "sending" && "opacity-60",
                    )}
                    data-testid="hl-comment"
                  >
                    {who ? (
                      <Avatar player={who} size={34} />
                    ) : (
                      <span className="h-[34px] w-[34px] shrink-0 rounded-full bg-line" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline gap-1.5 text-[12.5px] text-muted">
                        <span className="truncate font-bold text-text">
                          {shortName(who, players)}
                        </span>
                        <span className="shrink-0">
                          {c.state === "sending"
                            ? "invio…"
                            : timeAgo(c.createdAt, now)}
                        </span>
                      </p>
                      <p className="whitespace-pre-wrap break-words text-[14.5px] leading-snug [overflow-wrap:anywhere]">
                        {c.body}
                      </p>
                      {c.state === "failed" ? (
                        <div className="mt-1 flex gap-3 text-[12.5px] font-bold">
                          <span className="text-danger">Non inviato</span>
                          <button
                            className="press underline"
                            onClick={() => onRetry(c)}
                          >
                            Riprova
                          </button>
                          <button
                            className="press text-muted underline"
                            onClick={() => onDelete(c)}
                          >
                            Lascia stare
                          </button>
                        </div>
                      ) : (
                        mine &&
                        c.state !== "sending" && (
                          <button
                            className={clsx(
                              "press mt-0.5 text-[12.5px] font-semibold",
                              confirmId === c.id ? "text-danger" : "text-muted",
                            )}
                            onClick={() => {
                              if (confirmId === c.id) {
                                setConfirmId(null);
                                onDelete(c);
                              } else setConfirmId(c.id);
                            }}
                            data-testid="hl-comment-delete"
                          >
                            {confirmId === c.id
                              ? "Tocca ancora per eliminarlo"
                              : "Elimina"}
                          </button>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <form
          className="safe-bottom flex shrink-0 items-end gap-2 border-t-2 border-line px-3 pb-3 pt-2.5"
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
              placeholder="Scrivi un commento…"
              aria-label="Scrivi un commento"
              enterKeyHint="send"
              className="block max-h-[104px] min-h-[40px] w-full resize-none rounded-[20px] border-2 border-line-strong bg-bg px-3.5 py-[7px] text-[15px] leading-snug outline-none focus:border-edge"
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
            className="press grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-edge bg-ball text-ball-ink disabled:opacity-40"
            data-testid="hl-comment-send"
          >
            <ArrowUp size={20} strokeWidth={2.6} />
          </button>
        </form>
      </div>
    </div>
  );
}
