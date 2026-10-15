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
