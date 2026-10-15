create or replace function public.get_popular_manga(result_limit integer default 4)
returns table (
  id uuid,
  canonical_title text,
  average_rating numeric,
  rating_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.id,
    m.canonical_title,
    round(avg(r.rating)::numeric, 1) as average_rating,
    count(r.id) as rating_count
  from public.manga m
  join public.manga_reviews r on r.manga_id = m.id
  where m.visibility = 'published'
  group by m.id, m.canonical_title
  having count(r.id) >= 3
  order by average_rating desc, rating_count desc, m.canonical_title
  limit least(greatest(coalesce(result_limit, 4), 1), 12);
$$;

revoke execute on function public.get_popular_manga(integer) from public;
grant execute on function public.get_popular_manga(integer) to anon, authenticated;
