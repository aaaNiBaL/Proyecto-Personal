create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('review', 'profile', 'list')),
  target_id uuid not null,
  reason text not null check (
    reason in ('spam', 'harassment', 'spoilers', 'inappropriate', 'other')
  ),
  details text not null default '' check (length(details) <= 1000),
  status text not null default 'pending'
    check (status in ('pending', 'resolved', 'dismissed')),
  moderator_id uuid references auth.users(id) on delete set null,
  moderator_note text check (moderator_note is null or length(moderator_note) <= 1000),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (
    (status = 'pending' and moderator_id is null and reviewed_at is null)
    or (status <> 'pending' and moderator_id is not null and reviewed_at is not null)
  )
);

create index community_reports_queue_idx
  on public.community_reports (created_at)
  where status = 'pending';
create index community_reports_reporter_idx
  on public.community_reports (reporter_id, created_at desc);
create unique index community_reports_pending_target_uidx
  on public.community_reports (reporter_id, target_type, target_id)
  where status = 'pending';

alter table public.community_reports enable row level security;

create policy "Users can read their own community reports"
  on public.community_reports for select
  to authenticated
  using (reporter_id = (select auth.uid()));

grant select on public.community_reports to authenticated;
revoke insert, update, delete, truncate on public.community_reports
  from public, anon, authenticated;

create or replace function public.submit_community_report(
  target_type text,
  target_id uuid,
  reason text,
  details text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_owner_id uuid;
  report_id uuid;
begin
  if current_user_id is null then
    raise exception 'Debes iniciar sesión para enviar una denuncia.'
      using errcode = '42501';
  end if;
  if target_type is null or target_type not in ('review', 'profile', 'list') then
    raise exception 'El tipo de contenido no se puede denunciar.';
  end if;
  if target_id is null then
    raise exception 'No se encontró el contenido denunciado.';
  end if;
  if reason is null or reason not in ('spam', 'harassment', 'spoilers', 'inappropriate', 'other') then
    raise exception 'Selecciona un motivo válido para la denuncia.';
  end if;
  if details is not null and length(details) > 1000 then
    raise exception 'Los detalles no pueden superar 1000 caracteres.';
  end if;
  if (
    select count(*) from public.community_reports cr
    where cr.reporter_id = current_user_id
      and cr.created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'Alcanzaste el límite de denuncias por hora.';
  end if;

  if target_type = 'review' then
    select r.author_id into target_owner_id
    from public.manga_reviews r
    join public.manga m on m.id = r.manga_id
    where r.id = target_id and m.visibility = 'published';
  elsif target_type = 'profile' then
    select p.user_id into target_owner_id
    from public.profiles p
    where p.user_id = target_id and p.is_public;
  else
    select l.user_id into target_owner_id
    from public.manga_lists l
    where l.id = target_id and l.is_public;
  end if;

  if target_owner_id is null then
    raise exception 'El contenido no existe o no está disponible públicamente.';
  end if;
  if target_owner_id = current_user_id then
    raise exception 'No puedes denunciar tu propio contenido.';
  end if;

  insert into public.community_reports (
    reporter_id, target_type, target_id, reason, details
  )
  values (
    current_user_id, target_type, target_id, reason, coalesce(details, '')
  )
  returning id into report_id;
  return report_id;
exception
  when unique_violation then
    raise exception 'Ya enviaste una denuncia pendiente sobre este contenido.';
end;
$$;

create or replace function public.list_pending_community_reports()
returns table (
  id uuid,
  target_type text,
  target_id uuid,
  target_title text,
  target_excerpt text,
  target_path text,
  reporter_username text,
  reason text,
  details text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_catalog_moderator() then
    raise exception 'No tienes permiso para consultar las denuncias.'
      using errcode = '42501';
  end if;

  return query
  select cr.id,
    cr.target_type,
    cr.target_id,
    target_data.target_title,
    target_data.target_excerpt,
    target_data.target_path,
    coalesce(reporter.username, 'cuenta eliminada'),
    cr.reason,
    cr.details,
    cr.created_at
  from public.community_reports cr
  left join public.profiles reporter on reporter.user_id = cr.reporter_id
  cross join lateral (
    select case cr.target_type
        when 'review' then m.canonical_title
        when 'profile' then coalesce(nullif(p.display_name, ''), '@' || p.username)
        when 'list' then l.title
      end as target_title,
      case cr.target_type
        when 'review' then left(coalesce(r.review_text, 'Puntuación sin comentario.'), 2000)
        when 'profile' then left(coalesce(p.bio, ''), 500)
        when 'list' then left(coalesce(l.description, ''), 500)
      end as target_excerpt,
      case cr.target_type
        when 'review' then '/manga/' || r.manga_id::text
        when 'profile' then '/usuario/' || p.username
        when 'list' then '/listas/' || l.id::text
      end as target_path
    from (select 1) seed
    left join public.manga_reviews r
      on cr.target_type = 'review' and r.id = cr.target_id
    left join public.manga m on m.id = r.manga_id
    left join public.profiles p
      on cr.target_type = 'profile' and p.user_id = cr.target_id
    left join public.manga_lists l
      on cr.target_type = 'list' and l.id = cr.target_id
  ) target_data
  where cr.status = 'pending'
  order by cr.created_at asc;
end;
$$;

create or replace function public.review_community_report(
  target_report_id uuid,
  decision text,
  moderator_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  report_status text;
begin
  if current_user_id is null or not public.is_catalog_moderator() then
    raise exception 'No tienes permiso para revisar denuncias.'
      using errcode = '42501';
  end if;
  if decision is null or decision not in ('resolved', 'dismissed') then
    raise exception 'La decisión debe ser atender o descartar la denuncia.';
  end if;
  if moderator_note is not null and length(moderator_note) > 1000 then
    raise exception 'La nota de moderación no puede superar 1000 caracteres.';
  end if;

  select cr.status into report_status
  from public.community_reports cr
  where cr.id = target_report_id
  for update;

  if not found or report_status <> 'pending' then
    raise exception 'La denuncia ya fue revisada o no existe.';
  end if;

  update public.community_reports
  set status = decision,
      moderator_id = current_user_id,
      moderator_note = nullif(trim(moderator_note), ''),
      reviewed_at = now()
  where id = target_report_id;
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
        'user_id', p.user_id,
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

revoke execute on function public.submit_community_report(text, uuid, text, text)
  from public;
revoke execute on function public.list_pending_community_reports()
  from public;
revoke execute on function public.review_community_report(uuid, text, text)
  from public;
revoke execute on function public.get_public_profile(text) from public;
grant execute on function public.submit_community_report(text, uuid, text, text)
  to authenticated;
grant execute on function public.list_pending_community_reports()
  to authenticated;
grant execute on function public.review_community_report(uuid, text, text)
  to authenticated;
grant execute on function public.get_public_profile(text) to anon, authenticated;
