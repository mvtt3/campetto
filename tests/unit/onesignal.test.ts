import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Backend } from "@/lib/data/backend";

const sendNotification = vi.fn(async () => ({}));
vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification },
}));

const APP_ID = "11111111-2222-4333-8444-555555555555";

/* ----------------------------------------------------------------------------------------- */
/* Server: la stessa notifica parte con il sistema giusto per ogni telefono                   */
/* ----------------------------------------------------------------------------------------- */

describe("invio: OneSignal e il sistema di prima insieme", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ONESIGNAL_APP_ID", APP_ID);
    vi.stubEnv("ONESIGNAL_REST_API_KEY", "chiave-di-prova");
    vi.stubEnv("VAPID_PRIVATE_KEY", "privata");
    sendNotification.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("la richiesta per OneSignal ha titolo, testo, indirizzi completi e i pulsanti della proposta", async () => {
    const { oneSignalBody } = await import("@/lib/notifications/deliver");
    const body = oneSignalBody(
      {
        title: "Si gioca?",
        body: "Luca propone sabato",
        url: "/organizza",
        tag: "proposal-p1",
        actions: [
          { action: "si", title: "Ci sono" },
          { action: "no", title: "No" },
        ],
        data: { proposalId: "p1" },
      },
      ["a", "b"],
      { ttl: 3600, urgency: "high" },
      "https://campetto.vercel.app",
    );
    expect(body).toMatchObject({
      app_id: APP_ID,
      include_subscription_ids: ["a", "b"],
      headings: { en: "Si gioca?" },
      contents: { en: "Luca propone sabato" },
      url: "https://campetto.vercel.app/organizza",
      chrome_web_icon: "https://campetto.vercel.app/icons/icon-192.png",
      chrome_web_badge: "https://campetto.vercel.app/icons/badge-96.png",
      web_push_topic: "proposal-p1",
      ttl: 3600,
      priority: 10,
      web_buttons: [
        {
          id: "si",
          text: "Ci sono",
          url: "https://campetto.vercel.app/organizza?p=p1&r=si",
        },
        {
          id: "no",
          text: "No",
          url: "https://campetto.vercel.app/organizza?p=p1&r=no",
        },
      ],
      data: { proposalId: "p1" },
    });
  });

  it("senza tag ogni notifica ha il suo gruppo: una non cancella l'altra", async () => {
    const { oneSignalBody } = await import("@/lib/notifications/deliver");
    const msg = { title: "A", body: "b", url: "/" };
    const opts = { ttl: 60, urgency: "normal" as const };
    const one = oneSignalBody(msg, ["x"], opts, "https://x.it");
    const two = oneSignalBody(msg, ["x"], opts, "https://x.it");
    expect(one.web_push_topic).toBeTruthy();
    expect(one.web_push_topic).not.toBe(two.web_push_topic);
    expect(one.priority).toBe(5);
    expect(one).not.toHaveProperty("web_buttons");
  });

  it("i telefoni passati a OneSignal ricevono da OneSignal, gli altri come prima", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ id: "notifica-1" }, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { deliver } = await import("@/lib/notifications/deliver");
    const res = await deliver(
      [
        { endpoint: "onesignal:os-1", p256dh: "onesignal", auth: "onesignal" },
        { endpoint: "onesignal:os-2", p256dh: "onesignal", auth: "onesignal" },
        { endpoint: "https://fcm.googleapis.com/x", p256dh: "p", auth: "a" },
      ],
      { title: "Ciao", body: "Prova", url: "/" },
      { ttl: 60, urgency: "normal" },
      "https://campetto.vercel.app",
    );
    expect(res.sent).toBe(3);
    expect(sendNotification).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.onesignal.com/notifications?c=push");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Key chiave-di-prova",
    );
    expect(JSON.parse(String(init.body)).include_subscription_ids).toEqual([
      "os-1",
      "os-2",
    ]);
  });

  it("se OneSignal rifiuta l'invio non si conta come partita", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { id: "", errors: ["All included players are not subscribed"] },
          { status: 200 },
        ),
      ),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { deliver } = await import("@/lib/notifications/deliver");
    const res = await deliver(
      [{ endpoint: "onesignal:os-1", p256dh: "o", auth: "o" }],
      { title: "Ciao", body: "Prova", url: "/" },
      { ttl: 60, urgency: "normal" },
      "https://campetto.vercel.app",
    );
    expect(res.sent).toBe(0);
    // Le righe di OneSignal non si cancellano per un rifiuto: le ripulisce il telefono.
    expect(res.dead).toEqual([]);
  });

  it("senza la chiave di OneSignal le sue righe si saltano, senza errori", async () => {
    vi.stubEnv("ONESIGNAL_REST_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { deliver } = await import("@/lib/notifications/deliver");
    const res = await deliver(
      [{ endpoint: "onesignal:os-1", p256dh: "o", auth: "o" }],
      { title: "Ciao", body: "Prova", url: "/" },
      { ttl: 60, urgency: "normal" },
      "https://campetto.vercel.app",
    );
    expect(res.sent).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/* ----------------------------------------------------------------------------------------- */
/* Telefono: accensione, passaggio da sola e spegnimento con OneSignal                        */
/* ----------------------------------------------------------------------------------------- */

const LEGACY = "https://fcm.googleapis.com/fcm/send/vecchia";

function fakePhone(opts: { legacy?: boolean } = {}) {
  const legacy = opts.legacy
    ? {
        endpoint: LEGACY,
        unsubscribe: vi.fn(async () => true),
        toJSON: () => ({ endpoint: LEGACY, keys: { p256dh: "p", auth: "a" } }),
      }
    : null;
  const pushManager = {
    getSubscription: vi.fn(async () => legacy),
    subscribe: vi.fn(async () => ({
      endpoint: "https://fcm.googleapis.com/fcm/send/nuova",
      unsubscribe: vi.fn(async () => true),
      toJSON: () => ({
        endpoint: "https://fcm.googleapis.com/fcm/send/nuova",
        keys: { p256dh: "p", auth: "a" },
      }),
    })),
  };
  const reg = { active: { state: "activated" }, pushManager };
  const g = globalThis as Record<string, unknown>;
  const store = new Map<string, string>();
  g.window = Object.assign(globalThis, {
    PushManager: class {},
    matchMedia: () => ({ matches: false }),
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
  g.document = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    // Lo script di OneSignal "c'è già": il finto OneSignal risponde subito.
    querySelector: () => ({}),
  };
  g.Notification = {
    permission: "granted",
    requestPermission: vi.fn(async () => "granted"),
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      userAgent: "Mozilla/5.0 (Linux; Android 14; SM-A057G) Chrome/131",
      platform: "Linux",
      maxTouchPoints: 5,
      onLine: true,
      serviceWorker: {
        controller: {},
        getRegistration: vi.fn(async () => reg),
        register: vi.fn(async () => reg),
        ready: Promise.resolve(reg),
      },
    },
  });
  return { pushManager, store };
}

/** Un OneSignal finto: l'iscrizione nasce quando gli si chiede il permesso. */
function fakeOneSignal() {
  let id: string | null = null;
  let optedIn = false;
  const listeners = new Set<(e: unknown) => void>();
  const os = {
    init: vi.fn(async () => {}),
    login: vi.fn(async () => {}),
    Notifications: {
      requestPermission: vi.fn(async () => {
        id = "os-123";
        optedIn = true;
        for (const l of listeners)
          l({ previous: {}, current: { id, optedIn } });
        return true;
      }),
    },
    User: {
      PushSubscription: {
        get id() {
          return id;
        },
        get token() {
          return id ? "https://fcm.googleapis.com/fcm/send/onesignal" : null;
        },
        get optedIn() {
          return optedIn;
        },
        optIn: vi.fn(async () => {}),
        optOut: vi.fn(async () => {
          optedIn = false;
        }),
        addEventListener: (_: string, l: (e: unknown) => void) =>
          void listeners.add(l),
        removeEventListener: (_: string, l: (e: unknown) => void) =>
          void listeners.delete(l),
      },
    },
  };
  (globalThis as Record<string, unknown>).OneSignalDeferred = {
    push: (cb: (o: typeof os) => unknown) => void cb(os),
  };
  return os;
}

const backend = () =>
  ({
    savePushSubscription: vi.fn(async () => {}),
    hasPushSubscription: vi.fn(async () => false),
    removePushSubscription: vi.fn(async () => {}),
  }) as unknown as Backend;

const ADMIN = { id: "matteo", isAdmin: true };
const AMICO = { id: "luca", isAdmin: false };

describe("telefono con OneSignal (prima solo l'amministratore)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubEnv("NEXT_PUBLIC_ONESIGNAL_APP_ID", APP_ID);
    delete (globalThis as Record<string, unknown>).OneSignalDeferred;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("l'amministratore che accende passa da OneSignal e il server salva la sua iscrizione", async () => {
    fakePhone({ legacy: true });
    const os = fakeOneSignal();
    const { configurePush, enablePush } =
      await import("@/lib/notifications/push-client");
    configurePush(ADMIN);
    const b = backend();
    await expect(enablePush(b)).resolves.toBe("ok");
    expect(os.init).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: APP_ID,
        serviceWorkerPath: "sw.js",
        welcomeNotification: { disable: true },
      }),
    );
    expect(os.login).toHaveBeenCalledWith("matteo");
    expect(b.savePushSubscription).toHaveBeenCalledWith({
      endpoint: "onesignal:os-123",
      keys: { p256dh: "onesignal", auth: "onesignal" },
    });
    // La vecchia iscrizione del telefono non resta sul server.
    expect(b.removePushSubscription).toHaveBeenCalledWith(LEGACY);
  });

  it("gli amici restano col sistema di prima finché non si apre a tutti", async () => {
    const { pushManager } = fakePhone();
    const os = fakeOneSignal();
    const { configurePush, enablePush } =
      await import("@/lib/notifications/push-client");
    configurePush(AMICO);
    const b = backend();
    await expect(enablePush(b)).resolves.toBe("ok");
    expect(os.init).not.toHaveBeenCalled();
    expect(pushManager.subscribe).toHaveBeenCalledOnce();
    expect(b.savePushSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "https://fcm.googleapis.com/fcm/send/nuova",
      }),
    );
  });

  it("all'apertura chi aveva già le notifiche passa a OneSignal da solo, senza chiedere nulla", async () => {
    fakePhone({ legacy: true });
    const os = fakeOneSignal();
    const { configurePush, checkPush } =
      await import("@/lib/notifications/push-client");
    configurePush(ADMIN);
    const b = backend();
    const done = checkPush(b);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(done).resolves.toBe(true);
    expect(os.Notifications.requestPermission).toHaveBeenCalledOnce();
    expect(b.savePushSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "onesignal:os-123" }),
    );
    expect(b.removePushSubscription).toHaveBeenCalledWith(LEGACY);
  });

  it("chi le aveva spente a mano non se le ritrova accese", async () => {
    const { store } = fakePhone({ legacy: true });
    store.set("campetto:notifiche-volute", "0");
    const os = fakeOneSignal();
    const { configurePush, checkPush } =
      await import("@/lib/notifications/push-client");
    configurePush(ADMIN);
    const done = checkPush(backend());
    await vi.advanceTimersByTimeAsync(2000);
    await expect(done).resolves.toBe(false);
    expect(os.init).not.toHaveBeenCalled();
  });

  it("spegnere toglie l'iscrizione da OneSignal e dal server", async () => {
    fakePhone();
    const os = fakeOneSignal();
    const { configurePush, enablePush, disablePush } =
      await import("@/lib/notifications/push-client");
    configurePush(ADMIN);
    const b = backend();
    await enablePush(b);
    await disablePush(b);
    expect(os.User.PushSubscription.optOut).toHaveBeenCalledOnce();
    expect(b.removePushSubscription).toHaveBeenCalledWith("onesignal:os-123");
  });
});
