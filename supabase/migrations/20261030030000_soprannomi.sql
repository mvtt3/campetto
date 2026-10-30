-- Niente parole offensive nei soprannomi (30/10/2026): lo stesso controllo dell'app
-- (src/lib/nickname-filter.ts), anche nel database, così non si aggira.

create or replace function public.nickname_offensive(p text) returns boolean
language plpgsql immutable set search_path = public as $$
declare
  l text;
  joined text;
  tokens text[];
  t text;
  i int;
begin
  if p is null then return false; end if;
  -- minuscole, senza accenti, numeri e simboli letti come lettere (c4zz0, $h1t)
  l := translate(lower(p), 'àáâäãåèéêëìíîïòóôöõùúûüçñ0134578!|@$€9', 'aaaaaaeeeeiiiiooooouuuucnoieastbiiaseg');
  joined := regexp_replace(l, '[^a-z]', '', 'g');
  if joined = '' then return false; end if;
  if joined ~ 'a+s+s+h+o+l+e+|b+a+g+a+s+c+|b+a+l+d+r+a+c+c+|b+a+s+t+a+r+d+|b+i+t+c+h+|b+o+c+c+h+i+n+|c+a+z+z+|c+e+r+e+b+r+o+l+e+s+|c+o+g+l+i+o+n+|c+r+i+s+t+o+d+i+|c+u+l+a+t+t+o+n+|c+u+n+t+|d+i+l+d+o+|d+i+o+b+e+s+t+i+a+|d+i+o+b+o+i+|d+i+o+c+a+n+|d+i+o+m+e+r+d+|d+i+o+p+o+r+c+|f+a+g+g+|f+a+n+c+u+l+|f+r+o+c+e+t+t+|f+r+o+c+i+|f+u+c+k+|h+a+n+d+i+c+a+p+p+a+t+|h+i+t+l+e+r+|i+m+b+e+c+i+l+l+|i+n+c+u+l+a+t+|j+i+z+z+|k+k+k+|l+e+c+c+a+c+u+l+|m+a+d+o+n+n+a+p+u+t+t+|m+e+r+d+|m+i+g+n+o+t+t+|m+i+n+c+h+i+|m+o+n+g+o+l+o+i+d+|m+u+s+s+o+l+i+n+|n+a+z+i+s+t+|n+i+g+g+|p+o+m+p+i+n+|p+o+r+c+a+d+d+i+|p+o+r+c+a+m+a+d+o+n+n+|p+o+r+c+o+d+d+i+|p+o+r+c+o+d+i+|p+o+r+n+|p+u+s+s+y+|p+u+t+t+a+n+|r+e+t+a+r+d+|r+i+c+c+h+i+o+n+|s+b+o+r+r+|s+b+u+r+r+|s+e+g+a+i+o+l+|s+h+i+t+|s+l+u+t+|s+p+a+s+t+i+c+|s+t+r+o+n+z+|s+u+b+n+o+r+m+a+l+|t+e+r+r+o+n+|t+r+o+i+o+n+|v+a+f+f+a+n+c+u+l+|w+a+n+k+|w+h+o+r+e+|z+i+n+g+a+r+|z+o+c+c+o+l+o+n+' then return true; end if;
  tokens := regexp_split_to_array(regexp_replace(l, '[^a-z]+', ' ', 'g'), ' ');
  tokens := array_remove(tokens, '');
  foreach t in array tokens || joined loop
    if t ~ '^(a+s+s+|b+o+o+b+s+|c+h+e+c+c+a+|c+o+c+k+|c+o+r+n+u+t+a+|c+o+r+n+u+t+o+|c+r+e+t+i+n+a+|c+r+e+t+i+n+i+|c+r+e+t+i+n+o+|c+u+l+o+|c+u+l+o+n+a+|c+u+m+|d+e+f+i+c+i+e+n+t+e+|d+e+f+i+c+i+e+n+t+i+|d+i+c+k+|d+i+o+b+o+i+a+|d+i+o+c+a+n+e+|d+i+o+p+o+r+c+o+|d+u+c+e+|f+a+g+|f+i+c+a+|f+i+g+a+|f+i+n+o+c+c+h+i+|f+i+n+o+c+c+h+i+o+|f+r+e+g+n+a+|h+e+i+l+|i+d+i+o+t+a+|i+d+i+o+t+i+|i+s+i+s+|m+i+l+f+|n+a+z+i+|n+e+g+r+a+|n+e+g+r+e+|n+e+g+r+i+|n+e+g+r+o+|p+e+n+i+s+|p+o+l+e+n+t+o+n+e+|p+o+l+e+n+t+o+n+i+|p+o+r+c+o+d+i+o+|r+a+p+e+|r+i+t+a+r+d+a+t+a+|r+i+t+a+r+d+a+t+i+|r+i+t+a+r+d+a+t+o+|t+e+t+t+e+|t+e+t+t+o+n+a+|t+i+t+s+|t+r+o+i+a+|t+r+o+i+e+|v+a+g+i+n+a+|z+o+c+c+o+l+a+|z+o+c+c+o+l+e+)$' then return true; end if;
  end loop;
  for i in 2 .. coalesce(array_length(tokens, 1), 0) loop
    if (tokens[i - 1] || tokens[i]) ~ '^(a+s+s+|b+o+o+b+s+|c+h+e+c+c+a+|c+o+c+k+|c+o+r+n+u+t+a+|c+o+r+n+u+t+o+|c+r+e+t+i+n+a+|c+r+e+t+i+n+i+|c+r+e+t+i+n+o+|c+u+l+o+|c+u+l+o+n+a+|c+u+m+|d+e+f+i+c+i+e+n+t+e+|d+e+f+i+c+i+e+n+t+i+|d+i+c+k+|d+i+o+b+o+i+a+|d+i+o+c+a+n+e+|d+i+o+p+o+r+c+o+|d+u+c+e+|f+a+g+|f+i+c+a+|f+i+g+a+|f+i+n+o+c+c+h+i+|f+i+n+o+c+c+h+i+o+|f+r+e+g+n+a+|h+e+i+l+|i+d+i+o+t+a+|i+d+i+o+t+i+|i+s+i+s+|m+i+l+f+|n+a+z+i+|n+e+g+r+a+|n+e+g+r+e+|n+e+g+r+i+|n+e+g+r+o+|p+e+n+i+s+|p+o+l+e+n+t+o+n+e+|p+o+l+e+n+t+o+n+i+|p+o+r+c+o+d+i+o+|r+a+p+e+|r+i+t+a+r+d+a+t+a+|r+i+t+a+r+d+a+t+i+|r+i+t+a+r+d+a+t+o+|t+e+t+t+e+|t+e+t+t+o+n+a+|t+i+t+s+|t+r+o+i+a+|t+r+o+i+e+|v+a+g+i+n+a+|z+o+c+c+o+l+a+|z+o+c+c+o+l+e+)$' then return true; end if;
  end loop;
  return false;
end $$;

create or replace function public.players_nickname_check() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.nickname is distinct from old.nickname and public.nickname_offensive(new.nickname) then
    raise exception 'Questo nome non lo posso usare: potrebbe offendere qualcuno';
  end if;
  return new;
end $$;

drop trigger if exists players_nickname_check on public.players;
create trigger players_nickname_check before update of nickname on public.players
  for each row execute function public.players_nickname_check();
