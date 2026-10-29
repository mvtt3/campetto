"use client";

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
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] max-w-lg flex-col rounded-t-[26px] bg-surface outline-none ring-1 ring-line"
          aria-describedby={undefined}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line-strong" />
          <div className="shrink-0 px-5 pb-2 pt-3">
            <Drawer.Title className="title text-[21px]">{title}</Drawer.Title>
            {description && <Drawer.Description className="mt-0.5 text-[13px] text-muted">{description}</Drawer.Description>}
          </div>
          <div className="scroll-area min-h-0 flex-1 px-5 pb-4" data-vaul-no-drag="">
            {children}
          </div>
          {footer && <div className="safe-bottom shrink-0 border-t border-line px-5 pb-3 pt-3">{footer}</div>}
          {!footer && <div className="safe-bottom shrink-0" />}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
