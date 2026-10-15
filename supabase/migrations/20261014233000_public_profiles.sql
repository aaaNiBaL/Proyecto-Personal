alter table public.profiles
  add column display_name text not null default '',
  add column bio text not null default '',
  add column is_public boolean not null default false,
  add column updated_at timestamptz not null default now(),
  add constraint profiles_display_name_length
    check (length(display_name) <= 80),
  add constraint profiles_bio_length
    check (length(bio) <= 500);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant update (username, display_name, bio, is_public)
  on public.profiles to authenticated;

create or replace function public.get_public_profile(target_username text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with profile as (
    select p.user_id, p.username, p.display_name, p.bio, p.created_at
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
  )
  select case
    when exists (select 1 from profile) then
      (select jsonb_build_object(
        'username', p.username,
        'display_name', p.display_name,
        'bio', p.bio,
        'created_at', p.created_at,
        'reviews', recent_reviews.items
      )
      from profile p cross join recent_reviews)
    else null
  end;
$$;

revoke execute on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;
