import webpush from "web-push";
import { ONESIGNAL_APP_ID, VAPID_PUBLIC_KEY } from "@/lib/config";

/** Un telefono a cui mandare: l'indirizzo del telefono, o "onesignal:<numero>". */
export interface PushRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Il contenuto di una notifica, uguale per i due sistemi. */
export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag?: string;
  actions?: { action: string; title: string }[];
  data?: Record<string, string>;
}

export interface PushOptions {
  /** Per quanto tempo il servizio prova a consegnarla, in secondi. */
  ttl: number;
  urgency: "high" | "normal" | "low";
}

export const ONESIGNAL_PREFIX = "onesignal:";
const ONESIGNAL_API = "https://api.onesignal.com/notifications?c=push";

export const isOneSignal = (endpoint: string) =>
  endpoint.startsWith(ONESIGNAL_PREFIX);

let vapidReady: boolean | null = null;
/** Le chiavi del sistema di prima: senza, si manda solo con OneSignal. */
function vapid(): boolean {
  if (vapidReady !== null) return vapidReady;
  const key = process.env.VAPID_PRIVATE_KEY;
  if (!key) return (vapidReady = false);
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:campetto@example.com",
    VAPID_PUBLIC_KEY,
    key,
  );
  return (vapidReady = true);
}

const oneSignalKey = () => process.env.ONESIGNAL_REST_API_KEY || "";

/** C'è almeno un modo di mandare notifiche? */
export function pushReady(): boolean {
  return vapid() || Boolean(ONESIGNAL_APP_ID && oneSignalKey());
}

/** Dove porta il tocco su un pulsante ("Ci sono" / "No"): come faceva la nostra sw.js. */
function buttonUrl(msg: PushMessage, action: string): string {
  const proposalId = msg.data?.proposalId;
  return proposalId ? `/organizza?p=${proposalId}&r=${action}` : msg.url;
}

/**
 * La richiesta per OneSignal. Senza un "topic" OneSignal dà a tutte le notifiche lo stesso
 * gruppo e l'ultima cancellerebbe le altre: quando manca, se ne inventa uno solo per lei.
 */
export function oneSignalBody(
  msg: PushMessage,
  subscriptionIds: string[],
  opts: PushOptions,
  origin: string,
) {
  const abs = (path: string) => new URL(path, origin).href;
  return {
    app_id: ONESIGNAL_APP_ID,
    include_subscription_ids: subscriptionIds,
    headings: { en: msg.title },
    contents: { en: msg.body || " " },
    url: abs(msg.url),
    chrome_web_icon: abs("/icons/icon-192.png"),
    chrome_web_badge: abs("/icons/badge-96.png"),
    web_push_topic:
      msg.tag ??
      `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    ttl: opts.ttl,
    priority: opts.urgency === "high" ? 10 : 5,
    ...(msg.actions?.length
      ? {
          web_buttons: msg.actions.slice(0, 2).map((a) => ({
            id: a.action,
            text: a.title,
            url: abs(buttonUrl(msg, a.action)),
          })),
        }
      : {}),
    ...(msg.data ? { data: msg.data } : {}),
  };
}

export interface DeliverResult {
  sent: number;
  /** Iscrizioni che non esistono più: si possono togliere dal server. */
  dead: string[];
}

/** Manda la stessa notifica a questi telefoni, ognuno con il suo sistema. */
export async function deliver(
  rows: PushRow[],
  msg: PushMessage,
  opts: PushOptions,
  origin: string,
): Promise<DeliverResult> {
  const result: DeliverResult = { sent: 0, dead: [] };
  const legacy = rows.filter((r) => !isOneSignal(r.endpoint));
  const viaOs = rows.filter((r) => isOneSignal(r.endpoint));

  if (legacy.length && vapid())
    await Promise.all(
      legacy.map(async (r) => {
        try {
          await webpush.sendNotification(
            { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
            JSON.stringify(msg),
            { TTL: opts.ttl, urgency: opts.urgency },
          );
          result.sent++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) result.dead.push(r.endpoint);
        }
      }),
    );

  const key = oneSignalKey();
  if (viaOs.length && ONESIGNAL_APP_ID && key) {
    const ids = [
      ...new Set(viaOs.map((r) => r.endpoint.slice(ONESIGNAL_PREFIX.length))),
    ];
    try {
      const res = await fetch(ONESIGNAL_API, {
        method: "POST",
        headers: {
          Authorization: `Key ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(oneSignalBody(msg, ids, opts, origin)),
      });
      const json = (await res.json().catch(() => ({}))) as {
        id?: string;
        errors?: unknown;
      };
      // Le iscrizioni spente o sconosciute OneSignal le salta da solo: non si contano. Dal
      // server non si tolgono qui (una appena creata può risultare spenta per qualche istante):
      // le ripulisce il telefono quando cambia iscrizione o spegne le notifiche.
      const invalid =
        json.errors && !Array.isArray(json.errors)
          ? ((json.errors as { invalid_player_ids?: string[] })
              .invalid_player_ids?.length ?? 0)
          : 0;
      if (res.ok && json.id) result.sent += Math.max(0, ids.length - invalid);
      else
        console.error(
          "OneSignal non ha mandato:",
          res.status,
          JSON.stringify(json.errors ?? null).slice(0, 300),
        );
    } catch (e) {
      // OneSignal non risponde: si riprova al prossimo invio.
      console.error("OneSignal non risponde:", String(e).slice(0, 200));
    }
  }
  return result;
}
