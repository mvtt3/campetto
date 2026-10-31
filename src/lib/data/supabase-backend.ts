"use client";

import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { accessToken, signInWithGoogle, supabase } from "../supabase/client";
import {
  MATCH_SELECT,
  PROPOSAL_SELECT,
  mapHighlight,
  mapHighlightComment,
  mapMatch,
  mapPlayer,
  mapProposal,
} from "./map";
import type {
  AuthState,
  Backend,
  NotifyBody,
  PendingUser,
  PlayerPrivate,
} from "./backend";
import { say } from "../voice";
import { splitGuests } from "../guests";

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
      const { data, error: sessionError } = await sb.auth.getSession();
      // Senza rete la sessione non si rinnova: non vuol dire che sei uscito.
      if (sessionError && isAuthRetryableFetchError(sessionError))
        return { status: "error", message: say(sessionError) };
      const session = data.session;
      if (!session) return { status: "signed-out" } satisfies AuthState;
      try {
        if (inviteToken) {
          const { data: claimed, error } = await sb.rpc("claim_invite", {
            p_token: inviteToken,
          });
          if (error)
            return { status: "error", message: friendly(error.message) };
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
      const [p, m, pr, nw, hl] = await Promise.all([
        sb.from("players").select("*").order("created_at"),
        sb
          .from("matches")
          .select(MATCH_SELECT)
          .order("played_at", { ascending: false }),
        sb
          .from("proposals")
          .select(PROPOSAL_SELECT)
          .gte("starts_at", since)
          .order("starts_at"),
        sb
          .from("news")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(30),
        // Gli highlights li restituisce solo a chi li può vedere (per ora l'amministratore).
        sb
          .from("highlights")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
      fail(p.error);
      fail(m.error);
      fail(pr.error);
      // Gli ospiti restano fuori dal gruppo: solo nel tabellino delle loro partite.
      const split = splitGuests(
        (p.data ?? []).map(mapPlayer),
        (m.data ?? []).map(mapMatch),
      );
      return {
        players: split.players,
        guests: split.guests,
        matches: split.matches,
        proposals: (pr.data ?? []).map(mapProposal),
        // Le notizie non devono mai bloccare l'app: se non arrivano, se ne fa a meno.
        news: nw.error
          ? []
          : (nw.data ?? []).map((r) => ({
              id: r.id,
              title: r.title,
              body: r.body,
              kind: r.kind,
              createdAt: r.created_at,
            })),
        // Come le notizie: se mancano, l'app va avanti senza.
        highlights: hl.error ? [] : (hl.data ?? []).map(mapHighlight),
      };
    },

    subscribe(onChange) {
      const channel = sb.channel("campetto-db");
      for (const table of [
        "players",
        "matches",
        "match_players",
        "proposals",
        "proposal_responses",
      ]) {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => onChange(),
        );
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
            sub: Boolean(p.sub),
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
        .insert({
          starts_at: input.startsAt,
          format: input.format,
          note: input.note,
          place: input.place,
          created_by: meId,
        })
        .select("id")
        .single();
      fail(error);
      // Chi propone ci va: risponde subito "sì".
      await sb.from("proposal_responses").upsert({
        proposal_id: data!.id,
        player_id: meId,
        response: "si",
        notified: true,
      });
      return data!.id as string;
    },

    async cancelProposal(id) {
      fail(
        (
          await sb
            .from("proposals")
            .update({ status: "annullata" })
            .eq("id", id)
        ).error,
      );
    },

    async respond(proposalId, response) {
      if (!response) {
        fail(
          (
            await sb
              .from("proposal_responses")
              .delete()
              .eq("proposal_id", proposalId)
              .eq("player_id", meId!)
          ).error,
        );
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

    async setAlternative(proposalId, alt) {
      fail(
        (
          await sb
            .from("proposal_responses")
            .update({
              alt_starts_at: alt?.startsAt ?? null,
              alt_place: alt?.place ?? null,
            })
            .eq("proposal_id", proposalId)
            .eq("player_id", meId!)
        ).error,
      );
    },

    async moveProposal(proposalId, startsAt, place) {
      fail(
        (
          await sb.rpc("move_proposal", {
            p_id: proposalId,
            p_starts_at: startsAt,
            p_place: place,
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
      if ("character" in patch) row.character = patch.character;
      if ("showcase" in patch) row.showcase = patch.showcase;
      if ("notifyPrefs" in patch) row.notify_prefs = patch.notifyPrefs;
      fail((await sb.from("players").update(row).eq("id", meId!)).error);
    },

    async uploadAvatar(file) {
      const path = `${meId}/avatar-${Date.now()}.webp`;
      const { error } = await sb.storage
        .from("avatars")
        .upload(path, file, { contentType: "image/webp", upsert: true });
      fail(error);
      return sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    },

    async createGuest(name) {
      const { data, error } = await sb
        .from("players")
        .insert({
          first_name: name.trim().slice(0, 40) || "Ospite",
          guest: true,
        })
        .select("id")
        .single();
      fail(error);
      return data!.id as string;
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
      const { data, error } = await sb
        .from("players")
        .insert(row)
        .select("id")
        .single();
      fail(error);
      return data!.id as string;
    },

    async listPrivate() {
      const { data, error } = await sb.from("player_private").select("*");
      fail(error);
      return (data ?? []).map((r): PlayerPrivate => ({
        playerId: r.player_id,
        inviteToken: r.invite_token,
        linkEmail: r.link_email,
      }));
    },

    async setLinkEmail(playerId, email) {
      fail(
        (
          await sb
            .from("player_private")
            .update({ link_email: email?.trim().toLowerCase() || null })
            .eq("player_id", playerId)
        ).error,
      );
    },

    async regenerateInvite(playerId) {
      const { data, error } = await sb.rpc("regenerate_invite", {
        p_player: playerId,
      });
      fail(error);
      return data as string;
    },

    async unlinkPlayer(playerId) {
      fail((await sb.rpc("admin_unlink_player", { p_player: playerId })).error);
    },

    async listPending() {
      const { data, error } = await sb
        .from("pending_users")
        .select("*")
        .order("created_at");
      fail(error);
      return (data ?? []).map((r): PendingUser => ({
        userId: r.user_id,
        email: r.email,
        fullName: r.full_name,
        avatarUrl: r.avatar_url,
        createdAt: r.created_at,
      }));
    },

    async resolvePending(userId, playerId) {
      fail(
        (
          await sb.rpc("admin_resolve_pending", {
            p_user: userId,
            p_player: playerId,
          })
        ).error,
      );
    },

    async sendFeedback(input) {
      fail(
        (
          await sb.from("feedback").insert({
            player_id: meId,
            kind: input.kind,
            message: input.message.trim(),
            screen: input.screen,
            device: input.device,
            app_version: input.appVersion,
          })
        ).error,
      );
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
      fail(
        (await sb.from("push_subscriptions").delete().eq("endpoint", endpoint))
          .error,
      );
    },

    async notify(body: NotifyBody) {
      const token = await accessToken();
      if (!token) return;
      try {
        await fetch("/api/notify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
          keepalive: true,
        });
      } catch {
        // Le notifiche sono un extra: se falliscono non blocchiamo nulla.
      }
    },

    async touchSeen() {
      await sb.rpc("touch_seen");
    },

    async loadHighlightSocial(ids) {
      if (!ids.length) return { likes: [], comments: [] };
      const [l, c] = await Promise.all([
        sb
          .from("highlight_likes")
          .select("highlight_id, player_id")
          .in("highlight_id", ids),
        sb
          .from("highlight_comments")
          .select("*")
          .in("highlight_id", ids)
          .order("created_at"),
      ]);
      fail(l.error);
      fail(c.error);
      return {
        likes: (l.data ?? []).map((r) => ({
          highlightId: r.highlight_id,
          playerId: r.player_id,
        })),
        comments: (c.data ?? []).map(mapHighlightComment),
      };
    },

    async setHighlightLike(highlightId, on) {
      if (!meId) throw new Error(friendly("not authenticated"));
      const q = on
        ? sb
            .from("highlight_likes")
            .upsert(
              { highlight_id: highlightId, player_id: meId },
              { ignoreDuplicates: true },
            )
        : sb
            .from("highlight_likes")
            .delete()
            .eq("highlight_id", highlightId)
            .eq("player_id", meId);
      fail((await q).error);
    },

    async addHighlightComment(highlightId, body, replyTo) {
      const { data, error } = await sb
        .from("highlight_comments")
        .insert({
          highlight_id: highlightId,
          player_id: meId,
          body,
          reply_to: replyTo ?? null,
        })
        .select("*")
        .single();
      fail(error);
      const saved = mapHighlightComment(data);
      // Chi riceve la risposta viene avvisato (se non è un extra che fallisce in silenzio).
      if (saved.replyTo)
        void this.notify({ type: "highlight_reply", commentId: saved.id });
      return saved;
    },

    async deleteHighlightComment(id) {
      fail((await sb.from("highlight_comments").delete().eq("id", id)).error);
    },

    subscribeHighlights(onChange) {
      const channel = sb.channel("campetto-highlights");
      for (const table of ["highlight_likes", "highlight_comments"]) {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => onChange(),
        );
      }
      channel.subscribe();
      return () => {
        sb.removeChannel(channel);
      };
    },
  };
}
