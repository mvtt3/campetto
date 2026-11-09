-- Il nome nell'app si sceglie liberamente al primo accesso; dopo, un cambio ogni 14 giorni
-- (come i social: evita scambi continui e confusione nel gruppo). Il controllo è qui, così
-- non si aggira. L'amministratore può sempre correggere il nome di un altro giocatore.

alter table public.players add column if not exists nickname_changed_at timestamptz;

create or replace function public.players_nickname_cooldown() returns trigger
language plpgsql set search_path = public as $$
declare
  v_me uuid := public.current_player_id();
begin
  if new.nickname is not distinct from old.nickname then
    new.nickname_changed_at := old.nickname_changed_at;
    return new;
  end if;
  -- Primo nome (dall'accesso): libero e non conta.
  if old.nickname is null then return new; end if;
  -- L'amministratore che corregge un altro: nessun limite e il conto dell'altro non cambia.
  if v_me is distinct from old.id and public.is_admin() then return new; end if;
  -- Dal database (manutenzione, nessun utente): nessun limite.
  if v_me is null then return new; end if;
  if old.nickname_changed_at is not null and old.nickname_changed_at > now() - interval '14 days' then
    raise exception 'Puoi cambiare nome di nuovo dal %',
      to_char((old.nickname_changed_at + interval '14 days') at time zone 'Europe/Rome', 'DD/MM');
  end if;
  new.nickname_changed_at := now();
  return new;
end $$;

drop trigger if exists players_nickname_cooldown on public.players;
create trigger players_nickname_cooldown before update of nickname on public.players
  for each row execute function public.players_nickname_cooldown();
