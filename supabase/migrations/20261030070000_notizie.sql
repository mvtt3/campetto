-- Le notizie del Campetto (30/10/2026): quelle scritte a mano (annunci di Matteo) stanno qui;
-- quelle dalle partite (record, massimi, doppie doppie…) l'app le calcola da sola.
-- Ogni notizia nuova arriva come notifica a chi ha acceso "Notizie" (una volta sola).

create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 80),
  body text not null check (char_length(body) between 2 and 600),
  -- annuncio, stagione, novita: cambia solo l'icona.
  kind text not null default 'annuncio' check (kind in ('annuncio', 'stagione', 'novita')),
  created_at timestamptz not null default now(),
  notified_at timestamptz
);
create index if not exists news_created_idx on public.news (created_at desc);

alter table public.news enable row level security;
drop policy if exists news_read on public.news;
create policy news_read on public.news for select to authenticated using (true);
drop policy if exists news_admin on public.news;
create policy news_admin on public.news for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Dal timer (ogni 10 minuti): le notizie ancora da annunciare e a chi mandarle. Segna subito
-- l'invio, così nessuno la riceve due volte.
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
    update public.news n set notified_at = now()
     where n.notified_at is null and n.created_at > now() - interval '3 days'
    returning n.id as nid, n.title as t, n.body as b
  )
  select d.nid, d.t, d.b, s.endpoint, s.p256dh, s.auth
    from due d
    cross join public.push_subscriptions s
    join public.players pl on pl.id = s.player_id
   where not pl.archived and coalesce((pl.notify_prefs ->> 'notizie')::boolean, true);
end $$;

revoke all on function public.cron_due_news(text) from public;
grant execute on function public.cron_due_news(text) to anon, authenticated;
