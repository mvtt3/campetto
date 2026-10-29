-- Promemoria un'ora prima della partita, per chi ha detto "ci sono" (29/10/2026).
-- Il database chiama l'app ogni 10 minuti con un codice segreto che resta solo qui
-- (nella tabella app_settings, non leggibile dai giocatori) e mai nel repository.

create extension if not exists pgcrypto with schema extensions;

insert into public.app_settings (key, value)
values ('cron_secret', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

create or replace function public.cron_due_reminders(p_secret text)
returns table (
  player_id uuid, endpoint text, p256dh text, auth text,
  proposal_id uuid, starts_at timestamptz, format text, yes_count int, quiet boolean
)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if p_secret is null or p_secret <> (select value from public.app_settings where key = 'cron_secret') then
    raise exception 'non autorizzato';
  end if;
  return query
  with due as (
    select p.id, p.starts_at, p.format,
           (select count(*)::int from public.proposal_responses x where x.proposal_id = p.id and x.response = 'si') as yes_count
      from public.proposals p
     where p.status = 'aperta'
       and p.starts_at between now() + interval '45 minutes' and now() + interval '75 minutes'
  ), people as (
    select d.*, r.player_id as pid
      from due d join public.proposal_responses r on r.proposal_id = d.id and r.response = 'si'
      join public.players pl on pl.id = r.player_id
     where not pl.archived and coalesce((pl.notify_prefs ->> 'promemoria')::boolean, true)
  ), fresh as (
    insert into public.notified_events (key)
    select 'reminder:' || people.id || ':' || people.pid from people
    on conflict do nothing
    returning key
  )
  select s.player_id, s.endpoint, s.p256dh, s.auth, pe.id, pe.starts_at, pe.format, pe.yes_count,
         coalesce((pl.notify_prefs ->> 'notte')::boolean, true)
    from people pe
    join fresh f on f.key = 'reminder:' || pe.id || ':' || pe.pid
    join public.push_subscriptions s on s.player_id = pe.pid
    join public.players pl on pl.id = pe.pid;
end $$;

revoke all on function public.cron_due_reminders(text) from public;
grant execute on function public.cron_due_reminders(text) to anon, authenticated;

-- Il "timer": pg_cron chiama l'app ogni 10 minuti con pg_net.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'campetto-promemoria';
  perform cron.schedule(
    'campetto-promemoria',
    '*/10 * * * *',
    $job$
      select net.http_post(
        url := 'https://campetto.vercel.app/api/notify',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-campetto-cron', (select value from public.app_settings where key = 'cron_secret')),
        body := '{"type":"tick"}'::jsonb
      );
    $job$
  );
end $$;
