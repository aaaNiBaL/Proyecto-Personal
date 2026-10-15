create table public.manga_reviews (
  id uuid primary key default gen_random_uuid(),
  manga_id uuid not null references public.manga(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  review_text text check (
    review_text is null or length(trim(review_text)) between 1 and 10000
  ),
  contains_spoilers boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (manga_id, author_id),
  check (review_text is null or length(review_text) <= 10000)
);

create index manga_reviews_public_idx
  on public.manga_reviews (manga_id, created_at desc);

create trigger manga_reviews_set_updated_at
  before update on public.manga_reviews
  for each row execute function public.set_updated_at();

alter table public.manga_reviews enable row level security;

create policy "Reviews of published manga are publicly readable"
  on public.manga_reviews for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.manga m
      where m.id = manga_reviews.manga_id and m.visibility = 'published'
    )
  );

create policy "Users can review published manga"
  on public.manga_reviews for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.manga m
      where m.id = manga_reviews.manga_id and m.visibility = 'published'
    )
  );

create policy "Users can update their own reviews"
  on public.manga_reviews for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.manga m
      where m.id = manga_reviews.manga_id and m.visibility = 'published'
    )
  );

create policy "Users can delete their own reviews"
  on public.manga_reviews for delete
  to authenticated
  using (author_id = (select auth.uid()));

grant select on public.manga_reviews to anon, authenticated;
grant insert, update, delete on public.manga_reviews to authenticated;
revoke all on public.manga_reviews from public;

create or replace function public.get_manga_reviews(target_manga_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with published_manga as (
    select m.id
    from public.manga m
    where m.id = target_manga_id and m.visibility = 'published'
  ),
  review_stats as (
    select
      coalesce(round(avg(r.rating)::numeric, 1), 0) as average_rating,
      count(r.id)::integer as rating_count
    from published_manga pm
    left join public.manga_reviews r on r.manga_id = pm.id
  ),
  recent_reviews as (
    select coalesce(jsonb_agg(review_row.review_data), '[]'::jsonb) as items
    from (
      select jsonb_build_object(
        'id', r.id,
        'author_id', r.author_id,
        'username', p.username,
        'rating', r.rating,
        'review_text', r.review_text,
        'contains_spoilers', r.contains_spoilers,
        'created_at', r.created_at,
        'updated_at', r.updated_at
      ) as review_data
      from public.manga_reviews r
      join public.profiles p on p.user_id = r.author_id
      join published_manga pm on pm.id = r.manga_id
      order by r.created_at desc
      limit 50
    ) review_row
  )
  select case
    when exists (select 1 from published_manga) then
      jsonb_build_object(
        'average_rating', review_stats.average_rating,
        'rating_count', review_stats.rating_count,
        'reviews', recent_reviews.items
      )
    else null
  end
  from review_stats, recent_reviews;
$$;

revoke execute on function public.get_manga_reviews(uuid) from public;
grant execute on function public.get_manga_reviews(uuid) to anon, authenticated;
