"use client";

import { animate, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Mascot } from "./mascot";

const UPDATE = "Nuovo stile";
const SEEN_KEY = "campetto:aggiornamento-visto";
const STEPS = ["Scarico l'aggiornamento", "Installo", "Apro il Campetto"];
const STEP_FROM = [0, 72, 94];

export function updatePending(): boolean {
  try {
    return (
      location.search.includes("aggiornamento=1") ||
      (!navigator.webdriver && localStorage.getItem(SEEN_KEY) !== UPDATE)
    );
  } catch {
    return false;
  }
}

export function markUpdateSeen() {
  try {
    localStorage.setItem(SEEN_KEY, UPDATE);
  } catch {
    return;
  }
}

export function UpdateScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const bar = useRef<HTMLSpanElement>(null);
  const percent = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    markUpdateSeen();
    // Breve: un attimo per notare il nuovo stile, non un'attesa. Un tocco lo chiude subito.
    const run = animate(0, 100, {
      duration: 1.4,
      ease: [0.3, 0, 0.2, 1],
      onUpdate: (v) => {
        if (bar.current) bar.current.style.scale = `${v / 100} 1`;
        if (percent.current) percent.current.textContent = `${Math.round(v)}%`;
        setStep(STEP_FROM.findLastIndex((from) => v >= from));
      },
      onComplete: () => setLeaving(true),
    });
    return () => run.stop();
  }, []);

  return (
    <motion.div
      role="status"
      aria-label="Nuovo aggiornamento"
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: 0.25 }}
      onAnimationComplete={() => leaving && onDone()}
      onClick={() => setLeaving(true)}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg px-8 text-center text-text"
    >
      <Mascot pose={step === 2 ? "esulta" : "ciao"} size={132} />
      <p className="mt-5 rounded-full bg-raised px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
        Nuovo aggiornamento
      </p>
      <div className="mt-7 w-full max-w-[280px]">
        <div className="h-2 overflow-hidden rounded-full bg-raised">
          <span
            ref={bar}
            className="block h-full origin-left scale-x-0 rounded-full bg-ball"
          />
        </div>
        <p className="mt-2.5 flex items-center justify-between text-[13px] font-semibold text-muted">
          {STEPS[step]}
          <span ref={percent} className="tnum text-text">
            0%
          </span>
        </p>
      </div>
    </motion.div>
  );
}
