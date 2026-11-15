"use client";

import { IconX } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useData } from "@/lib/data/provider";
import type { NewsPost } from "@/lib/types";
import { Mascot } from "./mascot";
import { Button, CourtLines } from "./ui/basics";

const seenKey = (id: string) => `campetto:avviso-partite-visto:${id}`;

/** Gli avvisi che riguardano le Partite (una partita aggiunta dopo, per esempio): compaiono lì, una volta. */
export function isMatchesNotice(post: NewsPost): boolean {
  return !!post.popup && post.kind === "novita" && post.link === "/partite";
}

function seen(id: string): boolean {
  try {
    return localStorage.getItem(seenKey(id)) === "1";
  } catch {
    return false;
  }
}

/**
 * Il piccolo avviso della scheda Partite: come le altre schede festa (campo blu, X in alto, un
 * bottone), ma solo qui e solo finché non si dice "Ok": poi non torna più. Serve quando una
 * partita arriva in ritardo e nessuno deve pensare di esserselo perso.
 */
export function MatchesNotice({ active }: { active: boolean }) {
  const { data } = useData();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Dopo il primo disegno: il localStorage c'è solo nel browser.
    const t = window.setTimeout(() => setReady(true), 400);
    return () => window.clearTimeout(t);
  }, []);
  const nowIso = new Date().toISOString();
  const post = ready
    ? (data.news ?? []).find((p) => isMatchesNotice(p) && !(p.until && p.until <= nowIso) && !seen(p.id) && !dismissed.includes(p.id))
    : undefined;
  const close = () => {
    if (!post) return;
    try {
      localStorage.setItem(seenKey(post.id), "1");
    } catch {
      /* niente memoria: lo rivedrà */
    }
    setDismissed((d) => [...d, post.id]);
  };
  return (
    <AnimatePresence>
      {active && post && (
        <motion.div
          key={post.id}
          role="dialog"
          aria-modal="true"
          aria-labelledby="matches-notice-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[70] grid place-items-center bg-[#1d1a16]/60 px-8"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
            className="court relative flex w-full max-w-xs flex-col items-center overflow-hidden rounded-[32px] px-6 pb-6 pt-7 text-center text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <CourtLines className="absolute inset-0 h-full w-full" />
            <button
              type="button"
              aria-label="Chiudi"
              onClick={close}
              className="press absolute right-3.5 top-3.5 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white"
            >
              <IconX size={17} strokeWidth={2.4} />
            </button>
            <div className="relative">
              <Mascot pose="ciao" size={84} />
            </div>
            <p className="relative mt-3 text-[14px] font-semibold text-volt">Partite</p>
            <h2 id="matches-notice-title" className="display relative mt-1 text-[22px] leading-tight">
              {post.title}
            </h2>
            <p className="relative mt-2 text-[14.5px] leading-snug text-white/90">{post.body}</p>
            <Button variant="primary" className="relative mt-5 w-full" onClick={close}>
              {post.cta || "Ok, visto"}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
