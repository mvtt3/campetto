-- Annullamento automatico e notizie programmate.
--
-- 1) Una partita che 12 ore prima non ha almeno 4 "ci sono" (o quanti ne servono, se meno)
--    si annulla da sola e sparisce dal calendario. Avvisa chi aveva detto "ci sono" (chi l'ha
--    proposta con un messaggio suo). Le proposte fatte con meno di 12 ore di anticipo hanno
--    tempo fino a 2 ore prima, se sono state fatte almeno 3 ore prima; quelle all'ultimo no.
--    Gira solo di giorno (8–23, lo decide il giro): di notte si aspetta, e intanto la partita
--    si può ancora salvare.
--
-- 2) Una notizia con la data nel futuro è programmata: nessuno la vede e non parte finché
--    non arriva quell'ora.

create or replace function public.cron_auto_cancel(p_secret text)
returns table (
  player_id uuid, endpoint text, p256dh text, auth text,
  proposal_id uuid, starts_at timestamptz, place text, yes_count int, min_needed int, proposer boolean
)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if p_secret is null or p_secret <> (select value from public.app_settings where key = 'cron_secret') then
    raise exception 'non autorizzato';
  end if;
  return query
  with due as (
    select p.id,
           (select count(*)::int from public.proposal_responses x where x.proposal_id = p.id and x.response = 'si') as yes_count,
           least(4, case p.format when '1v1' then 2 when '2v2' then 4 when '3v3' then 6 when '4v4' then 8 else 6 end) as min_needed
      from public.proposals p
     where p.status = 'aperta'
       and p.starts_at > now()
       and (
         (p.created_at <= p.starts_at - interval '12 hours' and now() >= p.starts_at - interval '12 hours')
         or (p.created_at > p.starts_at - interval '12 hours'
             and p.created_at <= p.starts_at - interval '3 hours'
             and now() >= p.starts_at - interval '2 hours')
       )
  ), short as (
    update public.proposals p
       set status = 'annullata', cancel_reason = 'pochi', cancelled_at = now()
      from due d
     where p.id = d.id and d.yes_count < d.min_needed
    returning p.id, p.starts_at, p.place, p.created_by, d.yes_count, d.min_needed
  )
  select s.player_id, s.endpoint, s.p256dh, s.auth,
         c.id, c.starts_at, c.place, c.yes_count, c.min_needed, r.player_id = c.created_by
    from short c
    join public.proposal_responses r on r.proposal_id = c.id and r.response = 'si'
    join public.players pl on pl.id = r.player_id
    join public.push_subscriptions s on s.player_id = r.player_id
   where not pl.archived
     and coalesce((pl.notify_prefs ->> 'annullate')::boolean, true);
end $$;

revoke all on function public.cron_auto_cancel(text) from public;
grant execute on function public.cron_auto_cancel(text) to anon, authenticated;

-- Le notizie programmate: si leggono solo da quando è la loro ora.
drop policy if exists news_read on public.news;
create policy news_read on public.news for select to authenticated using (created_at <= now());

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
