-- L'MVP di una partita scelto dall'amministratore, al posto di quello calcolato dall'app.
-- Vuoto = l'app lo calcola come sempre (il migliore della squadra che ha vinto).
alter table public.matches
  add column if not exists mvp_player_id uuid references public.players(id) on delete set null;
comment on column public.matches.mvp_player_id is
  'MVP scelto a mano per questa partita; null = calcolato dall''app.';
