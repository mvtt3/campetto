-- Annunci con un'azione: una notizia può portare a una pagina dell'app (per
-- esempio il calendario sul sabato dell'indoor), comparire come scheda appena si apre l'app
-- (come i badge sbloccati) fino a una scadenza, e riguardare una proposta: allora la scheda
-- non la vede più chi ha già risposto, e la notifica ha i bottoni "Ci sono" e "No".

alter table public.news add column if not exists link text check (link is null or link like '/%');
alter table public.news add column if not exists popup boolean not null default false;
alter table public.news add column if not exists until timestamptz;
alter table public.news add column if not exists cta text check (cta is null or char_length(cta) between 2 and 24);
alter table public.news add column if not exists proposal_id uuid references public.proposals(id) on delete set null;

-- La notifica porta dove dice l'annuncio (e risponde alla proposta dai bottoni).
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
