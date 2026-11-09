import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex h-dvh max-w-lg flex-col">
      <header className="safe-top shrink-0 px-4">
        <div className="flex h-14 items-center gap-2">
          <Link
            href="/"
            aria-label="Indietro"
            className="-ml-2 grid h-11 w-11 place-items-center rounded-full"
          >
            <ChevronLeft size={24} />
          </Link>
          <h1 className="title text-[24px]">{title}</h1>
        </div>
      </header>
      <main className="scroll-area safe-bottom flex-1 px-5 pb-10 text-[15px] leading-relaxed text-muted [&_h2]:title [&_h2]:mb-1 [&_h2]:mt-6 [&_h2]:text-[18px] [&_h2]:text-text [&_p]:mt-2">
        <p className="text-[13px]">Aggiornata il {updated}</p>
        {children}
      </main>
    </div>
  );
}
