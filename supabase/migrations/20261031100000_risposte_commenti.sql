-- Risposte ai commenti degli highlights, come su WhatsApp (31/10/2026): un commento può
-- rispondere a un altro dello stesso video; chi riceve la risposta viene avvisato.

alter table public.highlight_comments
  add column if not exists reply_to uuid references public.highlight_comments(id) on delete set null;

-- La risposta deve stare sotto lo stesso video del commento a cui risponde.
create or replace function public.highlight_comment_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.highlight_comments
       where player_id = new.player_id and created_at > now() - interval '1 minute') >= 6 then
    raise exception 'Calma! Aspetta un attimo prima di scrivere ancora';
  end if;
  if new.reply_to is not null and not exists (
    select 1 from public.highlight_comments c
     where c.id = new.reply_to and c.highlight_id = new.highlight_id
  ) then
    new.reply_to := null;
  end if;
  new.body := btrim(new.body);
  new.created_at := now();
  return new;
end $$;
