-- Gli highlights montati da CMTP durano più di due minuti (fino a 2:22 il 21/11): il limite
-- passa da 120 a 300 secondi.
alter table public.highlights drop constraint if exists highlights_duration_check;
alter table public.highlights add constraint highlights_duration_check check (duration > 0 and duration <= 300);
