-- Niente notifiche arretrate (5/11/2026). Chi accende le notifiche oggi non riceve le
-- notizie dei giorni prima, solo quelle pubblicate da quando le ha accese. Al posto
-- dell'arretrato riceve una notifica sola: se ha detto "ci sono" a una partita che ha già
-- i giocatori, "Partita confermata" (e la conferma delle 12 ore prima non gli arriva doppia).

drop function if exists public.cron_due_news(text);
create function public.cron_due_news(p_secret text)
returns table (news_id uuid, title text, body text, link text, proposal_id uuid, endpoint text, p256dh text, auth text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if p_secret is null or p_secret <> (select value from public.app_settings where key = 'cron_secret') then
    raise exception 'non autorizzato';
  end if;
  return query
  with due as (
    select n.id as nid, n.title as t, n.body as b, n.link as l, n.proposal_id as pid,
           s.endpoint as e, s.p256dh as k, s.auth as a
      from public.news n
      cross join public.push_subscriptions s
      join public.players pl on pl.id = s.player_id
     where n.created_at > now() - interval '7 days'
       and n.created_at <= now()
       and n.created_at >= s.created_at - interval '10 minutes'
       and (n.until is null or n.until > now())
       and not pl.archived
       and not exists (select 1 from public.news_push x where x.news_id = n.id and x.endpoint = s.endpoint)
  ), marked as (
    insert into public.news_push (news_id, endpoint)
    select nid, e from due
    on conflict do nothing
    returning news_id as mid, endpoint as me
  ), stamped as (
    update public.news n set notified_at = now()
     where n.notified_at is null and n.id in (select nid from due)
    returning n.id
  )
  select d.nid, d.t, d.b, d.l, d.pid, d.e, d.k, d.a
    from due d join marked m on m.mid = d.nid and m.me = d.e;
end $$;

revoke all on function public.cron_due_news(text) from public;
grant execute on function public.cron_due_news(text) to anon, authenticated;

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
     and coalesce((pl.notify_prefs ->> 'completa')::boolean, true)
     -- Chi l'ha già ricevuta accendendo le notifiche non la riceve di nuovo.
     and not exists (
       select 1 from public.notified_events w
        where w.key = 'welcome-confirmed:' || ok.id || ':' || r.player_id
     );
end $$;

revoke all on function public.cron_due_confirmations(text) from public;
grant execute on function public.cron_due_confirmations(text) to anon, authenticated;
