"use client";

import clsx from "clsx";
import { Lock } from "lucide-react";
import { Character } from "@/components/character";
import { Button } from "@/components/ui/basics";
import { play } from "@/lib/sound";
import { ITEMS, ITEM_BY_ID, SLOTS, SLOT_NAMES } from "@/lib/game/catalog";
import {
  DAILY,
  LEGA_TEAMS,
  LEVELS,
  LEVEL_ORDER,
  dailyStatus,
  fmtEuro,
  seasonSummary,
  xpNeed,
} from "@/lib/game/economy";
import { SKILL_NAMES, claimDaily, equip, levelIndex } from "@/lib/game/state";
import type { Skill, Slot } from "@/lib/game/types";
import { useGame } from "./store";
import { Meter, Sheet, TIPS, Tip, useToast, useToday } from "./ui";

export function Wardrobe() {
  const { game, update, me, charId } = useGame();
  const pick = (slot: Slot, id: string | null) => {
    play("select");
    update((s) => equip(s, slot, id));
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="court mx-4 flex shrink-0 justify-center rounded-[24px] pb-1 pt-3">
        <Character id={charId} outfit={game.outfit} number={me.jerseyNumber} height={190} idle />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3">
        <Tip id="guardaroba" className="mb-3" />
        {SLOTS.map((slot) => {
          const mine = ITEMS.filter((i) => i.slot === slot && game.owned.includes(i.id));
          return (
            <div key={slot} className="mb-3">
              <p className="mb-1.5 px-1 text-[13px] font-bold uppercase tracking-wide text-muted">{SLOT_NAMES[slot]}</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <Chip on={!game.outfit[slot]} onClick={() => pick(slot, null)}>
                  Niente
                </Chip>
                {mine.map((i) => (
                  <Chip key={i.id} on={game.outfit[slot] === i.id} onClick={() => pick(slot, i.id)}>
                    {i.name}
                  </Chip>
                ))}
                {!mine.length && <span className="self-center px-1 text-[13px] text-muted">Compra qualcosa in Shopping</span>}
              </div>
            </div>
          );
        })}
        <p className="mt-2 text-center text-[13px] text-muted">Quello che indossi si vede anche nella tua figurina dell&apos;app</p>
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "press sticker-sm h-11 shrink-0 whitespace-nowrap rounded-full px-4 text-[14px] font-bold",
        on ? "bg-court text-court-ink" : "bg-surface",
      )}
    >
      {children}
    </button>
  );
}

export function Career() {
  const { game } = useGame();
  const sum = seasonSummary(game);
  const cur = levelIndex(game);
  const up = LEVELS[game.contract.level].up;
  const c = game.career;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto [&>*]:shrink-0 px-4 pb-6">
      <Tip id="carriera" />
      <div className="card px-4 py-3">
        <p className="text-[12.5px] font-bold uppercase tracking-wide text-muted">La scala</p>
        <ol className="mt-2 flex flex-col gap-2">
          {LEVEL_ORDER.map((l, k) => (
            <li
              key={l}
              className={clsx(
                "flex items-center gap-3 rounded-2xl border-2 border-edge px-3 py-2",
                k === cur ? "bg-court text-court-ink" : k < cur ? "bg-ok/20" : "bg-surface opacity-75",
              )}
            >
              <span className="num w-6 text-[18px]">{k + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold">{LEVELS[l].name}</span>
                <span className={clsx("block text-[12.5px]", k === cur ? "text-court-ink/85" : "text-muted")}>
                  {LEVELS[l].format} · {fmtEuro(LEVELS[l].salary[0])}–{fmtEuro(LEVELS[l].salary[1])} a settimana
                </span>
              </span>
              {k === cur && <span className="text-[12px] font-bold">Sei qui</span>}
              {k > cur && <Lock size={18} />}
            </li>
          ))}
          <li className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-line-strong px-3 py-2 opacity-70">
            <span className="num w-6 text-[18px]">4</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-bold">La Lega americana</span>
              <span className="block text-[12.5px] text-muted">
                {LEGA_TEAMS[0]}, {LEGA_TEAMS[2]}… arriva più avanti
              </span>
            </span>
            <Lock size={18} />
          </li>
        </ol>
      </div>

      <div className="card px-4 py-3">
        <p className="text-[12.5px] font-bold uppercase tracking-wide text-muted">Questa stagione</p>
        <p className="mt-1 text-[15px]">
          {sum.wins} vinte su {sum.played} giocate · voto medio <b>{sum.avg.toLocaleString("it-IT")}</b> · fama <b>{game.fame}</b>
        </p>
        {up && (
          <>
            <p className="mt-2 text-[13.5px] text-muted">
              Per salire: voto medio {String(up.rating).replace(".", ",")} {up.or ? "oppure" : "e"} fama {up.fame}
            </p>
            <div className="mt-1.5 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-[12.5px] font-bold">
                <span className="w-14">Voto</span>
                <Meter value={sum.avg} max={up.rating} color="var(--ball)" className="flex-1" label="Voto medio" />
              </div>
              <div className="flex items-center gap-2 text-[12.5px] font-bold">
                <span className="w-14">Fama</span>
                <Meter value={game.fame} max={up.fame} color="var(--ball)" className="flex-1" label="Fama" />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="card px-4 py-3">
        <p className="text-[12.5px] font-bold uppercase tracking-wide text-muted">Abilità</p>
        <div className="mt-2 flex flex-col gap-2">
          {(Object.keys(SKILL_NAMES) as Skill[]).map((k) => (
            <div key={k} className="flex items-center gap-2">
              <span className="w-[84px] text-[14px] font-semibold">{SKILL_NAMES[k]}</span>
              <Meter value={game.xp[k]} max={xpNeed(game.skills[k])} color="var(--court)" className="flex-1" label={`Esperienza ${SKILL_NAMES[k]}`} />
              <span className="num w-9 text-right text-[20px]">{game.skills[k]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card grid grid-cols-4 gap-1 px-2 py-3 text-center">
        {[
          ["Partite", c.games],
          ["Vinte", c.wins],
          ["Punti", c.pts],
          ["Assist", c.ast],
          ["Rimbalzi", c.reb],
          ["Rubate", c.stl],
          ["Stoppate", c.blk],
          ["Voto top", c.best ? c.best.toLocaleString("it-IT") : "—"],
        ].map(([l, v]) => (
          <div key={l} className="py-1">
            <p className="num text-[22px]">{v}</p>
            <p className="text-[11.5px] font-semibold text-muted">{l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Guide({ onTutorial }: { onTutorial: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto [&>*]:shrink-0 px-4 pb-6">
      {Object.entries(TIPS).map(([k, t]) => (
        <p key={k} className="card px-4 py-3 text-[14.5px]">
          {t}
        </p>
      ))}
      <Button variant="secondary" block className="mt-2" onClick={onTutorial}>
        Rifai il tutorial
      </Button>
    </div>
  );
}

const DAILY_LABEL = ["200 €", "Energia piena", "500 €", "Un vestito", "1.000 €", "Allenamento", "Accessorio raro"];
const DAILY_EMOJI = ["💶", "⚡", "💶", "👕", "💰", "🏋️", "🕶️"];

export function DailySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { game, update } = useGame();
  const toast = useToast();
  const today = useToday();
  const st = dailyStatus(game, today);
  const mult = LEVELS[game.contract.level].mult;
  return (
    <Sheet open={open} onClose={onClose} title="Premio del giorno">
      <p className="mb-3 text-[14px] text-muted">Entra tutti i giorni: al settimo c&apos;è l&apos;accessorio raro. Se salti un giorno si ricomincia.</p>
      <div className="grid grid-cols-4 gap-2">
        {DAILY.map((_, k) => {
          const n = k + 1;
          const done = st.claimed ? n <= st.step : n < st.step;
          const now = n === st.step && !st.claimed;
          return (
            <div
              key={k}
              className={clsx(
                "flex flex-col items-center rounded-2xl border-2 border-edge px-1 py-2 text-center",
                now ? "game-glow bg-volt text-volt-ink" : done ? "bg-ok/25" : "bg-surface",
                k === 6 && "col-span-2",
              )}
            >
              <span className="text-[11.5px] font-bold">Giorno {n}</span>
              <span className="text-[24px]">{done ? "✅" : DAILY_EMOJI[k]}</span>
              <span className="text-[11.5px] font-semibold leading-tight">
                {mult > 1 && DAILY[k].kind === "money" ? fmtEuro((DAILY[k] as { base: number }).base * mult) : DAILY_LABEL[k]}
              </span>
            </div>
          );
        })}
      </div>
      <Button
        variant="primary"
        size="lg"
        block
        className="mt-4"
        disabled={st.claimed}
        data-testid="claim-daily"
        onClick={() => {
          const r = claimDaily(game, today);
          if (!r) return;
          update(() => r.s);
          play("unlock");
          toast(`Premio: ${r.label}`, "ok");
          onClose();
        }}
      >
        {st.claimed ? "Ritirato: torna domani" : "Ritira"}
      </Button>
      {ITEM_BY_ID.get("occhiali-stella") && game.owned.includes("occhiali-stella") && (
        <p className="mt-2 text-center text-[12.5px] text-muted">Gli occhiali a stella sono già tuoi: al settimo giorno arrivano soldi</p>
      )}
    </Sheet>
  );
}
