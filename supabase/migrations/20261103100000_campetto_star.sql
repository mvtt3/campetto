-- Campetto Star: il gioco dentro l'app.
--  * players.outfit: quello che indossi nel gioco (si vede anche nell'app).
--  * game_saves: il salvataggio di ognuno (uno per giocatore).
--  * game_scores: le tre sfide, il record di sempre di ognuno (non si azzera mai).
--  * game_awards: a mezzanotte chi è primo in una classifica prende il premio.

alter table public.players add column if not exists outfit jsonb not null default '{}'::jsonb;

create table if not exists public.game_saves (
  player_id uuid primary key references public.players(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.game_saves enable row level security;
drop policy if exists game_saves_select on public.game_saves;
create policy game_saves_select on public.game_saves for select to authenticated
  using (public.is_member());
drop policy if exists game_saves_insert on public.game_saves;
create policy game_saves_insert on public.game_saves for insert to authenticated
  with check (player_id = public.current_player_id());
drop policy if exists game_saves_update on public.game_saves;
create policy game_saves_update on public.game_saves for update to authenticated
  using (player_id = public.current_player_id())
  with check (player_id = public.current_player_id());
revoke all on public.game_saves from anon, authenticated;
grant select, insert, update on public.game_saves to authenticated;

create table if not exists public.game_scores (
  player_id uuid not null references public.players(id) on delete cascade,
  game text not null check (game in ('triple', 'liberi', 'schiacciate')),
  best int not null check (best >= 0),
  achieved_at timestamptz not null default now(),
  primary key (player_id, game)
);
alter table public.game_scores enable row level security;
drop policy if exists game_scores_select on public.game_scores;
create policy game_scores_select on public.game_scores for select to authenticated
  using (public.is_member());
revoke all on public.game_scores from anon, authenticated;
grant select on public.game_scores to authenticated;

-- Un punteggio nuovo: resta in classifica solo se batte il tuo record. A pari punti
-- resta davanti chi ci è arrivato prima.
create or replace function public.submit_game_score(p_game text, p_score int)
returns int
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_player_id();
  cap int;
  b int;
begin
  if me is null then
    raise exception 'non autorizzato';
  end if;
  cap := case p_game when 'triple' then 30 when 'schiacciate' then 50 when 'liberi' then 400 else null end;
  if cap is null then
    raise exception 'sfida sconosciuta';
  end if;
  if p_score is null or p_score < 0 or p_score > cap then
    raise exception 'punteggio non valido';
  end if;
  insert into public.game_scores (player_id, game, best, achieved_at)
  values (me, p_game, p_score, now())
  on conflict (player_id, game) do update
    set best = excluded.best, achieved_at = excluded.achieved_at
    where public.game_scores.best < excluded.best;
  select s.best into b from public.game_scores s where s.player_id = me and s.game = p_game;
  return b;
end $$;
revoke all on function public.submit_game_score(text, int) from public;
grant execute on function public.submit_game_score(text, int) to authenticated;

create table if not exists public.game_awards (
  day date not null,
  game text not null check (game in ('triple', 'liberi', 'schiacciate')),
  player_id uuid not null references public.players(id) on delete cascade,
  score int not null,
  claimed_at timestamptz,
  notified_at timestamptz,
  primary key (day, game)
);
alter table public.game_awards enable row level security;
drop policy if exists game_awards_select on public.game_awards;
create policy game_awards_select on public.game_awards for select to authenticated
  using (public.is_member());
revoke all on public.game_awards from anon, authenticated;
grant select on public.game_awards to authenticated;

-- I re di ieri: chi era primo a mezzanotte (ora italiana) in ogni classifica.
-- Si può chiamare quante volte si vuole: ogni giorno si premia una volta sola.
create or replace function public.award_game_kings()
returns int
language plpgsql security definer set search_path = public as $$
declare
  d date := (now() at time zone 'Europe/Rome')::date - 1;
  midnight timestamptz := ((d + 1)::timestamp at time zone 'Europe/Rome');
  n int;
begin
  insert into public.game_awards (day, game, player_id, score)
  select distinct on (s.game) d, s.game, s.player_id, s.best
    from public.game_scores s
    join public.players p on p.id = s.player_id
   where not p.archived
     and s.achieved_at < midnight
   order by s.game, s.best desc, s.achieved_at asc
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.award_game_kings() from public, anon, authenticated;

-- Il premio lo ritira il gioco: soldi (e la corona) nel salvataggio di chi ha vinto.
create or replace function public.claim_game_awards()
returns table (day date, game text, score int)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  me uuid := public.current_player_id();
begin
  if me is null then
    raise exception 'non autorizzato';
  end if;
  return query
  update public.game_awards a set claimed_at = now()
   where a.player_id = me and a.claimed_at is null
  returning a.day, a.game, a.score;
end $$;
revoke all on function public.claim_game_awards() from public;
grant execute on function public.claim_game_awards() to authenticated;

-- La notifica "Sei il re del campetto": subito dopo mezzanotte a chi ha tolto il
-- silenzio di notte, agli altri dalle 8. Chi spegne "Campetto Star" non la riceve.
create or replace function public.cron_due_game_awards(p_secret text)
returns table (player_id uuid, game text, score int, endpoint text, p256dh text, auth text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  h int := extract(hour from now() at time zone 'Europe/Rome');
begin
  if p_secret is null or p_secret <> (select value from public.app_settings where key = 'cron_secret') then
    raise exception 'non autorizzato';
  end if;
  perform public.award_game_kings();
  return query
  with due as (
    select a.day as d, a.game as g, a.player_id as pid, a.score as sc
      from public.game_awards a
      join public.players pl on pl.id = a.player_id
     where a.notified_at is null
       and a.day >= (now() at time zone 'Europe/Rome')::date - 2
       and (h between 8 and 22 or not coalesce((pl.notify_prefs ->> 'notte')::boolean, true))
  ), stamped as (
    update public.game_awards a set notified_at = now()
      from due where a.day = due.d and a.game = due.g
    returning a.player_id
  )
  select d.pid, d.g, d.sc, s.endpoint, s.p256dh, s.auth
    from due d
    join public.players pl on pl.id = d.pid
    join public.push_subscriptions s on s.player_id = d.pid
   where coalesce((pl.notify_prefs ->> 'gioco')::boolean, true);
end $$;
revoke all on function public.cron_due_game_awards(text) from public;
grant execute on function public.cron_due_game_awards(text) to anon, authenticated;

-- I premi si assegnano anche se l'app non chiama: pg_cron ogni 10 minuti (non fa niente
-- se ieri è già stato premiato).
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'campetto-re-del-campetto';
  perform cron.schedule('campetto-re-del-campetto', '*/10 * * * *', 'select public.award_game_kings();');
end $$;
