-- Gli highlights delle partite (31/10/2026): un video breve per partita con tutti i canestri,
-- i "mi piace" (il pallone) e i commenti. Per ora li vede solo l'amministratore: si aprono a
-- tutti mettendo highlights_aperti = 'si' in app_settings.
-- I video sono file statici dell'app (/h/...): qui c'è solo l'indirizzo, con un nome casuale.

create table if not exists public.highlights (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  video_url text not null check (video_url ~ '^/h/[a-z0-9_-]+\.mp4$'),
  poster_url text check (poster_url is null or poster_url ~ '^/h/[a-z0-9_-]+\.jpg$'),
  duration real not null check (duration > 0 and duration <= 120),
  description text check (description is null or char_length(description) <= 300),
  -- I canestri del montaggio: [{"t": secondo nel video, "punti": 2|3, "come": "...", "descrizione": "..."}]
  clips jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists highlights_match_idx on public.highlights (match_id);

create table if not exists public.highlight_likes (
  highlight_id uuid not null references public.highlights(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (highlight_id, player_id)
);

create table if not exists public.highlight_comments (
  id uuid primary key default gen_random_uuid(),
  highlight_id uuid not null references public.highlights(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 280),
  created_at timestamptz not null default now()
);
create index if not exists highlight_comments_idx on public.highlight_comments (highlight_id, created_at);

insert into public.app_settings (key, value) values ('highlights_aperti', 'no')
on conflict (key) do nothing;

-- Chi può vedere gli highlights: l'amministratore sempre, gli altri del gruppo quando si aprono.
create or replace function public.highlights_visible() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or (public.is_member()
          and exists (select 1 from public.app_settings where key = 'highlights_aperti' and value = 'si'))
$$;
revoke all on function public.highlights_visible() from public, anon;
grant execute on function public.highlights_visible() to authenticated;

alter table public.highlights enable row level security;
alter table public.highlight_likes enable row level security;
alter table public.highlight_comments enable row level security;

drop policy if exists highlights_read on public.highlights;
create policy highlights_read on public.highlights for select to authenticated
  using (public.highlights_visible());
drop policy if exists highlights_admin on public.highlights;
create policy highlights_admin on public.highlights for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists highlight_likes_read on public.highlight_likes;
create policy highlight_likes_read on public.highlight_likes for select to authenticated
  using (public.highlights_visible());
drop policy if exists highlight_likes_mine on public.highlight_likes;
create policy highlight_likes_mine on public.highlight_likes for insert to authenticated
  with check (player_id = public.current_player_id() and public.highlights_visible());
drop policy if exists highlight_likes_unlike on public.highlight_likes;
create policy highlight_likes_unlike on public.highlight_likes for delete to authenticated
  using (player_id = public.current_player_id());

drop policy if exists highlight_comments_read on public.highlight_comments;
create policy highlight_comments_read on public.highlight_comments for select to authenticated
  using (public.highlights_visible());
drop policy if exists highlight_comments_write on public.highlight_comments;
create policy highlight_comments_write on public.highlight_comments for insert to authenticated
  with check (player_id = public.current_player_id() and public.highlights_visible());
drop policy if exists highlight_comments_delete on public.highlight_comments;
create policy highlight_comments_delete on public.highlight_comments for delete to authenticated
  using (player_id = public.current_player_id() or public.is_admin());

-- Niente raffiche: al massimo 6 commenti al minuto a testa.
create or replace function public.highlight_comment_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.highlight_comments
       where player_id = new.player_id and created_at > now() - interval '1 minute') >= 6 then
    raise exception 'Calma! Aspetta un attimo prima di scrivere ancora';
  end if;
  new.body := btrim(new.body);
  new.created_at := now();
  return new;
end $$;
drop trigger if exists highlight_comment_guard on public.highlight_comments;
create trigger highlight_comment_guard before insert on public.highlight_comments
  for each row execute function public.highlight_comment_guard();

-- Like e commenti in diretta mentre si guarda.
do $$
declare t text;
begin
  foreach t in array array['highlight_likes', 'highlight_comments'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
