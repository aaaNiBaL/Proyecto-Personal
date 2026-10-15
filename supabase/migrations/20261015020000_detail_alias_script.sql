create or replace function public.get_manga_detail(manga_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', m.id,
    'canonical_title', m.canonical_title,
    'original_title', m.original_title,
    'synopsis', m.synopsis,
    'publication_status', m.publication_status,
    'start_year', m.start_year,
    'end_year', m.end_year,
    'verification_status', m.verification_status,
    'aliases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', mt.title,
        'language_code', mt.language_code,
        'script_code', mt.script_code,
        'title_type', mt.title_type
      ) order by mt.preferred desc, mt.title)
      from public.manga_titles mt
      where mt.manga_id = m.id
        and mt.review_status = 'approved'
        and public.normalize_catalog_text(mt.title) <> m.canonical_title_normalized
    ), '[]'::jsonb),
    'genres', coalesce((
      select jsonb_agg(g.name order by g.name)
      from public.manga_genres mg
      join public.genres g on g.id = mg.genre_id
      where mg.manga_id = m.id
    ), '[]'::jsonb),
    'credits', coalesce((
      select jsonb_agg(jsonb_build_object('person_name', mc.person_name, 'role', mc.role)
        order by mc.role, mc.person_name)
      from public.manga_credits mc
      where mc.manga_id = m.id
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', s.name,
        'source_url', s.source_url,
        'field_key', ms.field_key,
        'verified_at', ms.verified_at
      ) order by s.name, ms.field_key)
      from public.manga_sources ms
      join public.sources s on s.id = ms.source_id
      where ms.manga_id = m.id
    ), '[]'::jsonb)
  )
  from public.manga m
  where m.id = manga_id and m.visibility = 'published';
$$;
