-- Campetto Star: sui salvataggi si legge, si crea e si aggiorna il proprio, niente altro
-- (i permessi predefiniti davano anche TRUNCATE, che scavalca le regole di riga).
revoke all on public.game_saves from anon, authenticated;
grant select, insert, update on public.game_saves to authenticated;
