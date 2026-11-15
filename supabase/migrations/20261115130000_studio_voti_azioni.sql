-- Il voto delle azioni dello Studio Campetto: dopo ogni canestro e ogni assist dei migliori della
-- giornata lo show si ferma e ognuno dà un voto da 1 a 5. Vince l'azione con la media più alta.
-- Un voto per persona e per azione, definitivo (la chiave primaria lo garantisce anche se l'app
-- sbagliasse): chi ha già votato rivede com'è andata ma non può cambiare.

create table if not exists public.studio_ratings (
  episode text not null,                 -- l'id della puntata (es. 2026-11-14)
  item smallint not null check (item between 0 and 49),   -- l'azione: indice in show.top.items
  player_id uuid not null references public.players(id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (episode, item, player_id)
);
create index if not exists studio_ratings_episode_idx on public.studio_ratings (episode, item);

alter table public.studio_ratings enable row level security;

-- Ognuno vede e scrive solo il proprio voto; i totali arrivano dalla funzione qui sotto.
drop policy if exists studio_ratings_own_select on public.studio_ratings;
create policy studio_ratings_own_select on public.studio_ratings for select to authenticated
  using (player_id = public.current_player_id());
drop policy if exists studio_ratings_own_insert on public.studio_ratings;
create policy studio_ratings_own_insert on public.studio_ratings for insert to authenticated
  with check (public.is_member() and player_id = public.current_player_id());
-- Niente update né delete: il voto è uno e resta.

grant select, insert on public.studio_ratings to authenticated;

-- Lo stato dei voti di una puntata, un elemento per azione (0 .. p_items-1):
-- [ { "counts": [n1, n2, n3, n4, n5], "mine": 4 }, { "counts": [...], "mine": null }, ... ]
create or replace function public.studio_rating_state(p_episode text, p_items int)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := public.current_player_id();
  v_n int := least(greatest(coalesce(p_items, 0), 0), 50);
begin
  if v_me is null then raise exception 'Solo chi è nel gruppo.'; end if;
  return coalesce((
    select jsonb_agg(
             jsonb_build_object(
               'counts', (select jsonb_agg(coalesce(c.n, 0) order by s.v)
                            from generate_series(1, 5) as s(v)
                            left join (select score, count(*)::int as n from public.studio_ratings
                                        where episode = p_episode and item = g.i group by score) c
                              on c.score = s.v),
               'mine', (select score from public.studio_ratings
                         where episode = p_episode and item = g.i and player_id = v_me))
             order by g.i)
      from generate_series(0, v_n - 1) as g(i)
  ), '[]'::jsonb);
end $$;

-- Il voto: inserisce e restituisce lo stato aggiornato. Se c'era già, non cambia niente
-- (torna lo stato con il voto di prima: l'app lo mostra come già dato).
create or replace function public.studio_rate(p_episode text, p_item int, p_score int, p_items int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.current_player_id();
begin
  if v_me is null or not public.is_member() then raise exception 'Solo chi è nel gruppo.'; end if;
  if p_item < 0 or p_item >= least(greatest(coalesce(p_items, 0), 0), 50) then raise exception 'Azione non valida.'; end if;
  if p_score < 1 or p_score > 5 then raise exception 'Voto non valido.'; end if;
  insert into public.studio_ratings (episode, item, player_id, score)
  values (p_episode, p_item, v_me, p_score)
  on conflict (episode, item, player_id) do nothing;
  return public.studio_rating_state(p_episode, p_items);
end $$;

revoke all on function public.studio_rating_state(text, int) from public, anon;
revoke all on function public.studio_rate(text, int, int, int) from public, anon;
grant execute on function public.studio_rating_state(text, int) to authenticated;
grant execute on function public.studio_rate(text, int, int, int) to authenticated;
