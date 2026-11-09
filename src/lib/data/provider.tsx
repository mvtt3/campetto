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
import { computeBadges, type BadgeState, type BadgeUnlock } from "../badges";
import { computeElo, type EloResult } from "../stats/elo";
import {
  currentMvp,
  monthlyHistory,
  seasonHistory,
  type MonthAward,
  type MvpEntry,
  type SeasonAward,
} from "../stats/awards";
import { sinceStart, type Period } from "../periods";
import type { Dataset, Player } from "../types";
import type { AuthState, Backend } from "./backend";
import { createMockBackend, mockAllowed } from "./mock-backend";
import { createSupabaseBackend } from "./supabase-backend";

const CACHE_KEY = "campetto:data:v1";
export const INVITE_KEY = "campetto:invite";

export interface Engine {
  playerIds: string[];
  elo: EloResult;
  months: MonthAward[];
  seasons: SeasonAward[];
  mvp: { entry: MvpEntry; period: Period } | null;
  badges(playerId: string): { states: BadgeState[]; unlocks: BadgeUnlock[] };
}

interface Ctx {
  backend: Backend;
  auth: AuthState;
  data: Dataset;
  me: Player | null;
  engine: Engine;
  loading: boolean;
  online: boolean;
  lastError: string | null;
  refresh: () => Promise<void>;
  reinit: () => Promise<void>;
  /** Optimistic local change applied immediately, before the server round trip. */
  mutate: (fn: (d: Dataset) => Dataset) => void;
  /**
   * Vista da giocatore: l'amministratore usa l'app come la vedono gli altri
   * (senza i suoi strumenti). Vale finché non la spegne o chiude l'app.
   */
  playerView: { on: boolean; available: boolean; set: (on: boolean) => void };
}

const VIEW_KEY = "campetto:vista-giocatore";

const DataContext = createContext<Ctx | null>(null);

const EMPTY: Dataset = { players: [], matches: [], proposals: [] };

function buildEngine(data: Dataset): Engine {
  const playerIds = data.players.map((p) => p.id);
  const elo = computeElo(data.matches, playerIds);
  const now = new Date();
  const months = monthlyHistory(playerIds, data.matches, now);
  const seasons = seasonHistory(playerIds, data.matches, now);
  const mvp = currentMvp(playerIds, data.matches, now, elo);
  const cache = new Map<
    string,
    { states: BadgeState[]; unlocks: BadgeUnlock[] }
  >();
  return {
    playerIds,
    elo,
    months,
    seasons,
    mvp,
    badges(id) {
      if (!cache.has(id))
        cache.set(
          id,
          computeBadges(id, data.matches, { months, seasons, now }),
        );
      return cache.get(id)!;
    },
  };
}

function readCacheRaw(): string | null {
  try {
    return localStorage.getItem(CACHE_KEY);
  } catch {
    return null;
  }
}

/** Chi eri all'ultima apertura: con i dati salvati, l'app si apre subito senza aspettare la rete. */
const ME_KEY = "campetto:me:v1";
const SEEN_KEY = "campetto:visto";

function readFastStart(): { meId: string; raw: string } | null {
  try {
    const meId = localStorage.getItem(ME_KEY);
    const raw = localStorage.getItem(CACHE_KEY);
    // Serve anche la sessione salvata da Supabase: senza, si passa dall'accesso.
    const signed = Object.keys(localStorage).some(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
    );
    // Con un invito da usare si passa dal controllo normale, che lo registra.
    const invite = localStorage.getItem(INVITE_KEY);
    return meId && raw && signed && !invite ? { meId, raw } : null;
  } catch {
    return null;
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [backend] = useState<Backend>(() =>
    typeof window !== "undefined" && mockAllowed()
      ? createMockBackend()
      : createSupabaseBackend(),
  );
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [data, setData] = useState<Dataset>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const refreshing = useRef<Promise<void> | null>(null);
  // Gli ultimi dati mostrati: se dal server arriva la stessa cosa, non si ricalcola niente
  // (succede quasi sempre tornando nell'app, ed evita un piccolo scatto proprio mentre tocchi).
  const shown = useRef<string | null>(null);
  const fastStarted = useRef(false);

  const show = useCallback((raw: string, d: Dataset) => {
    if (raw === shown.current) return;
    shown.current = raw;
    setData({ ...d, matches: sinceStart(d.matches) });
  }, []);

  const refresh = useCallback(async () => {
    if (refreshing.current) return refreshing.current;
    const run = (async () => {
      try {
        const d = await backend.loadAll();
        const raw = JSON.stringify(d);
        show(raw, d);
        setLastError(null);
        try {
          if (backend.kind === "supabase") localStorage.setItem(CACHE_KEY, raw);
        } catch {
          /* spazio pieno: la cache è facoltativa */
        }
      } catch (e) {
        setLastError((e as Error).message);
      } finally {
        setLoading(false);
        refreshing.current = null;
      }
    })();
    refreshing.current = run;
    return run;
  }, [backend, show]);

  const reinit = useCallback(async () => {
    let invite: string | null = null;
    try {
      invite = localStorage.getItem(INVITE_KEY);
    } catch {
      /* ignore */
    }
    const state = await backend.init(invite);
    if (invite && state.status !== "signed-out") {
      try {
        localStorage.removeItem(INVITE_KEY);
      } catch {
        /* ignore */
      }
    }
    // Stesso stato di prima (di solito, dopo l'apertura veloce): niente ridisegni inutili.
    setAuth((prev) => {
      if (
        prev.status === "ready" &&
        state.status === "ready" &&
        prev.meId === state.meId
      )
        return prev;
      // Senza rete il controllo non riesce: si resta dentro con i dati salvati (in alto compare "Sei offline").
      if (prev.status === "ready" && state.status === "error") return prev;
      return state;
    });
    if (backend.kind === "supabase") {
      try {
        if (state.status === "ready") localStorage.setItem(ME_KEY, state.meId);
        else if (state.status !== "error") localStorage.removeItem(ME_KEY);
      } catch {
        /* ignore */
      }
    }
    if (state.status === "ready") {
      if (backend.kind === "supabase" && !fastStarted.current) {
        const raw = readCacheRaw();
        if (raw) {
          try {
            show(raw, JSON.parse(raw) as Dataset);
            setLoading(false);
          } catch {
            /* cache rovinata: si aspetta il server */
          }
        }
      }
      fastStarted.current = false;
      await refresh();
    } else {
      fastStarted.current = false;
      setLoading(false);
    }
  }, [backend, refresh, show]);

  useEffect(() => {
    // Apertura veloce: se sul telefono ci sono già i dati e la sessione, l'app si
    // apre subito con quelli; il controllo dell'accesso e i dati nuovi arrivano dopo.
    if (backend.kind === "supabase") {
      const fast = readFastStart();
      if (fast) {
        try {
          const d = JSON.parse(fast.raw) as Dataset;
          fastStarted.current = true;
          shown.current = fast.raw;
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setData({ ...d, matches: sinceStart(d.matches) });
          setAuth({ status: "ready", meId: fast.meId });
          setLoading(false);
        } catch {
          /* cache rovinata: si parte dal controllo normale */
        }
      }
    }
    // Initial session check; state updates happen after the awaited backend call.
    void reinit();
    const off = backend.onAuthChange(() => void reinit());
    return off;
  }, [backend, reinit]);

  // "Sono passato di qui", al massimo ogni 3 ore: chi apre l'app non riceve il promemoria settimanale.
  useEffect(() => {
    if (auth.status !== "ready") return;
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      try {
        const last = Number(localStorage.getItem(SEEN_KEY) ?? 0);
        if (Date.now() - last < 3 * 3_600_000) return;
        localStorage.setItem(SEEN_KEY, String(Date.now()));
      } catch {
        /* senza memoria: si avvisa comunque */
      }
      void backend.touchSeen().catch(() => {
        try {
          localStorage.removeItem(SEEN_KEY);
        } catch {
          /* ignore */
        }
      });
    };
    // Dopo l'apertura, quando il telefono è libero.
    const t = window.setTimeout(ping, 2500);
    document.addEventListener("visibilitychange", ping);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [auth.status, backend]);

  useEffect(() => {
    if (auth.status !== "ready") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = backend.subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 400);
    });
    const onFocus = () =>
      document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      off();
      document.removeEventListener("visibilitychange", onFocus);
      if (timer) clearTimeout(timer);
    };
  }, [auth.status, backend, refresh]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const engine = useMemo(() => buildEngine(data), [data]);
  const realMe = useMemo(
    () =>
      auth.status === "ready"
        ? (data.players.find((p) => p.id === auth.meId) ?? null)
        : null,
    [auth, data.players],
  );
  const [viewOn, setViewOn] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setViewOn(sessionStorage.getItem(VIEW_KEY) === "1");
    } catch {
      /* niente memoria di sessione: si parte da amministratore */
    }
  }, []);
  const setView = useCallback((on: boolean) => {
    try {
      if (on) sessionStorage.setItem(VIEW_KEY, "1");
      else sessionStorage.removeItem(VIEW_KEY);
    } catch {
      /* vale solo per ora */
    }
    setViewOn(on);
  }, []);
  const available = Boolean(realMe?.isAdmin);
  const me = useMemo(
    () =>
      realMe && available && viewOn ? { ...realMe, isAdmin: false } : realMe,
    [realMe, available, viewOn],
  );
  const playerView = useMemo(
    () => ({ on: available && viewOn, available, set: setView }),
    [available, viewOn, setView],
  );
  const mutate = useCallback((fn: (d: Dataset) => Dataset) => {
    // Dopo una modifica locale, i dati del server vanno sempre riapplicati (anche se uguali a prima).
    shown.current = null;
    setData((d) => fn(d));
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      backend,
      auth,
      data,
      me,
      engine,
      loading,
      online,
      lastError,
      refresh,
      reinit,
      mutate,
      playerView,
    }),
    [
      backend,
      auth,
      data,
      me,
      engine,
      loading,
      online,
      lastError,
      refresh,
      reinit,
      mutate,
      playerView,
    ],
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): Ctx {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData fuori da DataProvider");
  return ctx;
}

export function usePlayer(id: string | null | undefined): Player | undefined {
  const { data } = useData();
  return useMemo(
    () => data.players.find((p) => p.id === id),
    [data.players, id],
  );
}
