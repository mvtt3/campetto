/**
 * Dati veri per lo sviluppo in locale, senza database: `?mock=dati` legge
 * `public/dati-locali.json`, creato con `scripts/esporta-dati.mjs`. Il file contiene le righe
 * delle tabelle come le restituisce Supabase e non va nel repository (è in .gitignore).
 */
import {
  mapHighlight,
  mapHighlightComment,
  mapMatch,
  mapPlayer,
  mapProposal,
} from "./map";
import type {
  Highlight,
  HighlightComment,
  Match,
  NewsPost,
  Player,
  Proposal,
} from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const LOCAL_DATA_URL = "/dati-locali.json";

export interface LocalData {
  players: Player[];
  matches: Match[];
  proposals: Proposal[];
  news: NewsPost[];
  highlights: Highlight[];
  hlComments: HighlightComment[];
  hlLikes: { highlightId: string; playerId: string }[];
  /** Chi si è "dentro" nell'app: l'amministratore. */
  meId: string;
}

export function fromExport(raw: any): LocalData {
  if (!raw || !Array.isArray(raw.players) || !Array.isArray(raw.matches))
    throw new Error("dati-locali.json non è un'esportazione di esporta-dati.mjs");
  const players: Player[] = raw.players.map(mapPlayer);
  const admin = players.find((p) => p.isAdmin) ?? players[0];
  return {
    players,
    matches: raw.matches.map(mapMatch),
    proposals: (raw.proposals ?? []).map(mapProposal),
    news: (raw.news ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      kind: r.kind,
      createdAt: r.created_at,
      link: r.link ?? undefined,
      popup: !!r.popup,
      until: r.until ?? undefined,
      cta: r.cta ?? undefined,
      proposalId: r.proposal_id ?? undefined,
    })),
    highlights: (raw.highlights ?? []).map(mapHighlight),
    hlComments: (raw.highlight_comments ?? []).map(mapHighlightComment),
    hlLikes: (raw.highlight_likes ?? []).map((r: any) => ({
      highlightId: r.highlight_id,
      playerId: r.player_id,
    })),
    meId: admin.id,
  };
}
