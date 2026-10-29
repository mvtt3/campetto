"use client";

import { DEFAULT_NOTIFY_PREFS, emptyBox, TEAM_SIZE, type Dataset, type Format, type Match, type Player } from "../types";
import type { AuthState, Backend, PendingUser, PlayerPrivate } from "./backend";
import { APP_START } from "../periods";

/**
 * Backend in memoria (salvato in localStorage) usato per i test automatici e per
 * provare l'app in locale senza account. Attivo solo su localhost.
 */

const KEY = "campetto:mock:v1";

interface MockState extends Dataset {
  meId: string;
  signedIn: boolean;
  private: PlayerPrivate[];
  pending: PendingUser[];
  notifications: unknown[];
}

// nome, cognome, ruoli, nome scelto nell'app, figurina
const SEED: [string, string | null, string[], string, string | null][] = [
  ["Matteo", "Pepe", ["Guardia", "Ala piccola"], "Matteo", null],
  ["Valerio", "Semeraro", ["Play"], "Valerio", "preset:bandana"],
  ["Davide", "Aquilino", ["Guardia", "Ala grande"], "Davide", "preset:occhiali"],
  ["Lorenzo", "Candela", ["Play"], "Lorenzo", null],
  ["Mattia", null, ["Play", "Guardia"], "Mattia", "preset:coppola"],
  ["Matteo", "Mocciaro", ["Ala grande", "Centro"], "Mocciaro", "preset:muscoli"],
  ["Simone", "Falbo", ["Ala grande", "Centro", "Ala piccola"], "Simone", null],
];

const rid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));

function seedPlayers(): Player[] {
  return SEED.map(([firstName, lastName, roles, nickname, avatarUrl], i) => ({
    id: `p${i + 1}`,
    firstName,
    lastName,
    nickname,
    roles,
    jerseyNumber: null,
    cardColor: null,
    avatarUrl,
    userId: i === 0 ? "u1" : null,
    isAdmin: i === 0,
    showcase: [],
    notifyPrefs: DEFAULT_NOTIFY_PREFS,
    archived: false,
    createdAt: new Date(2026, 9, 1, 10, i).toISOString(),
  }));
}

/** Deterministic pseudo-random history for visual checks (?mock=demo). */
export function demoMatches(players: Player[], now = new Date()): Match[] {
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const out: Match[] = [];
  const formats: Format[] = ["2v2", "3v3", "3v3", "1v1", "2v2", "4v4"];
  // Lo storico di prova sta tutto dopo l'apertura dell'app (ottobre 2026).
  const N = 24;
  const span = Math.max(1, Math.floor((now.getTime() - APP_START.getTime()) / 86_400_000));
  const step = Math.min(2.4, Math.max(0.5, (span - 1) / N));
  for (let i = 0; i < N; i++) {
    const daysAgo = Math.floor(i * step) + 1;
    const d = new Date(now.getTime() - daysAgo * 86_400_000);
    d.setHours(i % 2 && step < 1 ? 19 : 17, 30, 0, 0);
    if (d < APP_START) break;
    const format = formats[i % formats.length];
    const n = TEAM_SIZE[format];
    const pool = [...players].sort(() => rnd() - 0.5).slice(0, n * 2);
    const id = `demo-${i}`;
    const winA = rnd() > 0.45;
    const lose = Math.floor(rnd() * 18) + 2;
    const scoreA = winA ? 21 : lose;
    const scoreB = winA ? lose : 21;
    const withStats = i % 3 !== 2;
    const lines = pool.map((p, k) => {
      const team = (k < n ? "A" : "B") as "A" | "B";
      const teamPts = team === "A" ? scoreA : scoreB;
      const box = emptyBox();
      if (withStats) {
        const share = Math.round(teamPts / n);
        box.fg3m = Math.min(Math.floor(rnd() * 3), Math.floor(share / 3));
        box.fg2m = Math.max(0, Math.floor((share - box.fg3m * 3) / 2));
        box.fg2a = box.fg2m + Math.floor(rnd() * 5);
        box.fg3a = box.fg3m + Math.floor(rnd() * 4);
        box.pts = box.fg2m * 2 + box.fg3m * 3;
        box.oreb = Math.floor(rnd() * 3);
        box.dreb = Math.floor(rnd() * 5);
        box.ast = Math.floor(rnd() * 5);
        box.stl = Math.floor(rnd() * 3);
        box.blk = Math.floor(rnd() * 2);
        box.tov = Math.floor(rnd() * 3);
      }
      return { matchId: id, playerId: p.id, team, hasStats: withStats, box };
    });
    out.push({
      id,
      playedAt: d.toISOString(),
      format,
      targetPoints: 21,
      scoreA,
      scoreB,
      statsSource: withStats ? "tabellino" : "solo_risultato",
      confirmedBy: i % 4 === 0 ? pool[pool.length - 1].id : null,
      confirmedAt: null,
      createdBy: pool[0].id,
      notes: null,
      createdAt: d.toISOString(),
      players: lines,
      events: [],
    });
  }
  return out;
}

function demoProposals() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  const at = new Date().toISOString();
  return [
    {
      id: "demo-prop",
      startsAt: d.toISOString(),
      format: "3v3" as Format,
      note: "Porto io il pallone nuovo",
      createdBy: "p2",
      status: "aperta" as const,
      createdAt: at,
      responses: [
        { playerId: "p2", response: "si" as const, updatedAt: at },
        { playerId: "p4", response: "si" as const, updatedAt: at },
        { playerId: "p7", response: "si" as const, updatedAt: at },
        { playerId: "p5", response: "forse" as const, updatedAt: at },
      ],
    },
  ];
}

function initialState(demo: boolean): MockState {
  const players = seedPlayers();
  return {
    meId: "p1",
    signedIn: false,
    players,
    matches: demo ? demoMatches(players) : [],
    proposals: demo ? demoProposals() : [],
    private: players.map((p) => ({ playerId: p.id, inviteToken: `tok-${p.id}`, linkEmail: null })),
    pending: [],
    notifications: [],
  };
}

export function createMockBackend(): Backend {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mock");
  localStorage.setItem("campetto:use-mock", "1");
  let state: MockState;
  const raw = localStorage.getItem(KEY);
  if (mode === "reset" || mode === "demo" || !raw) {
    state = initialState(mode === "demo");
    if (params.get("signed") === "1" || mode === "demo") state.signedIn = true;
    // ?as=p2 entra come un giocatore normale (non amministratore)
    const as = params.get("as");
    if (as && state.players.some((p) => p.id === as)) {
      state.meId = as;
      for (const p of state.players) p.userId = p.id === as ? "u1" : p.id === "p1" ? "u-admin" : null;
    }
    // ?nuovo=1: primo accesso, il giocatore deve ancora scegliere nome e figurina
    if (params.get("nuovo") === "1") {
      const meP = state.players.find((p) => p.id === state.meId);
      if (meP) Object.assign(meP, { nickname: null, avatarUrl: null });
    }
  } else {
    state = JSON.parse(raw);
  }
  const listeners = new Set<() => void>();
  const save = () => {
    localStorage.setItem(KEY, JSON.stringify(state));
    for (const l of listeners) setTimeout(l, 0);
  };
  save();
  const me = () => state.players.find((p) => p.id === state.meId)!;

  return {
    kind: "mock",
    async init(): Promise<AuthState> {
      if (!state.signedIn) return { status: "signed-out" };
      return { status: "ready", meId: state.meId };
    },
    onAuthChange() {
      return () => {};
    },
    async loadAll() {
      return structuredClone({ players: state.players, matches: state.matches, proposals: state.proposals });
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async signIn() {
      state.signedIn = true;
      save();
      window.location.reload();
    },
    async signOut() {
      state.signedIn = false;
      save();
    },
    async saveMatch(input) {
      const size = TEAM_SIZE[input.format];
      const a = input.players.filter((p) => p.team === "A").length;
      const b = input.players.filter((p) => p.team === "B").length;
      if (a !== size || b !== size) throw new Error(`Per il ${input.format} servono ${size} giocatori per squadra.`);
      if (input.scoreA === input.scoreB) throw new Error("Il risultato non può essere un pareggio.");
      const id = input.id ?? rid();
      const existing = state.matches.find((m) => m.id === id);
      const m: Match = {
        id,
        playedAt: input.playedAt,
        format: input.format,
        targetPoints: input.targetPoints,
        scoreA: input.scoreA,
        scoreB: input.scoreB,
        statsSource: input.statsSource,
        confirmedBy: null,
        confirmedAt: null,
        createdBy: existing?.createdBy ?? state.meId,
        notes: input.notes ?? null,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        players: input.players.map((p) => ({ ...p, matchId: id })),
        events: input.events.map((e, i) => ({ ...e, id: rid(), matchId: id, seq: i })),
      };
      state.matches = [m, ...state.matches.filter((x) => x.id !== id)];
      save();
      return id;
    },
    async deleteMatch(id) {
      state.matches = state.matches.filter((m) => m.id !== id);
      save();
    },
    async confirmMatch(id) {
      const m = state.matches.find((x) => x.id === id);
      if (m) {
        m.confirmedBy = state.meId;
        m.confirmedAt = new Date().toISOString();
      }
      save();
    },
    async createProposal(input) {
      const id = rid();
      state.proposals.push({
        id,
        startsAt: input.startsAt,
        format: input.format,
        note: input.note,
        createdBy: state.meId,
        status: "aperta",
        createdAt: new Date().toISOString(),
        responses: [{ playerId: state.meId, response: "si", updatedAt: new Date().toISOString() }],
      });
      save();
      return id;
    },
    async cancelProposal(id) {
      const p = state.proposals.find((x) => x.id === id);
      if (p) p.status = "annullata";
      save();
    },
    async respond(proposalId, response) {
      const p = state.proposals.find((x) => x.id === proposalId);
      if (!p) return;
      p.responses = p.responses.filter((r) => r.playerId !== state.meId);
      if (response) p.responses.push({ playerId: state.meId, response, updatedAt: new Date().toISOString() });
      save();
    },
    async updateMe(patch) {
      const nick = patch.nickname?.trim().toLowerCase();
      if (nick && state.players.some((p) => p.id !== state.meId && p.nickname?.trim().toLowerCase() === nick))
        throw new Error("duplicate key value violates unique constraint \"players_nickname_key\"");
      Object.assign(me(), patch);
      save();
    },
    async uploadAvatar(file) {
      return await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.readAsDataURL(file);
      });
    },
    async upsertPlayer(input) {
      if (input.id) {
        const p = state.players.find((x) => x.id === input.id)!;
        Object.assign(p, {
          firstName: input.firstName,
          lastName: input.lastName,
          roles: input.roles,
          archived: input.archived ?? false,
        });
        save();
        return input.id;
      }
      const id = rid();
      state.players.push({ ...seedPlayers()[1], id, firstName: input.firstName, lastName: input.lastName, roles: input.roles, userId: null, isAdmin: false });
      state.private.push({ playerId: id, inviteToken: `tok-${id}`, linkEmail: null });
      save();
      return id;
    },
    async listPrivate() {
      return structuredClone(state.private);
    },
    async setLinkEmail(playerId, email) {
      const p = state.private.find((x) => x.playerId === playerId);
      if (p) p.linkEmail = email;
      save();
    },
    async regenerateInvite(playerId) {
      const token = `tok-${rid().slice(0, 8)}`;
      const p = state.private.find((x) => x.playerId === playerId);
      if (p) p.inviteToken = token;
      save();
      return token;
    },
    async unlinkPlayer(playerId) {
      const p = state.players.find((x) => x.id === playerId);
      if (p) p.userId = null;
      save();
    },
    async listPending() {
      return structuredClone(state.pending);
    },
    async resolvePending(userId) {
      state.pending = state.pending.filter((p) => p.userId !== userId);
      save();
    },
    async savePushSubscription() {},
    async removePushSubscription() {},
    async notify(body) {
      state.notifications.push(body);
      localStorage.setItem(KEY, JSON.stringify(state));
    },
  };
}

export function mockAllowed(): boolean {
  if (typeof window === "undefined") return false;
  const local = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const q = new URLSearchParams(window.location.search).get("mock");
  if (q === "off") {
    localStorage.removeItem("campetto:use-mock");
    return false;
  }
  return local && (q !== null || localStorage.getItem("campetto:use-mock") === "1");
}
