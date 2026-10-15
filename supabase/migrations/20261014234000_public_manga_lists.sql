create table public.manga_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 80),
  description text not null default '' check (length(description) <= 500),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index manga_lists_user_title_uidx
  on public.manga_lists (user_id, lower(trim(title)));

create table public.manga_list_items (
  list_id uuid not null references public.manga_lists(id) on delete cascade,
  manga_id uuid not null references public.manga(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (list_id, manga_id)
);

create index manga_list_items_manga_idx on public.manga_list_items (manga_id);

create trigger manga_lists_set_updated_at
  before update on public.manga_lists
  for each row execute function public.set_updated_at();

alter table public.manga_lists enable row level security;
alter table public.manga_list_items enable row level security;

create policy "Owners can read their manga lists"
  on public.manga_lists for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can create their own manga lists"
  on public.manga_lists for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update their own manga lists"
  on public.manga_lists for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can delete their own manga lists"
  on public.manga_lists for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Owners can read items in their manga lists"
  on public.manga_list_items for select
  to authenticated
  using (
    exists (
      select 1 from public.manga_lists l
      where l.id = manga_list_items.list_id
        and l.user_id = (select auth.uid())
    )
  );

create policy "Owners can add published manga to their lists"
  on public.manga_list_items for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.manga_lists l
      join public.manga m on m.id = manga_list_items.manga_id
      where l.id = manga_list_items.list_id
        and l.user_id = (select auth.uid())
        and m.visibility = 'published'
    )
  );

create policy "Owners can remove manga from their lists"
  on public.manga_list_items for delete
  to authenticated
  using (
    exists (
      select 1 from public.manga_lists l
      where l.id = manga_list_items.list_id
        and l.user_id = (select auth.uid())
    )
  );

grant select on public.manga_lists, public.manga_list_items to authenticated;
grant insert (user_id, title, description, is_public)
  on public.manga_lists to authenticated;
grant update (title, description, is_public)
  on public.manga_lists to authenticated;
grant delete on public.manga_lists to authenticated;
grant delete on public.manga_list_items to authenticated;
revoke all on public.manga_lists, public.manga_list_items from public;

create or replace function public.add_manga_to_list(target_list_id uuid, target_manga_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  list_owner_id uuid;
  item_count integer;
begin
  if current_user_id is null then
    raise exception 'Debes iniciar sesión para editar listas.'
      using errcode = '42501';
  end if;

  select l.user_id into list_owner_id
  from public.manga_lists l
  where l.id = target_list_id
  for update;

  if not found or list_owner_id <> current_user_id then
    raise exception 'No tienes permiso para editar esta lista.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.manga m
    where m.id = target_manga_id and m.visibility = 'published'
  ) then
    raise exception 'La obra no está disponible para añadir a una lista.';
  end if;

  if exists (
    select 1 from public.manga_list_items i
    where i.list_id = target_list_id and i.manga_id = target_manga_id
  ) then
    return;
  end if;

  select count(*) into item_count
  from public.manga_list_items i
  where i.list_id = target_list_id;

  if item_count >= 100 then
    raise exception 'Una lista puede contener como máximo 100 obras.';
  end if;

  insert into public.manga_list_items (list_id, manga_id)
  values (target_list_id, target_manga_id)
  on conflict (list_id, manga_id) do nothing;
end;
$$;

create or replace function public.get_public_manga_list(target_list_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with visible_list as (
    select l.id, l.title, l.description, l.created_at, p.username,
      coalesce(nullif(p.display_name, ''), p.username) as display_name
    from public.manga_lists l
    join public.profiles p on p.user_id = l.user_id
    where l.id = target_list_id and l.is_public
  ),
  list_items as (
    select coalesce(jsonb_agg(item_data order by item_created_at, manga_title), '[]'::jsonb) as items
    from (
      select jsonb_build_object(
        'id', m.id,
        'canonical_title', m.canonical_title,
        'synopsis', m.synopsis,
        'publication_status', m.publication_status,
        'start_year', m.start_year
      ) as item_data,
      i.created_at as item_created_at,
      m.canonical_title as manga_title
      from public.manga_list_items i
      join visible_list l on l.id = i.list_id
      join public.manga m on m.id = i.manga_id
      where m.visibility = 'published'
      order by i.created_at, m.canonical_title
      limit 100
    ) items
  )
  select case
    when exists (select 1 from visible_list) then
      (select jsonb_build_object(
        'id', l.id,
        'title', l.title,
        'description', l.description,
        'created_at', l.created_at,
        'username', l.username,
        'display_name', l.display_name,
        'items', list_items.items
      )
      from visible_list l cross join list_items)
    else null
  end;
$$;

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
  )
  select case
    when exists (select 1 from profile) then
      (select jsonb_build_object(
        'username', p.username,
        'display_name', p.display_name,
        'bio', p.bio,
        'created_at', p.created_at,
        'reviews', recent_reviews.items,
        'lists', public_lists.items
      )
      from profile p cross join recent_reviews cross join public_lists)
    else null
  end;
$$;

revoke execute on function public.add_manga_to_list(uuid, uuid) from public;
revoke execute on function public.get_public_manga_list(uuid) from public;
revoke execute on function public.get_public_profile(text) from public;
grant execute on function public.add_manga_to_list(uuid, uuid) to authenticated;
grant execute on function public.get_public_manga_list(uuid) to anon, authenticated;
grant execute on function public.get_public_profile(text) to anon, authenticated;
