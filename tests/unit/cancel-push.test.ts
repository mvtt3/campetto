import { describe, expect, it } from "vitest";
import { autoCancelledPush, cancelledPush } from "@/lib/notifications/cancel";

const now = new Date("2026-11-04T08:00:00Z");
const m = { startsAt: "2026-11-04T17:00:00Z", place: "niche" as const };

describe("notifiche di partita annullata", () => {
  it("per pioggia: dice quale partita e porta al calendario di quel giorno", () => {
    const p = cancelledPush(m, "meteo", "Springs", now);
    expect(p.title).toBe("🌧️ Partita annullata per pioggia");
    expect(p.body).toBe("La partita di oggi alle 18:00 al Niche salta per il meteo. Appena ne propongono un'altra ti avviso");
    expect(p.url).toBe("/organizza?giorno=2026-11-04");
  });
  it("annullata a mano: dice chi l'ha annullata", () => {
    expect(cancelledPush(m, null, "Valerio", now).body).toMatch(/^Valerio ha annullato la partita di oggi alle 18:00 al Niche/);
  });
  it("annullata da sola: a chi l'ha proposta come rimediare, agli altri che non si gioca", () => {
    const mine = autoCancelledPush({ ...m, yes: 2, min: 4 }, true, now);
    expect(mine.title).toBe("Partita annullata: mancano giocatori");
    expect(mine.body).toContain('si è fermata a 2 "ci sono" su 4');
    expect(mine.url).toBe("/organizza?nuova=1");
    const other = autoCancelledPush({ ...m, yes: 2, min: 4 }, false, now);
    expect(other.body).toBe("Per oggi alle 18:00 al Niche eravate in 2, ne servivano 4. Appena ne propongono un'altra ti avviso");
  });
});
