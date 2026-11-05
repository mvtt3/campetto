-- Silenzio di notte (5/11/2026): spento per tutti finché non lo accende chi lo vuole.
-- Prima era acceso di partenza (e si salvava acceso al primo tocco di un altro interruttore),
-- quindi lo si rimette spento a tutti; da qui in poi lo accende solo chi lo sceglie.

update public.players
   set notify_prefs = coalesce(notify_prefs, '{}'::jsonb) || '{"notte": false}'::jsonb;

alter table public.players
  alter column notify_prefs set default
  '{"proposte":true,"riepiloghi":true,"mvp":true,"badge":true,"conferme":true,"notte":false}'::jsonb;
