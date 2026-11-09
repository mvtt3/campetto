-- Avvisi al volo: un messaggio a tutti quelli con le notifiche, per esempio
-- "pioggia prevista alle 18" sulla partita di oggi. Li manda il giro di ogni 10 minuti,
-- solo di giorno (8–23), una volta per telefono, finché l'avviso non scade. Rispetta
-- l'interruttore scelto da ognuno (di solito "promemoria"). Se l'avviso è legato a una
-- proposta, la notifica ha i bottoni "Ci sono" e "No".

create table if not exists public.push_alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 60),
  body text not null check (char_length(body) between 1 and 180),
  url text not null default '/organizza' check (url like '/%'),
  proposal_id uuid references public.proposals(id) on delete cascade,
  kind text not null default 'promemoria',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '6 hours'
);
alter table public.push_alerts enable row level security;
revoke all on public.push_alerts from anon, authenticated;

create table if not exists public.push_alerts_sent (
  alert_id uuid not null references public.push_alerts(id) on delete cascade,
  endpoint text not null,
  sent_at timestamptz not null default now(),
  primary key (alert_id, endpoint)
);
alter table public.push_alerts_sent enable row level security;
revoke all on public.push_alerts_sent from anon, authenticated;

create or replace function public.cron_due_alerts(p_secret text)
returns table (alert_id uuid, title text, body text, url text, proposal_id uuid, endpoint text, p256dh text, auth text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if p_secret is null or p_secret <> (select value from public.app_settings where key = 'cron_secret') then
    raise exception 'non autorizzato';
  end if;
  return query
  with due as (
    select a.id as aid, a.title as t, a.body as b, a.url as u, a.proposal_id as pid,
           s.endpoint as e, s.p256dh as k, s.auth as au
      from public.push_alerts a
      cross join public.push_subscriptions s
      join public.players pl on pl.id = s.player_id
     where a.expires_at > now()
       and not pl.archived
       and coalesce((pl.notify_prefs ->> a.kind)::boolean, true)
       and not exists (select 1 from public.push_alerts_sent x where x.alert_id = a.id and x.endpoint = s.endpoint)
  ), marked as (
    insert into public.push_alerts_sent (alert_id, endpoint)
    select aid, e from due
    on conflict do nothing
    returning alert_id as mid, endpoint as me
  )
  select d.aid, d.t, d.b, d.u, d.pid, d.e, d.k, d.au
    from due d join marked m on m.mid = d.aid and m.me = d.e;
end $$;

revoke all on function public.cron_due_alerts(text) from public;
grant execute on function public.cron_due_alerts(text) to anon, authenticated;
