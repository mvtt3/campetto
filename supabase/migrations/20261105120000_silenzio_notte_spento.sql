-- Silenzio di notte: spento per tutti finché non lo accende chi lo vuole.
-- Si spegne per tutti; da qui in poi lo accende solo chi lo sceglie.

update public.players
   set notify_prefs = coalesce(notify_prefs, '{}'::jsonb) || '{"notte": false}'::jsonb;

alter table public.players
  alter column notify_prefs set default
  '{"proposte":true,"riepiloghi":true,"mvp":true,"badge":true,"conferme":true,"notte":false}'::jsonb;
