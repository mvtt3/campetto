-- Le notizie arrivano a tutti e subito (31/10/2026): a qualsiasi ora, anche a chi ha spento
-- "Notizie", e a chi attiva le notifiche dopo riceve le notizie degli ultimi 7 giorni.
-- Ogni telefono riceve ogni notizia una volta sola: lo ricorda news_push.

create table if not exists public.news_push (
  news_id uuid not null references public.news(id) on delete cascade,
  endpoint text not null,
  sent_at timestamptz not null default now(),
  primary key (news_id, endpoint)
);
alter table public.news_push enable row level security;
revoke all on public.news_push from anon, authenticated;

-- Quelle già annunciate valgono come ricevute da chi aveva già le notifiche.
insert into public.news_push (news_id, endpoint)
select n.id, s.endpoint from public.news n cross join public.push_subscriptions s
 where n.notified_at is not null
on conflict do nothing;

create or replace function public.cron_due_news(p_secret text)
returns table (news_id uuid, title text, body text, endpoint text, p256dh text, auth text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if p_secret is null or p_secret <> (select value from public.app_settings where key = 'cron_secret') then
    raise exception 'non autorizzato';
  end if;
  return query
  with due as (
    select n.id as nid, n.title as t, n.body as b, s.endpoint as e, s.p256dh as k, s.auth as a
      from public.news n
      cross join public.push_subscriptions s
      join public.players pl on pl.id = s.player_id
     where n.created_at > now() - interval '7 days'
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
  select d.nid, d.t, d.b, d.e, d.k, d.a
    from due d join marked m on m.mid = d.nid and m.me = d.e;
end $$;

revoke all on function public.cron_due_news(text) from public;
grant execute on function public.cron_due_news(text) to anon, authenticated;
