-- Il voto dello Studio Campetto: a fine puntata il pubblico sceglie il canestro e l'assist della
-- giornata. Un voto per persona e per categoria, definitivo (la chiave primaria lo garantisce anche
-- se l'app sbagliasse): chi ha già votato rivede le percentuali ma non può cambiare.

create table if not exists public.studio_votes (
  episode text not null,                 -- l'id della puntata (es. 2026-11-14)
  category text not null check (category in ('canestro', 'assist')),
  player_id uuid not null references public.players(id) on delete cascade,
  choice smallint not null check (choice between 0 and 9),
  created_at timestamptz not null default now(),
  primary key (episode, category, player_id)
);
create index if not exists studio_votes_episode_idx on public.studio_votes (episode, category);

alter table public.studio_votes enable row level security;

-- Ognuno vede e scrive solo il proprio voto; i totali arrivano dalla funzione qui sotto.
drop policy if exists studio_votes_own_select on public.studio_votes;
create policy studio_votes_own_select on public.studio_votes for select to authenticated
  using (player_id = public.current_player_id());
drop policy if exists studio_votes_own_insert on public.studio_votes;
create policy studio_votes_own_insert on public.studio_votes for insert to authenticated
  with check (public.is_member() and player_id = public.current_player_id());
-- Niente update né delete: il voto è uno e resta.

grant select, insert on public.studio_votes to authenticated;

-- Lo stato del voto per una puntata: quanti voti per ogni scelta e cosa ho votato io.
-- { "canestro": { "counts": [3, 1, 0, 2], "mine": 0 }, "assist": { "counts": [...], "mine": null } }
create or replace function public.studio_vote_state(p_episode text, p_options int default 4)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := public.current_player_id();
  v_out jsonb := '{}'::jsonb;
  v_cat text;
  v_counts jsonb;
  v_mine int;
begin
  if v_me is null then raise exception 'Solo chi è nel gruppo.'; end if;
  foreach v_cat in array array['canestro', 'assist'] loop
    select coalesce(jsonb_agg(coalesce(c.n, 0) order by g.i), '[]'::jsonb)
      into v_counts
      from generate_series(0, greatest(p_options, 1) - 1) as g(i)
      left join (
        select choice, count(*)::int as n from public.studio_votes
         where episode = p_episode and category = v_cat group by choice
      ) c on c.choice = g.i;
    select choice into v_mine from public.studio_votes
     where episode = p_episode and category = v_cat and player_id = v_me;
    v_out := v_out || jsonb_build_object(v_cat, jsonb_build_object('counts', v_counts, 'mine', v_mine));
  end loop;
  return v_out;
end $$;

-- Il voto: inserisce e restituisce lo stato aggiornato. Se c'era già, non cambia niente
-- (torna lo stato con il voto di prima: l'app lo mostra come già dato).
create or replace function public.studio_vote(p_episode text, p_category text, p_choice int, p_options int default 4)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.current_player_id();
begin
  if v_me is null then raise exception 'Solo chi è nel gruppo.'; end if;
  if p_category not in ('canestro', 'assist') then raise exception 'Categoria non valida.'; end if;
  if p_choice < 0 or p_choice >= greatest(p_options, 1) then raise exception 'Scelta non valida.'; end if;
  insert into public.studio_votes (episode, category, player_id, choice)
  values (p_episode, p_category, v_me, p_choice)
  on conflict (episode, category, player_id) do nothing;
  return public.studio_vote_state(p_episode, p_options);
end $$;

revoke all on function public.studio_vote_state(text, int) from public, anon;
revoke all on function public.studio_vote(text, text, int, int) from public, anon;
grant execute on function public.studio_vote_state(text, int) to authenticated;
grant execute on function public.studio_vote(text, text, int, int) to authenticated;
