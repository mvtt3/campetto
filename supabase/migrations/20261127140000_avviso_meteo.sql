-- L'avviso meteo: una scheda a comparsa con la pioggia e Spicchio triste, una volta sola per telefono.
alter table public.news drop constraint if exists news_kind_check;
alter table public.news add constraint news_kind_check check (kind in ('annuncio', 'stagione', 'novita', 'meteo'));
