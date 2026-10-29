"use client";

import { accessToken, signInWithGoogle, supabase } from "../supabase/client";
import { MATCH_SELECT, PROPOSAL_SELECT, mapMatch, mapPlayer, mapProposal } from "./map";
import type { AuthState, Backend, NotifyBody, PendingUser, PlayerPrivate } from "./backend";
import { say } from "../voice";

function fail(error: { message: string } | null): void {
  if (error) throw new Error(friendly(error.message));
}

/** Gli errori arrivano già nella voce di Spicchio (vedi lib/voice). */
function friendly(msg: string): string {
  return say(new Error(msg));
}

export function createSupabaseBackend(): Backend {
  const sb = supabase();
  let meId: string | null = null;

  return {
    kind: "supabase",

    async init(inviteToken) {
      const { data } = await sb.auth.getSession();
      const session = data.session;
      if (!session) return { status: "signed-out" } satisfies AuthState;
      try {
        if (inviteToken) {
          const { data: claimed, error } = await sb.rpc("claim_invite", { p_token: inviteToken });
          if (error) return { status: "error", message: friendly(error.message) };
          meId = claimed as string;
        }
        if (!meId) {
          const { data: linked, error } = await sb.rpc("auto_link");
          fail(error);
          meId = (linked as string | null) ?? null;
        }
        if (!meId) {
          await sb.rpc("register_pending");
          return { status: "pending", email: session.user.email ?? null };
        }
        return { status: "ready", meId };
      } catch (e) {
        return { status: "error", message: say(e) };
      }
    },

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT") cb();
      });
      return () => data.subscription.unsubscribe();
    },

    async loadAll() {
      const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
      const [p, m, pr] = await Promise.all([
        sb.from("players").select("*").order("created_at"),
        sb.from("matches").select(MATCH_SELECT).order("played_at", { ascending: false }),
        sb.from("proposals").select(PROPOSAL_SELECT).gte("starts_at", since).order("starts_at"),
      ]);
      fail(p.error);
      fail(m.error);
      fail(pr.error);
      return {
        players: (p.data ?? []).map(mapPlayer),
        matches: (m.data ?? []).map(mapMatch),
        proposals: (pr.data ?? []).map(mapProposal),
      };
    },

    subscribe(onChange) {
      const channel = sb.channel("campetto-db");
      for (const table of ["players", "matches", "match_players", "proposals", "proposal_responses"]) {
        channel.on("postgres_changes", { event: "*", schema: "public", table }, () => onChange());
      }
      channel.subscribe();
      return () => {
        sb.removeChannel(channel);
      };
    },

    async signIn(next = "/") {
      await signInWithGoogle(next);
    },

    async signOut() {
      meId = null;
      await sb.auth.signOut();
    },

    async saveMatch(input) {
      const { data, error } = await sb.rpc("save_match", {
        p: {
          id: input.id ?? null,
          played_at: input.playedAt,
          format: input.format,
          target_points: input.targetPoints,
          score_a: input.scoreA,
          score_b: input.scoreB,
          stats_source: input.statsSource,
          notes: input.notes ?? null,
          players: input.players.map((p) => ({
            player_id: p.playerId,
            team: p.team,
            has_stats: p.hasStats,
            box: p.box,
          })),
          events: input.events.map((e) => ({
            player_id: e.playerId,
            kind: e.kind,
            target_player_id: e.targetPlayerId,
            video_ts: e.videoTs,
          })),
        },
      });
      fail(error);
      return data as string;
    },

    async deleteMatch(id) {
      fail((await sb.rpc("delete_match", { p_id: id })).error);
    },

    async confirmMatch(id) {
      fail((await sb.rpc("confirm_match", { p_id: id })).error);
    },

    async createProposal(input) {
      const { data, error } = await sb
        .from("proposals")
        .insert({ starts_at: input.startsAt, format: input.format, note: input.note, created_by: meId })
        .select("id")
        .single();
      fail(error);
      // Chi propone ci va: risponde subito "sì".
      await sb.from("proposal_responses").upsert({ proposal_id: data!.id, player_id: meId, response: "si", notified: true });
      return data!.id as string;
    },

    async cancelProposal(id) {
      fail((await sb.from("proposals").update({ status: "annullata" }).eq("id", id)).error);
    },

    async respond(proposalId, response) {
      if (!response) {
        fail((await sb.from("proposal_responses").delete().eq("proposal_id", proposalId).eq("player_id", meId!)).error);
        return;
      }
      fail(
        (
          await sb.from("proposal_responses").upsert({
            proposal_id: proposalId,
            player_id: meId,
            response,
            notified: false,
            updated_at: new Date().toISOString(),
          })
        ).error,
      );
    },

    async updateMe(patch) {
      const row: Record<string, unknown> = {};
      if ("nickname" in patch) row.nickname = patch.nickname || null;
      if ("jerseyNumber" in patch) row.jersey_number = patch.jerseyNumber;
      if ("cardColor" in patch) row.card_color = patch.cardColor;
      if ("avatarUrl" in patch) row.avatar_url = patch.avatarUrl;
      if ("showcase" in patch) row.showcase = patch.showcase;
      if ("notifyPrefs" in patch) row.notify_prefs = patch.notifyPrefs;
      fail((await sb.from("players").update(row).eq("id", meId!)).error);
    },

    async uploadAvatar(file) {
      const path = `${meId}/avatar-${Date.now()}.webp`;
      const { error } = await sb.storage.from("avatars").upload(path, file, { contentType: "image/webp", upsert: true });
      fail(error);
      return sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    },

    async upsertPlayer(input) {
      const row = {
        first_name: input.firstName.trim(),
        last_name: input.lastName?.trim() || null,
        roles: input.roles,
        archived: input.archived ?? false,
        ...(input.isAdmin !== undefined ? { is_admin: input.isAdmin } : {}),
      };
      if (input.id) {
        fail((await sb.from("players").update(row).eq("id", input.id)).error);
        return input.id;
      }
      const { data, error } = await sb.from("players").insert(row).select("id").single();
      fail(error);
      return data!.id as string;
    },

    async listPrivate() {
      const { data, error } = await sb.from("player_private").select("*");
      fail(error);
      return (data ?? []).map(
        (r): PlayerPrivate => ({ playerId: r.player_id, inviteToken: r.invite_token, linkEmail: r.link_email }),
      );
    },

    async setLinkEmail(playerId, email) {
      fail(
        (await sb.from("player_private").update({ link_email: email?.trim().toLowerCase() || null }).eq("player_id", playerId))
          .error,
      );
    },

    async regenerateInvite(playerId) {
      const { data, error } = await sb.rpc("regenerate_invite", { p_player: playerId });
      fail(error);
      return data as string;
    },

    async unlinkPlayer(playerId) {
      fail((await sb.rpc("admin_unlink_player", { p_player: playerId })).error);
    },

    async listPending() {
      const { data, error } = await sb.from("pending_users").select("*").order("created_at");
      fail(error);
      return (data ?? []).map(
        (r): PendingUser => ({
          userId: r.user_id,
          email: r.email,
          fullName: r.full_name,
          avatarUrl: r.avatar_url,
          createdAt: r.created_at,
        }),
      );
    },

    async resolvePending(userId, playerId) {
      fail((await sb.rpc("admin_resolve_pending", { p_user: userId, p_player: playerId })).error);
    },

    async savePushSubscription(sub) {
      fail(
        (
          await sb.from("push_subscriptions").upsert({
            endpoint: sub.endpoint,
            player_id: meId,
            p256dh: sub.keys?.p256dh,
            auth: sub.keys?.auth,
          })
        ).error,
      );
    },

    async removePushSubscription(endpoint) {
      fail((await sb.from("push_subscriptions").delete().eq("endpoint", endpoint)).error);
    },

    async notify(body: NotifyBody) {
      const token = await accessToken();
      if (!token) return;
      try {
        await fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
          keepalive: true,
        });
      } catch {
        // Le notifiche sono un extra: se falliscono non blocchiamo nulla.
      }
    },
  };
}
