alter table public.profiles
  add column if not exists show_favorites boolean not null default false,
  add column if not exists show_achievements boolean not null default false,
  add column if not exists notify_contributions boolean not null default true,
  add column if not exists notify_news boolean not null default false;

create or replace function public.get_public_profile(target_username text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with profile as (
    select
      p.user_id,
      p.username,
      p.display_name,
      p.bio,
      p.created_at,
      p.show_favorites,
      p.show_achievements
    from public.profiles p
    where p.username = lower(trim(target_username))
      and p.is_public
  ),
  recent_reviews as (
    select coalesce(jsonb_agg(review_data order by review_created_at desc), '[]'::jsonb) as items
    from (
      select jsonb_build_object(
        'manga_id', m.id,
        'manga_title', m.canonical_title,
        'rating', r.rating,
        'review_text', r.review_text,
        'contains_spoilers', r.contains_spoilers,
        'created_at', r.created_at,
        'updated_at', r.updated_at
      ) as review_data,
      r.created_at as review_created_at
      from public.manga_reviews r
      join profile p on p.user_id = r.author_id
      join public.manga m on m.id = r.manga_id
      where m.visibility = 'published'
      order by r.created_at desc
      limit 20
    ) reviews
  ),
  public_lists as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id,
      'title', l.title,
      'description', l.description,
      'item_count', (
        select count(*)::integer
        from public.manga_list_items i
        join public.manga m on m.id = i.manga_id
        where i.list_id = l.id and m.visibility = 'published'
      )
    ) order by l.created_at desc), '[]'::jsonb) as items
    from public.manga_lists l
    join profile p on p.user_id = l.user_id
    where l.is_public
  ),
  public_favorites as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id,
      'canonical_title', m.canonical_title
    ) order by f.created_at desc), '[]'::jsonb) as items
    from public.manga_favorites f
    join profile p on p.user_id = f.user_id and p.show_favorites
    join public.manga m on m.id = f.manga_id and m.visibility = 'published'
  ),
  public_achievements as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'slug', a.slug,
      'title', a.title,
      'unlocked_at', ua.unlocked_at
    ) order by a.sort_order), '[]'::jsonb) as items
    from public.user_achievements ua
    join profile p on p.user_id = ua.user_id and p.show_achievements
    join public.achievements a on a.id = ua.achievement_id
  )
  select case
    when exists (select 1 from profile) then
      (select jsonb_build_object(
        'user_id', p.user_id,
        'username', p.username,
        'display_name', p.display_name,
        'bio', p.bio,
        'created_at', p.created_at,
        'show_favorites', p.show_favorites,
        'show_achievements', p.show_achievements,
        'reviews', recent_reviews.items,
        'lists', public_lists.items,
        'favorites', public_favorites.items,
        'achievements', public_achievements.items
      )
      from profile p
      cross join recent_reviews
      cross join public_lists
      cross join public_favorites
      cross join public_achievements)
    else null
  end;
$$;

revoke execute on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;
