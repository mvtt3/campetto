"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Logo } from "./mascot";

export function Welcome({
  kicker,
  title,
  text,
  children,
}: {
  kicker?: string;
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <main className="fixed inset-0 flex flex-col overflow-hidden text-text">
      <div className="safe-top relative mx-auto flex w-full max-w-lg flex-1 flex-col px-5">
        <div className="relative isolate mt-5 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[32px] bg-[radial-gradient(circle_at_50%_40%,#ffe27d_0%,#ffc531_45%,#ff9a2b_100%)] shadow-[var(--shadow-pop)]">
          <motion.div
            initial={{ opacity: 0, scale: 0.6, rotate: -14 }}
            animate={{ opacity: 1, scale: 1, rotate: -4 }}
            transition={{
              type: "spring",
              stiffness: 170,
              damping: 12,
              delay: 0.15,
            }}
          >
            <Logo size={220} className="short:h-[160px] short:w-[160px]" />
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="pt-7 text-center short:pt-5"
        >
          {kicker && (
            <p className="mx-auto mb-3 w-fit rounded-full bg-raised px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
              {kicker}
            </p>
          )}
          <h1 className="display text-[40px] short:text-[32px]">{title}</h1>
          <p className="mx-auto mt-2.5 max-w-[30ch] text-[15px] leading-snug text-muted">
            {text}
          </p>
        </motion.div>
        <div className="safe-bottom pb-8 pt-7 short:pt-5">{children}</div>
      </div>
    </main>
  );
}
