-- Nome scelto da ciascuno, figurine e partenza dell'app (29/10/2026).

-- Il nome nell'app è unico nel gruppo (senza distinguere maiuscole) e lungo 2-16 caratteri.
create unique index if not exists players_nickname_key on public.players (lower(btrim(nickname))) where nickname is not null;
alter table public.players drop constraint if exists players_nickname_len;
alter table public.players add constraint players_nickname_len
  check (nickname is null or char_length(btrim(nickname)) between 2 and 16);

-- Foto profilo: una figurina dell'app ("preset:…") oppure una foto caricata.
alter table public.players drop constraint if exists players_avatar_url_check;
alter table public.players add constraint players_avatar_url_check
  check (avatar_url is null or avatar_url ~ '^preset:[a-z]{2,20}$' or avatar_url ~ '^https://');

-- L'app nasce a ottobre 2026: nessuna partita prima di allora.
alter table public.matches drop constraint if exists matches_since_start;
alter table public.matches add constraint matches_since_start
  check (played_at >= timestamptz '2026-10-01 00:00:00+02');
