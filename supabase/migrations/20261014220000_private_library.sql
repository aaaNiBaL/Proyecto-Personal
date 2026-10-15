create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique default (
    'reader_' || replace(substr(gen_random_uuid()::text, 1, 13), '-', '')
  ),
  created_at timestamptz not null default now()
);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

create table public.library_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  manga_id uuid not null references public.manga(id) on delete cascade,
  reading_status text not null default 'to_read'
    check (reading_status in ('to_read', 'reading', 'paused', 'completed', 'dropped')),
  last_chapter text check (last_chapter is null or length(trim(last_chapter)) <= 80),
  private_notes text check (private_notes is null or length(private_notes) <= 5000),
  personal_rating numeric(3, 1)
    check (personal_rating is null or personal_rating between 1 and 10),
  started_on date,
  finished_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, manga_id),
  check (finished_on is null or started_on is null or finished_on >= started_on)
);

create table public.personal_links (
  id uuid primary key default gen_random_uuid(),
  library_entry_id uuid not null references public.library_entries(id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 80),
  url text not null
    check (length(url) between 1 and 2048 and url ~* '^https?://[^[:space:]]+$'),
  created_at timestamptz not null default now()
);

create index library_entries_user_status_idx
  on public.library_entries (user_id, reading_status, updated_at desc);
create index personal_links_entry_idx on public.personal_links (library_entry_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger library_entries_set_updated_at
  before update on public.library_entries
  for each row execute function public.set_updated_at();

revoke execute on function public.create_profile_for_new_user() from public;
revoke execute on function public.set_updated_at() from public;

alter table public.profiles enable row level security;
alter table public.library_entries enable row level security;
alter table public.personal_links enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can read their own library"
  on public.library_entries for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can add published manga to their library"
  on public.library_entries for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.manga m
      where m.id = library_entries.manga_id and m.visibility = 'published'
    )
  );

create policy "Users can update their own library"
  on public.library_entries for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.manga m
      where m.id = library_entries.manga_id and m.visibility = 'published'
    )
  );

create policy "Users can remove entries from their own library"
  on public.library_entries for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can read links in their own library"
  on public.personal_links for select
  to authenticated
  using (
    exists (
      select 1 from public.library_entries le
      where le.id = personal_links.library_entry_id
        and le.user_id = (select auth.uid())
    )
  );

create policy "Users can add links to their own library"
  on public.personal_links for insert
  to authenticated
  with check (
    exists (
      select 1 from public.library_entries le
      where le.id = personal_links.library_entry_id
        and le.user_id = (select auth.uid())
    )
  );

create policy "Users can update links in their own library"
  on public.personal_links for update
  to authenticated
  using (
    exists (
      select 1 from public.library_entries le
      where le.id = personal_links.library_entry_id
        and le.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.library_entries le
      where le.id = personal_links.library_entry_id
        and le.user_id = (select auth.uid())
    )
  );

create policy "Users can remove links from their own library"
  on public.personal_links for delete
  to authenticated
  using (
    exists (
      select 1 from public.library_entries le
      where le.id = personal_links.library_entry_id
        and le.user_id = (select auth.uid())
    )
  );

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.library_entries, public.personal_links
  to authenticated;
revoke all on public.profiles, public.library_entries, public.personal_links
  from public, anon;
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
