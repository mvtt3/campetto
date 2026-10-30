-- Dove si gioca (Niche o Decathlon) e le controproposte: chi ha detto "ci sono" può proporre,
-- per lo stesso giorno, un altro orario e/o l'altro campetto (30/10/2026).
-- Il campetto serve solo a organizzarsi: le partite giocate e le statistiche non lo usano.

alter table public.proposals
  add column if not exists place text
  check (place is null or place in ('niche', 'decathlon'));

alter table public.proposal_responses
  add column if not exists alt_starts_at timestamptz,
  add column if not exists alt_place text
  check (alt_place is null or alt_place in ('niche', 'decathlon'));

-- Una controproposta vale solo con un "sì" e solo nello stesso giorno (ora italiana).
-- Uguale alla proposta non serve: si toglie da sola.
create or replace function public.response_alt_guard() returns trigger
language plpgsql set search_path = public as $$
declare
  v_start timestamptz;
  v_place text;
begin
  if new.response <> 'si' then
    new.alt_starts_at := null;
    new.alt_place := null;
    return new;
  end if;
  if new.alt_starts_at is null and new.alt_place is null then
    return new;
  end if;
  select starts_at, place into v_start, v_place from public.proposals where id = new.proposal_id;
  if new.alt_starts_at is not null
     and (new.alt_starts_at at time zone 'Europe/Rome')::date <> (v_start at time zone 'Europe/Rome')::date then
    raise exception 'Per cambiare giorno fai una nuova proposta dal calendario';
  end if;
  if coalesce(new.alt_starts_at, v_start) = v_start
     and coalesce(new.alt_place, v_place, '') = coalesce(v_place, '') then
    new.alt_starts_at := null;
    new.alt_place := null;
  end if;
  return new;
end $$;

drop trigger if exists response_alt_guard on public.proposal_responses;
create trigger response_alt_guard
  before insert or update on public.proposal_responses
  for each row execute function public.response_alt_guard();

-- Spostare la partita su una controproposta: lo fa chi l'ha proposta o l'amministratore.
-- Stesso giorno; le controproposte ormai uguali alla partita si tolgono.
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
  if p_place is not null and p_place not in ('niche', 'decathlon') then
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

-- Il promemoria di un'ora prima dice anche dove si gioca.
drop function if exists public.cron_due_reminders(text);
create function public.cron_due_reminders(p_secret text)
returns table (
  player_id uuid, endpoint text, p256dh text, auth text,
  proposal_id uuid, starts_at timestamptz, format text, yes_count int, quiet boolean, place text
)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if p_secret is null or p_secret <> (select value from public.app_settings where key = 'cron_secret') then
    raise exception 'non autorizzato';
  end if;
  return query
  with due as (
    select p.id, p.starts_at, p.format, p.place,
           (select count(*)::int from public.proposal_responses x where x.proposal_id = p.id and x.response = 'si') as yes_count
      from public.proposals p
     where p.status = 'aperta'
       and p.starts_at between now() + interval '45 minutes' and now() + interval '75 minutes'
  ), people as (
    select d.*, r.player_id as pid
      from due d join public.proposal_responses r on r.proposal_id = d.id and r.response = 'si'
      join public.players pl on pl.id = r.player_id
     where not pl.archived and coalesce((pl.notify_prefs ->> 'promemoria')::boolean, true)
  ), fresh as (
    insert into public.notified_events (key)
    select 'reminder:' || people.id || ':' || people.pid from people
    on conflict do nothing
    returning key
  )
  select s.player_id, s.endpoint, s.p256dh, s.auth, pe.id, pe.starts_at, pe.format, pe.yes_count,
         coalesce((pl.notify_prefs ->> 'notte')::boolean, true), pe.place
    from people pe
    join fresh f on f.key = 'reminder:' || pe.id || ':' || pe.pid
    join public.push_subscriptions s on s.player_id = pe.pid
    join public.players pl on pl.id = pe.pid;
end $$;

revoke all on function public.cron_due_reminders(text) from public;
grant execute on function public.cron_due_reminders(text) to anon, authenticated;
