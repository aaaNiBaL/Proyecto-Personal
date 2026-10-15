-- Private, monotonic reading achievements.
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9_]+$'),
  title text not null,
  description text not null,
  criteria_type text not null check (
    criteria_type in ('library_count', 'reading_count', 'completed_count', 'chapter_count')
  ),
  threshold integer not null check (threshold > 0),
  sort_order integer not null unique
);

create table public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

insert into public.achievements (slug, title, description, criteria_type, threshold, sort_order)
values
  ('first_manga', 'Primera obra', 'Añade tu primera obra a la biblioteca.', 'library_count', 1, 1),
  ('curious_reader', 'Lector curioso', 'Guarda 5 obras en tu biblioteca.', 'library_count', 5, 2),
  ('manga_collector', 'Coleccionista', 'Guarda 10 obras en tu biblioteca.', 'library_count', 10, 3),
  ('first_steps', 'Primeros pasos', 'Marca una obra como En lectura.', 'reading_count', 1, 4),
  ('chapter_tracker', 'Seguimiento al día', 'Registra tu último capítulo en una obra.', 'chapter_count', 1, 5),
  ('first_finish', '¡Finalizado!', 'Marca tu primera obra como Terminada.', 'completed_count', 1, 6),
  ('five_finishes', 'Lector incansable', 'Marca 5 obras como Terminadas.', 'completed_count', 5, 7);

alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

create policy "Authenticated users can read achievement definitions"
  on public.achievements for select
  to authenticated
  using (true);

create policy "Users can read their own achievements"
  on public.user_achievements for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.achievements, public.user_achievements
  from public, anon, authenticated;
grant select on public.achievements, public.user_achievements to authenticated;

create or replace function public.unlock_library_achievements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry_count integer;
  reading_count integer;
  completed_count integer;
  chapter_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 1)
  );

  select
    count(*)::integer,
    count(*) filter (where le.reading_status = 'reading')::integer,
    count(*) filter (where le.reading_status = 'completed')::integer,
    count(*) filter (where nullif(trim(le.last_chapter), '') is not null)::integer
  into entry_count, reading_count, completed_count, chapter_count
  from public.library_entries le
  where le.user_id = new.user_id;

  insert into public.user_achievements (user_id, achievement_id)
  select new.user_id, a.id
  from public.achievements a
  where case a.criteria_type
    when 'library_count' then entry_count >= a.threshold
    when 'reading_count' then reading_count >= a.threshold
    when 'completed_count' then completed_count >= a.threshold
    when 'chapter_count' then chapter_count >= a.threshold
    else false
  end
  on conflict (user_id, achievement_id) do nothing;

  return new;
end;
$$;

revoke execute on function public.unlock_library_achievements() from public;

create trigger library_entries_unlock_achievements
  after insert or update of reading_status, last_chapter
  on public.library_entries
  for each row execute function public.unlock_library_achievements();

with user_progress as (
  select
    le.user_id,
    count(*)::integer as library_count,
    count(*) filter (where le.reading_status = 'reading')::integer as reading_count,
    count(*) filter (where le.reading_status = 'completed')::integer as completed_count,
    count(*) filter (where nullif(trim(le.last_chapter), '') is not null)::integer as chapter_count
  from public.library_entries le
  group by le.user_id
)
insert into public.user_achievements (user_id, achievement_id)
select progress.user_id, achievement.id
from user_progress progress
cross join public.achievements achievement
where case achievement.criteria_type
  when 'library_count' then progress.library_count >= achievement.threshold
  when 'reading_count' then progress.reading_count >= achievement.threshold
  when 'completed_count' then progress.completed_count >= achievement.threshold
  when 'chapter_count' then progress.chapter_count >= achievement.threshold
  else false
end
on conflict (user_id, achievement_id) do nothing;
