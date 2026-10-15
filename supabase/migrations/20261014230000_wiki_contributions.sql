create table public.catalog_editor_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('editor', 'moderator', 'admin')),
  created_at timestamptz not null default now()
);

create table public.catalog_contributions (
  id uuid primary key default gen_random_uuid(),
  manga_id uuid not null references public.manga(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  contribution_type text not null check (contribution_type in ('metadata', 'alias')),
  proposed_changes jsonb not null check (
    jsonb_typeof(proposed_changes) = 'object'
    and proposed_changes <> '{}'::jsonb
  ),
  source_url text not null check (
    length(source_url) between 10 and 2048
    and source_url ~ '^https://[^[:space:]]+$'
  ),
  note text check (note is null or length(note) <= 2000),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewer_id uuid references auth.users(id) on delete set null,
  review_note text check (review_note is null or length(review_note) <= 2000),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'pending' and reviewer_id is null and reviewed_at is null)
    or (status <> 'pending' and reviewer_id is not null and reviewed_at is not null)
  )
);

create table public.catalog_revisions (
  id uuid primary key default gen_random_uuid(),
  manga_id uuid not null references public.manga(id) on delete cascade,
  contribution_id uuid not null
    references public.catalog_contributions(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  field_key text not null,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index catalog_contributions_author_idx
  on public.catalog_contributions (author_id, created_at desc);
create index catalog_contributions_review_idx
  on public.catalog_contributions (status, created_at)
  where status = 'pending';
create index catalog_contributions_manga_idx
  on public.catalog_contributions (manga_id, created_at desc);
create index catalog_revisions_manga_idx
  on public.catalog_revisions (manga_id, created_at desc);
create unique index sources_source_url_uidx on public.sources (source_url);

alter table public.catalog_editor_roles enable row level security;
alter table public.catalog_contributions enable row level security;
alter table public.catalog_revisions enable row level security;

create or replace function public.is_catalog_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.catalog_editor_roles r
    where r.user_id = (select auth.uid())
      and r.role in ('editor', 'moderator', 'admin')
  );
$$;

create or replace function public.is_catalog_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.catalog_editor_roles r
    where r.user_id = (select auth.uid())
      and r.role in ('moderator', 'admin')
  );
$$;

revoke all on public.catalog_editor_roles from public, anon, authenticated;
grant select on public.catalog_contributions, public.catalog_revisions
  to authenticated;
grant select on public.catalog_revisions to anon;
revoke insert, update, delete, truncate on public.catalog_contributions,
  public.catalog_revisions from public, anon, authenticated;
revoke execute on function public.is_catalog_editor() from public;
revoke execute on function public.is_catalog_moderator() from public;
grant execute on function public.is_catalog_editor() to authenticated;
grant execute on function public.is_catalog_moderator() to authenticated;

create policy "Authors and editors can read contributions"
  on public.catalog_contributions for select
  to authenticated
  using (
    author_id = (select auth.uid())
    or (select public.is_catalog_editor())
  );

create policy "Published catalog revisions are readable"
  on public.catalog_revisions for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.manga m
      where m.id = catalog_revisions.manga_id and m.visibility = 'published'
    )
  );

create or replace function public.submit_catalog_contribution(
  target_manga_id uuid,
  requested_type text,
  changes jsonb,
  reference_url text,
  contributor_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  contribution_id uuid;
  allowed_keys text[];
  provided_keys text[];
  one_key text;
  year_value numeric;
begin
  if current_user_id is null then
    raise exception 'Debes iniciar sesión para proponer cambios.'
      using errcode = '42501';
  end if;

  if requested_type is null or requested_type not in ('metadata', 'alias') then
    raise exception 'Tipo de propuesta no permitido.';
  end if;
  if jsonb_typeof(changes) <> 'object' or changes = '{}'::jsonb then
    raise exception 'La propuesta debe contener cambios.';
  end if;
  if reference_url is null
     or reference_url !~ '^https://[^[:space:]]+$'
     or length(reference_url) > 2048 then
    raise exception 'La fuente debe ser una URL HTTPS válida.';
  end if;
  if contributor_note is not null and length(contributor_note) > 2000 then
    raise exception 'La nota supera el límite permitido.';
  end if;
  if not exists (
    select 1 from public.manga m
    where m.id = target_manga_id and m.visibility = 'published'
  ) then
    raise exception 'La obra no está disponible para recibir propuestas.';
  end if;

  if requested_type = 'metadata' then
    allowed_keys := array['canonical_title', 'synopsis', 'publication_status', 'start_year', 'end_year'];
  else
    allowed_keys := array['title', 'language_code', 'script_code', 'title_type'];
  end if;
  select array_agg(keys.field_name)
  into provided_keys
  from jsonb_object_keys(changes) as keys(field_name);
  if provided_keys is null or not (provided_keys <@ allowed_keys) then
    raise exception 'La propuesta incluye campos no permitidos.';
  end if;

  if requested_type = 'metadata' then
    if changes ? 'canonical_title' and (
      jsonb_typeof(changes->'canonical_title') <> 'string'
      or length(trim(changes->>'canonical_title')) not between 1 and 240
    ) then raise exception 'El título debe tener entre 1 y 240 caracteres.'; end if;
    if changes ? 'synopsis' and changes->'synopsis' <> 'null'::jsonb and (
      jsonb_typeof(changes->'synopsis') <> 'string'
      or length(changes->>'synopsis') > 10000
    ) then raise exception 'La sinopsis no puede superar 10000 caracteres.'; end if;
    if changes ? 'publication_status' and (
      changes->>'publication_status' is null or
      changes->>'publication_status' not in ('ongoing', 'completed', 'hiatus', 'cancelled', 'unknown')
    )
    then raise exception 'Estado de publicación inválido.'; end if;
    foreach one_key in array array['start_year', 'end_year'] loop
      if changes ? one_key and changes->one_key <> 'null'::jsonb then
        if jsonb_typeof(changes->one_key) <> 'number' then
          raise exception 'El año debe ser un entero entre 1 y 9999.';
        end if;
        year_value := (changes->>one_key)::numeric;
        if year_value not between 1 and 9999 or year_value <> trunc(year_value) then
          raise exception 'El año debe ser un entero entre 1 y 9999.';
        end if;
      end if;
    end loop;
  else
    if not (changes ? 'title') or jsonb_typeof(changes->'title') <> 'string'
      or length(trim(changes->>'title')) not between 1 and 240
    then raise exception 'El alias debe incluir un título de 1 a 240 caracteres.'; end if;
    if changes ? 'language_code' and changes->'language_code' <> 'null'::jsonb and (
      jsonb_typeof(changes->'language_code') <> 'string'
      or length(changes->>'language_code') > 20
    ) then raise exception 'El código de idioma es inválido.'; end if;
    if changes ? 'script_code' and changes->'script_code' <> 'null'::jsonb and (
      jsonb_typeof(changes->'script_code') <> 'string'
      or length(changes->>'script_code') > 20
    ) then raise exception 'El sistema de escritura es inválido.'; end if;
    if changes ? 'title_type' and (
      changes->>'title_type' is null or
      changes->>'title_type' not in ('translated', 'romanized', 'original', 'alternate')
    )
    then raise exception 'Tipo de alias inválido.'; end if;
  end if;

  if (
    select count(*) from public.catalog_contributions c
    where c.author_id = current_user_id
      and c.created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Alcanzaste el límite de propuestas por hora.';
  end if;

  insert into public.catalog_contributions (
    manga_id, author_id, contribution_type, proposed_changes, source_url, note
  )
  values (
    target_manga_id, current_user_id, requested_type, changes, reference_url, contributor_note
  )
  returning id into contribution_id;

  return contribution_id;
end;
$$;

create or replace function public.review_catalog_contribution(
  target_contribution_id uuid,
  decision text,
  moderator_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  contribution public.catalog_contributions%rowtype;
  current_user_id uuid := auth.uid();
  v_field_key text;
  previous_json jsonb;
  new_json jsonb;
  current_manga public.manga%rowtype;
  next_title text;
  next_synopsis text;
  next_status text;
  next_start_year integer;
  next_end_year integer;
begin
  if current_user_id is null or not public.is_catalog_moderator() then
    raise exception 'No tienes permiso para revisar propuestas.'
      using errcode = '42501';
  end if;
  if decision is null or decision not in ('approved', 'rejected') then
    raise exception 'La decisión debe ser aprobar o rechazar.';
  end if;
  if moderator_note is not null and length(moderator_note) > 2000 then
    raise exception 'La nota de revisión supera el límite permitido.';
  end if;

  select * into contribution
  from public.catalog_contributions
  where id = target_contribution_id
  for update;
  if not found or contribution.status <> 'pending' then
    raise exception 'La propuesta ya no está pendiente o no existe.';
  end if;

  if decision = 'approved' then
    if contribution.contribution_type = 'metadata' then
      select * into current_manga from public.manga
      where id = contribution.manga_id
      for update;

      next_title := current_manga.canonical_title;
      next_synopsis := current_manga.synopsis;
      next_status := current_manga.publication_status;
      next_start_year := current_manga.start_year;
      next_end_year := current_manga.end_year;

      if contribution.proposed_changes ? 'canonical_title' then
        next_title := contribution.proposed_changes->>'canonical_title';
      end if;
      if contribution.proposed_changes ? 'synopsis' then
        next_synopsis := case
          when contribution.proposed_changes->'synopsis' = 'null'::jsonb then null
          else contribution.proposed_changes->>'synopsis'
        end;
      end if;
      if contribution.proposed_changes ? 'publication_status' then
        next_status := contribution.proposed_changes->>'publication_status';
      end if;
      if contribution.proposed_changes ? 'start_year' then
        next_start_year := case
          when contribution.proposed_changes->'start_year' = 'null'::jsonb then null
          else (contribution.proposed_changes->>'start_year')::integer
        end;
      end if;
      if contribution.proposed_changes ? 'end_year' then
        next_end_year := case
          when contribution.proposed_changes->'end_year' = 'null'::jsonb then null
          else (contribution.proposed_changes->>'end_year')::integer
        end;
      end if;

      update public.manga
      set canonical_title = next_title,
          synopsis = next_synopsis,
          publication_status = next_status,
          start_year = next_start_year,
          end_year = next_end_year,
          updated_at = now()
      where id = contribution.manga_id;

      for v_field_key in
        select keys.field_name
        from jsonb_object_keys(contribution.proposed_changes) as keys(field_name)
      loop
        case v_field_key
          when 'canonical_title' then
            previous_json := to_jsonb(current_manga.canonical_title);
            new_json := contribution.proposed_changes->v_field_key;
          when 'synopsis' then
            previous_json := to_jsonb(current_manga.synopsis);
            new_json := contribution.proposed_changes->v_field_key;
          when 'publication_status' then
            previous_json := to_jsonb(current_manga.publication_status);
            new_json := contribution.proposed_changes->v_field_key;
          when 'start_year' then
            previous_json := to_jsonb(current_manga.start_year);
            new_json := contribution.proposed_changes->v_field_key;
          when 'end_year' then
            previous_json := to_jsonb(current_manga.end_year);
            new_json := contribution.proposed_changes->v_field_key;
          else
            raise exception 'Campo no permitido en la propuesta.';
        end case;

        insert into public.catalog_revisions (
          manga_id, contribution_id, actor_id, field_key, previous_value, new_value
        )
        values (
          contribution.manga_id, contribution.id, current_user_id,
          v_field_key, previous_json, new_json
        );

        insert into public.sources (name, source_url, source_type)
        values ('Fuente de contribución', contribution.source_url, 'other')
        on conflict (source_url) do nothing;
        insert into public.manga_sources (manga_id, source_id, field_key, verified_at)
        select contribution.manga_id, s.id, v_field_key, now()
        from public.sources s
        where s.source_url = contribution.source_url
        on conflict (manga_id, source_id, field_key)
        do update set verified_at = excluded.verified_at;
      end loop;
    else
      if exists (
        select 1 from public.manga_titles mt
        where mt.manga_id = contribution.manga_id
          and mt.review_status = 'approved'
          and public.normalize_catalog_text(mt.title) =
            public.normalize_catalog_text(contribution.proposed_changes->>'title')
      ) then
        raise exception 'Ya existe un título aprobado equivalente para esta obra.';
      end if;
      insert into public.manga_titles (
        manga_id, title, language_code, script_code, title_type, preferred, review_status
      )
      values (
        contribution.manga_id,
        contribution.proposed_changes->>'title',
        contribution.proposed_changes->>'language_code',
        contribution.proposed_changes->>'script_code',
        coalesce(contribution.proposed_changes->>'title_type', 'alternate'),
        false,
        'approved'
      );

      insert into public.catalog_revisions (
        manga_id, contribution_id, actor_id, field_key, previous_value, new_value
      )
      values (
        contribution.manga_id, contribution.id, current_user_id, 'alias', null,
        contribution.proposed_changes
      );

      insert into public.sources (name, source_url, source_type)
      values ('Fuente de contribución', contribution.source_url, 'other')
      on conflict (source_url) do nothing;
      insert into public.manga_sources (manga_id, source_id, field_key, verified_at)
      select contribution.manga_id, s.id, 'alias', now()
      from public.sources s
      where s.source_url = contribution.source_url
      on conflict (manga_id, source_id, field_key)
      do update set verified_at = excluded.verified_at;
    end if;
  end if;

  update public.catalog_contributions
  set status = decision,
      reviewer_id = current_user_id,
      review_note = moderator_note,
      reviewed_at = now()
  where id = contribution.id;
end;
$$;

create or replace function public.list_pending_catalog_contributions()
returns table (
  id uuid,
  manga_id uuid,
  manga_title text,
  author_id uuid,
  contribution_type text,
  proposed_changes jsonb,
  source_url text,
  note text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.manga_id, m.canonical_title, c.author_id,
    c.contribution_type, c.proposed_changes, c.source_url, c.note, c.created_at
  from public.catalog_contributions c
  join public.manga m on m.id = c.manga_id
  where c.status = 'pending'
    and (select public.is_catalog_moderator())
  order by c.created_at asc;
$$;

revoke execute on function public.submit_catalog_contribution(uuid, text, jsonb, text, text)
  from public;
revoke execute on function public.review_catalog_contribution(uuid, text, text)
  from public;
revoke execute on function public.list_pending_catalog_contributions() from public;
grant execute on function public.submit_catalog_contribution(uuid, text, jsonb, text, text)
  to authenticated;
grant execute on function public.review_catalog_contribution(uuid, text, text)
  to authenticated;
grant execute on function public.list_pending_catalog_contributions()
  to authenticated;
