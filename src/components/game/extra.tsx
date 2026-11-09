"use client";

import clsx from "clsx";
import { IconLock } from "@tabler/icons-react";
import { useState } from "react";
import { Character } from "@/components/character";
import { Button } from "@/components/ui/basics";
import { play } from "@/lib/sound";
import { ITEMS, ITEM_BY_ID, SLOTS, SLOT_NAMES } from "@/lib/game/catalog";
import {
  DAILY,
  LEGA_TEAMS,
  LEVELS,
  LEVEL_ORDER,
  DAY_NAMES,
  dailyStatus,
  dow,
  fmtEuro,
  seasonSummary,
  xpNeed,
} from "@/lib/game/economy";
import { SKILL_NAMES, claimDaily, equip, levelIndex } from "@/lib/game/state";
import type { Skill, Slot } from "@/lib/game/types";
import {
  LADDER,
  LEAGUE,
  PLAYOFF,
  clubWord,
  coachScore,
  gapNote,
  interest,
  marketValue,
  moodWord,
  nextFixture,
  rank,
  standings,
  teamMood,
  teamRoster,
  type TableRow,
} from "@/lib/game/career";
import { useMyKit } from "./action";
import type { View } from "./game";
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

export function Career({ go }: { go: (v: View) => void }) {
  const { game, charId } = useGame();
  const [sel, setSel] = useState<string | null>(null);
  const [table, setTable] = useState(false);
  const sum = seasonSummary(game);
  const cur = levelIndex(game);
  const up = LEVELS[game.contract.level].up;
  const c = game.career;
  const kit = useMyKit(game, charId);
  const roster = teamRoster(game);
  const rk = rank(game);
  const next = nextFixture(game);
  const tbl = standings(game);
  const meAt = tbl.findIndex((r) => r.me);
  // La finestra della classifica: la prima, due sopra di te, tu, due sotto.
  const around = [...new Set([0, meAt - 2, meAt - 1, meAt, meAt + 1, meAt + 2].filter((k) => k >= 0 && k < tbl.length))].sort((a, b) => a - b);
  const wanted = interest(game).slice(0, 6);
  const meters = [
    { label: "Coach", v: coachScore(game), color: "var(--court)" },
    { label: "Società", v: game.club, color: "var(--ball)" },
    { label: "Squadra", v: teamMood(game), color: "var(--ok)" },
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto [&>*]:shrink-0 px-4 pb-6" data-testid="career">
      {/* Il prossimo impegno */}
      {next && (
        <div className="court rounded-[24px] px-4 pb-4 pt-3">
          <p className="text-[12.5px] font-bold text-court-ink/80">
            {next.inDays === 0 ? "Oggi" : next.inDays === 1 ? "Domani" : `Fra ${next.inDays} giorni`} · {DAY_NAMES[dow(next.day)]} · giornata {next.index + 1}
          </p>
          <p className="display mt-1 text-[24px] leading-tight">contro {next.opponent}</p>
          <p className="mt-0.5 text-[13.5px] text-court-ink/85">
            {next.home ? "In casa" : "Fuori casa"} · {next.strength > 1.07 ? "avversari forti" : next.strength < 0.93 ? "alla portata" : "avversari normali"}
          </p>
          {next.inDays === 0 && (
            <Button variant="primary" block className="mt-3" onClick={() => go(`partita:${next.index}`)}>
              Vai alla partita
            </Button>
          )}
        </div>
      )}

      {/* Il tuo ruolo in squadra */}
      <div className="card px-4 py-3">
        <p className="text-[12.5px] font-bold uppercase tracking-wide text-muted">Il tuo ruolo</p>
        <div className="mt-2 flex gap-1" role="list">
          {LADDER.map((l, k) => (
            <span
              key={l}
              role="listitem"
              className={clsx(
                "flex-1 rounded-lg border-2 border-edge px-0.5 py-1.5 text-center text-[11px] font-bold leading-tight",
                k === rk.i ? "bg-volt text-volt-ink" : k < rk.i ? "bg-ok/25" : "bg-surface text-muted",
              )}
              aria-current={k === rk.i ? "step" : undefined}
            >
              {l}
            </span>
          ))}
        </div>
        {rk.next && <p className="mt-2 text-[13.5px]">Prossimo passo: {rk.next}</p>}
        <div className="mt-3 flex flex-col gap-1.5">
          {meters.map((m) => (
            <div key={m.label} className="flex items-center gap-2 text-[13px] font-bold">
              <span className="w-16">{m.label}</span>
              <Meter value={m.v} color={m.color} className="flex-1" label={m.label} />
              <span className="num w-8 text-right">{m.v}</span>
            </div>
          ))}
          <p className="text-[12.5px] text-muted">{clubWord(game.club)}</p>
        </div>
      </div>

      {/* La squadra: chi ti passa la palla e chi no */}
      <div className="card px-4 py-3">
        <p className="text-[12.5px] font-bold uppercase tracking-wide text-muted">{game.contract.team}</p>
        <div className="mt-2 grid grid-cols-4 gap-x-1 gap-y-3">
          {roster.map((m) => {
            const w = moodWord(m.mood);
            return (
              <button key={m.name} onClick={() => setSel(sel === m.name ? null : m.name)} className="press flex flex-col items-center" aria-expanded={sel === m.name}>
                <span
                  className="num relative grid h-12 w-12 place-items-center rounded-full border-[2.5px] text-[17px]"
                  style={{ background: kit.jersey, borderColor: m.starter ? "#1d1a16" : kit.trim, color: kit.trim }}
                >
                  {m.number}
                  <span className="absolute -bottom-1 -right-2 text-[18px]" aria-label={w.line}>
                    {w.emoji}
                  </span>
                </span>
                <span className="mt-1 w-full truncate text-center text-[12px] font-semibold">{m.name}</span>
              </button>
            );
          })}
        </div>
        {sel && (
          <p className="mt-3 rounded-xl bg-raised px-3 py-2 text-[13.5px]">
            <b>{sel}</b>: {moodWord(roster.find((m) => m.name === sel)?.mood ?? 50).line}
          </p>
        )}
        <p className="mt-2 text-[12.5px] text-muted">Vincere, fare assist, dedicare i post e la pizza di squadra alzano il morale.</p>
      </div>

      {/* La classifica: dove sei, subito */}
      <div className="card px-4 py-3" data-testid="standings">
        <div className="flex items-baseline justify-between">
          <p className="text-[12.5px] font-bold uppercase tracking-wide text-muted">Classifica</p>
          <p className="num text-[22px] leading-none">{tbl[meAt]?.played ? `${meAt + 1}°` : "—"}</p>
        </div>
        <p className="mb-2 text-[13.5px] font-semibold">{gapNote(tbl)}</p>
        <TableRows rows={tbl} show={around} />
        <button onClick={() => setTable(true)} className="mt-2 text-[13px] font-bold text-court">
          Tutta la classifica →
        </button>
      </div>

      {/* Il calendario: le ultime giocate e le prossime */}
      <div className="card px-4 py-3">
        <p className="text-[12.5px] font-bold uppercase tracking-wide text-muted">Calendario</p>
        <div className="mt-2 flex flex-col">
          {game.season.matches
            .map((m, k) => ({ m, k }))
            .filter(({ k }) => {
              const n = next?.index ?? game.season.matches.length;
              return k >= n - 2 && k < n + 3;
            })
            .map(({ m, k }) => (
              <div key={k} className={clsx("flex items-center gap-2 rounded-xl px-2 py-1.5 text-[14px]", k === next?.index && "bg-volt/40 font-bold")}>
                <span className="num w-6 text-muted">{k + 1}</span>
                <span className="w-9 text-[12px] font-semibold text-muted">{DAY_NAMES[dow(m.day)].slice(0, 3)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {m.home ? "vs" : "@"} {m.opponent}
                </span>
                {m.result ? (
                  <span className={clsx("num rounded-full px-2 py-0.5 text-[13px] text-white", m.result.us > m.result.them ? "bg-ok" : "bg-danger")}>
                    {m.result.us}–{m.result.them}
                  </span>
                ) : (
                  <span className="text-[12px] text-muted">{m.day === game.day ? "oggi" : `fra ${m.day - game.day} gg`}</span>
                )}
              </div>
            ))}
        </div>
        <button onClick={() => go("telefono:calendario")} className="mt-2 text-[13px] font-bold text-court">
          Tutto il calendario →
        </button>
      </div>

      {/* Chi ti cerca */}
      <div className="card px-4 py-3" data-testid="interest">
        <div className="flex items-baseline justify-between">
          <p className="text-[12.5px] font-bold uppercase tracking-wide text-muted">Chi ti cerca</p>
          <p className="text-[12.5px] font-semibold text-muted">
            Valore <b className="num text-[17px] text-text">{fmtEuro(marketValue(game))}</b>
          </p>
        </div>
        <div className="mt-2 flex flex-col gap-2">
          {wanted.map((w) => (
            <div key={w.team} className="rounded-2xl border-2 border-line px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-[20px]" aria-hidden>
                  {LEAGUE[w.league].flag}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-bold">{w.team}</span>
                  <span className="block text-[11.5px] font-semibold text-muted">{LEAGUE[w.league].name}</span>
                </span>
                <span className="num text-[20px]">{w.pct}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-raised">
                <div className={clsx("h-full rounded-full", w.pct >= 70 ? "bg-ok" : w.pct >= 35 ? "bg-volt" : "bg-line-strong")} style={{ width: `${w.pct}%` }} />
              </div>
              <p className="mt-1 text-[12px] text-muted">
                <b className={clsx(w.pct >= 70 ? "text-ok" : "text-text")}>{w.stage}</b>
                {w.wants ? ` · ${w.wants}` : " · a fine stagione può arrivare l'offerta"}
              </p>
            </div>
          ))}
        </div>
      </div>

      <Sheet open={table} onClose={() => setTable(false)} title={`Classifica · ${LEVELS[game.contract.level].name}`}>
        <TableRows rows={tbl} show={tbl.map((_, k) => k)} />
      </Sheet>

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
              {k > cur && <IconLock size={18} />}
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
            <IconLock size={18} />
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

function TableRows({ rows, show }: { rows: TableRow[]; show: number[] }) {
  return (
    <div className="flex flex-col">
      <div className="flex gap-2 px-2 pb-1 text-[11px] font-bold text-muted">
        <span className="w-6">#</span>
        <span className="flex-1">Squadra</span>
        <span className="w-12 text-center">V–P</span>
        <span className="w-8 text-right">Pt</span>
      </div>
      {show.map((k, n) => {
        const r = rows[k];
        const gap = n > 0 && k - show[n - 1] > 1;
        return (
          <div key={r.team}>
            {gap && <div className="py-0.5 text-center text-[11px] text-muted">···</div>}
            {k === PLAYOFF && <div className="my-1 border-t-2 border-dashed border-ok" aria-label="Linea dei playoff" />}
            <div className={clsx("flex items-center gap-2 rounded-xl px-2 py-1.5 text-[14px]", r.me && "bg-volt font-bold text-volt-ink")}>
              <span className="num w-6">{k + 1}</span>
              <span className="min-w-0 flex-1 truncate">{r.team}</span>
              <span className="num w-12 text-center">
                {r.won}–{r.lost}
              </span>
              <span className="num w-8 text-right">{r.points}</span>
            </div>
          </div>
        );
      })}
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
          toast(`Premio: ${r.label}`, "ok", "coins");
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
