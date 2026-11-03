"use client";

import clsx from "clsx";
import { Gift, Shirt, Smartphone, Target, Trophy } from "lucide-react";
import { useState } from "react";
import { Character } from "@/components/character";
import { Button } from "@/components/ui/basics";
import { play } from "@/lib/sound";
import {
  DAY_NAMES,
  LEVELS,
  dailyStatus,
  dow,
  fmtEuro,
  overall,
  seasonSummary,
  shortEuro,
  week,
  xpNeed,
} from "@/lib/game/economy";
import { girlfriend, unreadCount } from "@/lib/game/messages";
import { isCaptain } from "@/lib/game/match";
import {
  ACTIVITY_INFO,
  SKILL_NAMES,
  activityCost,
  advanceDay,
  nextMatch,
  seasonOver,
  todayMatch,
  type Activity,
} from "@/lib/game/state";
import type { Skill } from "@/lib/game/types";
import { ratingWord } from "./match-screen";
import { useGame } from "./store";
import { Coach, Meter, Sheet, Tip, useToast, useToday } from "./ui";
import type { View } from "./game";

const SKILLS: Skill[] = ["tiro", "passaggio", "difesa", "fisico"];
const SKILL_LINE: Record<Skill, string> = {
  tiro: "Verde più largo al tiro",
  passaggio: "Più tempo per passare, più assist",
  difesa: "Più rubate",
  fisico: "Stoppate e rimbalzi",
};

export function Hub({ go, openDaily }: { go: (v: View) => void; openDaily: () => void }) {
  const { game, update, me, charId } = useGame();
  const toast = useToast();
  const [train, setTrain] = useState(false);
  const lv = LEVELS[game.contract.level];
  const unread = unreadCount(game);
  const daily = dailyStatus(game, useToday());
  const t = todayMatch(game);
  const next = nextMatch(game);
  const over = seasonOver(game);
  const gf = girlfriend(game);
  const tut = game.tutorial.step;

  const doDay = (a: Activity) => {
    const r = advanceDay(game, a, Math.random);
    if (r.s === game) return;
    update(() => r.s);
    play(a.kind === "partita" ? "whoosh" : "success");
    const day = `${DAY_NAMES[dow(r.s.day)]}`;
    toast(r.note ? `${r.note} · ${day}` : day, "info");
    setTrain(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto [&>*]:shrink-0 px-4 pb-6">
      {/* Il personaggio e come sta */}
      <div className="court relative flex gap-3 overflow-hidden rounded-[24px] px-3 pb-3 pt-2">
        <div className="relative -mb-2 shrink-0 self-end" data-testid="game-character">
          <Character id={charId} outfit={game.outfit} number={me.jerseyNumber} height={150} idle />
          {isCaptain(game) && (
            <span className="num absolute left-1 top-2 grid h-7 w-7 place-items-center rounded-full border-2 border-edge bg-volt text-[15px] text-volt-ink">C</span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1">
          <p className="truncate text-[12px] font-bold uppercase tracking-wide text-court-ink/80">
            {lv.name} · stagione {game.season.n}
          </p>
          <p className="display line-clamp-2 text-[19px] leading-[1.05]">{game.contract.team}</p>
          <p className="num text-[13px] text-court-ink/85">Valutazione {overall(game)}</p>
          {(
            [
              ["Energia", game.energy, "var(--volt)"],
              ["Felicità", game.happiness, "#ff8fb1"],
              ["Fama", game.fame, "var(--ball)"],
            ] as const
          ).map(([l, v, c]) => (
            <div key={l}>
              <div className="flex justify-between text-[12px] font-bold">
                <span>{l}</span>
                <span className="num">{Math.round(v)}</span>
              </div>
              <Meter value={v} color={c} label={l} className="!border-[#1d1a16]" />
            </div>
          ))}
        </div>
      </div>

      {tut >= 4 && daily.claimed === false && (
        <button
          onClick={openDaily}
          className="press sticker flex items-center gap-3 rounded-2xl bg-volt px-4 py-3 text-left text-volt-ink"
        >
          <Gift size={26} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-bold">Premio del giorno pronto</span>
            <span className="block text-[13px] font-semibold opacity-80">Giorno {daily.step} di 7: non saltarne uno</span>
          </span>
          <span className="h-3 w-3 rounded-full bg-danger" />
        </button>
      )}

      <Tip id="hub" />

      {/* Oggi */}
      <div className="card px-4 pb-4 pt-3">
        <p className="text-[12.5px] font-bold uppercase tracking-wide text-muted">
          {DAY_NAMES[dow(game.day)]} · settimana {week(game.day)}
        </p>
        {over && game.offers.length > 0 ? (
          <SeasonEnd onOpen={() => go("telefono:contratti")} />
        ) : t && !t.match.result ? (
          <>
            <p className="display mt-1 text-[24px] leading-tight">Oggi si gioca!</p>
            <p className="mt-1 text-[15px]">
              contro <b>{t.match.opponent}</b> · {t.match.home ? "in casa" : "fuori casa"}
            </p>
            <Button
              variant="primary"
              size="lg"
              block
              className="display mt-3 !h-16 !text-[24px]"
              onClick={() => go(`partita:${t.index}`)}
              data-testid="game-play-match"
            >
              Vai alla partita
            </Button>
          </>
        ) : t && t.match.result ? (
          <>
            <p className="display mt-1 text-[22px] leading-tight">
              {t.match.result.us > t.match.result.them ? "Vinta" : "Persa"} {t.match.result.us}–{t.match.result.them}
            </p>
            <p className="mt-1 text-[15px]">
              Voto {t.match.result.rating.toLocaleString("it-IT")} · {ratingWord(t.match.result.rating)}
            </p>
            <Button variant="court" size="lg" block className="mt-3 !h-16 text-[18px]" onClick={() => doDay({ kind: "partita" })}>
              Vai a domani
            </Button>
          </>
        ) : (
          <>
            <p className="mt-1 text-[15px]">
              {next ? (
                <>
                  Prossima partita: <b>{DAY_NAMES[dow(next.day)].toLowerCase()}</b> contro <b>{next.opponent}</b>
                </>
              ) : (
                "Stagione finita"
              )}
            </p>
            <p className="display mt-2 text-[21px]">Cosa fai oggi?</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <DayButton emoji="🏋️" name={ACTIVITY_INFO.allenamento.name} line="Abilità su, −18 energia" disabled={game.energy < 18} why="Troppo stanco" onClick={() => setTrain(true)} testId="day-train" />
              <DayButton emoji="😴" name={ACTIVITY_INFO.riposo.name} line="+40 energia" onClick={() => doDay({ kind: "riposo" })} testId="day-rest" />
              <DayButton
                emoji="🪩"
                name={ACTIVITY_INFO.serata.name}
                line={`+felicità +fama · ${shortEuro(activityCost(game, "serata"))}`}
                onClick={() => doDay({ kind: "serata" })}
                testId="day-out"
              />
              {gf ? (
                <DayButton emoji="❤️" name={`Esci con ${gf.name}`} line={`+felicità · ${shortEuro(activityCost(game, "ragazza"))}`} onClick={() => doDay({ kind: "ragazza" })} />
              ) : (
                <DayButton emoji="🍕" name={ACTIVITY_INFO.amici.name} line={`+felicità · ${shortEuro(activityCost(game, "amici"))}`} onClick={() => doDay({ kind: "amici" })} />
              )}
            </div>
          </>
        )}
      </div>

      {/* Le quattro porte del gioco */}
      <div className="grid grid-cols-2 gap-2">
        <BigTile
          icon={<Smartphone size={30} />}
          name="Telefono"
          line={unread ? `${unread} da leggere` : "Messaggi, banca, shopping"}
          badge={unread + game.badges.banca + game.badges.contratti}
          onClick={() => go("telefono")}
          highlight={tut === 2 || tut === 3}
          testId="open-phone"
        />
        <BigTile icon={<Target size={30} />} name="Sfide" line={`🎟️ ${game.tokens}/5 gettoni`} onClick={() => go("sfide")} testId="open-sfide" />
        <BigTile icon={<Shirt size={30} />} name="Guardaroba" line={`${game.owned.length} ${game.owned.length === 1 ? "oggetto" : "oggetti"}`} onClick={() => go("guardaroba")} />
        <BigTile icon={<Trophy size={30} />} name="Carriera" line={`${seasonSummary(game).wins} vinte su ${seasonSummary(game).played}`} onClick={() => go("carriera")} />
      </div>

      {tut === 2 && <Coach className="-mt-1">Ti ha scritto Mamma: apri il telefono!</Coach>}
      {tut === 3 && <Coach className="-mt-1">Con i 100 € di Mamma compra le scarpe: Telefono → Shopping</Coach>}

      <p className="text-center text-[12.5px] text-muted">
        Conto: <b className="num text-[14px] text-text">{fmtEuro(game.money)}</b> · stipendio il lunedì
      </p>

      <Sheet open={train} onClose={() => setTrain(false)} title="Cosa alleni?">
        <div className="grid grid-cols-2 gap-2">
          {SKILLS.map((k) => (
            <button
              key={k}
              onClick={() => doDay({ kind: "allenamento", skill: k })}
              className="press sticker flex flex-col items-start rounded-2xl bg-surface px-3 py-3 text-left"
              data-testid={`train-${k}`}
            >
              <span className="flex w-full items-baseline justify-between">
                <span className="text-[16px] font-bold">{SKILL_NAMES[k]}</span>
                <span className="num text-[26px]">{game.skills[k]}</span>
              </span>
              <Meter value={game.xp[k]} max={xpNeed(game.skills[k])} color="var(--court)" className="mt-1 w-full" label={`Esperienza ${SKILL_NAMES[k]}`} />
              <span className="mt-1.5 text-[12.5px] leading-snug text-muted">{SKILL_LINE[k]}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-center text-[13px] text-muted">
          {game.perks.trainer ? "Col personal trainer vale doppio" : "Un personal trainer (in Shopping) fa valere doppio ogni allenamento"}
        </p>
      </Sheet>
    </div>
  );
}

function SeasonEnd({ onOpen }: { onOpen: () => void }) {
  const { game } = useGame();
  const s = seasonSummary(game);
  return (
    <>
      <p className="display mt-1 text-[24px] leading-tight">Fine stagione!</p>
      <p className="mt-1 text-[15px]">
        {s.wins} vinte su {s.played} · voto medio <b>{s.avg.toLocaleString("it-IT")}</b>
      </p>
      <p className="mt-1 text-[15px] font-semibold">{s.promoted ? "🚀 C'è un'offerta per salire di categoria!" : "Sono arrivate le offerte per la prossima stagione."}</p>
      <Button variant="primary" size="lg" block className="mt-3 !h-16" onClick={onOpen}>
        Guarda i contratti
      </Button>
    </>
  );
}

function DayButton({
  emoji,
  name,
  line,
  onClick,
  disabled,
  why,
  testId,
}: {
  emoji: string;
  name: string;
  line: string;
  onClick: () => void;
  disabled?: boolean;
  why?: string;
  testId?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="press sticker flex min-h-[86px] flex-col items-start rounded-2xl bg-surface px-3 py-2.5 text-left disabled:opacity-45"
    >
      <span className="text-[24px] leading-none">{emoji}</span>
      <span className="mt-1 text-[15px] font-bold leading-tight">{name}</span>
      <span className="text-[12.5px] leading-snug text-muted">{disabled && why ? why : line}</span>
    </button>
  );
}

function BigTile({
  icon,
  name,
  line,
  badge = 0,
  onClick,
  highlight,
  testId,
}: {
  icon: React.ReactNode;
  name: string;
  line: string;
  badge?: number;
  onClick: () => void;
  highlight?: boolean;
  testId?: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={clsx(
        "press sticker relative flex min-h-[104px] flex-col items-start justify-between rounded-[22px] px-3.5 py-3 text-left",
        highlight ? "game-glow bg-volt text-volt-ink" : "bg-surface",
      )}
    >
      {icon}
      <span>
        <span className="display block text-[clamp(17px,5.1vw,21px)] leading-none">{name}</span>
        <span className={clsx("mt-1 block text-[12.5px] font-semibold", highlight ? "opacity-80" : "text-muted")}>{line}</span>
      </span>
      {badge > 0 && (
        <span className="num absolute -right-1.5 -top-1.5 grid h-7 min-w-7 place-items-center rounded-full border-2 border-edge bg-danger px-1.5 text-[14px] text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}
