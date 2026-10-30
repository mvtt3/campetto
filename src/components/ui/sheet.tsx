"use client";

import { X } from "lucide-react";
import { Drawer } from "vaul";
import type { ReactNode } from "react";

/** Bottom sheet: details open over the current screen instead of a new page. */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  footer,
  description,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  description?: ReactNode;
}) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-[#1d1a16]/50" />
        <Drawer.Content
          // Un livello solo che si sposta col dito: niente ridisegni del contenuto durante il trascinamento.
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] max-w-lg flex-col rounded-t-[30px] border-[2.5px] border-b-0 border-edge bg-surface outline-none will-change-transform [backface-visibility:hidden] [contain:layout_paint]"
          aria-describedby={undefined}
          // Le schede aperte sopra al pannello (es. il personaggio) non lo chiudono.
          onInteractOutside={(e) => {
            if ((e.target as Element | null)?.closest?.("[data-over-sheet]"))
              e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (document.querySelector("[data-over-sheet]")) e.preventDefault();
          }}
        >
          <div className="mx-auto mt-3 h-1.5 w-11 shrink-0 rounded-full bg-line-strong" />
          {/* Chiudere con un tocco, come nelle app di oggi: non serve trascinare. */}
          <Drawer.Close
            aria-label="Chiudi"
            className="press absolute right-3.5 top-3.5 z-10 grid h-9 w-9 place-items-center rounded-full border-2 border-edge bg-surface text-text"
          >
            <X size={18} strokeWidth={2.4} />
          </Drawer.Close>
          <div className="shrink-0 px-12 pb-2 pt-3 text-center">
            <Drawer.Title className="display text-[22px]">{title}</Drawer.Title>
            {description && (
              <Drawer.Description className="mx-auto mt-0.5 max-w-[34ch] text-[13px] text-muted">
                {description}
              </Drawer.Description>
            )}
          </div>
          <div
            className="scroll-area min-h-0 flex-1 px-5 pb-4"
            data-vaul-no-drag=""
          >
            {children}
          </div>
          {footer && (
            <div className="safe-bottom shrink-0 px-5 pb-4 pt-2">{footer}</div>
          )}
          {!footer && <div className="safe-bottom shrink-0" />}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
