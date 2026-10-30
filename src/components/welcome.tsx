"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Logo } from "./mascot";

/** Schermata d'ingresso come un poster: giallo sole, il badge con Spicchio, un solo pulsante. */
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
    <main className="halftone relative flex h-dvh flex-col overflow-hidden bg-volt text-[#1d1a16]">
      <div className="safe-top relative mx-auto flex w-full max-w-lg flex-1 flex-col px-6">
        <div className="flex flex-1 items-center justify-center pt-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.6, rotate: -14 }}
            animate={{ opacity: 1, scale: 1, rotate: -4 }}
            transition={{
              type: "spring",
              stiffness: 170,
              damping: 12,
              delay: 0.15,
            }}
            className="drop-shadow-[6px_6px_0_#1d1a16]"
          >
            <Logo size={250} className="short:h-[190px] short:w-[190px]" />
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="text-center"
        >
          {kicker && (
            <p className="mx-auto mb-2 w-fit rounded-full border-2 border-[#1d1a16] bg-[#fffaf0] px-3 py-1 text-[14px] font-bold">
              {kicker}
            </p>
          )}
          <h1 className="display text-[50px] leading-[0.95] short:text-[40px]">
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-[30ch] text-[16px] font-medium text-[#3d342a]">
            {text}
          </p>
        </motion.div>
        <div className="safe-bottom pb-8 pt-7 short:pt-4">{children}</div>
      </div>
    </main>
  );
}
