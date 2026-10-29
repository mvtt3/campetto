import {
  DEFAULT_NOTIFY_PREFS,
  type Box,
  type Format,
  type Match,
  type MatchEvent,
  type MatchPlayer,
  type NotifyPrefs,
  type Player,
  type Proposal,
} from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const MATCH_SELECT = "*, match_players(*), match_events(*)";
export const PROPOSAL_SELECT = "*, proposal_responses(*)";

export function mapPlayer(r: any): Player {
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    nickname: r.nickname,
    roles: r.roles ?? [],
    jerseyNumber: r.jersey_number,
    cardColor: r.card_color,
    avatarUrl: r.avatar_url,
    character: r.character ?? null,
    userId: r.user_id,
    isAdmin: r.is_admin,
    showcase: r.showcase ?? [],
    notifyPrefs: { ...DEFAULT_NOTIFY_PREFS, ...(r.notify_prefs as Partial<NotifyPrefs>) },
    archived: r.archived,
    createdAt: r.created_at,
  };
}

function mapBox(r: any): Box {
  return {
    pts: r.pts ?? 0,
    fg2m: r.fg2m ?? 0,
    fg2a: r.fg2a ?? 0,
    fg3m: r.fg3m ?? 0,
    fg3a: r.fg3a ?? 0,
    oreb: r.oreb ?? 0,
    dreb: r.dreb ?? 0,
    ast: r.ast ?? 0,
    stl: r.stl ?? 0,
    blk: r.blk ?? 0,
    tov: r.tov ?? 0,
    fouls: r.fouls ?? 0,
  };
}

export function mapMatch(r: any): Match {
  const players: MatchPlayer[] = (r.match_players ?? []).map((p: any) => ({
    matchId: r.id,
    playerId: p.player_id,
    team: p.team,
    hasStats: p.has_stats,
    box: mapBox(p),
    sub: Boolean(p.sub),
  }));
  const events: MatchEvent[] = (r.match_events ?? [])
    .map((e: any) => ({
      id: e.id,
      matchId: r.id,
      playerId: e.player_id,
      kind: e.kind,
      targetPlayerId: e.target_player_id,
      videoTs: e.video_ts,
      seq: e.seq,
    }))
    .sort((a: MatchEvent, b: MatchEvent) => a.seq - b.seq);
  return {
    id: r.id,
    playedAt: r.played_at,
    format: r.format as Format,
    targetPoints: r.target_points,
    scoreA: r.score_a,
    scoreB: r.score_b,
    statsSource: r.stats_source,
    confirmedBy: r.confirmed_by,
    confirmedAt: r.confirmed_at,
    createdBy: r.created_by,
    notes: r.notes,
    createdAt: r.created_at,
    players,
    events,
  };
}

export function mapProposal(r: any): Proposal {
  return {
    id: r.id,
    startsAt: r.starts_at,
    format: r.format,
    note: r.note,
    createdBy: r.created_by,
    status: r.status,
    createdAt: r.created_at,
    responses: (r.proposal_responses ?? []).map((x: any) => ({
      playerId: x.player_id,
      response: x.response,
      updatedAt: x.updated_at,
    })),
  };
}
