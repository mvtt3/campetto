-- Le partite le inserisce, modifica ed elimina solo l'amministratore.
-- I giocatori possono solo vederle.

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
  if v_me is null or not public.is_admin() then
    raise exception 'Solo l''amministratore può inserire o modificare le partite.';
  end if;
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
    if not exists (select 1 from public.matches where id = v_id) then raise exception 'Partita non trovata.'; end if;
    update public.matches set played_at = v_played, format = v_format,
      target_points = coalesce((p ->> 'target_points')::int, 21), score_a = v_a, score_b = v_b,
      stats_source = coalesce(p ->> 'stats_source', 'solo_risultato'), notes = nullif(p ->> 'notes', '')
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
  if not public.is_admin() then
    raise exception 'Solo l''amministratore può eliminare le partite.';
  end if;
  delete from public.matches where id = p_id;
end $$;

-- La conferma del risultato non serve più: le partite le inserisce l'amministratore.
revoke execute on function public.confirm_match(uuid) from authenticated;
