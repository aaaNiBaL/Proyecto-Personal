create table public.manga_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  manga_id uuid not null references public.manga(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, manga_id)
);

create index manga_favorites_user_created_idx
  on public.manga_favorites (user_id, created_at desc);

alter table public.manga_favorites enable row level security;

create policy "Users can read their own manga favorites"
  on public.manga_favorites for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can favorite published manga"
  on public.manga_favorites for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.manga m
      where m.id = manga_favorites.manga_id
        and m.visibility = 'published'
    )
  );

create policy "Users can remove their own manga favorites"
  on public.manga_favorites for delete
  to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, delete on public.manga_favorites to authenticated;
revoke update, truncate on public.manga_favorites from public, anon, authenticated;
