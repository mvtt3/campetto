"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useData } from "@/lib/data/provider";
import { characterOf } from "@/components/character";
import type { AvatarPresetId } from "@/components/avatar-presets";
import { refillTokens } from "@/lib/game/economy";
import { newGame, normalize } from "@/lib/game/state";
import type { GameState, Outfit } from "@/lib/game/types";
import { shortName, type Player } from "@/lib/types";

/**
 * Il salvataggio di Campetto Star. Si apre all'istante dal telefono (localStorage),
 * poi si allinea col server: si salva da solo, poco dopo ogni mossa e quando
 * chiudi l'app. Se hai giocato da un altro telefono vince il salvataggio più recente.
 */

const keyOf = (id: string) => `campetto:gioco:${id}`;

export function readLocalGame(playerId: string): GameState | null {
  try {
    const raw = localStorage.getItem(keyOf(playerId));
    return raw ? normalize(JSON.parse(raw), Date.now(), "") : null;
  } catch {
    return null;
  }
}

function writeLocal(playerId: string, s: GameState) {
  try {
    localStorage.setItem(keyOf(playerId), JSON.stringify(s));
  } catch {
    /* telefono pieno: resta il server */
  }
}

/** L'amico che ti scrive nel gioco: uno vero del gruppo (quello con più partite insieme). */
function pickFriend(me: Player, players: Player[], matches: { players: { playerId: string }[] }[]): string {
  const count = new Map<string, number>();
  for (const m of matches) {
    if (!m.players.some((p) => p.playerId === me.id)) continue;
    for (const p of m.players)
      if (p.playerId !== me.id) count.set(p.playerId, (count.get(p.playerId) ?? 0) + 1);
  }
  const best = players
    .filter((p) => p.id !== me.id && !p.archived && !p.guest)
    .sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0))[0];
  return best ? shortName(best) : "Il Socio";
}

interface GameCtx {
  game: GameState;
  /** Il primo avvio su questo telefono: il salvataggio del server non è ancora arrivato. */
  syncing: boolean;
  update: (fn: (s: GameState) => GameState) => void;
  me: Player;
  charId: AvatarPresetId;
  /** Le partite vere del gruppo in cui ho giocato (per il bonus). */
  realIds: string[];
  /** Salva subito (prima di uscire). */
  flush: () => void;
  saveError: string | null;
}

const Ctx = createContext<GameCtx | null>(null);

export function useGame(): GameCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useGame fuori dal gioco");
  return c;
}

export function GameProvider({ me, children }: { me: Player; children: ReactNode }) {
  const { backend, data, mutate } = useData();
  const realIds = useMemo(
    () =>
      data.matches
        .filter((m) => m.players.some((p) => p.playerId === me.id))
        .map((m) => m.id),
    [data.matches, me.id],
  );
  const friend = useMemo(() => pickFriend(me, data.players, data.matches), [me, data.players, data.matches]);
  // Il salvataggio di questo telefono, letto una volta sola all'apertura.
  const [initial] = useState(() => readLocalGame(me.id));
  const [game, setGame] = useState<GameState>(
    () => initial ?? newGame({ now: Date.now(), friend, realSeen: realIds }),
  );
  // Prima volta su questo telefono: finché il server non risponde non si salva niente
  // (potrebbe esserci già una partita in corso fatta da un altro telefono).
  const [syncing, setSyncing] = useState(!initial);
  const waiting = useRef(!initial);
  const [saveError, setSaveError] = useState<string | null>(null);
  const latest = useRef(game);
  const dirty = useRef(false);
  const timer = useRef<number | null>(null);

  const pushServer = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current || waiting.current) return;
    dirty.current = false;
    backend.saveGame(latest.current).then(
      () => setSaveError(null),
      (e: unknown) => {
        dirty.current = true;
        setSaveError(e instanceof Error ? e.message : String(e));
      },
    );
  }, [backend]);

  // Allineamento col server all'apertura.
  useEffect(() => {
    let alive = true;
    backend.loadGame().then(
      (remote) => {
        if (!alive) return;
        const rs = remote ? normalize(remote.state, Date.now(), friend) : null;
        const cur = latest.current;
        if (rs && (!initial || Date.parse(rs.updatedAt) > Date.parse(cur.updatedAt))) {
          latest.current = rs;
          setGame(rs);
          writeLocal(me.id, rs);
        } else if (!rs || Date.parse(cur.updatedAt) > Date.parse(rs.updatedAt)) {
          dirty.current = true;
          writeLocal(me.id, cur);
        }
        waiting.current = false;
        pushServer();
        setSyncing(false);
      },
      () => {
        if (!alive) return;
        waiting.current = false;
        setSyncing(false);
      },
    );
    return () => {
      alive = false;
    };
    // Solo all'apertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback(
    (fn: (s: GameState) => GameState) => {
      const prev = latest.current;
      const next0 = fn(prev);
      if (next0 === prev) return;
      const next = { ...next0, updatedAt: new Date().toISOString() };
      latest.current = next;
      setGame(next);
      writeLocal(me.id, next);
      dirty.current = true;
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(pushServer, 1500);
    },
    [me.id, pushServer],
  );

  // Chiudi l'app o cambi schermata: si salva subito.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") pushServer();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      pushServer();
    };
  }, [pushServer]);

  // Gettoni che si ricaricano mentre il gioco è aperto.
  useEffect(() => {
    const tick = () => update((s) => {
      const r = refillTokens(s, Date.now());
      return r.tokens === s.tokens ? s : r;
    });
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [update]);

  // Quello che indossi si vede anche nell'app: profilo, classifiche, partite.
  const outfitKey = JSON.stringify(game.outfit);
  const sentOutfit = useRef(JSON.stringify(me.outfit ?? {}));
  useEffect(() => {
    if (syncing || outfitKey === sentOutfit.current) return;
    const t = window.setTimeout(() => {
      const outfit = JSON.parse(outfitKey) as Outfit;
      sentOutfit.current = outfitKey;
      mutate((d) => ({
        ...d,
        players: d.players.map((p) => (p.id === me.id ? { ...p, outfit } : p)),
      }));
      backend.updateMe({ outfit }).catch(() => {
        sentOutfit.current = "";
      });
    }, 800);
    return () => window.clearTimeout(t);
  }, [outfitKey, syncing, backend, mutate, me.id]);

  const value = useMemo<GameCtx>(
    () => ({
      game,
      syncing,
      update,
      me,
      charId: characterOf(me),
      realIds,
      flush: pushServer,
      saveError,
    }),
    [game, syncing, update, me, realIds, pushServer, saveError],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
