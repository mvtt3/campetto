-- Il tabellino deve tornare col risultato (31/10/2026). Una partita finita 8-23 aveva nel
-- tabellino 20 punti per la squadra che ne aveva fatti 23 (a Simone mancava una tripla, che c'è
-- nelle azioni registrate). Si corregge quella partita e da qui in poi il database rifiuta ogni
-- partita in cui, per una squadra con le statistiche di tutti, la somma dei punti non è il risultato.
-- I punti si contano come nell'app: dai tiri segnati (2 e 3) quando ci sono, altrimenti dai punti.

-- 1) La partita del 29/10 finita 8-23: Simone 6 canestri da 2 e 3 triple = 21 (come nelle azioni).
update public.match_players mp
   set fg3m = 3, pts = 21
  from public.players p
 where mp.player_id = p.id
   and mp.match_id = 'e6bfd60e-68c3-4fb0-9198-5cdd450763d6'
   and p.first_name = 'Simone'
   and mp.fg3m = 2 and mp.pts = 18;

-- 2) Il controllo, alla fine di ogni salvataggio (insieme a tutto il resto della partita).
create or replace function public.check_match_points(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_a int;
  v_b int;
  r record;
  v_score int;
begin
  select score_a, score_b into v_a, v_b from public.matches where id = p_match;
  if not found then return; end if;
  for r in
    select team,
           bool_and(has_stats) as all_stats,
           sum(case when fg2m + fg2a > 0 then fg2m * 2 + fg3m * 3
                    else greatest(pts, fg2m * 2 + fg3m * 3) end)::int as pts
      from public.match_players
     where match_id = p_match
     group by team
  loop
    v_score := case when r.team = 'A' then v_a else v_b end;
    if r.all_stats and r.pts <> v_score then
      raise exception 'Il tabellino non torna: la squadra % fa % punti, ma il risultato dice %. Sistema i punti prima di salvare.',
        r.team, r.pts, v_score;
    end if;
  end loop;
end $$;

create or replace function public.match_points_from_lines() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.check_match_points(new.match_id);
  return null;
end $$;

create or replace function public.match_points_from_match() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.check_match_points(new.id);
  return null;
end $$;

drop trigger if exists match_points_lines on public.match_players;
create constraint trigger match_points_lines
  after insert or update on public.match_players
  deferrable initially deferred
  for each row execute function public.match_points_from_lines();

drop trigger if exists match_points_match on public.matches;
create constraint trigger match_points_match
  after insert or update of score_a, score_b on public.matches
  deferrable initially deferred
  for each row execute function public.match_points_from_match();

revoke all on function public.check_match_points(uuid) from public, anon, authenticated;

-- 3) Le partite già salvate devono passare il controllo (altrimenti questa migrazione si ferma).
do $$
declare m record;
begin
  for m in select id from public.matches loop
    perform public.check_match_points(m.id);
  end loop;
end $$;
