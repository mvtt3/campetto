import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { matchMvp } from "@/lib/stats/match-mvp";
import webpush from "web-push";
import { z } from "zod";
import { BADGE_BY_KEY, computeBadges } from "@/lib/badges";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  VAPID_PUBLIC_KEY,
} from "@/lib/config";
import {
  MATCH_SELECT,
  PROPOSAL_SELECT,
  mapMatch,
  mapPlayer,
  mapProposal,
} from "@/lib/data/map";
import {
  decideProposalNotifications,
  atPlace,
  dayLabel,
  timeLabel,
  neededPlayers,
  summaryText,
} from "@/lib/notifications/grouping";
import { nudgeFor } from "@/lib/notifications/nudges";
import { MONTHS_IT, monthKey } from "@/lib/periods";
import { TIER_NAMES } from "@/lib/badges";
import { currentMvp, monthlyHistory, seasonHistory } from "@/lib/stats/awards";
import { computeElo } from "@/lib/stats/elo";
import { groupRecords } from "@/lib/stats/records";
import {
  leaderboard,
  STAT_BY_KEY,
  type StatKey,
} from "@/lib/stats/leaderboards";
import { computePlayerStats } from "@/lib/stats/player";
import { filterMatches } from "@/lib/periods";
import {
  shortName,
  type Match,
  type NotifyKind,
  type Place,
  type Player,
  type Proposal,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.discriminatedUnion("type", [
  z.object({ type: z.literal("proposal_new"), proposalId: z.uuid() }),
  z.object({ type: z.literal("proposal_response"), proposalId: z.uuid() }),
  z.object({ type: z.literal("proposal_cancelled"), proposalId: z.uuid() }),
  z.object({ type: z.literal("proposal_alternative"), proposalId: z.uuid() }),
  z.object({ type: z.literal("proposal_moved"), proposalId: z.uuid() }),
  z.object({ type: z.literal("tick") }),
  z.object({ type: z.literal("feedback"), kind: z.string().max(20) }),
  z.object({
    type: z.literal("match_saved"),
    matchId: z.uuid(),
    isNew: z.boolean(),
  }),
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

/** Ora di Roma: il silenzio di notte vale dalle 23 alle 8. */
function romeHour(d = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("it-IT", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Europe/Rome",
    }).format(d),
  );
}
const isNight = (d = new Date()) => {
  const h = romeHour(d);
  return h >= 23 || h < 8;
};

class Ctx {
  sent = 0;
  quiet = new Set<string>();
  constructor(
    public sb: SupabaseClient,
    public me: string,
    players: Player[] = [],
  ) {
    if (isNight())
      for (const p of players) if (p.notifyPrefs.notte) this.quiet.add(p.id);
  }

  async targets(
    kind: NotifyKind,
    players: string[] | null,
    exclude: string | null = null,
  ): Promise<Target[]> {
    if (players && !players.length) return [];
    const { data } = await this.sb.rpc("push_targets", {
      p_kind: kind,
      p_players: players,
      p_exclude: exclude,
    });
    return (data as Target[] | null) ?? [];
  }

  async send(targets: Target[], payload: Payload) {
    await Promise.all(
      targets
        .filter((t) => !this.quiet.has(t.player_id))
        .map(async (t) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: t.endpoint,
                keys: { p256dh: t.p256dh, auth: t.auth },
              },
              JSON.stringify(payload),
              { TTL: 12 * 3600, urgency: "normal" },
            );
            this.sent++;
          } catch (e) {
            const status = (e as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410)
              await this.sb.rpc("drop_push_subscription", {
                p_endpoint: t.endpoint,
              });
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

async function proposalSummary(
  ctx: Ctx,
  p: Proposal,
  players: Player[],
): Promise<{ threshold: boolean }> {
  if (p.status !== "aperta" || new Date(p.startsAt).getTime() < Date.now())
    return { threshold: false };
  const { data } = await ctx.sb.rpc("proposal_notify_state", { p_id: p.id });
  const st = (
    data as
      | {
          last_summary_at: string | null;
          threshold_notified: boolean;
          pending_yes: number;
        }[]
      | null
  )?.[0];
  if (!st) return { threshold: false };
  const yes = p.responses
    .filter((r) => r.response === "si")
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .map((r) => r.playerId);
  const names = yes.map((id) =>
    shortName(
      players.find((x) => x.id === id),
      players,
    ),
  );
  const decision = decideProposalNotifications({
    format: p.format,
    lastSummaryAt: st.last_summary_at,
    thresholdNotified: st.threshold_notified,
    yesNames: names,
    pendingYes: st.pending_yes,
  });
  const when = dayLabel(p.startsAt);
  if (decision.threshold) {
    const to = await ctx.targets("completa", yes);
    await ctx.send(to, {
      title: "Si gioca!",
      body: `Ho fatto la conta: siete in ${yes.length} ${when}${p.format ? ` per il ${p.format}` : ""}. Ci vediamo${p.place ? atPlace(p.place) : " al campetto"}`,
      url: "/organizza",
      tag: `proposal-${p.id}`,
    });
    // Chi non ha ancora risposto sa che la partita c'è.
    const answered = new Set(p.responses.map((r) => r.playerId));
    const others = players
      .filter((x) => !x.archived && !answered.has(x.id))
      .map((x) => x.id);
    await ctx.send(await ctx.targets("completa", others), {
      title: "Si gioca!",
      body: `Ho già ${yes.length} giocatori ${when}${atPlace(p.place)}. Vuoi esserci anche tu?`,
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
      body: `Ti aggiorno: ${summaryText(names, when)}`,
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
    await ctx.sb.rpc("mark_proposal_notified", {
      p_id: p.id,
      p_threshold: decision.threshold,
      p_summary: decision.summary,
    });
  }
  return { threshold: decision.threshold };
}

/** A chi ha proposto: ogni volta che qualcuno dice "ci sono" (una volta per persona). */
async function proposalJoined(ctx: Ctx, p: Proposal, players: Player[]) {
  if (ctx.me === p.createdBy || p.status !== "aperta") return;
  if (new Date(p.startsAt).getTime() < Date.now()) return;
  const mine = p.responses.find((r) => r.playerId === ctx.me);
  if (mine?.response !== "si") return;
  if (!(await ctx.claim(`adesione:${p.id}:${ctx.me}`))) return;
  const who = shortName(
    players.find((x) => x.id === ctx.me),
    players,
  );
  const yes = p.responses.filter((r) => r.response === "si").length;
  const need = neededPlayers(p.format);
  await ctx.send(await ctx.targets("adesioni", [p.createdBy]), {
    title: `${who} c'è!`,
    body:
      yes >= need
        ? `Ha detto sì alla tua partita di ${dayLabel(p.startsAt)}: siete al completo, si gioca`
        : `Ha detto sì alla tua partita di ${dayLabel(p.startsAt)}. Siete in ${yes} di ${need}`,
    url: "/organizza",
    tag: `proposal-${p.id}`,
  });
}

/** A chi ha proposto: qualcuno preferisce un altro orario o l'altro campetto. */
async function proposalAlternative(ctx: Ctx, p: Proposal, players: Player[]) {
  const mine = p.responses.find((r) => r.playerId === ctx.me);
  if (!mine || mine.response !== "si") return;
  if (!mine.altStartsAt && !mine.altPlace) return;
  if (ctx.me === p.createdBy) return;
  const key = `alt:${p.id}:${ctx.me}:${mine.altStartsAt ?? ""}:${mine.altPlace ?? ""}`;
  if (!(await ctx.claim(key))) return;
  const who = shortName(
    players.find((x) => x.id === ctx.me),
    players,
  );
  const time = timeLabel(mine.altStartsAt ?? p.startsAt);
  const place = mine.altPlace ?? p.place;
  await ctx.send(await ctx.targets("adesioni", [p.createdBy]), {
    title: `${who} propone un'alternativa`,
    body: `Per ${dayOnly(p.startsAt)} meglio alle ${time}${atPlace(place)}. Se va bene anche a te, sposti la partita con un tocco`,
    url: "/organizza",
    tag: `proposal-${p.id}`,
  });
}

/** A chi ha detto "ci sono": la partita è stata spostata (stesso giorno). */
async function proposalMoved(ctx: Ctx, p: Proposal, players: Player[]) {
  if (!(await ctx.claim(`moved:${p.id}:${p.startsAt}:${p.place ?? ""}`)))
    return;
  const who = shortName(
    players.find((x) => x.id === ctx.me),
    players,
  );
  const ids = p.responses
    .filter((r) => r.response !== "no" && r.playerId !== ctx.me)
    .map((r) => r.playerId);
  await ctx.send(await ctx.targets("annullate", ids), {
    title: "Cambio di programma",
    body: `${who} ha spostato la partita di ${dayOnly(p.startsAt)}: ora è alle ${timeLabel(p.startsAt)}${atPlace(p.place)}`,
    url: "/organizza",
    tag: `proposal-${p.id}`,
  });
}

const LEADERS: { stat: StatKey; who: string; unit: string }[] = [
  { stat: "punti", who: "il miglior realizzatore", unit: "punti a partita" },
  {
    stat: "rimbalzi",
    who: "il miglior rimbalzista",
    unit: "rimbalzi a partita",
  },
  { stat: "assist", who: "il miglior assistman", unit: "assist a partita" },
  {
    stat: "difesa",
    who: "il miglior difensore",
    unit: "punti difesa a partita",
  },
  {
    stat: "rubate",
    who: "il miglior ladro di palloni",
    unit: "palle rubate a partita",
  },
  {
    stat: "stoppate",
    who: "il miglior stoppatore",
    unit: "stoppate a partita",
  },
  { stat: "triple", who: "il miglior tiratore da tre", unit: "triple segnate" },
];

async function monthLeaders(
  ctx: Ctx,
  matches: Match[],
  m: Match,
  ids: string[],
) {
  const d = new Date(m.playedAt);
  const now = new Date();
  // Solo per il mese in corso: una partita vecchia inserita dopo non riapre i conti.
  if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth())
    return;
  const period = {
    kind: "month" as const,
    year: d.getFullYear(),
    month: d.getMonth(),
  };
  const scoped = filterMatches(matches, { period, format: "all" });
  const scopedBefore = scoped.filter((x) => x.id !== m.id);
  const stats = ids.map((id) => computePlayerStats(id, scoped));
  const statsBefore = ids.map((id) => computePlayerStats(id, scopedBefore));
  const month = MONTHS_IT[d.getMonth()].toLowerCase();
  const opts = {
    elo: { ratings: new Map(), history: [] } as never,
    allTime: false,
  };
  // Primo da solo, con un valore vero: niente primati a pari merito o a zero.
  const leaderOf = (rows: { playerId: string; value: number }[]) => {
    const [first, second] = rows;
    if (!first || first.value <= 0 || (second && second.value === first.value))
      return null;
    return first;
  };
  for (const l of LEADERS) {
    const def = STAT_BY_KEY.get(l.stat)!;
    const first = leaderOf(leaderboard(def, stats, opts).rows);
    if (!first) continue;
    // Solo quando cambia chi è in testa: chi resta primo non riceve lo stesso messaggio ogni volta.
    const prev = leaderOf(leaderboard(def, statsBefore, opts).rows);
    if (prev?.playerId === first.playerId) continue;
    if (
      !(await ctx.claim(
        `primato:${monthKey(period.year, period.month)}:${l.stat}:${first.playerId}:${m.id}`,
      ))
    )
      continue;
    const value = def.format(first.value).replace(".", ",");
    await ctx.send(await ctx.targets("primati", [first.playerId]), {
      title: `Sei ${l.who} di ${month}!`,
      body: `Nessuno nel gruppo fa meglio: ${value} ${l.unit}. Difendi il primato`,
      url: "/classifiche",
      tag: `primato-${l.stat}`,
    });
  }
}

async function matchSaved(ctx: Ctx, matchId: string) {
  const [players, { data }] = await Promise.all([
    loadPlayers(ctx.sb),
    ctx.sb.from("matches").select(MATCH_SELECT).order("played_at"),
  ]);
  const matches: Match[] = (data ?? []).map(mapMatch);
  const m = matches.find((x) => x.id === matchId);
  if (!m) return;
  const name = (id: string) =>
    shortName(
      players.find((p) => p.id === id),
      players,
    );

  // Il risultato a chi ha giocato (tranne chi l'ha inserita).
  if (await ctx.claim(`match:${m.id}`)) {
    const w = m.scoreA > m.scoreB ? "A" : "B";
    const day = dayOnly(m.playedAt);
    const mvp = matchMvp(m)?.playerId ?? null;
    for (const team of ["A", "B"] as const) {
      const ids = m.players
        .filter((p) => p.team === team)
        .map((p) => p.playerId)
        .filter((id) => id !== ctx.me);
      if (!ids.length) continue;
      const won = team === w;
      const mine = team === "A" ? m.scoreA : m.scoreB;
      const theirs = team === "A" ? m.scoreB : m.scoreA;
      const others = ids.filter((id) => id !== mvp);
      const mvpLine = mvp ? ` MVP della partita: ${name(mvp)}` : "";
      if (others.length)
        await ctx.send(await ctx.targets("partite", others), {
          title: won
            ? `Vittoria ${mine}–${theirs}`
            : `Sconfitta ${mine}–${theirs}`,
          body: won
            ? `Ho segnato la partita di ${day}: avete vinto, bel colpo!${mvpLine}`
            : `Ho segnato la partita di ${day}: stavolta è andata male, ci si rifà la prossima`,
          url: `/partite?m=${m.id}`,
          tag: `match-${m.id}`,
        });
      // L'MVP ha il suo messaggio.
      if (mvp && ids.includes(mvp))
        await ctx.send(await ctx.targets("partite", [mvp]), {
          title: `Vittoria ${mine}–${theirs}, e sei l'MVP!`,
          body: `Ho segnato la partita di ${day}: il migliore della squadra sei tu`,
          url: `/partite?m=${m.id}`,
          tag: `match-${m.id}`,
        });
    }
  }

  // Record del gruppo battuti in questa partita (non il primo record in assoluto).
  const before = new Map(
    groupRecords(matches.filter((x) => x.id !== m.id)).map((r) => [r.key, r]),
  );
  for (const rec of groupRecords(matches)) {
    const old = before.get(rec.key);
    if (
      rec.matchId !== m.id ||
      !old ||
      rec.value <= old.value ||
      !SINGLE_GAME_KEYS.has(rec.key)
    )
      continue;
    if (!(await ctx.claim(`record:${rec.key}:${m.id}`))) continue;
    await ctx.send(await ctx.targets("record", null), {
      title: "Nuovo record!",
      body: `${name(rec.playerIds[0])} ha fatto ${rec.display} in una partita: è il nuovo record del gruppo`,
      url: "/classifiche/albo",
      tag: `record-${rec.key}`,
    });
  }

  // Dopo ogni partita si rifanno i conti del mese: se cambia l'MVP in carica o il primo di
  // una statistica, glielo dico subito (anche se si riprende un primato che aveva già avuto).
  const ids = players.map((p) => p.id);
  const withoutIt = matches.filter((x) => x.id !== m.id);
  const now = new Date();
  const mvp = currentMvp(ids, matches, now, computeElo(matches, ids));
  const mvpBefore = currentMvp(ids, withoutIt, now, computeElo(withoutIt, ids));
  if (
    mvp &&
    mvp.period.kind === "month" &&
    (!mvpBefore ||
      mvpBefore.period.kind !== "month" ||
      mvpBefore.period.month !== mvp.period.month ||
      mvpBefore.entry.playerId !== mvp.entry.playerId)
  ) {
    const key = `mvp:${monthKey(mvp.period.year, mvp.period.month)}:${mvp.entry.playerId}:${m.id}`;
    if (await ctx.claim(key)) {
      const month = MONTHS_IT[mvp.period.month].toLowerCase();
      const dethroned =
        mvpBefore?.period.kind === "month" &&
        mvpBefore.period.month === mvp.period.month
          ? mvpBefore.entry.playerId
          : null;
      const targets = await ctx.targets("mvp", null);
      await ctx.send(
        targets.filter((t) => t.player_id === mvp.entry.playerId),
        {
          title: "Sei tu l'MVP!",
          body: dethroned
            ? `Hai superato ${name(dethroned)}: sei il nuovo MVP di ${month}. Tieniti stretta la corona`
            : `Ti ho messo la corona d'oro: sei l'MVP di ${month}`,
          url: "/classifiche",
          tag: "mvp",
        },
      );
      if (dethroned)
        await ctx.send(
          targets.filter((t) => t.player_id === dethroned),
          {
            title: "Ti hanno preso la corona",
            body: `${name(mvp.entry.playerId)} è il nuovo MVP di ${month}. Alla prossima partita te la riprendi`,
            url: "/classifiche",
            tag: "mvp",
          },
        );
      await ctx.send(
        targets.filter(
          (t) =>
            t.player_id !== mvp.entry.playerId && t.player_id !== dethroned,
        ),
        {
          title: "Nuovo MVP",
          body: `${name(mvp.entry.playerId)} è l'MVP di ${month}. Riesci a strappargli la corona?`,
          url: "/classifiche",
          tag: "mvp",
        },
      );
    }
  }

  // I migliori del mese, statistica per statistica: a chi passa in testa arriva il suo messaggio.
  await monthLeaders(ctx, matches, m, ids);

  // Badge sbloccati con questa partita.
  const months = monthlyHistory(ids, matches, now);
  const seasons = seasonHistory(ids, matches, now);
  for (const line of m.players) {
    const { unlocks } = computeBadges(line.playerId, matches, {
      months,
      seasons,
      now,
    });
    const fresh = unlocks.filter((u) => u.matchId === m.id);
    const best = new Map<string, (typeof fresh)[number]>();
    for (const u of fresh)
      if (!best.has(u.key) || best.get(u.key)!.tier < u.tier)
        best.set(u.key, u);
    const toSend: string[] = [];
    for (const u of best.values()) {
      if (await ctx.claim(`badge:${line.playerId}:${u.key}:${u.tier}`)) {
        toSend.push(`${BADGE_BY_KEY.get(u.key)!.name} ${TIER_NAMES[u.tier]}`);
      }
    }
    if (toSend.length) {
      await ctx.send(await ctx.targets("badge", [line.playerId]), {
        title:
          toSend.length === 1
            ? "Badge sbloccato"
            : `${toSend.length} badge sbloccati`,
        body: `Ti ho appena consegnato ${toSend.join(", ")}. Lo trovi nel profilo`,
        url: "/profilo/badge",
        tag: `badge-${m.id}`,
      });
    }
  }
}

const SINGLE_GAME_KEYS = new Set(["pts", "ast", "reb", "fg3m", "stl", "blk"]);

function dayOnly(iso: string): string {
  return dayLabel(iso).replace(/ alle .*/, "");
}

async function proposalCancelled(ctx: Ctx, p: Proposal, players: Player[]) {
  if (!(await ctx.claim(`cancel:${p.id}`))) return;
  const who = shortName(
    players.find((x) => x.id === p.createdBy),
    players,
  );
  const ids = p.responses
    .filter((r) => r.response !== "no" && r.playerId !== ctx.me)
    .map((r) => r.playerId);
  await ctx.send(await ctx.targets("annullate", ids), {
    title: "Partita annullata",
    body: `${who} ha annullato la partita di ${dayLabel(p.startsAt)}. Se ne propongono un'altra ti avviso io`,
    url: "/organizza",
    tag: `proposal-${p.id}`,
  });
}

interface Reminder {
  player_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  proposal_id: string;
  starts_at: string;
  format: string | null;
  yes_count: number;
  quiet: boolean;
  place?: string | null;
}

/** Chiamato ogni 10 minuti dal database: i promemoria un'ora prima della partita. */
async function tick(req: Request) {
  const secret = req.headers.get("x-campetto-cron");
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!secret)
    return Response.json({ error: "Accesso richiesto" }, { status: 401 });
  if (!privateKey)
    return Response.json(
      { skipped: "VAPID_PRIVATE_KEY mancante" },
      { status: 202 },
    );
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:campetto@example.com",
    VAPID_PUBLIC_KEY,
    privateKey,
  );
  const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.rpc("cron_due_reminders", {
    p_secret: secret,
  });
  if (error)
    return Response.json({ error: "Non autorizzato" }, { status: 403 });
  let sent = 0;
  const night = isNight();
  for (const r of (data as Reminder[] | null) ?? []) {
    if (night && r.quiet) continue;
    const time = new Date(r.starts_at).toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Rome",
    });
    try {
      await webpush.sendNotification(
        { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
        JSON.stringify({
          title: "Tra un'ora si gioca",
          body: `Ti aspetto${r.place ? atPlace(r.place as Place) : " al campetto"} alle ${time}: siete in ${r.yes_count}${r.format ? ` per il ${r.format}` : ""}`,
          url: "/organizza",
          tag: `reminder-${r.proposal_id}`,
        }),
        { TTL: 3600, urgency: "high" },
      );
      sent++;
    } catch {
      /* abbonamento scaduto: lo ripulisce il prossimo invio normale */
    }
  }
  // "Torna a giocare": verso sera (17–19, ora di Roma), a chi non apre l'app da 6 giorni,
  // al massimo una volta a settimana (lo segna il database).
  let nudged = 0;
  const h = romeHour();
  if (h >= 17 && h < 19) {
    const { data: due } = await sb.rpc("cron_due_nudges", { p_secret: secret });
    for (const r of (due as DueNudge[] | null) ?? []) {
      const msg = nudgeFor(
        r.player_id,
        r.n,
        r.nickname || r.first_name,
        r.days,
      );
      try {
        await webpush.sendNotification(
          { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
          JSON.stringify({
            title: msg.title,
            body: msg.body,
            url: msg.url,
            tag: "ritorno",
          }),
          { TTL: 6 * 3600, urgency: "low" },
        );
        nudged++;
      } catch {
        /* abbonamento scaduto */
      }
    }
  }
  // Le notizie nuove (annunci): di giorno, a chi ha acceso "Notizie", una volta sola.
  let news = 0;
  if (h >= 9 && h < 22) {
    const { data: due } = await sb.rpc("cron_due_news", { p_secret: secret });
    for (const r of (due as DueNews[] | null) ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
          JSON.stringify({
            title: r.title,
            body: r.body.length > 140 ? `${r.body.slice(0, 137)}…` : r.body,
            url: "/?notizie=1",
            tag: `news-${r.news_id}`,
          }),
          { TTL: 12 * 3600, urgency: "low" },
        );
        news++;
      } catch {
        /* abbonamento scaduto */
      }
    }
  }
  return Response.json({ sent, nudged, news });
}

interface DueNews {
  news_id: string;
  title: string;
  body: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface DueNudge {
  player_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  first_name: string;
  nickname: string | null;
  days: number;
  n: number;
}

export async function POST(req: Request) {
  if (req.headers.get("x-campetto-cron")) return tick(req);
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token)
    return Response.json({ error: "Accesso richiesto" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Richiesta non valida" }, { status: 400 });

  const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: user, error } = await sb.auth.getUser(token);
  if (error || !user.user)
    return Response.json({ error: "Sessione non valida" }, { status: 401 });
  const { data: meId } = await sb.rpc("current_player_id");
  if (!meId)
    return Response.json({ error: "Non sei nel gruppo" }, { status: 403 });

  if (!privateKey)
    return Response.json(
      { skipped: "VAPID_PRIVATE_KEY mancante" },
      { status: 202 },
    );
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:campetto@example.com",
    VAPID_PUBLIC_KEY,
    privateKey,
  );

  const ctx = new Ctx(sb, meId as string, await loadPlayers(sb));
  const body = parsed.data;
  try {
    if (body.type === "test") {
      ctx.quiet.clear();
      await ctx.send(await ctx.targets("proposte", [ctx.me]), {
        title: "Ci sono anch'io!",
        body: "Perfetto, da ora ti avviso io quando si gioca",
        url: "/",
        tag: "test",
      });
    } else if (body.type === "proposal_new") {
      const [players, { data }] = await Promise.all([
        loadPlayers(sb),
        sb
          .from("proposals")
          .select(PROPOSAL_SELECT)
          .eq("id", body.proposalId)
          .single(),
      ]);
      if (data) {
        const p = mapProposal(data);
        const who = shortName(
          players.find((x) => x.id === p.createdBy),
          players,
        );
        await ctx.send(await ctx.targets("proposte", null, p.createdBy), {
          title: "Si gioca?",
          body: `${who} propone ${dayLabel(p.startsAt)}${atPlace(p.place)}${p.format ? ` per un ${p.format}` : ""}. Ti tengo un posto?`,
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
      const [players, { data }] = await Promise.all([
        loadPlayers(sb),
        sb
          .from("proposals")
          .select(PROPOSAL_SELECT)
          .eq("id", body.proposalId)
          .single(),
      ]);
      if (data) {
        const p = mapProposal(data);
        const { threshold } = await proposalSummary(ctx, p, players);
        // Se si è appena arrivati al completo, "Si gioca!" l'ha già ricevuto anche lui.
        if (!threshold) await proposalJoined(ctx, p, players);
      }
    } else if (
      body.type === "proposal_alternative" ||
      body.type === "proposal_moved"
    ) {
      const [players, { data }] = await Promise.all([
        loadPlayers(sb),
        sb
          .from("proposals")
          .select(PROPOSAL_SELECT)
          .eq("id", body.proposalId)
          .single(),
      ]);
      if (data) {
        const p = mapProposal(data);
        if (body.type === "proposal_alternative")
          await proposalAlternative(ctx, p, players);
        else await proposalMoved(ctx, p, players);
      }
    } else if (body.type === "proposal_cancelled") {
      const [players, { data }] = await Promise.all([
        loadPlayers(sb),
        sb
          .from("proposals")
          .select(PROPOSAL_SELECT)
          .eq("id", body.proposalId)
          .single(),
      ]);
      if (data) await proposalCancelled(ctx, mapProposal(data), players);
    } else if (body.type === "feedback") {
      // Avvisa l'amministratore che è arrivata una segnalazione.
      const players = await loadPlayers(sb);
      const admins = players
        .filter((p) => p.isAdmin && p.id !== ctx.me)
        .map((p) => p.id);
      const who = shortName(
        players.find((p) => p.id === ctx.me),
        players,
      );
      await ctx.send(await ctx.targets("segnalazioni" as NotifyKind, admins), {
        title: body.kind === "idea" ? "Una nuova idea" : "Nuova segnalazione",
        body: `${who} mi ha scritto dall'app: la guardo nel prossimo controllo`,
        url: "/profilo/impostazioni",
        tag: "feedback",
      });
    } else if (body.type === "flush") {
      const [players, { data }] = await Promise.all([
        loadPlayers(sb),
        sb
          .from("proposals")
          .select(PROPOSAL_SELECT)
          .eq("status", "aperta")
          .gte("starts_at", new Date().toISOString()),
      ]);
      for (const row of data ?? [])
        await proposalSummary(ctx, mapProposal(row), players);
    } else if (body.type === "match_saved") {
      await matchSaved(ctx, body.matchId);
    }
  } catch {
    return Response.json(
      { error: "Non sono riuscito a mandare le notifiche" },
      { status: 500 },
    );
  }
  return Response.json({ sent: ctx.sent });
}
