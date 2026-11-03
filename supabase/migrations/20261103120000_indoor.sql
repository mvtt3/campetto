-- Terzo posto dove si gioca: Indoor (in palestra), con la via (3/11/2026).

alter table public.proposals drop constraint if exists proposals_place_check;
alter table public.proposals
  add constraint proposals_place_check check (place is null or place in ('niche', 'decathlon', 'indoor'));

alter table public.proposal_responses drop constraint if exists proposal_responses_alt_place_check;
alter table public.proposal_responses
  add constraint proposal_responses_alt_place_check check (alt_place is null or alt_place in ('niche', 'decathlon', 'indoor'));

-- La via della palestra (solo per Indoor, facoltativa).
alter table public.proposals
  add column if not exists place_address text
  check (place_address is null or char_length(place_address) between 1 and 120);

create or replace function public.move_proposal(p_id uuid, p_starts_at timestamptz, p_place text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.current_player_id();
  v_row public.proposals%rowtype;
begin
  select * into v_row from public.proposals where id = p_id;
  if not found or v_row.status <> 'aperta' then
    raise exception 'Questa proposta non c''è più';
  end if;
  if v_me is null or (v_row.created_by <> v_me and not public.is_admin()) then
    raise exception 'Può spostarla solo chi l''ha proposta';
  end if;
  if (p_starts_at at time zone 'Europe/Rome')::date <> (v_row.starts_at at time zone 'Europe/Rome')::date then
    raise exception 'Per cambiare giorno fai una nuova proposta dal calendario';
  end if;
  if p_place is not null and p_place not in ('niche', 'decathlon', 'indoor') then
    raise exception 'Campetto non valido';
  end if;
  update public.proposals
     set starts_at = p_starts_at, place = coalesce(p_place, place)
   where id = p_id;
  update public.proposal_responses r
     set alt_starts_at = null, alt_place = null
   where r.proposal_id = p_id
     and coalesce(r.alt_starts_at, p_starts_at) = p_starts_at
     and coalesce(r.alt_place, p_place, v_row.place, '') = coalesce(p_place, v_row.place, '');
end $$;

revoke all on function public.move_proposal(uuid, timestamptz, text) from public;
grant execute on function public.move_proposal(uuid, timestamptz, text) to authenticated;
