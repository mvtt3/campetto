"use client";

import { Avatar } from "@/components/ui/avatar";
import { useData } from "@/lib/data/provider";
import { shortName } from "@/lib/types";

/** Tutto il gruppo, ognuno con la sua figurina: un tocco apre il profilo. */
export function GroupStrip({ title = "Il gruppo" }: { title?: string }) {
  const { data } = useData();
  const players = data.players.filter((p) => !p.archived && p.nickname);
  if (!players.length) return null;
  return (
    <section className="card mt-2 px-3 pb-3 pt-3" aria-label={title}>
      <h2 className="title mb-2 text-center text-[15px]">{title}</h2>
      <ul className="flex flex-wrap justify-center gap-x-1 gap-y-2">
        {players.map((p) => (
          <li key={p.id} className="w-[64px]">
            <span className="flex flex-col items-center gap-1">
              <Avatar player={p} size={44} />
              <span className="w-full truncate text-center text-[12px] font-semibold">{shortName(p, data.players)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
