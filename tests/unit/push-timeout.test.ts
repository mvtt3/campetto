import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Backend } from "@/lib/data/backend";

/** Un telefono finto: permesso, service worker e servizio notifiche li decide il test. */
function fakePhone(opts: {
  permission?: NotificationPermission;
  ask?: () => Promise<NotificationPermission>;
  subscribe?: () => Promise<unknown>;
}) {
  const sub = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    unsubscribe: vi.fn(async () => true),
    toJSON: () => ({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      keys: { p256dh: "p", auth: "a" },
    }),
  };
  const pushManager = {
    getSubscription: vi.fn(async () => null),
    subscribe: vi.fn(opts.subscribe ?? (async () => sub)),
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
  const docListeners = new Map<string, () => void>();
  g.document = {
    addEventListener: (t: string, f: () => void) => docListeners.set(t, f),
    removeEventListener: (t: string) => docListeners.delete(t),
  };
  g.Notification = {
    permission: opts.permission ?? "granted",
    requestPermission: vi.fn(opts.ask ?? (async () => "granted")),
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
  return { sub, pushManager, store, docListeners };
}

/** Il permesso cambia fuori dall'app (impostazioni, controlli del sito). */
function setPermission(p: NotificationPermission) {
  (
    Notification as unknown as { permission: NotificationPermission }
  ).permission = p;
}

const lateEvents = () =>
  (window.dispatchEvent as ReturnType<typeof vi.fn>).mock.calls.map(
    (c) => (c[0] as Event).type,
  );

const backend = (over: Partial<Backend> = {}) =>
  ({
    savePushSubscription: vi.fn(async () => {}),
    hasPushSubscription: vi.fn(async () => true),
    removePushSubscription: vi.fn(async () => {}),
    ...over,
  }) as unknown as Backend;

const never = () => new Promise<never>(() => {});

describe("accensione delle notifiche: mai una rotellina infinita", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("quando va tutto bene si accende e salva l'iscrizione", async () => {
    fakePhone({});
    const { enablePush } = await import("@/lib/notifications/push-client");
    const b = backend();
    await expect(enablePush(b)).resolves.toBe("ok");
    expect(b.savePushSubscription).toHaveBeenCalledOnce();
  });

  it("il servizio notifiche che non risponde si ferma dopo il tempo massimo, col passaggio giusto", async () => {
    fakePhone({ subscribe: never });
    const { enablePush, PushStuck, PUSH_LIMITS } =
      await import("@/lib/notifications/push-client");
    const p = enablePush(backend());
    const seen = p.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(PUSH_LIMITS.iscrizione + 10);
    const e = await seen;
    expect(e).toBeInstanceOf(PushStuck);
    expect(e).toMatchObject({ step: "iscrizione", timedOut: true });
  });

  it("se il telefono risponde in ritardo, l'iscrizione si salva lo stesso e la pagina viene avvisata", async () => {
    let answer: (v: unknown) => void = () => {};
    const { sub } = fakePhone({
      subscribe: () => new Promise((r) => (answer = r)),
    });
    const { enablePush, PUSH_LIMITS, PUSH_LATE_EVENT } =
      await import("@/lib/notifications/push-client");
    const b = backend();
    const seen = enablePush(b).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(PUSH_LIMITS.iscrizione + 10);
    await seen;
    answer(sub);
    await vi.advanceTimersByTimeAsync(0);
    expect(b.savePushSubscription).toHaveBeenCalledOnce();
    expect(lateEvents()).toContain(PUSH_LATE_EVENT);
  });

  it("il server che non risponde al salvataggio non lascia la rotellina accesa", async () => {
    fakePhone({});
    const { enablePush, PUSH_LIMITS } =
      await import("@/lib/notifications/push-client");
    const seen = enablePush(backend({ savePushSubscription: never })).catch(
      (e: unknown) => e,
    );
    await vi.advanceTimersByTimeAsync(PUSH_LIMITS.salvataggio + 10);
    expect(await seen).toMatchObject({ step: "salvataggio", timedOut: true });
  });

  it("permesso già negato: niente richiesta, risposta subito", async () => {
    fakePhone({ permission: "denied" });
    const { enablePush } = await import("@/lib/notifications/push-client");
    await expect(enablePush(backend())).resolves.toBe("denied");
    expect(Notification.requestPermission).not.toHaveBeenCalled();
  });

  it("Chrome bloccato nelle impostazioni del telefono conta come permesso negato", async () => {
    fakePhone({
      subscribe: async () => {
        throw Object.assign(
          new Error("Registration failed - permission denied"),
          {
            name: "NotAllowedError",
          },
        );
      },
    });
    const { enablePush } = await import("@/lib/notifications/push-client");
    await expect(enablePush(backend())).resolves.toBe("denied");
  });

  it("il controllo all'apertura bloccato si arrende e non ferma l'accensione a mano", async () => {
    fakePhone({});
    const { checkPush, enablePush, PUSH_LIMITS } =
      await import("@/lib/notifications/push-client");
    // Il telefono ha un'iscrizione che il server non conosce, e il servizio notifiche non risponde.
    const phone = fakePhone({ subscribe: never });
    phone.pushManager.getSubscription.mockResolvedValue({
      endpoint: "https://fcm.googleapis.com/fcm/send/old",
      unsubscribe: async () => true,
    } as never);
    const check = checkPush(
      backend({ hasPushSubscription: async () => false }),
    );
    await vi.advanceTimersByTimeAsync(PUSH_LIMITS.iscrizione + 10);
    await expect(check).resolves.toBe(false);
    // A mano, col telefono che ora risponde.
    fakePhone({});
    await expect(enablePush(backend())).resolves.toBe("ok");
  });
});

describe("il permesso che non arriva subito", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("richiesta scaduta senza risposta (la richiesta leggera di Chrome): non è un blocco", async () => {
    fakePhone({ permission: "default", ask: async () => "default" });
    const { enablePush } = await import("@/lib/notifications/push-client");
    const b = backend();
    await expect(enablePush(b)).resolves.toBe("dismissed");
    expect(b.savePushSubscription).not.toHaveBeenCalled();
  });

  it("richiesta rifiutata: bloccato", async () => {
    fakePhone({ permission: "default", ask: async () => "denied" });
    const { enablePush } = await import("@/lib/notifications/push-client");
    await expect(enablePush(backend())).resolves.toBe("denied");
  });

  it("il sì che arriva dopo il tempo massimo accende le notifiche da solo", async () => {
    let answer: (p: NotificationPermission) => void = () => {};
    fakePhone({
      permission: "default",
      ask: () => new Promise((r) => (answer = r)),
    });
    const { enablePush, PUSH_LIMITS, PUSH_LATE_EVENT } =
      await import("@/lib/notifications/push-client");
    const b = backend();
    const seen = enablePush(b).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(PUSH_LIMITS.permesso + 10);
    expect(await seen).toMatchObject({ step: "permesso", timedOut: true });
    setPermission("granted");
    answer("granted");
    await vi.advanceTimersByTimeAsync(0);
    expect(b.savePushSubscription).toHaveBeenCalledOnce();
    expect(lateEvents()).toContain(PUSH_LATE_EVENT);
  });

  it("permesso dato dalle impostazioni: si iscrive da solo, ma solo se le notifiche erano state chieste", async () => {
    fakePhone({ permission: "granted" });
    const { resumePush, setWantPush } =
      await import("@/lib/notifications/push-client");
    const b = backend();
    await expect(resumePush(b)).resolves.toBe(false);
    expect(b.savePushSubscription).not.toHaveBeenCalled();
    setWantPush(true);
    await expect(resumePush(b)).resolves.toBe(true);
    expect(b.savePushSubscription).toHaveBeenCalledOnce();
  });

  it("spente a mano: il permesso che resta non le riaccende", async () => {
    fakePhone({});
    const { enablePush, disablePush, resumePush } =
      await import("@/lib/notifications/push-client");
    const b = backend();
    await expect(enablePush(b)).resolves.toBe("ok");
    await disablePush(b);
    await expect(resumePush(b)).resolves.toBe(false);
    expect(b.savePushSubscription).toHaveBeenCalledOnce();
  });

  it("all'apertura: il telefono ha perso l'iscrizione ma il permesso c'è, ne rifà una", async () => {
    const phone = fakePhone({ permission: "granted" });
    phone.store.set("campetto:notifiche-volute", "1");
    const { checkPush } = await import("@/lib/notifications/push-client");
    const b = backend();
    await expect(checkPush(b)).resolves.toBe(true);
    expect(b.savePushSubscription).toHaveBeenCalledOnce();
  });

  it("all'apertura: mai chieste su questo telefono, non si iscrive da solo", async () => {
    fakePhone({ permission: "granted" });
    const { checkPush } = await import("@/lib/notifications/push-client");
    const b = backend();
    await expect(checkPush(b)).resolves.toBe(false);
    expect(b.savePushSubscription).not.toHaveBeenCalled();
  });

  it("tornando nell'app col permesso cambiato, la pagina lo sa", async () => {
    const phone = fakePhone({ permission: "default" });
    const { watchPermission } = await import("@/lib/notifications/push-client");
    const seen: NotificationPermission[] = [];
    const stop = watchPermission((p) => seen.push(p));
    phone.docListeners.get("visibilitychange")?.();
    expect(seen).toEqual([]);
    setPermission("granted");
    phone.docListeners.get("visibilitychange")?.();
    expect(seen).toEqual(["granted"]);
    stop();
  });
});
