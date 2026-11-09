-- Campetto: schema iniziale
-- Tabelle, sicurezza (RLS), funzioni RPC, storage avatar, realtime, giocatori iniziali.

------------------------------------------------------------
-- Tabelle
------------------------------------------------------------

create table if not exists public.app_settings (
  key text primary key,
  value text not null
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(first_name) between 1 and 40),
  last_name text check (last_name is null or char_length(last_name) between 1 and 40),
  nickname text check (nickname is null or char_length(nickname) between 1 and 24),
  roles text[] not null default '{}',
  jersey_number int check (jersey_number is null or jersey_number between 0 and 99),
  card_color text check (card_color is null or card_color ~ '^#[0-9a-fA-F]{6}$'),
  avatar_url text,
  user_id uuid unique references auth.users(id) on delete set null,
  is_admin boolean not null default false,
  showcase text[] not null default '{}' check (cardinality(showcase) <= 3),
  notify_prefs jsonb not null default '{"proposte":true,"riepiloghi":true,"mvp":true,"badge":true,"conferme":true}',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- Dati visibili solo all'admin: link d'invito ed email per il collegamento automatico.
create table if not exists public.player_private (
  player_id uuid primary key references public.players(id) on delete cascade,
  invite_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  link_email text unique
);

create table if not exists public.pending_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  played_at timestamptz not null default now(),
  format text not null check (format in ('1v1','2v2','3v3','4v4')),
  target_points int not null default 21 check (target_points between 1 and 100),
  score_a int not null check (score_a between 0 and 200),
  score_b int not null check (score_b between 0 and 200),
  stats_source text not null default 'solo_risultato'
    check (stats_source in ('solo_risultato','tabellino','video','importata')),
  confirmed_by uuid references public.players(id) on delete set null,
  confirmed_at timestamptz,
  created_by uuid references public.players(id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 280),
  created_at timestamptz not null default now(),
  check (score_a <> score_b)
);
create index if not exists matches_played_at_idx on public.matches (played_at desc);

create table if not exists public.match_players (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  team text not null check (team in ('A','B')),
  has_stats boolean not null default false,
  pts int not null default 0 check (pts between 0 and 200),
  fg2m int not null default 0 check (fg2m between 0 and 100),
  fg2a int not null default 0 check (fg2a between 0 and 200),
  fg3m int not null default 0 check (fg3m between 0 and 100),
  fg3a int not null default 0 check (fg3a between 0 and 200),
  oreb int not null default 0 check (oreb between 0 and 100),
  dreb int not null default 0 check (dreb between 0 and 100),
  ast int not null default 0 check (ast between 0 and 100),
  stl int not null default 0 check (stl between 0 and 100),
  blk int not null default 0 check (blk between 0 and 100),
  tov int not null default 0 check (tov between 0 and 100),
  fouls int not null default 0 check (fouls between 0 and 100),
  primary key (match_id, player_id)
);
create index if not exists match_players_player_idx on public.match_players (player_id);

create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  seq int not null,
  player_id uuid not null references public.players(id) on delete restrict,
  kind text not null check (kind in ('2pt','3pt','miss2','miss3','oreb','dreb','ast','stl','blk','tov','foul')),
  target_player_id uuid references public.players(id) on delete set null,
  video_ts real,
  unique (match_id, seq)
);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  format text check (format is null or format in ('1v1','2v2','3v3','4v4')),
  note text check (note is null or char_length(note) <= 140),
  created_by uuid not null references public.players(id) on delete cascade,
  status text not null default 'aperta' check (status in ('aperta','annullata')),
  last_summary_at timestamptz,
  threshold_notified boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists proposals_starts_at_idx on public.proposals (starts_at);

create table if not exists public.proposal_responses (
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  response text not null check (response in ('si','forse','no')),
  notified boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (proposal_id, player_id)
);

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- Chiavi delle notifiche già inviate (MVP cambiato, badge sbloccati), per non ripeterle.
create table if not exists public.notified_events (
  key text primary key,
  created_at timestamptz not null default now()
);

------------------------------------------------------------
-- Funzioni di supporto
------------------------------------------------------------

create or replace function public.current_player_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.players where user_id = auth.uid() and not archived limit 1
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.players where user_id = auth.uid() and not archived)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.players where user_id = auth.uid() and is_admin and not archived)
$$;

-- I giocatori possono modificare solo i propri campi personali.
create or replace function public.players_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('campetto.bypass', true), '') = 'on' or public.is_admin() then
    return new;
  end if;
  if new.first_name is distinct from old.first_name
     or new.last_name is distinct from old.last_name
     or new.roles is distinct from old.roles
     or new.user_id is distinct from old.user_id
     or new.is_admin is distinct from old.is_admin
     or new.archived is distinct from old.archived then
    raise exception 'Solo l''amministratore può modificare nome, ruoli e accesso.';
  end if;
  return new;
end $$;

drop trigger if exists players_guard on public.players;
create trigger players_guard before update on public.players
for each row execute function public.players_guard();

create or replace function public.players_private_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.player_private (player_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists players_private_row on public.players;
create trigger players_private_row after insert on public.players
for each row execute function public.players_private_row();

------------------------------------------------------------
-- RLS
------------------------------------------------------------

alter table public.app_settings enable row level security;
alter table public.players enable row level security;
alter table public.player_private enable row level security;
alter table public.pending_users enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.match_events enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_responses enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notified_events enable row level security;

-- players
drop policy if exists players_select on public.players;
create policy players_select on public.players for select to authenticated using (public.is_member());
drop policy if exists players_update_self on public.players;
create policy players_update_self on public.players for update to authenticated
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
drop policy if exists players_insert_admin on public.players;
create policy players_insert_admin on public.players for insert to authenticated with check (public.is_admin());
drop policy if exists players_delete_admin on public.players;
create policy players_delete_admin on public.players for delete to authenticated using (public.is_admin());

-- player_private (solo admin)
drop policy if exists private_admin on public.player_private;
create policy private_admin on public.player_private for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- pending_users
drop policy if exists pending_self on public.pending_users;
create policy pending_self on public.pending_users for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists pending_admin_delete on public.pending_users;
create policy pending_admin_delete on public.pending_users for delete to authenticated using (public.is_admin());

-- partite: lettura ai membri, scrittura solo tramite funzioni (save_match/delete_match)
drop policy if exists matches_select on public.matches;
create policy matches_select on public.matches for select to authenticated using (public.is_member());
drop policy if exists match_players_select on public.match_players;
create policy match_players_select on public.match_players for select to authenticated using (public.is_member());
drop policy if exists match_events_select on public.match_events;
create policy match_events_select on public.match_events for select to authenticated using (public.is_member());

-- proposte
drop policy if exists proposals_select on public.proposals;
create policy proposals_select on public.proposals for select to authenticated using (public.is_member());
drop policy if exists proposals_insert on public.proposals;
create policy proposals_insert on public.proposals for insert to authenticated
  with check (public.is_member() and created_by = public.current_player_id());
drop policy if exists proposals_update on public.proposals;
create policy proposals_update on public.proposals for update to authenticated
  using (created_by = public.current_player_id() or public.is_admin())
  with check (created_by = public.current_player_id() or public.is_admin());
drop policy if exists proposals_delete on public.proposals;
create policy proposals_delete on public.proposals for delete to authenticated
  using (created_by = public.current_player_id() or public.is_admin());

drop policy if exists responses_select on public.proposal_responses;
create policy responses_select on public.proposal_responses for select to authenticated using (public.is_member());
drop policy if exists responses_upsert on public.proposal_responses;
create policy responses_upsert on public.proposal_responses for insert to authenticated
  with check (player_id = public.current_player_id());
drop policy if exists responses_update on public.proposal_responses;
create policy responses_update on public.proposal_responses for update to authenticated
  using (player_id = public.current_player_id()) with check (player_id = public.current_player_id());
drop policy if exists responses_delete on public.proposal_responses;
create policy responses_delete on public.proposal_responses for delete to authenticated
  using (player_id = public.current_player_id());

-- push: ognuno vede e gestisce solo le proprie iscrizioni
drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions for all to authenticated
  using (player_id = public.current_player_id()) with check (player_id = public.current_player_id());

------------------------------------------------------------
-- Permessi (l'esposizione automatica delle tabelle è disattivata)
------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.players to authenticated;
grant select, insert, update, delete on public.player_private to authenticated;
grant select, delete on public.pending_users to authenticated;
grant select on public.matches, public.match_players, public.match_events to authenticated;
grant select, insert, update, delete on public.proposals to authenticated;
grant select, insert, update, delete on public.proposal_responses to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

------------------------------------------------------------
-- Funzioni RPC
------------------------------------------------------------

-- Dopo il login: collega l'account al giocatore se l'email è stata registrata dall'admin.
create or replace function public.auto_link() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_player uuid;
begin
  if auth.uid() is null then raise exception 'Accesso richiesto'; end if;
  select id into v_player from public.players where user_id = auth.uid();
  if v_player is not null then return v_player; end if;
  if v_email = '' then return null; end if;
  select pp.player_id into v_player
    from public.player_private pp join public.players p on p.id = pp.player_id
   where lower(pp.link_email) = v_email and p.user_id is null and not p.archived;
  if v_player is null then return null; end if;
  perform set_config('campetto.bypass', 'on', true);
  update public.players set user_id = auth.uid() where id = v_player;
  delete from public.pending_users where user_id = auth.uid();
  return v_player;
end $$;

-- Link d'invito personale.
create or replace function public.claim_invite(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_player uuid;
  v_current uuid;
begin
  if auth.uid() is null then raise exception 'Accesso richiesto'; end if;
  select id into v_current from public.players where user_id = auth.uid();
  select pp.player_id into v_player
    from public.player_private pp join public.players p on p.id = pp.player_id
   where pp.invite_token = p_token and not p.archived;
  if v_player is null then raise exception 'Invito non valido o scaduto.'; end if;
  if v_current = v_player then return v_player; end if;
  if v_current is not null then raise exception 'Questo account è già collegato a un altro giocatore.'; end if;
  if exists (select 1 from public.players where id = v_player and user_id is not null) then
    raise exception 'Questo invito è già stato usato da un altro account.';
  end if;
  perform set_config('campetto.bypass', 'on', true);
  update public.players set user_id = auth.uid() where id = v_player;
  update public.player_private set invite_token = replace(gen_random_uuid()::text, '-', '') where player_id = v_player;
  delete from public.pending_users where user_id = auth.uid();
  return v_player;
end $$;

-- Chi entra senza invito finisce in attesa di approvazione.
create or replace function public.register_pending() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_member() then return; end if;
  insert into public.pending_users (user_id, email, full_name, avatar_url)
  select u.id, u.email,
         coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
         u.raw_user_meta_data ->> 'avatar_url'
    from auth.users u where u.id = auth.uid()
  on conflict (user_id) do nothing;
end $$;

create or replace function public.admin_resolve_pending(p_user uuid, p_player uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo l''amministratore.'; end if;
  if p_player is not null then
    if exists (select 1 from public.players where id = p_player and user_id is not null) then
      raise exception 'Questo giocatore ha già un account collegato.';
    end if;
    perform set_config('campetto.bypass', 'on', true);
    update public.players set user_id = p_user where id = p_player;
  end if;
  delete from public.pending_users where user_id = p_user;
end $$;

create or replace function public.admin_unlink_player(p_player uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo l''amministratore.'; end if;
  if p_player = public.current_player_id() then raise exception 'Non puoi scollegare te stesso.'; end if;
  update public.players set user_id = null where id = p_player;
end $$;

create or replace function public.regenerate_invite(p_player uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_token text := replace(gen_random_uuid()::text, '-', '');
begin
  if not public.is_admin() then raise exception 'Solo l''amministratore.'; end if;
  insert into public.player_private (player_id, invite_token) values (p_player, v_token)
  on conflict (player_id) do update set invite_token = excluded.invite_token;
  return v_token;
end $$;

-- Crea o modifica una partita con squadre, tabellino ed eventi, tutto validato lato server.
create or replace function public.save_match(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.current_player_id();
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_format text := p ->> 'format';
  v_size int;
  v_a int := (p ->> 'score_a')::int;
  v_b int := (p ->> 'score_b')::int;
  v_played timestamptz := coalesce((p ->> 'played_at')::timestamptz, now());
  v_line jsonb;
  v_ev jsonb;
  v_count_a int := 0;
  v_count_b int := 0;
  v_ids uuid[] := '{}';
  v_pid uuid;
  v_seq int := 0;
  v_box jsonb;
begin
  if v_me is null then raise exception 'Devi essere un giocatore del gruppo.'; end if;
  if v_format not in ('1v1','2v2','3v3','4v4') then raise exception 'Formato non valido.'; end if;
  v_size := left(v_format, 1)::int;
  if v_a is null or v_b is null or v_a < 0 or v_b < 0 or v_a > 200 or v_b > 200 then
    raise exception 'Punteggio non valido.';
  end if;
  if v_a = v_b then raise exception 'Il risultato non può essere un pareggio.'; end if;
  if v_played > now() + interval '1 day' then raise exception 'La data è nel futuro.'; end if;

  for v_line in select * from jsonb_array_elements(coalesce(p -> 'players', '[]'::jsonb)) loop
    v_pid := (v_line ->> 'player_id')::uuid;
    if v_pid = any(v_ids) then raise exception 'Un giocatore è in campo due volte.'; end if;
    if not exists (select 1 from public.players where id = v_pid and not archived) then
      raise exception 'Giocatore non trovato.';
    end if;
    v_ids := v_ids || v_pid;
    if v_line ->> 'team' = 'A' then v_count_a := v_count_a + 1;
    elsif v_line ->> 'team' = 'B' then v_count_b := v_count_b + 1;
    else raise exception 'Squadra non valida.'; end if;
  end loop;
  if v_count_a <> v_size or v_count_b <> v_size then
    raise exception 'Per il % servono % giocatori per squadra.', v_format, v_size;
  end if;

  if v_id is null then
    insert into public.matches (played_at, format, target_points, score_a, score_b, stats_source, notes, created_by)
    values (v_played, v_format, coalesce((p ->> 'target_points')::int, 21), v_a, v_b,
            coalesce(p ->> 'stats_source', 'solo_risultato'), nullif(p ->> 'notes', ''), v_me)
    returning id into v_id;
  else
    if not exists (select 1 from public.matches where id = v_id and (created_by = v_me or public.is_admin())) then
      raise exception 'Puoi modificare solo le partite che hai inserito tu.';
    end if;
    update public.matches set played_at = v_played, format = v_format,
      target_points = coalesce((p ->> 'target_points')::int, 21), score_a = v_a, score_b = v_b,
      stats_source = coalesce(p ->> 'stats_source', 'solo_risultato'), notes = nullif(p ->> 'notes', ''),
      confirmed_by = null, confirmed_at = null
    where id = v_id;
    delete from public.match_events where match_id = v_id;
    delete from public.match_players where match_id = v_id;
  end if;

  for v_line in select * from jsonb_array_elements(p -> 'players') loop
    v_box := coalesce(v_line -> 'box', '{}'::jsonb);
    insert into public.match_players (match_id, player_id, team, has_stats, pts, fg2m, fg2a, fg3m, fg3a,
      oreb, dreb, ast, stl, blk, tov, fouls)
    values (v_id, (v_line ->> 'player_id')::uuid, v_line ->> 'team', coalesce((v_line ->> 'has_stats')::boolean, false),
      coalesce((v_box ->> 'pts')::int, 0), coalesce((v_box ->> 'fg2m')::int, 0), coalesce((v_box ->> 'fg2a')::int, 0),
      coalesce((v_box ->> 'fg3m')::int, 0), coalesce((v_box ->> 'fg3a')::int, 0), coalesce((v_box ->> 'oreb')::int, 0),
      coalesce((v_box ->> 'dreb')::int, 0), coalesce((v_box ->> 'ast')::int, 0), coalesce((v_box ->> 'stl')::int, 0),
      coalesce((v_box ->> 'blk')::int, 0), coalesce((v_box ->> 'tov')::int, 0), coalesce((v_box ->> 'fouls')::int, 0));
  end loop;

  for v_ev in select * from jsonb_array_elements(coalesce(p -> 'events', '[]'::jsonb)) loop
    v_pid := (v_ev ->> 'player_id')::uuid;
    if not (v_pid = any(v_ids)) then raise exception 'Evento di un giocatore non in campo.'; end if;
    insert into public.match_events (match_id, seq, player_id, kind, target_player_id, video_ts)
    values (v_id, v_seq, v_pid, v_ev ->> 'kind',
      case when nullif(v_ev ->> 'target_player_id', '')::uuid = any(v_ids)
           then (v_ev ->> 'target_player_id')::uuid end,
      nullif(v_ev ->> 'video_ts', '')::real);
    v_seq := v_seq + 1;
  end loop;

  return v_id;
end $$;

create or replace function public.delete_match(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.matches where id = p_id
                 and (created_by = public.current_player_id() or public.is_admin())) then
    raise exception 'Puoi eliminare solo le partite che hai inserito tu.';
  end if;
  delete from public.matches where id = p_id;
end $$;

-- Conferma del risultato da parte della squadra avversaria.
create or replace function public.confirm_match(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.current_player_id();
  v_my_team text;
  v_creator uuid;
  v_creator_team text;
begin
  select created_by into v_creator from public.matches where id = p_id;
  select team into v_my_team from public.match_players where match_id = p_id and player_id = v_me;
  if v_my_team is null then raise exception 'Solo chi ha giocato può confermare.'; end if;
  if v_creator = v_me then raise exception 'Deve confermare la squadra avversaria.'; end if;
  select team into v_creator_team from public.match_players where match_id = p_id and player_id = v_creator;
  if v_creator_team is not null and v_creator_team = v_my_team then
    raise exception 'Deve confermare la squadra avversaria.';
  end if;
  update public.matches set confirmed_by = v_me, confirmed_at = now() where id = p_id;
end $$;

-- Destinatari delle notifiche push in base alle preferenze.
create or replace function public.push_targets(p_kind text, p_players uuid[] default null, p_exclude uuid default null)
returns table (player_id uuid, endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = public as $$
  select s.player_id, s.endpoint, s.p256dh, s.auth
    from public.push_subscriptions s join public.players p on p.id = s.player_id
   where public.is_member()
     and not p.archived
     and coalesce((p.notify_prefs ->> p_kind)::boolean, true)
     and (p_players is null or s.player_id = any(p_players))
     and (p_exclude is null or s.player_id <> p_exclude)
$$;

create or replace function public.drop_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and public.is_member()
$$;

-- Registra una notifica come inviata; restituisce false se era già stata inviata.
create or replace function public.claim_notification(p_key text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member() then return false; end if;
  insert into public.notified_events (key) values (p_key) on conflict do nothing;
  return found;
end $$;

-- Stato per il raggruppamento delle notifiche di una proposta.
create or replace function public.mark_proposal_notified(p_id uuid, p_threshold boolean, p_summary boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member() then return; end if;
  update public.proposals set
    threshold_notified = threshold_notified or p_threshold,
    last_summary_at = case when p_summary or p_threshold then now() else last_summary_at end
  where id = p_id;
  if p_summary or p_threshold then
    update public.proposal_responses set notified = true where proposal_id = p_id and response = 'si';
  end if;
end $$;

create or replace function public.proposal_notify_state(p_id uuid)
returns table (last_summary_at timestamptz, threshold_notified boolean, pending_yes int)
language sql stable security definer set search_path = public as $$
  select pr.last_summary_at, pr.threshold_notified,
         (select count(*)::int from public.proposal_responses r
           where r.proposal_id = pr.id and r.response = 'si' and not r.notified)
    from public.proposals pr where pr.id = p_id and public.is_member()
$$;

revoke all on function public.current_player_id() from public, anon;
revoke all on function public.is_member() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.auto_link() from public, anon;
revoke all on function public.claim_invite(text) from public, anon;
revoke all on function public.register_pending() from public, anon;
revoke all on function public.admin_resolve_pending(uuid, uuid) from public, anon;
revoke all on function public.admin_unlink_player(uuid) from public, anon;
revoke all on function public.regenerate_invite(uuid) from public, anon;
revoke all on function public.save_match(jsonb) from public, anon;
revoke all on function public.delete_match(uuid) from public, anon;
revoke all on function public.confirm_match(uuid) from public, anon;
revoke all on function public.push_targets(text, uuid[], uuid) from public, anon;
revoke all on function public.drop_push_subscription(text) from public, anon;
revoke all on function public.claim_notification(text) from public, anon;
revoke all on function public.mark_proposal_notified(uuid, boolean, boolean) from public, anon;
revoke all on function public.proposal_notify_state(uuid) from public, anon;

grant execute on function public.current_player_id() to authenticated;
grant execute on function public.is_member() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.auto_link() to authenticated;
grant execute on function public.claim_invite(text) to authenticated;
grant execute on function public.register_pending() to authenticated;
grant execute on function public.admin_resolve_pending(uuid, uuid) to authenticated;
grant execute on function public.admin_unlink_player(uuid) to authenticated;
grant execute on function public.regenerate_invite(uuid) to authenticated;
grant execute on function public.save_match(jsonb) to authenticated;
grant execute on function public.delete_match(uuid) to authenticated;
grant execute on function public.confirm_match(uuid) to authenticated;
grant execute on function public.push_targets(text, uuid[], uuid) to authenticated;
grant execute on function public.drop_push_subscription(text) to authenticated;
grant execute on function public.claim_notification(text) to authenticated;
grant execute on function public.mark_proposal_notified(uuid, boolean, boolean) to authenticated;
grant execute on function public.proposal_notify_state(uuid) to authenticated;

------------------------------------------------------------
-- Storage: foto profilo
------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/webp','image/jpeg','image/png'])
on conflict (id) do update set public = true, file_size_limit = 1048576,
  allowed_mime_types = array['image/webp','image/jpeg','image/png'];

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select to public using (bucket_id = 'avatars');
drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and ((storage.foldername(name))[1] = public.current_player_id()::text or public.is_admin()));
drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = public.current_player_id()::text or public.is_admin()));
drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = public.current_player_id()::text or public.is_admin()));

------------------------------------------------------------
-- Realtime
------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['players','matches','match_players','proposals','proposal_responses'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
