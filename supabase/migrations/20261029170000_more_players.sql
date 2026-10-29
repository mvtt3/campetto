-- Si aggiungono Mori e Samuele Formigaro (29/10/2026).
insert into public.players (first_name, last_name, roles)
select 'Mori', null, '{}'::text[]
where not exists (select 1 from public.players where first_name = 'Mori' and last_name is null);

insert into public.players (first_name, last_name, roles)
select 'Samuele', 'Formigaro', '{}'::text[]
where not exists (select 1 from public.players where first_name = 'Samuele' and last_name = 'Formigaro');
