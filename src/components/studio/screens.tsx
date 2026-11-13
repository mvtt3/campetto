"use client";

import clsx from "clsx";
import { IconBallBasketball, IconTrophy } from "@tabler/icons-react";
import type { CSSProperties, ReactNode } from "react";
import { useData } from "@/lib/data/provider";
import type { StudioScreen } from "@/lib/studio";
import { shortName } from "@/lib/types";
import { Character, characterOf } from "../character";
import { Avatar, playerColor } from "../ui/avatar";

/** Ritardo di un pezzo della grafica, da quando la grafica compare. */
const at = (d: number): CSSProperties => ({ ["--d" as string]: `${d}s` });

/**
 * Un numero che conta fino al valore: lo aggiorna il player a ogni fotogramma
 * (data-at: secondi dall'inizio della grafica), così segue pause e salti.
 */
function Count({ to, d, suffix }: { to: number; d: number; suffix?: string }) {
  return (
    <span className="tnum">
      <span data-to={to} data-at={d}>
        {to}
      </span>
      {suffix}
    </span>
  );
}

function Kicker({ children, d = 0 }: { children: ReactNode; d?: number }) {
  return (
    <p className="studio-in inline-flex items-center gap-1.5 rounded-full bg-volt px-3 py-1 text-[13px] font-bold text-volt-ink" style={at(d)}>
      <IconBallBasketball size={15} stroke={2.2} aria-hidden />
      {children}
    </p>
  );
}

/**
 * Le grafiche del maxischermo, disegnate a 330×400 come una schermata da TV sportiva:
 * fondo blu notte, titoletto giallo, numeri grandi. Ogni pezzo entra con il suo ritardo.
 */
export function StudioScreenView({ screen, day }: { screen: StudioScreen; day: string }) {
  return (
    <div className="relative h-[400px] w-[330px] overflow-hidden bg-[#0C1736] text-white">
      {/* Griglia dei led e una luce che passa. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "linear-gradient(rgb(255 255 255 / 0.5) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.5) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div aria-hidden className="absolute -top-24 left-1/2 h-64 w-[420px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgb(61_106_240/0.55),transparent_70%)]" />
      <div className="relative flex h-full flex-col px-5 pb-5 pt-5">
        <Body screen={screen} day={day} />
      </div>
    </div>
  );
}

function Body({ screen, day }: { screen: StudioScreen; day: string }) {
  const { data } = useData();
  const player = (id: string) => data.players.find((p) => p.id === id);
  const name = (id: string) => shortName(player(id));

  switch (screen.kind) {
    case "sigla": {
      const date = new Date(`${day}T12:00:00`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
      return (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <span className="studio-pop grid h-20 w-20 place-items-center rounded-full bg-ball text-white shadow-[0_0_40px_rgb(242_106_27/0.6)]" style={at(0.1)}>
            <IconBallBasketball size={48} stroke={1.8} aria-hidden />
          </span>
          <p className="studio-in display mt-5 text-[40px] leading-none" style={at(0.35)}>
            Studio
            <br />
            Campetto
          </p>
          <div className="relative mt-4 h-1 w-40 overflow-hidden rounded-full bg-white/15">
            <span className="studio-grow absolute inset-0 rounded-full bg-volt" style={at(0.6)} />
          </div>
          <p className="studio-in mt-4 text-[16px] font-semibold text-white/85" style={at(0.8)}>
            {date[0].toUpperCase() + date.slice(1)}
          </p>
          <p className="studio-in mt-1 text-[14px] text-white/65" style={at(0.95)}>
            {screen.subtitle.replace(/^[^·]*·\s*/, "")}
          </p>
        </div>
      );
    }

    case "risultati":
      return (
        <>
          <Kicker>{screen.title}</Kicker>
          <ol className="mt-4 flex flex-1 flex-col justify-between gap-2">
            {screen.games.map((g, i) => {
              const aWon = g.sa > g.sb;
              return (
                <li key={i} className="studio-in flex items-center gap-2 rounded-2xl bg-white/[0.07] px-2.5 py-2" style={at(0.25 + i * 0.22)}>
                  <span className="tnum w-4 shrink-0 text-[12px] font-bold text-white/50">{i + 1}</span>
                  <Team ids={g.a} won={aWon} name={name} />
                  <span className="score shrink-0 text-[19px]">
                    <span className={aWon ? "text-volt" : "text-white/60"}>{g.sa}</span>
                    <span className="text-white/40">–</span>
                    <span className={!aWon ? "text-volt" : "text-white/60"}>{g.sb}</span>
                  </span>
                  <Team ids={g.b} won={!aWon} name={name} right />
                </li>
              );
            })}
          </ol>
        </>
      );

    case "giocatore": {
      const p = player(screen.playerId);
      const color = p ? playerColor(p) : "#2D5BE3";
      return (
        <>
          <Kicker>{screen.kicker}</Kicker>
          <div className="mt-3 flex items-end gap-3">
            <div className="studio-pop relative -mb-1 grid w-[118px] shrink-0 place-items-end justify-center" style={at(0.2)}>
              <span aria-hidden className="absolute bottom-3 left-1/2 h-[104px] w-[104px] -translate-x-1/2 rounded-full" style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }} />
              {p && <Character id={characterOf(p)} height={168} idle className="relative" />}
            </div>
            <div className="min-w-0 pb-3">
              <p className="studio-in display line-clamp-2 text-[30px] leading-[1.05]" style={at(0.35)}>
                {name(screen.playerId)}
              </p>
              {screen.tag && (
                <p className="studio-in mt-2 inline-block rounded-lg bg-white/12 px-2 py-1 text-[12.5px] font-semibold leading-tight text-white/90" style={at(0.55)}>
                  {screen.tag}
                </p>
              )}
            </div>
          </div>
          <div className="mt-auto grid grid-cols-3 gap-2">
            {screen.tiles.map((tile, i) => (
              <div key={tile.label} className="studio-in rounded-2xl bg-white/[0.09] px-2 pb-2.5 pt-2 text-center" style={at(0.6 + i * 0.15)}>
                <p className="score text-[36px] text-white">
                  <Count to={tile.value} d={0.7 + i * 0.15} suffix={tile.suffix} />
                </p>
                <p className="mt-1 text-[11.5px] font-semibold leading-tight text-white/65">{tile.label}</p>
              </div>
            ))}
          </div>
        </>
      );
    }

    case "record":
      return (
        <div className="flex flex-1 flex-col">
          <Kicker>{screen.kicker}</Kicker>
          <p className="studio-in mt-4 text-[17px] font-semibold text-white/80" style={at(0.2)}>
            {screen.label}
          </p>
          <div className="mt-1 flex items-end gap-3">
            <p className="score text-[120px] leading-[0.85] text-volt drop-shadow-[0_0_24px_rgb(255_197_49/0.45)]">
              <Count to={screen.value} d={0.4} />
            </p>
            <p className="studio-in mb-2 text-[22px] font-bold" style={at(1.2)}>
              {screen.unit}
            </p>
          </div>
          <div className="studio-in mt-5 flex items-center gap-3 rounded-2xl bg-white/[0.09] p-3" style={at(1.4)}>
            <Avatar player={player(screen.playerId)} size={44} href={false} ring="none" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[18px] font-bold">{name(screen.playerId)}</p>
              {screen.before && <p className="text-[13px] text-white/65">{screen.before}</p>}
            </div>
            <IconTrophy size={28} className="studio-pop text-volt" style={at(1.7)} aria-hidden />
          </div>
          {/* Coriandoli: pochi, solo trasformazioni. */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {Array.from({ length: 14 }, (_, i) => (
              <span
                key={i}
                className="studio-pop absolute h-2.5 w-1.5 rounded-sm"
                style={{
                  ...at(0.9 + (i % 5) * 0.08),
                  left: `${8 + ((i * 37) % 84)}%`,
                  top: `${10 + ((i * 53) % 40)}%`,
                  background: ["#FFC531", "#F26A1B", "#FFF8EA", "#3D6AF0"][i % 4],
                  rotate: `${(i * 47) % 180}deg`,
                }}
              />
            ))}
          </div>
        </div>
      );

    case "tiro": {
      const best = Math.max(...screen.rows.map((r) => r.made / r.att));
      return (
        <>
          <Kicker>{screen.kicker}</Kicker>
          <p className="studio-in mt-3 text-[15px] font-semibold text-white/75" style={at(0.15)}>
            {screen.title}
          </p>
          <ul className="mt-4 flex flex-1 flex-col justify-between">
            {screen.rows.map((r, i) => {
              const pct = r.made / r.att;
              const top = pct === best;
              return (
                <li key={r.playerId} className="studio-in" style={at(0.3 + i * 0.2)}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar player={player(r.playerId)} size={26} href={false} ring="none" />
                      <span className="truncate text-[15px] font-semibold">{name(r.playerId)}</span>
                    </span>
                    <span className="tnum shrink-0 text-[13px] text-white/65">
                      {r.made}/{r.att}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-white/10">
                      <span
                        className={clsx("studio-grow absolute inset-y-0 left-0 rounded-full", top ? "bg-volt" : "bg-[#3D6AF0]")}
                        style={{ ...at(0.5 + i * 0.2), width: `${Math.round(pct * 100)}%` }}
                      />
                    </div>
                    <span className={clsx("score w-12 shrink-0 text-right text-[20px]", top && "text-volt")}>
                      <Count to={Math.round(pct * 100)} d={0.5 + i * 0.2} suffix="%" />
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          {screen.note && (
            <p className="studio-in mt-3 rounded-xl bg-white/[0.08] px-3 py-2 text-[13px] font-semibold text-white/85" style={at(1.5)}>
              {screen.note}
            </p>
          )}
        </>
      );
    }

    case "elo": {
      const max = Math.max(...screen.rows.map((r) => Math.abs(r.delta)));
      return (
        <>
          <Kicker>{screen.kicker}</Kicker>
          <p className="studio-in mt-3 text-[15px] font-semibold text-white/75" style={at(0.15)}>
            Punti guadagnati e persi nella serata
          </p>
          <ul className="mt-4 flex flex-1 flex-col justify-between">
            {screen.rows.map((r, i) => {
              const up = r.delta >= 0;
              // Al massimo un terzo della riga: accanto resta posto per il numero.
              const w = `${(Math.abs(r.delta) / max) * 33}%`;
              return (
                <li key={r.playerId} className="studio-in" style={at(0.3 + i * 0.2)}>
                  <div className="flex items-center gap-2">
                    <Avatar player={player(r.playerId)} size={26} href={false} ring="none" />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{name(r.playerId)}</span>
                    <span className="tnum text-[13px] text-white/65">{r.after}</span>
                  </div>
                  {/* Barra a due versi: a destra chi sale, a sinistra chi scende. */}
                  <div className="relative mt-1.5 h-6">
                    <span className="absolute inset-y-0 left-1/2 w-px bg-white/30" />
                    <span
                      className={clsx("studio-grow absolute inset-y-1 rounded-full", up ? "left-1/2 bg-[#2E9E5B]" : "right-1/2 bg-[#E5412D]")}
                      style={{ ...at(0.5 + i * 0.2), width: w, transformOrigin: up ? "left center" : "right center" }}
                    />
                    <span
                      className={clsx("studio-in tnum absolute top-0 text-[15px] font-bold leading-6", up ? "text-[#7BE0A4]" : "text-[#FF8C7A]")}
                      style={{ ...at(1 + i * 0.2), ...(up ? { left: `calc(50% + ${w} + 6px)` } : { right: `calc(50% + ${w} + 6px)` }) }}
                    >
                      {up ? `+${r.delta}` : `−${Math.abs(r.delta)}`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      );
    }

    case "montaggio":
      // Il video lo mette il player (deve seguire il tempo della puntata).
      return null;
  }
}

function Team({ ids, won, name, right }: { ids: string[]; won: boolean; name: (id: string) => string; right?: boolean }) {
  return (
    <span className={clsx("flex min-w-0 flex-1 flex-col text-[13px] leading-tight", right ? "items-end text-right" : "items-start", won ? "font-bold text-white" : "font-medium text-white/60")}>
      {ids.map((id) => (
        <span key={id} className="max-w-full truncate">
          {name(id)}
        </span>
      ))}
    </span>
  );
}
