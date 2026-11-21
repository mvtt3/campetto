-- Anteprima di una giornata: le partite nuove si caricano con `anteprima = true` e finché non
-- si pubblicano le vede solo l'amministratore (tabellini, eventi, highlights). Gli altri non
-- le ricevono proprio dal database, quindi neanche un'app vecchia può mostrarle.
-- Per pubblicarle per tutti: update public.matches set anteprima = false where anteprima;

alter table public.matches add column if not exists anteprima boolean not null default false;

-- La partita è ancora in anteprima? (security definer: chi non la vede non può nemmeno
-- chiederlo alla tabella, quindi la domanda la fa la funzione per lui)
create or replace function public.match_in_preview(mid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select anteprima from public.matches where id = mid), false)
$$;
revoke all on function public.match_in_preview(uuid) from public, anon;
grant execute on function public.match_in_preview(uuid) to authenticated;

drop policy if exists matches_select on public.matches;
create policy matches_select on public.matches for select to authenticated
  using (public.is_member() and (not anteprima or public.is_admin()));

drop policy if exists match_players_select on public.match_players;
create policy match_players_select on public.match_players for select to authenticated
  using (public.is_member() and (public.is_admin() or not public.match_in_preview(match_id)));

drop policy if exists match_events_select on public.match_events;
create policy match_events_select on public.match_events for select to authenticated
  using (public.is_member() and (public.is_admin() or not public.match_in_preview(match_id)));

drop policy if exists highlights_read on public.highlights;
create policy highlights_read on public.highlights for select to authenticated
  using (public.highlights_visible() and (public.is_admin() or not public.match_in_preview(match_id)));
