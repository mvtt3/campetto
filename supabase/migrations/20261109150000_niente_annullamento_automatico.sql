-- Niente annullamento automatico: una partita proposta resta aperta fino all'orario d'inizio,
-- anche se mancano giocatori. Se salta, la annulla l'amministratore.
-- La funzione resta (la chiama il giro programmato) ma non annulla più niente.
create or replace function public.cron_auto_cancel(p_secret text)
returns table (
  player_id uuid, endpoint text, p256dh text, auth text,
  proposal_id uuid, starts_at timestamptz, place text, yes_count int, min_needed int, proposer boolean
)
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is null or p_secret <> (select value from public.app_settings where key = 'cron_secret') then
    raise exception 'non autorizzato';
  end if;
  return;
end $$;

revoke all on function public.cron_auto_cancel(text) from public;
grant execute on function public.cron_auto_cancel(text) to anon, authenticated;
