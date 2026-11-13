import type { Match, Player } from "./types";

/**
 * Separa ospiti ed extra dal gruppo. In `players` restano solo quelli del gruppo; nelle partite
 * le righe di ospiti ed extra passano in `guests` (per il tabellino) e spariscono da `players` ed
 * `events`: così statistiche, classifiche, MVP, record, badge e notizie non li vedono mai.
 * Gli extra (senza app, con un nome fisso) tornano anche in `extras`, per calendario e squadre.
 */
export function splitGuests(
  allPlayers: Player[],
  matches: Match[],
): { players: Player[]; guests: Player[]; extras: Player[]; matches: Match[] } {
  const guests = allPlayers.filter((p) => p.guest || p.extra);
  const extras = guests.filter((p) => p.extra && !p.archived);
  if (!guests.length) return { players: allPlayers, guests, extras, matches };
  const ids = new Set(guests.map((p) => p.id));
  return {
    players: allPlayers.filter((p) => !p.guest && !p.extra),
    guests,
    extras,
    matches: matches.map((m) => {
      const g = m.players.filter((l) => ids.has(l.playerId));
      if (!g.length) return m;
      return {
        ...m,
        players: m.players.filter((l) => !ids.has(l.playerId)),
        events: m.events.filter(
          (e) =>
            !ids.has(e.playerId) &&
            !(e.targetPlayerId && ids.has(e.targetPlayerId)),
        ),
        guests: g,
      };
    }),
  };
}

/** La partita com'è stata giocata, ospiti compresi: per il tabellino e per modificarla. */
export function withGuestLines(m: Match): Match {
  return m.guests?.length ? { ...m, players: [...m.players, ...m.guests] } : m;
}
