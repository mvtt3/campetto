-- "Torna a giocare" (30/10/2026): a chi non apre l'app da 6 giorni arriva una notifica
-- di Spicchio, al massimo una volta a settimana, verso sera. Si può spegnere dalle
-- impostazioni delle notifiche ("ritorno").

alter table public.player_private add column if not exists last_seen_at timestamptz;
alter table public.player_private add column if not exists last_nudge_at timestamptz;
alter table public.player_private add column if not exists nudge_count int not null default 0;

-- Si parte da adesso: nessuno riceve il promemoria prima di 6 giorni da oggi.
update public.player_private set last_seen_at = now() where last_seen_at is null;

-- L'app lo chiama quando la apri (al massimo ogni qualche ora).
create or replace function public.touch_seen() returns void
language sql security definer set search_path = public as $$
  update public.player_private set last_seen_at = now()
   where player_id = (select id from public.players where user_id = auth.uid());
$$;

revoke all on function public.touch_seen() from public, anon;
grant execute on function public.touch_seen() to authenticated;

-- Chiamato dal "timer" (lo stesso dei promemoria): chi è da avvisare adesso. Segna subito
-- l'invio, così ognuno lo riceve una volta sola a settimana anche se il timer passa spesso.
create or replace function public.cron_due_nudges(p_secret text)
returns table (player_id uuid, endpoint text, p256dh text, auth text, first_name text, nickname text, days int, n int)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if p_secret is null or p_secret <> (select value from public.app_settings where key = 'cron_secret') then
    raise exception 'non autorizzato';
  end if;
  return query
  with due as (
    update public.player_private pp
       set last_nudge_at = now(), nudge_count = pp.nudge_count + 1
      from public.players pl
     where pl.id = pp.player_id
       and not pl.archived
       and pl.user_id is not null
       and coalesce((pl.notify_prefs ->> 'ritorno')::boolean, true)
       and pp.last_seen_at < now() - interval '6 days'
       and (pp.last_nudge_at is null or pp.last_nudge_at < now() - interval '7 days')
       and exists (select 1 from public.push_subscriptions s where s.player_id = pp.player_id)
    returning pp.player_id as pid, pp.last_seen_at as seen, pp.nudge_count as cnt
  )
  select s.player_id, s.endpoint, s.p256dh, s.auth, pl.first_name, pl.nickname,
         greatest(6, extract(day from now() - d.seen)::int), d.cnt
    from due d
    join public.push_subscriptions s on s.player_id = d.pid
    join public.players pl on pl.id = d.pid;
end $$;

revoke all on function public.cron_due_nudges(text) from public;
grant execute on function public.cron_due_nudges(text) to anon, authenticated;
