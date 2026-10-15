create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
begin
  requested_username := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));

  if requested_username = '' then
    requested_username :=
      'reader_' || replace(substr(gen_random_uuid()::text, 1, 13), '-', '');
  end if;

  if requested_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'El nombre de usuario debe tener entre 3 y 24 caracteres y usar solo letras, números o guion bajo.';
  end if;

  insert into public.profiles (user_id, username)
  values (new.id, requested_username);

  return new;
exception
  when unique_violation then
    raise exception 'Ese nombre de usuario ya está en uso.'
      using errcode = '23505';
end;
$$;

revoke execute on function public.create_profile_for_new_user() from public;
