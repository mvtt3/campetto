import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { z } from "zod";
import { BADGE_BY_KEY, computeBadges } from "@/lib/badges";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, VAPID_PUBLIC_KEY } from "@/lib/config";
import { MATCH_SELECT, PROPOSAL_SELECT, mapMatch, mapPlayer, mapProposal } from "@/lib/data/map";
import { decideProposalNotifications, dayLabel, neededPlayers, summaryText } from "@/lib/notifications/grouping";
import { MONTHS_IT, monthKey } from "@/lib/periods";
import { TIER_NAMES } from "@/lib/badges";
import { currentMvp, monthlyHistory, seasonHistory } from "@/lib/stats/awards";
import { computeElo } from "@/lib/stats/elo";
import { shortName, type Match, type NotifyKind, type Player, type Proposal } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.discriminatedUnion("type", [
  z.object({ type: z.literal("proposal_new"), proposalId: z.uuid() }),
  z.object({ type: z.literal("proposal_response"), proposalId: z.uuid() }),
  z.object({ type: z.literal("match_saved"), matchId: z.uuid(), isNew: z.boolean() }),
  z.object({ type: z.literal("flush") }),
  z.object({ type: z.literal("test") }),
]);

interface Payload {
  title: string;
  body: string;
  url: string;
  tag?: string;
  actions?: { action: string; title: string }[];
  data?: Record<string, string>;
}

interface Target {
  player_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

class Ctx {
  sent = 0;
  constructor(
    public sb: SupabaseClient,
    public me: string,
  ) {}

  async targets(kind: NotifyKind, players: string[] | null, exclude: string | null = null): Promise<Target[]> {
    if (players && !players.length) return [];
    const { data } = await this.sb.rpc("push_targets", { p_kind: kind, p_players: players, p_exclude: exclude });
    return (data as Target[] | null) ?? [];
  }

  async send(targets: Target[], payload: Payload) {
    await Promise.all(
      targets.map(async (t) => {
        try {
          await webpush.sendNotification(
            { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
            JSON.stringify(payload),
            { TTL: 12 * 3600, urgency: "normal" },
          );
          this.sent++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await this.sb.rpc("drop_push_subscription", { p_endpoint: t.endpoint });
        }
      }),
    );
  }

  async claim(key: string): Promise<boolean> {
    const { data } = await this.sb.rpc("claim_notification", { p_key: key });
    return data === true;
  }
}

async function loadPlayers(sb: SupabaseClient): Promise<Player[]> {
  const { data } = await sb.from("players").select("*");
  return (data ?? []).map(mapPlayer);
}

async function proposalSummary(ctx: Ctx, p: Proposal, players: Player[]) {
  if (p.status !== "aperta" || new Date(p.startsAt).getTime() < Date.now()) return;
  const { data } = await ctx.sb.rpc("proposal_notify_state", { p_id: p.id });
  const st = (data as { last_summary_at: string | null; threshold_notified: boolean; pending_yes: number }[] | null)?.[0];
  if (!st) return;
  const yes = p.responses
    .filter((r) => r.response === "si")
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .map((r) => r.playerId);
  const names = yes.map((id) => shortName(players.find((x) => x.id === id), players));
  const decision = decideProposalNotifications({
    format: p.format,
    lastSummaryAt: st.last_summary_at,
    thresholdNotified: st.threshold_notified,
    yesNames: names,
    pendingYes: st.pending_yes,
  });
  const when = dayLabel(p.startsAt);
  if (decision.threshold) {
    const to = await ctx.targets("riepiloghi", yes);
    await ctx.send(to, {
      title: "Si gioca!",
      body: `Siete in ${yes.length} ${when}${p.format ? ` per il ${p.format}` : ""}.`,
      url: "/organizza",
      tag: `proposal-${p.id}`,
    });
    // Chi non ha ancora risposto sa che la partita c'è.
    const answered = new Set(p.responses.map((r) => r.playerId));
    const others = players.filter((x) => !x.archived && !answered.has(x.id)).map((x) => x.id);
    await ctx.send(await ctx.targets("riepiloghi", others), {
      title: "Si gioca!",
      body: `${summaryText(names, when).replace(", vieni anche tu?", "")}. C'è posto anche per te?`,
      url: "/organizza",
      tag: `proposal-${p.id}`,
      actions: [
        { action: "si", title: "Ci sono" },
        { action: "no", title: "No" },
      ],
      data: { proposalId: p.id },
    });
  } else if (decision.summary) {
    const noAnswer = players
      .filter((x) => !x.archived)
      .filter((x) => {
        const r = p.responses.find((y) => y.playerId === x.id)?.response;
        return !r || r === "forse";
      })
      .map((x) => x.id);
    await ctx.send(await ctx.targets("riepiloghi", noAnswer), {
      title: `${yes.length} di ${neededPlayers(p.format)} per ${when.split(" alle")[0]}`,
      body: summaryText(names, when),
      url: "/organizza",
      tag: `proposal-${p.id}`,
      actions: [
        { action: "si", title: "Ci sono" },
        { action: "no", title: "No" },
      ],
      data: { proposalId: p.id },
    });
  }
  if (decision.threshold || decision.summary) {
    await ctx.sb.rpc("mark_proposal_notified", { p_id: p.id, p_threshold: decision.threshold, p_summary: decision.summary });
  }
}

async function matchSaved(ctx: Ctx, matchId: string, isNew: boolean) {
  const [players, { data }] = await Promise.all([loadPlayers(ctx.sb), ctx.sb.from("matches").select(MATCH_SELECT).order("played_at")]);
  const matches: Match[] = (data ?? []).map(mapMatch);
  const m = matches.find((x) => x.id === matchId);
  if (!m) return;
  const name = (id: string) => shortName(players.find((p) => p.id === id), players);

  // 1. Chiedi alla squadra avversaria di confermare.
  const myLine = m.players.find((p) => p.playerId === ctx.me);
  if (isNew && myLine) {
    const opponents = m.players.filter((p) => p.team !== myLine.team).map((p) => p.playerId);
    const score = myLine.team === "A" ? `${m.scoreA}–${m.scoreB}` : `${m.scoreB}–${m.scoreA}`;
    await ctx.send(await ctx.targets("conferme", opponents), {
      title: "Conferma il risultato",
      body: `${name(ctx.me)} ha segnato ${score} nel ${m.format}. Tocca per confermare.`,
      url: `/partite?m=${m.id}`,
      tag: `match-${m.id}`,
    });
  }

  // 2. Nuovo MVP in carica.
  const ids = players.map((p) => p.id);
  const elo = computeElo(matches, ids);
  const mvp = currentMvp(ids, matches, new Date(), elo);
  if (mvp && mvp.period.kind === "month") {
    const key = `mvp:${monthKey(mvp.period.year, mvp.period.month)}:${mvp.entry.playerId}`;
    if (await ctx.claim(key)) {
      await ctx.send(await ctx.targets("mvp", null), {
        title: "Nuovo MVP",
        body: `${name(mvp.entry.playerId)} è l'MVP di ${MONTHS_IT[mvp.period.month].toLowerCase()}.`,
        url: "/classifiche",
        tag: "mvp",
      });
    }
  }

  // 3. Badge sbloccati con questa partita.
  const now = new Date();
  const months = monthlyHistory(ids, matches, now);
  const seasons = seasonHistory(ids, matches, now);
  for (const line of m.players) {
    const { unlocks } = computeBadges(line.playerId, matches, { months, seasons, now });
    const fresh = unlocks.filter((u) => u.matchId === m.id);
    const best = new Map<string, (typeof fresh)[number]>();
    for (const u of fresh) if (!best.has(u.key) || best.get(u.key)!.tier < u.tier) best.set(u.key, u);
    const toSend: string[] = [];
    for (const u of best.values()) {
      if (await ctx.claim(`badge:${line.playerId}:${u.key}:${u.tier}`)) {
        toSend.push(`${BADGE_BY_KEY.get(u.key)!.name} ${TIER_NAMES[u.tier]}`);
      }
    }
    if (toSend.length) {
      await ctx.send(await ctx.targets("badge", [line.playerId]), {
        title: toSend.length === 1 ? "Badge sbloccato" : `${toSend.length} badge sbloccati`,
        body: toSend.join(", "),
        url: "/profilo/badge",
        tag: `badge-${m.id}`,
      });
    }
  }
}

export async function POST(req: Request) {
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "Accesso richiesto" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Richiesta non valida" }, { status: 400 });

  const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: user, error } = await sb.auth.getUser(token);
  if (error || !user.user) return Response.json({ error: "Sessione non valida" }, { status: 401 });
  const { data: meId } = await sb.rpc("current_player_id");
  if (!meId) return Response.json({ error: "Non sei nel gruppo" }, { status: 403 });

  if (!privateKey) return Response.json({ skipped: "VAPID_PRIVATE_KEY mancante" }, { status: 202 });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:campetto@example.com", VAPID_PUBLIC_KEY, privateKey);

  const ctx = new Ctx(sb, meId as string);
  const body = parsed.data;
  try {
    if (body.type === "test") {
      await ctx.send(await ctx.targets("proposte", [ctx.me]), {
        title: "Notifiche attive",
        body: "Da ora ti avvisiamo quando qualcuno vuole giocare.",
        url: "/",
        tag: "test",
      });
    } else if (body.type === "proposal_new") {
      const [players, { data }] = await Promise.all([loadPlayers(sb), sb.from("proposals").select(PROPOSAL_SELECT).eq("id", body.proposalId).single()]);
      if (data) {
        const p = mapProposal(data);
        const who = shortName(players.find((x) => x.id === p.createdBy), players);
        await ctx.send(await ctx.targets("proposte", null, p.createdBy), {
          title: "Si gioca?",
          body: `${who} vuole giocare ${dayLabel(p.startsAt)}${p.format ? ` (${p.format})` : ""}, ci sei?`,
          url: "/organizza",
          tag: `proposal-${p.id}`,
          actions: [
            { action: "si", title: "Ci sono" },
            { action: "no", title: "No" },
          ],
          data: { proposalId: p.id },
        });
      }
    } else if (body.type === "proposal_response") {
      const [players, { data }] = await Promise.all([loadPlayers(sb), sb.from("proposals").select(PROPOSAL_SELECT).eq("id", body.proposalId).single()]);
      if (data) await proposalSummary(ctx, mapProposal(data), players);
    } else if (body.type === "flush") {
      const [players, { data }] = await Promise.all([
        loadPlayers(sb),
        sb.from("proposals").select(PROPOSAL_SELECT).eq("status", "aperta").gte("starts_at", new Date().toISOString()),
      ]);
      for (const row of data ?? []) await proposalSummary(ctx, mapProposal(row), players);
    } else if (body.type === "match_saved") {
      await matchSaved(ctx, body.matchId, body.isNew);
    }
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
  return Response.json({ sent: ctx.sent });
}
