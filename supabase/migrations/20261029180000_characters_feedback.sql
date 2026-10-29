-- Personaggi a figura intera e segnalazioni dall'app (29/10/2026).

-- Il personaggio scelto (id di una figurina), separato dalla foto profilo.
alter table public.players add column if not exists character text;
alter table public.players drop constraint if exists players_character_check;
alter table public.players add constraint players_character_check
  check (character is null or character ~ '^[a-z]{2,20}$');

-- Segnalazioni: chiunque nel gruppo può scriverle, le legge solo l'amministratore
-- (e il controllo periodico di Claude, con il suo codice segreto).
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players(id) on delete set null,
  kind text not null check (kind in ('problema', 'idea', 'altro')),
  message text not null check (char_length(btrim(message)) between 3 and 2000),
  screen text,
  device text,
  app_version text,
  status text not null default 'nuova' check (status in ('nuova', 'letta', 'risolta')),
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback for insert to authenticated
  with check (public.is_member() and player_id = public.current_player_id());
drop policy if exists feedback_admin on public.feedback;
create policy feedback_admin on public.feedback for select to authenticated using (public.is_admin());

insert into public.app_settings (key, value)
values ('feedback_secret', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

-- Le segnalazioni nuove per il controllo periodico; le segna come lette.
create or replace function public.feedback_inbox(p_secret text, p_mark boolean default true)
returns table (id uuid, created_at timestamptz, kind text, message text, screen text, device text, app_version text, player text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if p_secret is null or p_secret <> (select value from public.app_settings where key = 'feedback_secret') then
    raise exception 'non autorizzato';
  end if;
  return query
    select f.id, f.created_at, f.kind, f.message, f.screen, f.device, f.app_version,
           coalesce(pl.nickname, pl.first_name) || ' (' || pl.first_name || coalesce(' ' || pl.last_name, '') || ')'
      from public.feedback f left join public.players pl on pl.id = f.player_id
     where f.status = 'nuova'
     order by f.created_at;
  if p_mark then
    update public.feedback set status = 'letta' where status = 'nuova';
  end if;
end $$;
revoke all on function public.feedback_inbox(text, boolean) from public;
grant execute on function public.feedback_inbox(text, boolean) to anon, authenticated;
