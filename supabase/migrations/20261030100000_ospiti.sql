-- Gli ospiti (30/10/2026): chi si unisce al campetto per una partita senza far parte del
-- gruppo. Giocano e hanno il loro tabellino in quella partita, ma non entrano in classifiche,
-- statistiche, badge o notifiche: li crea solo l'amministratore quando inserisce la partita.

alter table public.players
  add column if not exists guest boolean not null default false;

create index if not exists players_guest_idx on public.players (guest) where guest;
