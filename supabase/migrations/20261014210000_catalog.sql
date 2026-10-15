create extension if not exists pg_trgm with schema extensions;

create or replace function public.normalize_catalog_text(value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select regexp_replace(lower(value), '[[:space:][:punct:]]+', '', 'g');
$$;

create table public.manga (
  id uuid primary key default gen_random_uuid(),
  canonical_title text not null check (length(trim(canonical_title)) between 1 and 240),
  canonical_title_normalized text generated always as (
    public.normalize_catalog_text(canonical_title)
  ) stored,
  original_title text,
  synopsis text,
  publication_status text not null default 'unknown'
    check (publication_status in ('ongoing', 'completed', 'hiatus', 'cancelled', 'unknown')),
  start_year integer check (start_year between 1 and 9999),
  end_year integer check (end_year between 1 and 9999),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'partially_verified', 'verified')),
  visibility text not null default 'draft'
    check (visibility in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_year is null or start_year is null or end_year >= start_year)
);

create table public.manga_titles (
  id uuid primary key default gen_random_uuid(),
  manga_id uuid not null references public.manga(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 240),
  title_normalized text generated always as (public.normalize_catalog_text(title)) stored,
  language_code text,
  script_code text,
  title_type text not null
    check (title_type in ('translated', 'romanized', 'original', 'alternate')),
  preferred boolean not null default false,
  review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table public.genres (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null unique check (length(trim(name)) between 1 and 80)
);

create table public.manga_genres (
  manga_id uuid not null references public.manga(id) on delete cascade,
  genre_id uuid not null references public.genres(id) on delete restrict,
  primary key (manga_id, genre_id)
);

create table public.manga_credits (
  id uuid primary key default gen_random_uuid(),
  manga_id uuid not null references public.manga(id) on delete cascade,
  person_name text not null check (length(trim(person_name)) between 1 and 160),
  role text not null check (role in ('author', 'illustrator', 'creator', 'other'))
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  source_url text not null check (source_url ~ '^https://'),
  source_type text not null default 'bibliographic'
    check (source_type in ('publisher', 'official', 'bibliographic', 'other'))
);

create table public.manga_sources (
  manga_id uuid not null references public.manga(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete restrict,
  field_key text not null check (length(trim(field_key)) between 1 and 80),
  verified_at timestamptz,
  primary key (manga_id, source_id, field_key)
);

create index manga_published_updated_idx
  on public.manga (updated_at desc)
  where visibility = 'published';
create index manga_title_normalized_trgm_idx
  on public.manga using gin (canonical_title_normalized extensions.gin_trgm_ops);
create index manga_titles_normalized_trgm_idx
  on public.manga_titles using gin (title_normalized extensions.gin_trgm_ops)
  where review_status = 'approved';
create index manga_titles_manga_idx on public.manga_titles (manga_id);
create index manga_genres_genre_idx on public.manga_genres (genre_id, manga_id);
create index manga_credits_manga_idx on public.manga_credits (manga_id);
create index manga_sources_manga_idx on public.manga_sources (manga_id);

alter table public.manga enable row level security;
alter table public.manga_titles enable row level security;
alter table public.genres enable row level security;
alter table public.manga_genres enable row level security;
alter table public.manga_credits enable row level security;
alter table public.sources enable row level security;
alter table public.manga_sources enable row level security;

create policy "Published manga is readable by everyone"
  on public.manga for select
  using (visibility = 'published');

create policy "Approved titles of published manga are readable"
  on public.manga_titles for select
  using (
    review_status = 'approved'
    and exists (
      select 1 from public.manga
      where manga.id = manga_titles.manga_id and manga.visibility = 'published'
    )
  );

create policy "Genres are readable by everyone"
  on public.genres for select
  using (true);

create policy "Genres of published manga are readable"
  on public.manga_genres for select
  using (
    exists (
      select 1 from public.manga
      where manga.id = manga_genres.manga_id and manga.visibility = 'published'
    )
  );

create policy "Credits of published manga are readable"
  on public.manga_credits for select
  using (
    exists (
      select 1 from public.manga
      where manga.id = manga_credits.manga_id and manga.visibility = 'published'
    )
  );

create policy "Sources are readable by everyone"
  on public.sources for select
  using (
    exists (
      select 1
      from public.manga_sources ms
      join public.manga m on m.id = ms.manga_id
      where ms.source_id = sources.id and m.visibility = 'published'
    )
  );

create policy "Sources of published manga are readable"
  on public.manga_sources for select
  using (
    exists (
      select 1 from public.manga
      where manga.id = manga_sources.manga_id and manga.visibility = 'published'
    )
  );

grant select on public.manga, public.manga_titles, public.genres,
  public.manga_genres, public.manga_credits, public.sources, public.manga_sources
  to anon, authenticated;
revoke insert, update, delete, truncate on public.manga, public.manga_titles,
  public.genres, public.manga_genres, public.manga_credits, public.sources,
  public.manga_sources from anon, authenticated;

create or replace function public.search_manga(
  search_query text default null,
  filter_status text default null,
  filter_year integer default null,
  filter_genre text default null,
  result_limit integer default 24,
  result_offset integer default 0
)
returns table (
  id uuid,
  canonical_title text,
  original_title text,
  publication_status text,
  start_year integer,
  aliases text[],
  genres text[],
  creators text[],
  match_title text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with query_value as (
    select nullif(public.normalize_catalog_text(trim(coalesce(search_query, ''))), '') as normalized
  )
  select
    m.id,
    m.canonical_title,
    m.original_title,
    m.publication_status,
    m.start_year,
    coalesce((
      select array_agg(distinct mt.title order by mt.title)
      from public.manga_titles mt
      where mt.manga_id = m.id
        and mt.review_status = 'approved'
        and public.normalize_catalog_text(mt.title) <> m.canonical_title_normalized
    ), '{}'::text[]) as aliases,
    coalesce((
      select array_agg(distinct g.name order by g.name)
      from public.manga_genres mg
      join public.genres g on g.id = mg.genre_id
      where mg.manga_id = m.id
    ), '{}'::text[]) as genres,
    coalesce((
      select array_agg(distinct mc.person_name order by mc.person_name)
      from public.manga_credits mc
      where mc.manga_id = m.id and mc.role in ('author', 'creator')
    ), '{}'::text[]) as creators,
    (
      select mt.title
      from public.manga_titles mt, query_value q
      where mt.manga_id = m.id
        and mt.review_status = 'approved'
        and (
          mt.title_normalized like '%' || q.normalized || '%'
          or extensions.similarity(mt.title_normalized, q.normalized) > 0.25
        )
      order by extensions.similarity(mt.title_normalized, q.normalized) desc
      limit 1
    ) as match_title
  from public.manga m, query_value q
  where m.visibility = 'published'
    and (filter_status is null or filter_status = '' or m.publication_status = filter_status)
    and (filter_year is null or m.start_year = filter_year)
    and (
      filter_genre is null or filter_genre = ''
      or exists (
        select 1
        from public.manga_genres mg
        join public.genres g on g.id = mg.genre_id
        where mg.manga_id = m.id and g.slug = filter_genre
      )
    )
    and (
      q.normalized is null
      or m.canonical_title_normalized like '%' || q.normalized || '%'
      or extensions.similarity(m.canonical_title_normalized, q.normalized) > 0.25
      or exists (
        select 1
        from public.manga_titles mt
        where mt.manga_id = m.id
          and mt.review_status = 'approved'
          and (
            mt.title_normalized like '%' || q.normalized || '%'
            or extensions.similarity(mt.title_normalized, q.normalized) > 0.25
          )
      )
    )
  order by
    case
      when q.normalized is null then 1
      when m.canonical_title_normalized = q.normalized then 0
      when m.canonical_title_normalized like q.normalized || '%' then 1
      else 2
    end,
    m.canonical_title
  limit least(greatest(coalesce(result_limit, 24), 1), 50)
  offset greatest(coalesce(result_offset, 0), 0);
$$;

create or replace function public.list_catalog_genres()
returns table (slug text, name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct g.slug, g.name
  from public.genres g
  join public.manga_genres mg on mg.genre_id = g.id
  join public.manga m on m.id = mg.manga_id
  where m.visibility = 'published'
  order by g.name;
$$;

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

revoke execute on function public.search_manga(text, text, integer, text, integer, integer)
  from public;
revoke execute on function public.list_catalog_genres() from public;
revoke execute on function public.get_manga_detail(uuid) from public;
grant execute on function public.search_manga(text, text, integer, text, integer, integer)
  to anon, authenticated;
grant execute on function public.list_catalog_genres() to anon, authenticated;
grant execute on function public.get_manga_detail(uuid) to anon, authenticated;
