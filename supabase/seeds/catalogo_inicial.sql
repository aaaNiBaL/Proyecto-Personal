begin;

do $$
declare
  entry record;
  v_manga_id uuid;
  v_source_id uuid;
begin
  for entry in
    select *
    from (values
      ('One Piece', 'https://www.viz.com/one-piece'),
      ('Dragon Ball', 'https://www.viz.com/dragon-ball')
    ) as initial_catalog(canonical_title, source_url)
  loop
    select m.id
    into v_manga_id
    from public.manga m
    where m.canonical_title_normalized =
      public.normalize_catalog_text(entry.canonical_title)
    order by m.created_at
    limit 1;

    if v_manga_id is null then
      insert into public.manga (
        canonical_title,
        publication_status,
        verification_status,
        visibility
      )
      values (
        entry.canonical_title,
        'unknown',
        'partially_verified',
        'published'
      )
      returning id into v_manga_id;
    end if;

    select s.id
    into v_source_id
    from public.sources s
    where s.source_url = entry.source_url
    limit 1;

    if v_source_id is null then
      insert into public.sources (name, source_url, source_type)
      values ('VIZ Media', entry.source_url, 'publisher')
      returning id into v_source_id;
    end if;

    insert into public.manga_sources (manga_id, source_id, field_key, verified_at)
    values (v_manga_id, v_source_id, 'title', now())
    on conflict (manga_id, source_id, field_key) do nothing;
  end loop;
end
$$;

commit;
