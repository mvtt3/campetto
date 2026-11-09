-- Partite annullate per il meteo: chi annulla può dire che è per la pioggia.
-- Allora la partita non sparisce: per tutto quel giorno, in Home e nel calendario, si vede
-- "Annullata per pioggia" con Spicchio sotto la nuvola, al posto della partita in corso.

alter table public.proposals add column if not exists cancel_reason text
  check (cancel_reason is null or cancel_reason in ('meteo', 'pochi', 'altro'));
alter table public.proposals add column if not exists cancelled_at timestamptz;
