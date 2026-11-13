-- Gli extra: chi gioca con il gruppo ma non ha l'app (per esempio Leo). A differenza degli ospiti
-- (uno trovato al campetto, creato solo inserendo la partita) l'extra ha un nome fisso e torna:
-- chiunque del gruppo lo può portare e segnare nel calendario ("Ci sono"), si sceglie nelle
-- squadre e ha il suo tabellino. Nelle classifiche, nei record, negli MVP e nei badge non entra,
-- come gli ospiti; se un giorno scarica l'app, l'amministratore lo collega e da lì conta.

alter table public.players
  add column if not exists extra boolean not null default false;
-- Chi l'ha portato la prima volta.
alter table public.players
  add column if not exists extra_by uuid references public.players(id) on delete set null;
create index if not exists players_extra_idx on public.players (extra) where extra;

-- Nel calendario: chi l'ha segnato (per scrivere "portato da …").
alter table public.proposal_responses
  add column if not exists added_by uuid references public.players(id) on delete set null;

-- Chiunque del gruppo può creare un extra: senza account, non amministratore, non ospite.
drop policy if exists players_insert_extra on public.players;
create policy players_insert_extra on public.players for insert to authenticated
  with check (
    public.is_member()
    and extra
    and not guest
    and not is_admin
    and user_id is null
    and extra_by = public.current_player_id()
  );

-- Le risposte degli extra le dà chi li porta (chiunque del gruppo).
drop policy if exists responses_extra_insert on public.proposal_responses;
create policy responses_extra_insert on public.proposal_responses for insert to authenticated
  with check (
    public.is_member()
    and added_by = public.current_player_id()
    and exists (select 1 from public.players x where x.id = player_id and x.extra and not x.archived)
  );
drop policy if exists responses_extra_update on public.proposal_responses;
create policy responses_extra_update on public.proposal_responses for update to authenticated
  using (
    public.is_member()
    and exists (select 1 from public.players x where x.id = player_id and x.extra)
  )
  with check (
    public.is_member()
    and added_by = public.current_player_id()
    and exists (select 1 from public.players x where x.id = player_id and x.extra and not x.archived)
  );
drop policy if exists responses_extra_delete on public.proposal_responses;
create policy responses_extra_delete on public.proposal_responses for delete to authenticated
  using (
    public.is_member()
    and exists (select 1 from public.players x where x.id = player_id and x.extra)
  );
