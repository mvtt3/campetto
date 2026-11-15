-- Il voto a sfide dello Studio Campetto: dei migliori canestri (e assist) della giornata se ne
-- confrontano due alla volta. Chi guarda tocca il preferito, che resta in gara contro l'azione
-- dopo; l'ultimo scelto è il suo canestro (o assist) della giornata. Vince l'azione che più persone
-- hanno portato fino in fondo. Una scelta per persona e per sfida, definitiva (chiave primaria).

create table if not exists public.studio_duels (
  episode text not null,                 -- l'id della puntata (es. 2026-11-14)
  category text not null check (category in ('canestro', 'assist')),
  round smallint not null check (round between 1 and 20),   -- la sfida: 1 = prima contro seconda azione
  player_id uuid not null references public.players(id) on delete cascade,
  a smallint not null check (a between 0 and 49),            -- la preferita di prima (indice in show.top.items)
  b smallint not null check (b between 0 and 49),            -- l'azione appena vista
  choice smallint not null,
  created_at timestamptz not null default now(),
  primary key (episode, category, round, player_id),
  check (a <> b and choice in (a, b))
);
create index if not exists studio_duels_episode_idx on public.studio_duels (episode, category);

alter table public.studio_duels enable row level security;

drop policy if exists studio_duels_own_select on public.studio_duels;
create policy studio_duels_own_select on public.studio_duels for select to authenticated
  using (player_id = public.current_player_id());
-- Si scrive solo dalla funzione qui sotto (che controlla la catena delle sfide): niente insert diretto,
-- niente update né delete.
grant select on public.studio_duels to authenticated;

-- Lo stato delle sfide di una puntata:
-- { "mine":   [ { "c": "canestro", "r": 1, "a": 0, "b": 1, "x": 1 }, ... ],      le mie scelte
--   "counts": [ { "c": "canestro", "a": 0, "b": 1, "x": 1, "n": 4 }, ... ],      per coppia, quanti hanno scelto x
--   "champs": [ { "c": "canestro", "item": 3, "n": 5 }, ... ] }                  l'ultima scelta di ognuno
create or replace function public.studio_duel_state(p_episode text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := public.current_player_id();
begin
  if v_me is null then raise exception 'Solo chi è nel gruppo.'; end if;
  return jsonb_build_object(
    'mine', coalesce((
      select jsonb_agg(jsonb_build_object('c', category, 'r', round, 'a', a, 'b', b, 'x', choice) order by category, round)
        from public.studio_duels where episode = p_episode and player_id = v_me), '[]'::jsonb),
    'counts', coalesce((
      select jsonb_agg(jsonb_build_object('c', category, 'a', a, 'b', b, 'x', choice, 'n', n))
        from (select category, a, b, choice, count(*)::int as n from public.studio_duels
               where episode = p_episode group by category, a, b, choice) t), '[]'::jsonb),
    'champs', coalesce((
      select jsonb_agg(jsonb_build_object('c', category, 'item', choice, 'n', n))
        from (select category, choice, count(*)::int as n
                from (select distinct on (category, player_id) category, player_id, choice
                        from public.studio_duels where episode = p_episode
                       order by category, player_id, round desc) l
               group by category, choice) t), '[]'::jsonb)
  );
end $$;

-- La scelta: inserisce e restituisce lo stato aggiornato. Se per quella sfida c'era già, non cambia
-- niente. La preferita "a" deve essere davvero la mia ultima scelta nelle sfide precedenti.
create or replace function public.studio_duel(p_episode text, p_category text, p_round int, p_a int, p_b int, p_choice int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.current_player_id();
  v_prev int;
begin
  if v_me is null or not public.is_member() then raise exception 'Solo chi è nel gruppo.'; end if;
  if p_category not in ('canestro', 'assist') then raise exception 'Categoria non valida.'; end if;
  if p_round < 1 or p_round > 20 or p_a < 0 or p_a > 49 or p_b < 0 or p_b > 49 or p_a = p_b or p_choice not in (p_a, p_b) then
    raise exception 'Sfida non valida.';
  end if;
  if not exists (select 1 from public.studio_duels where episode = p_episode and category = p_category and round = p_round and player_id = v_me) then
    select choice into v_prev from public.studio_duels
     where episode = p_episode and category = p_category and player_id = v_me and round < p_round
     order by round desc limit 1;
    if v_prev is not null and v_prev <> p_a then raise exception 'Sfida non valida.'; end if;
    insert into public.studio_duels (episode, category, round, player_id, a, b, choice)
    values (p_episode, p_category, p_round, v_me, p_a, p_b, p_choice)
    on conflict (episode, category, round, player_id) do nothing;
  end if;
  return public.studio_duel_state(p_episode);
end $$;

revoke all on function public.studio_duel_state(text) from public, anon;
revoke all on function public.studio_duel(text, text, int, int, int, int) from public, anon;
grant execute on function public.studio_duel_state(text) to authenticated;
grant execute on function public.studio_duel(text, text, int, int, int, int) to authenticated;
