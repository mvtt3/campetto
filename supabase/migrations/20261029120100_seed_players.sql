-- Giocatori iniziali del gruppo. Nessuna partita: le statistiche partono da zero.
do $$
declare v_admin uuid;
begin
  if exists (select 1 from public.players) then return; end if;

  insert into public.players (first_name, last_name, roles, is_admin)
  values ('Matteo', 'Pepe', array['Guardia','Ala piccola'], true)
  returning id into v_admin;

  insert into public.players (first_name, last_name, roles) values
    ('Valerio', 'Semeraro', array['Play']),
    ('Davide', 'Aquilino', array['Guardia','Ala grande']),
    ('Lorenzo', 'Candela', array['Play']),
    ('Mattia', null, array['Play','Guardia']),
    ('Matteo', 'Mocciaro', array['Ala grande','Centro']),
    ('Simone', 'Falbo', array['Ala grande','Centro','Ala piccola']);

  -- L'email dell'amministratore (per il collegamento automatico al primo accesso)
  -- non sta nel repository: si imposta a parte con scripts/set-admin-email.sql.
  perform v_admin;
end $$;
