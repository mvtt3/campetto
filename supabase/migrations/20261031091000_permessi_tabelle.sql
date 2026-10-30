-- Permessi delle tabelle per chi ha fatto l'accesso (31/10/2026).
-- In questo progetto le tabelle nuove non ricevono permessi in automatico: senza GRANT il ruolo
-- "authenticated" non le vede nemmeno, anche con le regole RLS giuste. Mancavano per notizie e
-- segnalazioni (le notizie scritte a mano non arrivavano e "Segnala un problema" non salvava) e
-- per gli highlights. Le regole RLS restano quelle: decidono loro chi vede e chi scrive cosa.

grant select, insert, update, delete on public.news to authenticated;
grant select, insert on public.feedback to authenticated;

grant select, insert, update, delete on public.highlights to authenticated;
grant select, insert, delete on public.highlight_likes to authenticated;
grant select, insert, delete on public.highlight_comments to authenticated;
