-- Partita confermata (30/10/2026): se a 12 ore dall'inizio ci sono almeno 4 "ci sono"
-- (o tutti quelli che servono, se ne servono meno), chi ha detto sì riceve la conferma.
-- Al completo arriva già "Si gioca!" (threshold_notified): qui non si ripete.

create or replace function public.cron_due_confirmations(p_secret text)
returns table (
  player_id uuid, endpoint text, p256dh text, auth text,
  proposal_id uuid, starts_at timestamptz, format text, place text, yes_count int
)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if p_secret is null or p_secret <> (select value from public.app_settings where key = 'cron_secret') then
    raise exception 'non autorizzato';
  end if;
  return query
  with due as (
    select p.id, p.starts_at, p.format, p.place,
           (select count(*)::int from public.proposal_responses x where x.proposal_id = p.id and x.response = 'si') as yes_count,
           case p.format when '1v1' then 2 when '2v2' then 4 when '3v3' then 6 when '4v4' then 8 else 6 end as needed
      from public.proposals p
     where p.status = 'aperta'
       and not p.threshold_notified
       and p.starts_at between now() and now() + interval '12 hours'
  ), ok as (
    select * from due where yes_count >= least(4, needed)
  ), fresh as (
    insert into public.notified_events (key)
    select 'confirmed:' || ok.id from ok
    on conflict do nothing
    returning key
  )
  select s.player_id, s.endpoint, s.p256dh, s.auth, ok.id, ok.starts_at, ok.format, ok.place, ok.yes_count
    from ok
    join fresh f on f.key = 'confirmed:' || ok.id
    join public.proposal_responses r on r.proposal_id = ok.id and r.response = 'si'
    join public.players pl on pl.id = r.player_id
    join public.push_subscriptions s on s.player_id = r.player_id
   where not pl.archived
     and coalesce((pl.notify_prefs ->> 'completa')::boolean, true);
end $$;

revoke all on function public.cron_due_confirmations(text) from public;
grant execute on function public.cron_due_confirmations(text) to anon, authenticated;
