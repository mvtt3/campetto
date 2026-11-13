"use client";

import clsx from "clsx";
import {
  IconArrowUpRight,
  IconBallBasketball,
  IconBolt,
  IconChartPie,
  IconFlame,
  IconTarget,
  IconTrendingUp,
  IconTrophy,
  IconUsersGroup,
} from "@tabler/icons-react";
import { memo, type CSSProperties, type ReactNode } from "react";
import { useData } from "@/lib/data/provider";
import type { StudioScreen, StudioTile } from "@/lib/studio";
import { shortName, type Player } from "@/lib/types";
import { Character, characterOf } from "../character";
import { Logo } from "../mascot";
import { Avatar, playerColor } from "../ui/avatar";
import { CourtLines } from "../ui/basics";

/** Ritardo di un pezzo della grafica, da quando la grafica compare. */
const at = (d: number): CSSProperties => ({ ["--d" as string]: `${d}s` });

/**
 * Un numero che conta fino al valore: lo aggiorna il player a ogni fotogramma
 * (data-at: secondi dall'inizio della grafica), così segue pause e salti.
 */
export function Count({ to, d, prefix, suffix }: { to: number; d: number; prefix?: string; suffix?: string }) {
  return (
    <span className="tnum">
      {prefix}
      <span data-to={to} data-at={d}>
        {to}
      </span>
      {suffix}
    </span>
  );
}

/** Il titoletto in alto, come le etichette delle schede dell'app. */
function Chip({ children, d = 0, tone = "glass", icon: Icon = IconBallBasketball }: { children: ReactNode; d?: number; tone?: "glass" | "volt" | "ink"; icon?: typeof IconBolt }) {
  return (
    <p
      className={clsx(
        "studio-in inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold",
        tone === "volt" && "bg-volt text-volt-ink",
        tone === "glass" && "bg-white/20 text-white",
        tone === "ink" && "bg-[#1d1a16] text-white",
      )}
      style={at(d)}
    >
      <Icon size={15} stroke={2.2} aria-hidden />
      {children}
    </p>
  );
}

/** Riquadro "vetro" come quelli della Home (Il tuo mese) e della scheda MVP. */
function Tile({ tile, d, light, solid }: { tile: StudioTile; d: number; light?: boolean; solid?: boolean }) {
  return (
    <div
      className={clsx(
        "studio-in min-w-0 rounded-[18px] px-2.5 pb-2 pt-2",
        light
          ? "border border-white/50 bg-white/50 text-[#1d1a16]"
          : solid
            ? "border border-white/20 bg-[#1d1a16]/35 text-white"
            : "border border-white/15 bg-white/15 text-white",
      )}
      style={at(d)}
    >
      <p className="score text-[30px] leading-none">
        <Count to={tile.value} d={d + 0.1} prefix={tile.prefix} suffix={tile.suffix} />
      </p>
      <p className={clsx("mt-1 text-[11.5px] font-semibold leading-tight", light ? "text-[#1d1a16]/70" : "text-white/75")}>{tile.label}</p>
      {tile.note && <p className={clsx("text-[11px] leading-tight", light ? "text-[#1d1a16]/55" : "text-white/55")}>{tile.note}</p>}
    </div>
  );
}

/** Fondo blu campo della Home: macchie di luce gialla e arancio, linee del campo. */
function CourtBg() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden" style={{ background: "linear-gradient(160deg, var(--court) 0%, var(--court-deep) 100%)" }}>
      <span className="blob -right-16 -top-20 h-56 w-56 bg-[radial-gradient(circle,rgb(255_197_49/0.45),transparent_68%)]" />
      <span className="blob -bottom-24 -left-16 h-60 w-60 bg-[radial-gradient(circle,rgb(242_106_27/0.35),transparent_70%)]" />
      <CourtLines className="absolute inset-0 h-full w-full opacity-80" />
    </div>
  );
}

/** Fondo del giocatore: il suo colore con luci e righe, come il banner del profilo. */
function PlayerBg({ player }: { player?: Player }) {
  const tint = player ? playerColor(player) : "#2D5BE3";
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden" style={{ backgroundColor: tint }}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_12%_8%,rgb(255_255_255/0.35),transparent_60%),radial-gradient(ellipse_50%_45%_at_76%_48%,rgb(255_255_255/0.3),transparent_65%),linear-gradient(170deg,transparent_30%,rgb(0_0_0/0.55))]" />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(115deg,rgb(255_255_255/0.08)_0_2px,transparent_2px_14px)] [mask-image:linear-gradient(to_left,#000,transparent_75%)]" />
      <span className="blob -bottom-24 right-6 h-64 w-64 bg-[radial-gradient(circle,rgb(255_197_49/0.3),transparent_70%)]" />
    </div>
  );
}

/** Il personaggio del giocatore, con l'ombra a terra. */
function Figure({ player, height, d = 0.15 }: { player?: Player; height: number; d?: number }) {
  if (!player) return null;
  return (
    <span className="studio-pop relative block drop-shadow-[0_12px_18px_rgb(0_0_0/0.35)]" style={at(d)}>
      <Character id={characterOf(player)} outfit={player.outfit} number={player.jerseyNumber} height={height} idle />
    </span>
  );
}

/**
 * Le grafiche del maxischermo, disegnate a 330×400 con lo stile attuale dell'app:
 * schede morbide, blu campo, giallo MVP, colore del giocatore, numeri grandi e riquadri vetro.
 */
export const StudioScreenView = memo(function StudioScreenView({ screen }: { screen: StudioScreen }) {
  return (
    <div className="relative h-[400px] w-[330px] overflow-hidden text-white">
      <Body screen={screen} />
    </div>
  );
});

function Body({ screen }: { screen: StudioScreen }) {
  const { data } = useData();
  const player = (id: string) => data.players.find((p) => p.id === id);
  const name = (id: string) => shortName(player(id));

  switch (screen.kind) {
    case "sigla":
      // Solo il badge, in alto: nei primi piani del maxischermo si vede la parte bassa, e lì c'è solo il campo.
      return (
        <>
          <CourtBg />
          <div className="relative flex h-full items-start justify-center pt-[62px]">
            <span className="studio-pop drop-shadow-[0_14px_24px_rgb(0_0_0/0.35)]" style={at(0.05)}>
              <Logo size={168} top="STUDIO" bottom="★ CAMPETTO ★" />
            </span>
          </div>
        </>
      );

    case "risultati":
      return (
        <div className="absolute inset-0 flex flex-col bg-[#FFFAF0] px-4 pb-4 pt-4 text-[#1d1a16]">
          <Chip tone="ink">I risultati</Chip>
          <ol className="mt-3 flex flex-1 flex-col justify-between">
            {screen.games.map((g, i) => {
              const aWon = g.sa > g.sb;
              return (
                <li key={i}>
                  {screen.turn === i && (
                    <div className="studio-in my-1 flex items-center gap-2" style={at(0.25 + i * 0.18)}>
                      <span className="h-px flex-1 bg-[#1d1a16]/15" />
                      <span className="rounded-full bg-ball px-2 py-0.5 text-[11px] font-bold text-white">La svolta</span>
                      <span className="h-px flex-1 bg-[#1d1a16]/15" />
                    </div>
                  )}
                  <div className="studio-in flex items-center gap-2 rounded-[16px] bg-[#F2E8D5]/70 px-2.5 py-1.5" style={at(0.3 + i * 0.18)}>
                    <span className="tnum w-3.5 shrink-0 text-[12px] font-bold text-[#1d1a16]/45">{i + 1}</span>
                    <Team ids={g.a} won={aWon} name={name} />
                    <span className="score shrink-0 text-[21px]">
                      <span className={aWon ? "text-[#1d1a16]" : "text-[#1d1a16]/35"}>{g.sa}</span>
                      <span className="text-[#1d1a16]/30">–</span>
                      <span className={!aWon ? "text-[#1d1a16]" : "text-[#1d1a16]/35"}>{g.sb}</span>
                    </span>
                    <Team ids={g.b} won={!aWon} name={name} right />
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      );

    case "quota": {
      const p = player(screen.playerId);
      const share = screen.value / screen.total;
      const pct = Math.round(share * 100);
      const r = 46;
      const len = 2 * Math.PI * r;
      return (
        <div className="mvp-hero absolute inset-0 text-volt-ink">
          <span className="mvp-rays absolute -left-28 -top-16 h-96 w-96" aria-hidden />
          <span className="mvp-word display pointer-events-none absolute -bottom-6 -right-2 text-[120px] leading-none" aria-hidden>
            MVP
          </span>
          <div className="relative flex h-full flex-col px-4 pb-4 pt-4">
            <Chip tone="ink" icon={IconFlame}>
              {screen.kicker}
            </Chip>
            <div className="mt-2 flex items-end gap-1">
              <span className="-mb-2 -ml-3 shrink-0">
                <Figure player={p} height={170} />
              </span>
              <div className="min-w-0 flex-1 pb-2">
                <p className="studio-in display truncate text-[30px] leading-[1.05]" style={at(0.25)}>
                  {name(screen.playerId)}
                </p>
                <div className="mt-2 flex items-center gap-2.5">
                  {/* La fetta della serata: quanti punti su tutti quelli segnati. */}
                  <svg viewBox="0 0 110 110" className="h-[92px] w-[92px] shrink-0 -rotate-90" aria-hidden>
                    <circle cx="55" cy="55" r={r} fill="none" stroke="rgb(255 255 255 / 0.45)" strokeWidth="13" />
                    <circle
                      className="studio-ring"
                      cx="55"
                      cy="55"
                      r={r}
                      fill="none"
                      stroke="#1d1a16"
                      strokeWidth="13"
                      strokeLinecap="round"
                      strokeDasharray={len}
                      style={{ ...at(0.55), ["--from" as string]: `${len}`, ["--to" as string]: `${len * (1 - share)}` }}
                    />
                  </svg>
                  <div className="min-w-0">
                    <p className="score text-[38px] leading-none">
                      <Count to={pct} d={0.55} suffix="%" />
                    </p>
                    <p className="mt-1 text-[12px] font-semibold leading-tight text-[#1d1a16]/75">{screen.label}</p>
                  </div>
                </div>
                <p className="studio-in mt-2 text-[13px] font-bold" style={at(0.9)}>
                  {screen.value} {screen.unit} su {screen.total}
                </p>
              </div>
            </div>
            <div className="mt-auto grid grid-cols-3 gap-2">
              {screen.tiles.map((t, i) => (
                <Tile key={t.label} tile={t} d={1.1 + i * 0.15} light />
              ))}
            </div>
          </div>
        </div>
      );
    }

    case "record": {
      const p = player(screen.playerId);
      return (
        <>
          <PlayerBg player={p} />
          <span
            aria-hidden
            className="display pointer-events-none absolute -right-3 -top-6 bg-linear-to-b from-white/45 via-white/20 to-white/0 bg-clip-text text-[170px] leading-none text-transparent"
          >
            {screen.items[0]?.value}
          </span>
          <div className="relative flex h-full flex-col px-4 pb-4 pt-4">
            <Chip tone="volt" icon={IconTrophy}>
              {screen.kicker}
            </Chip>
            <div className="mt-2 flex items-center gap-2">
              <Avatar player={p} size={34} href={false} ring="none" />
              <p className="studio-in display text-[26px] leading-none" style={at(0.2)}>
                {name(screen.playerId)}
              </p>
            </div>
            <ul className="mt-auto flex flex-col gap-2">
              {screen.items.map((it, i) => (
                <li key={it.label} className="studio-in flex items-center gap-3 rounded-[18px] border border-white/15 bg-white/15 px-3 py-2" style={at(0.45 + i * 0.35)}>
                  <p className="score w-[74px] shrink-0 text-[40px] leading-none">
                    <Count to={it.value} d={0.5 + i * 0.35} />
                  </p>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-bold leading-tight">{it.label}</p>
                    <p className="mt-0.5 text-[12px] font-medium text-white/70 line-through decoration-white/60">{it.before}</p>
                  </div>
                  <span className="studio-pop shrink-0 rounded-full bg-volt px-2 py-0.5 text-[11px] font-bold text-volt-ink" style={at(0.9 + i * 0.35)}>
                    Nuovo
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      );
    }

    case "serie": {
      const p = player(screen.playerId);
      const dots = [...Array.from({ length: screen.wins }, () => "V"), "S"];
      return (
        <>
          <CourtBg />
          <div className="relative flex h-full flex-col px-4 pb-4 pt-4">
            <Chip icon={IconBolt}>{screen.kicker}</Chip>
            <div className="mt-3 flex items-center gap-3">
              <Avatar player={p} size={40} href={false} ring="none" />
              <div>
                <p className="studio-in display text-[24px] leading-none" style={at(0.15)}>
                  {name(screen.playerId)}
                </p>
                <p className="studio-in text-[13px] font-medium text-white/75" style={at(0.25)}>
                  imbattuto dal {screen.since}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-end gap-2">
              <p className="score text-[96px] leading-[0.85] text-volt">
                <Count to={screen.wins} d={0.3} />
              </p>
              <p className="studio-in mb-2 text-[18px] font-bold leading-tight" style={at(0.6)}>
                {screen.label}
              </p>
            </div>
            {/* Come la "forma" nel profilo: V per ogni vittoria, poi lo stop. */}
            <div className="mt-auto grid grid-cols-5 gap-1.5">
              {dots.map((r, i) => (
                <span
                  key={i}
                  className={clsx(
                    "studio-pop grid h-[34px] place-items-center rounded-full text-[13px] font-bold",
                    r === "V" ? "bg-volt text-volt-ink" : "bg-white/25 text-white ring-2 ring-white/60",
                  )}
                  style={at(0.7 + i * 0.09)}
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        </>
      );
    }

    case "giocatore": {
      const p = player(screen.playerId);
      return (
        <>
          <PlayerBg player={p} />
          {/* Il personaggio a destra, sopra i riquadri (che restano davanti e interi). */}
          <span className="absolute right-1 top-[58px]" aria-hidden>
            <Figure player={p} height={178} />
          </span>
          <div className="relative flex h-full flex-col px-4 pb-4 pt-4">
            <Chip tone="volt" icon={IconTarget}>
              {screen.kicker}
            </Chip>
            <p className="studio-in display mt-2 text-[28px] leading-none" style={at(0.15)}>
              {name(screen.playerId)}
            </p>
            <p className="score mt-3 text-[92px] leading-[0.85] drop-shadow-[0_4px_18px_rgb(0_0_0/0.25)]">
              <Count to={screen.big.value} d={0.35} />
            </p>
            <p className="studio-in mt-1 max-w-[60%] text-[15px] font-bold leading-tight" style={at(0.7)}>
              {screen.big.label}
            </p>
            {screen.big.before && (
              <p className="studio-in mt-1 max-w-[60%] text-[12.5px] font-medium text-white/75" style={at(0.9)}>
                {screen.big.before}
              </p>
            )}
            <div className="relative mt-auto grid grid-cols-3 gap-2">
              {screen.tiles.map((t, i) => (
                <Tile key={t.label} tile={t} d={1.1 + i * 0.15} solid />
              ))}
            </div>
          </div>
        </>
      );
    }

    case "tiro": {
      const best = Math.max(...screen.rows.map((r) => r.made / r.att));
      const three = screen.three;
      return (
        <div className="absolute inset-0 flex flex-col bg-[#FFFAF0] px-4 pb-4 pt-4 text-[#1d1a16]">
          <Chip tone="ink" icon={IconTarget}>
            {screen.kicker}
          </Chip>
          <p className="studio-in mt-2 text-[13px] font-semibold text-[#1d1a16]/60" style={at(0.1)}>
            Tiri segnati sui tentati, tutta la serata
          </p>
          <ul className="mt-2 flex flex-1 flex-col justify-around">
            {screen.rows.map((r, i) => {
              const pct = r.made / r.att;
              const top = pct === best;
              return (
                <li key={r.playerId} className="studio-in" style={at(0.25 + i * 0.15)}>
                  <div className="flex items-center gap-2">
                    <Avatar player={player(r.playerId)} size={24} href={false} ring="none" />
                    <span className="min-w-0 flex-1 truncate text-[14px] font-bold">{name(r.playerId)}</span>
                    <span className="tnum text-[12px] font-medium text-[#1d1a16]/55">
                      {r.made}/{r.att}
                    </span>
                    <span className={clsx("score w-12 text-right text-[20px]", top ? "text-ball" : "text-[#1d1a16]")}>
                      <Count to={Math.round(pct * 100)} d={0.4 + i * 0.15} suffix="%" />
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[#F2E8D5]">
                    <span
                      className={clsx("studio-grow block h-full rounded-full", top ? "bg-linear-to-r from-[#ffb73a] to-ball" : "bg-[#1d1a16]/25")}
                      style={{ ...at(0.4 + i * 0.15), width: `${Math.round(pct * 100)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          {three && (
            <div className="studio-in mt-2 rounded-[16px] bg-[#F2E8D5] px-3 py-2" style={at(1.3)}>
              <p className="text-[12.5px] font-bold leading-tight">
                Da tre: {three.att} dei {three.total} tiri della serata sono di {name(three.playerId)}
              </p>
              {/* La barra di tutti i tiri da tre: la parte sua, poi gli altri. */}
              <div className="mt-1.5 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
                <span className="studio-grow block rounded-full bg-court" style={{ ...at(1.45), flexGrow: three.att }} />
                <span className="block rounded-full bg-[#1d1a16]/15" style={{ flexGrow: three.total - three.att }} />
              </div>
            </div>
          )}
        </div>
      );
    }

    case "elo": {
      // La classifica si riordina: chi sale scivola su, chi scende scivola giù.
      const rows = [...screen.rows].sort((a, b) => a.rank - b.rank);
      return (
        <div className="absolute inset-0 flex flex-col bg-[#FFFAF0] px-4 pb-4 pt-4 text-[#1d1a16]">
          <Chip tone="ink" icon={IconTrophy}>
            {screen.kicker}
          </Chip>
          <p className="studio-in mt-2 text-[13px] font-semibold text-[#1d1a16]/60" style={at(0.1)}>
            I primi tre dopo la serata
          </p>
          <ul className="relative mt-3 flex flex-col gap-2">
            {rows.map((r, i) => {
              const moved = r.before - r.rank;
              return (
                <li
                  key={r.playerId}
                  className={clsx("studio-swap flex h-[64px] items-center gap-3 rounded-[18px] px-3", r.rank === 1 ? "bg-volt" : "bg-[#F2E8D5]")}
                  style={{ ...at(0.2 + i * 0.12), ["--shift" as string]: `${(r.before - r.rank) * 72}px` }}
                >
                  <span className="score w-7 text-[28px]">{r.rank}</span>
                  <Avatar player={player(r.playerId)} size={36} href={false} ring="none" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-bold leading-tight">{name(r.playerId)}</p>
                    <p className="tnum text-[12.5px] font-medium text-[#1d1a16]/60">{r.after} punti</p>
                  </div>
                  {r.delta !== 0 && (
                    <span className="studio-pop inline-flex items-center gap-0.5 rounded-full bg-[#2E9E5B] px-2 py-0.5 text-[12px] font-bold text-white" style={at(1.4 + i * 0.1)}>
                      +{r.delta}
                    </span>
                  )}
                  {moved > 0 && (
                    <span className="studio-pop inline-flex items-center gap-0.5 rounded-full bg-[#1d1a16] px-2 py-0.5 text-[11.5px] font-bold text-white" style={at(1.6)}>
                      <IconArrowUpRight size={13} stroke={2.6} aria-hidden />
                      {r.before}°→{r.rank}°
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      );
    }

    case "numeri":
      return (
        <>
          <CourtBg />
          <div className="relative flex h-full flex-col px-4 pb-4 pt-4">
            <Chip icon={IconBallBasketball}>{screen.kicker}</Chip>
            <ul className="mt-3 flex flex-1 flex-col justify-around gap-2">
              {screen.tiles.map((t, i) => (
                <li key={t.label} className="studio-in flex items-center gap-3 rounded-[20px] border border-white/15 bg-white/15 px-4 py-2.5" style={at(0.2 + i * 0.3)}>
                  <p className={clsx("score w-[112px] shrink-0 text-[50px] leading-none", i === 0 && "text-volt")}>
                    <Count to={t.value} d={0.25 + i * 0.3} prefix={t.prefix} />
                  </p>
                  <p className="text-[14px] font-bold leading-tight">{t.label}</p>
                </li>
              ))}
            </ul>
          </div>
        </>
      );

    case "torta": {
      // Una ciambella con i colori dei giocatori (come i loro avatar) e la legenda sotto.
      const total = screen.slices.reduce((a, x) => a + x.value, 0) || 1;
      const slices = [...screen.slices].sort((a, b) => b.value - a.value);
      const r = 62;
      const len = 2 * Math.PI * r;
      // Dove comincia ogni fetta (somma di quelle prima).
      const starts = slices.map((_, i) => slices.slice(0, i).reduce((a, x) => a + x.value, 0));
      return (
        <div className="absolute inset-0 flex flex-col bg-[#FFFAF0] px-4 pb-4 pt-4 text-[#1d1a16]">
          <Chip tone="ink" icon={IconChartPie}>
            {screen.kicker}
          </Chip>
          <p className="studio-in display mt-2 text-[21px] leading-[1.1]" style={at(0.1)}>
            {screen.title}
          </p>
          <div className="mt-3 flex items-center gap-2.5">
            <div className="relative h-[150px] w-[150px] shrink-0">
              <svg viewBox="0 0 150 150" className="h-full w-full -rotate-90" aria-hidden>
                <circle cx="75" cy="75" r={r} fill="none" stroke="#F2E8D5" strokeWidth="22" />
                {slices.map((x, i) => {
                  const f = x.value / total;
                  const seg = Math.max(0, f * len - 3);
                  const rot = (starts[i] / total) * 360;
                  const p = player(x.playerId);
                  return (
                    <circle
                      key={x.playerId}
                      className="studio-ring"
                      cx="75"
                      cy="75"
                      r={r}
                      fill="none"
                      stroke={p ? playerColor(p) : "#2D5BE3"}
                      strokeWidth="22"
                      strokeDasharray={`${seg} ${len}`}
                      transform={`rotate(${rot} 75 75)`}
                      style={{ ...at(0.3 + i * 0.22), ["--from" as string]: `${seg}`, ["--to" as string]: "0" }}
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 grid place-items-center text-center">
                <div>
                  <p className="score text-[34px] leading-none">
                    <Count to={total} d={0.3} />
                  </p>
                  <p className="text-[11.5px] font-semibold text-[#1d1a16]/60">{screen.unit}</p>
                </div>
              </div>
            </div>
            <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
              {slices.map((x, i) => {
                const p = player(x.playerId);
                return (
                  <li key={x.playerId} className="studio-in flex items-center gap-2" style={at(0.45 + i * 0.22)}>
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p ? playerColor(p) : "#2D5BE3" }} />
                    <span className={clsx("min-w-0 flex-1 truncate text-[14px]", i === 0 ? "font-bold" : "font-semibold")}>{name(x.playerId)}</span>
                    <span className="score text-[20px] leading-none">{x.value}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          {/* La fetta più grande in percentuale, in evidenza. */}
          <div className="studio-in mt-auto flex items-center gap-3 rounded-[18px] bg-volt px-3 py-2.5 text-volt-ink" style={at(1.4)}>
            <Avatar player={player(slices[0].playerId)} size={34} href={false} ring="none" />
            <p className="min-w-0 flex-1 text-[13.5px] font-bold leading-tight">
              {name(slices[0].playerId)}, da solo
            </p>
            <p className="score text-[30px] leading-none">
              <Count to={Math.round((slices[0].value / total) * 100)} d={1.45} suffix="%" />
            </p>
          </div>
        </div>
      );
    }

    case "coppie": {
      // Le coppie: chi vince di più insieme. In giallo la migliore, in arancio la peggiore.
      // Con tante righe si stringe, così ci stanno tutte (e la nota sotto).
      const dense = screen.rows.length > 5;
      return (
        <div className="absolute inset-0 flex flex-col bg-[#FFFAF0] px-4 pb-4 pt-4 text-[#1d1a16]">
          <Chip tone="ink" icon={IconUsersGroup}>
            {screen.kicker}
          </Chip>
          <p className="studio-in display mt-2 text-[21px] leading-[1.1]" style={at(0.1)}>
            {screen.title}
          </p>
          <ul className={clsx("flex flex-1 flex-col justify-around", dense ? "mt-1.5 gap-0.5" : "mt-2.5 gap-1")}>
            {screen.rows.map((r, i) => {
              const pct = r.g ? r.w / r.g : 0;
              const top = r.tone === "top";
              const flop = r.tone === "flop";
              return (
                <li key={r.a + r.b} className={clsx("studio-in rounded-[16px] px-2.5", dense ? "py-1" : "py-1.5", top ? "bg-volt/35" : flop ? "bg-ball/12" : "")} style={at(0.25 + i * 0.16)}>
                  <div className="flex items-center gap-2">
                    <span className="flex shrink-0">
                      <Avatar player={player(r.a)} size={24} href={false} ring="none" />
                      <span className="-ml-2 rounded-full ring-2 ring-[#FFFAF0]">
                        <Avatar player={player(r.b)} size={24} href={false} ring="none" />
                      </span>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold">
                      {name(r.a)} e {name(r.b)}
                    </span>
                    <span className="tnum shrink-0 text-[12px] font-semibold text-[#1d1a16]/60">
                      {r.w} su {r.g}
                    </span>
                    <span className={clsx("score w-11 shrink-0 text-right text-[19px] leading-none", top ? "text-[#1d1a16]" : flop ? "text-ball" : "")}>
                      <Count to={Math.round(pct * 100)} d={0.35 + i * 0.16} suffix="%" />
                    </span>
                  </div>
                  <div className={clsx("flex items-center gap-2", dense ? "mt-0.5" : "mt-1")}>
                    <div className={clsx("flex-1 overflow-hidden rounded-full bg-[#F2E8D5]", dense ? "h-2" : "h-2.5")}>
                      <span
                        className={clsx("studio-grow block h-full rounded-full", top ? "bg-linear-to-r from-[#ffd75a] to-[#f5b400]" : flop ? "bg-ball" : "bg-[#1d1a16]/30")}
                        style={{ ...at(0.35 + i * 0.16), width: `${Math.max(3, Math.round(pct * 100))}%` }}
                      />
                    </div>
                    {r.tag && (
                      <span className={clsx("studio-pop shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold", top ? "bg-[#1d1a16] text-white" : "bg-ball text-white")} style={at(1.1 + i * 0.1)}>
                        {r.tag}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {screen.note && (
            <p className="studio-in mt-1 text-[11.5px] font-medium text-[#1d1a16]/55" style={at(1.3)}>
              {screen.note}
            </p>
          )}
        </div>
      );
    }

    case "forma": {
      // Chi sale e chi scende: la differenza dalla propria media, barre a destra (meglio, in
      // giallo) o a sinistra (peggio, in arancio) di una linea centrale.
      const dec = (v: number) => v.toFixed(1).replace(".", ",");
      const rows = [...screen.rows].sort((a, b) => (b.before === null ? -1e9 : b.now - b.before) - (a.before === null ? -1e9 : a.now - a.before));
      const maxD = Math.max(1, ...rows.filter((r) => r.before !== null).map((r) => Math.abs(r.now - (r.before ?? 0))));
      return (
        <div className="absolute inset-0 flex flex-col bg-[#FFFAF0] px-4 pb-4 pt-4 text-[#1d1a16]">
          <Chip tone="ink" icon={IconTrendingUp}>
            {screen.kicker}
          </Chip>
          <p className="studio-in display mt-2 text-[21px] leading-[1.1]" style={at(0.1)}>
            {screen.title}
          </p>
          <ul className="mt-3 flex flex-1 flex-col justify-around gap-1.5">
            {rows.map((r, i) => {
              const d = r.before === null ? null : r.now - r.before;
              const up = d !== null && d >= 0;
              const w = d === null ? 0 : (Math.abs(d) / maxD) * 50;
              return (
                <li key={r.playerId} className="studio-in" style={at(0.3 + i * 0.18)}>
                  <div className="flex items-center gap-2">
                    <Avatar player={player(r.playerId)} size={26} href={false} ring="none" />
                    <span className="min-w-0 flex-1 truncate text-[14px] font-bold">{name(r.playerId)}</span>
                    <span className="tnum shrink-0 text-[12.5px] font-semibold text-[#1d1a16]/55">
                      {r.before === null ? `${dec(r.now)} a partita` : `${dec(r.before)} → ${dec(r.now)}`}
                    </span>
                    <span
                      className={clsx(
                        "studio-pop shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold",
                        d === null ? "bg-court text-white" : up ? "bg-volt text-volt-ink" : "bg-ball text-white",
                      )}
                      style={at(0.6 + i * 0.18)}
                    >
                      {d === null ? "Esordio" : `${up ? "+" : "−"}${dec(Math.abs(d))}`}
                    </span>
                  </div>
                  {/* Linea centrale = la sua media di prima. */}
                  <div className="relative mt-1.5 h-2.5 rounded-full bg-[#F2E8D5]">
                    <span className="absolute inset-y-[-3px] left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-[#1d1a16]/35" aria-hidden />
                    {d !== null && (
                      <span
                        className={clsx("studio-grow absolute inset-y-0 rounded-full", up ? "left-1/2 bg-linear-to-r from-[#ffd75a] to-[#f5b400]" : "right-1/2 origin-right bg-ball")}
                        style={{ ...at(0.45 + i * 0.18), width: `${Math.max(3, w)}%` }}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {screen.note && (
            <p className="studio-in mt-2 text-[11.5px] font-medium text-[#1d1a16]/55" style={at(1.3)}>
              {screen.note}
            </p>
          )}
        </div>
      );
    }

    case "intesa": {
      // Con chi vince di più: una barra per compagno e la linea della sua media.
      const p = player(screen.playerId);
      const avg = Math.round(screen.avg * 100);
      return (
        <>
          <PlayerBg player={p} />
          <div className="relative flex h-full flex-col px-4 pb-4 pt-4">
            <Chip tone="volt" icon={IconUsersGroup}>
              {screen.kicker}
            </Chip>
            <div className="mt-2 flex items-center gap-2">
              <Avatar player={p} size={34} href={false} ring="none" />
              <p className="studio-in display text-[24px] leading-none" style={at(0.15)}>
                {name(screen.playerId)}
              </p>
            </div>
            <p className="studio-in mt-1 text-[12.5px] font-medium text-white/75" style={at(0.25)}>
              Vittorie con ogni compagno
            </p>
            <div className="relative mt-3 flex flex-1 flex-col justify-around">
              {/* La media del giocatore: sopra la linea si vince più del solito. */}
              <span className="pointer-events-none absolute bottom-0 top-0 border-l-2 border-dashed border-white/70" style={{ left: `calc(84px + (100% - 84px - 44px) * ${screen.avg})` }} aria-hidden />
              {screen.rows.map((r, i) => {
                const pct = r.g ? r.w / r.g : 0;
                const up = pct > screen.avg;
                return (
                  <div key={r.playerId} className="studio-in flex items-center gap-2" style={at(0.35 + i * 0.16)}>
                    <span className="flex w-[76px] shrink-0 items-center gap-1.5">
                      <Avatar player={player(r.playerId)} size={22} href={false} ring="none" />
                      <span className="truncate text-[12.5px] font-bold">{name(r.playerId)}</span>
                    </span>
                    <div className="h-4 flex-1 overflow-hidden rounded-full bg-white/15">
                      <span className={clsx("studio-grow block h-full rounded-full", up ? "bg-volt" : "bg-white/55")} style={{ ...at(0.4 + i * 0.16), width: `${Math.max(4, Math.round(pct * 100))}%` }} />
                    </div>
                    <span className="score w-10 shrink-0 text-right text-[17px] leading-none">
                      {r.w}/{r.g}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="studio-in mt-2 text-[12px] font-semibold text-white/80" style={at(1.2)}>
              La linea: la sua media, {avg}% di vittorie
            </p>
          </div>
        </>
      );
    }

    case "replay":
      // I canestri vanno a tutto schermo: li mostra il player.
      return <CourtBg />;
  }
}

function Team({ ids, won, name, right }: { ids: string[]; won: boolean; name: (id: string) => string; right?: boolean }) {
  return (
    <span className={clsx("flex min-w-0 flex-1 flex-col text-[13px] leading-tight", right ? "items-end text-right" : "items-start", won ? "font-bold" : "font-medium text-[#1d1a16]/50")}>
      {ids.map((id) => (
        <span key={id} className="max-w-full truncate">
          {name(id)}
        </span>
      ))}
    </span>
  );
}
