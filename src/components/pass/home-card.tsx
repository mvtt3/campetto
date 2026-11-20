"use client";

import clsx from "clsx";
import Link from "next/link";
import { IconBallBasketball, IconChevronRight, IconDoor, IconGift, IconHanger } from "@tabler/icons-react";
import type { CSSProperties } from "react";
import { CARDINE, ITEM_BY_ID, LEVELS, PASS_LEVELS, POINTS_PER_LEVEL } from "@/lib/pass/catalog";
import { todayKey } from "@/lib/pass/store";
import { BoostIcon, ItemPhoto, SpicchioIcon } from "./ui";
import { usePass } from "./use-pass";

/**
 * Il pass nella Home: livello, barra e il prossimo premio; sotto, il tiro del giorno, lo
 * spogliatoio e il camerino. Una riga sola di cose da fare, niente di più.
 */
export function PassHomeCard({ index = 2 }: { index?: number }) {
  const v = usePass();
  const { prog, st } = v;
  if (!v.allowed || !prog) return null;
  const nextLv = PASS_LEVELS.find((l) => l.n > prog.level && l.reward.kind === "item") ?? PASS_LEVELS[LEVELS - 1];
  const nextItem = nextLv.reward.kind === "item" ? ITEM_BY_ID.get(nextLv.reward.id) : undefined;
  const shotToday = st.shot?.day === todayKey();
  const latest = prog.giornate[0];
  const lockerNew = !!latest && !st.lockerSeen.includes(latest.day);

  return (
    <section className="rise" style={{ "--i": index } as CSSProperties} data-testid="pass-home">
      <div className="mb-2.5 flex min-h-8 items-center justify-between gap-3 px-1">
        <h2 className="title flex items-center gap-1.5 text-[17px]">Pass di {prog.season.name}</h2>
        <span className="flex items-center gap-1 text-[13px] font-semibold text-muted">
          <SpicchioIcon size={17} />
          <span className="num text-[14px] text-text">{prog.spicchi}</span>
        </span>
      </div>
      <div className="card overflow-hidden">
        <Link href="/pass" className="press flex items-center gap-3.5 p-3.5">
          <span className={clsx("relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[20px]", nextItem && `rar-${nextItem.rarity}`)}>
            {/* Solo la foto già salvata: la Home non scarica il 3D. */}
            {nextItem && (
              <ItemPhoto
                item={nextItem}
                preset={v.preset}
                size={CARDINE.includes(nextLv.n) ? 208 : 112}
                make={false}
                className="absolute inset-0"
                fallback={<IconGift size={30} className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 text-white/90" aria-hidden />}
              />
            )}
            <span className="absolute inset-x-0 bottom-0 bg-black/35 py-0.5 text-center text-[10.5px] font-bold text-white backdrop-blur-sm">
              Liv. {nextLv.n}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className="score text-[30px]">{prog.level}</span>
              <span className="text-[13px] font-medium text-muted">livello · {prog.daysLeft} giorni</span>
            </span>
            <span className="mt-2 block h-2 overflow-hidden rounded-full bg-raised">
              <span
                className="bar-in block h-full rounded-full bg-court"
                style={{ width: `${prog.level >= LEVELS ? 100 : (prog.bar / POINTS_PER_LEVEL) * 100}%` }}
              />
            </span>
            <span className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-muted">
              {prog.toClaim.length > 0 ? (
                <span className="rounded-full bg-volt px-2 py-px text-[11.5px] font-bold text-volt-ink">
                  {prog.toClaim.length === 1 ? "1 premio" : `${prog.toClaim.length} premi`} da riscattare
                </span>
              ) : (
                <span className="truncate">Prossimo: {nextItem?.name}</span>
              )}
              {st.boosts > 0 && (
                <span className="ml-auto inline-flex items-center gap-0.5 font-semibold text-text">
                  <BoostIcon size={13} className="text-gold" /> {st.boosts}
                </span>
              )}
            </span>
          </span>
          <IconChevronRight size={18} className="shrink-0 text-faint" />
        </Link>
        <div className="grid grid-cols-3 gap-1.5 border-t border-line p-1.5">
          <Shortcut href="/tiro" label="Tiro del giorno" dot={!shotToday} testId="home-tiro">
            <IconBallBasketball size={19} />
          </Shortcut>
          <Shortcut href={latest ? `/spogliatoio?giorno=${latest.day}` : "/pass"} label="Spogliatoio" dot={lockerNew} testId="home-spogliatoio">
            <IconDoor size={19} />
          </Shortcut>
          <Shortcut href="/camerino" label="Camerino" testId="home-camerino">
            <IconHanger size={19} />
          </Shortcut>
        </div>
      </div>
    </section>
  );
}

function Shortcut({
  href,
  label,
  dot,
  children,
  testId,
}: {
  href: string;
  label: string;
  dot?: boolean;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className="press relative flex flex-col items-center gap-1 rounded-[14px] py-2 text-[11.5px] font-semibold text-muted"
    >
      <span className="relative text-text">
        {children}
        {dot && <span className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-danger" aria-label="Novità" />}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}
