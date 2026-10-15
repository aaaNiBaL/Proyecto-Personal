create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  manga_id uuid references public.manga(id) on delete cascade,
  review_id uuid references public.manga_reviews(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  comment_text text not null check (
    length(trim(comment_text)) between 1 and 2000
  ),
  created_at timestamptz not null default now(),
  check ((manga_id is not null) <> (review_id is not null))
);

create index community_comments_manga_idx
  on public.community_comments (manga_id, created_at desc)
  where manga_id is not null;
create index community_comments_review_idx
  on public.community_comments (review_id, created_at desc)
  where review_id is not null;
create index community_comments_author_idx
  on public.community_comments (author_id, created_at desc);

alter table public.community_comments enable row level security;

create policy "Comments on published manga are publicly readable"
  on public.community_comments for select
  to anon, authenticated
  using (
    (
      manga_id is not null
      and exists (
        select 1 from public.manga m
        where m.id = community_comments.manga_id
          and m.visibility = 'published'
      )
    )
    or (
      review_id is not null
      and exists (
        select 1
        from public.manga_reviews r
        join public.manga m on m.id = r.manga_id
        where r.id = community_comments.review_id
          and m.visibility = 'published'
      )
    )
  );

create policy "Authors can delete their own comments"
  on public.community_comments for delete
  to authenticated
  using (author_id = (select auth.uid()));

grant select on public.community_comments to anon, authenticated;
grant delete on public.community_comments to authenticated;
revoke insert, update, truncate on public.community_comments
  from public, anon, authenticated;

create or replace function public.create_community_comment(
  comment_target_type text,
  comment_target_id uuid,
  comment_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_manga_id uuid;
  new_comment_id uuid;
  normalized_body text := trim(coalesce(comment_body, ''));
begin
  if current_user_id is null then
    raise exception 'Debes iniciar sesión para comentar.'
      using errcode = '42501';
  end if;
  if comment_target_type is null
    or comment_target_type not in ('manga', 'review')
    or comment_target_id is null then
    raise exception 'El contenido seleccionado no admite comentarios.';
  end if;
  if length(normalized_body) not between 1 and 2000 then
    raise exception 'El comentario debe tener entre 1 y 2000 caracteres.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 0)
  );
  if (
    select count(*)
    from public.community_comments c
    where c.author_id = current_user_id
      and c.created_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'Alcanzaste el límite de 20 comentarios por hora.';
  end if;

  if comment_target_type = 'manga' then
    select m.id into target_manga_id
    from public.manga m
    where m.id = comment_target_id and m.visibility = 'published';
  else
    select r.manga_id into target_manga_id
    from public.manga_reviews r
    join public.manga m on m.id = r.manga_id
    where r.id = comment_target_id and m.visibility = 'published';
  end if;

  if target_manga_id is null then
    raise exception 'La obra o reseña no existe o no está disponible públicamente.';
  end if;

  insert into public.community_comments (
    manga_id, review_id, author_id, comment_text
  )
  values (
    case when comment_target_type = 'manga' then target_manga_id end,
    case when comment_target_type = 'review' then comment_target_id end,
    current_user_id,
    normalized_body
  )
  returning id into new_comment_id;

  return new_comment_id;
end;
$$;

revoke execute on function public.create_community_comment(text, uuid, text) from public;
grant execute on function public.create_community_comment(text, uuid, text)
  to authenticated;

create or replace function public.get_community_comments(
  comment_target_type text,
  comment_target_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with visible_target as (
    select m.id as manga_id, null::uuid as review_id
    from public.manga m
    where comment_target_type = 'manga'
      and m.id = comment_target_id
      and m.visibility = 'published'
    union all
    select r.manga_id, r.id as review_id
    from public.manga_reviews r
    join public.manga m on m.id = r.manga_id
    where comment_target_type = 'review'
      and r.id = comment_target_id
      and m.visibility = 'published'
  ),
  visible_comments as (
    select
      c.id,
      c.author_id,
      coalesce(p.username, 'cuenta eliminada') as username,
      c.comment_text,
      c.created_at
    from public.community_comments c
    join visible_target t
      on (
        comment_target_type = 'manga'
        and c.manga_id = t.manga_id
        and c.review_id is null
      ) or (
        comment_target_type = 'review'
        and c.review_id = t.review_id
      )
    left join public.profiles p on p.user_id = c.author_id
    order by c.created_at desc
    limit 100
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', visible_comments.id,
        'author_id', visible_comments.author_id,
        'username', visible_comments.username,
        'comment_text', visible_comments.comment_text,
        'created_at', visible_comments.created_at
      ) order by visible_comments.created_at desc
    ),
    '[]'::jsonb
  )
  from visible_comments;
$$;

revoke execute on function public.get_community_comments(text, uuid) from public;
grant execute on function public.get_community_comments(text, uuid) to anon, authenticated;

alter table public.community_reports
  drop constraint community_reports_target_type_check;
alter table public.community_reports
  add constraint community_reports_target_type_check
  check (target_type in ('review', 'profile', 'list', 'comment'));

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
  if target_type is null or target_type not in ('review', 'profile', 'list', 'comment') then
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
  elsif target_type = 'list' then
    select l.user_id into target_owner_id
    from public.manga_lists l
    where l.id = target_id and l.is_public;
  else
    select c.author_id into target_owner_id
    from public.community_comments c
    where c.id = target_id
      and (
        (c.manga_id is not null and exists (
          select 1 from public.manga m
          where m.id = c.manga_id and m.visibility = 'published'
        ))
        or (c.review_id is not null and exists (
          select 1
          from public.manga_reviews r
          join public.manga m on m.id = r.manga_id
          where r.id = c.review_id and m.visibility = 'published'
        ))
      );
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
        when 'comment' then m.canonical_title
      end as target_title,
      case cr.target_type
        when 'review' then left(coalesce(r.review_text, 'Puntuación sin comentario.'), 2000)
        when 'profile' then left(coalesce(p.bio, ''), 500)
        when 'list' then left(coalesce(l.description, ''), 500)
        when 'comment' then left(coalesce(c.comment_text, ''), 2000)
      end as target_excerpt,
      case cr.target_type
        when 'review' then '/manga/' || r.manga_id::text
        when 'profile' then '/usuario/' || p.username
        when 'list' then '/listas/' || l.id::text
        when 'comment' then '/manga/' || m.id::text
      end as target_path
    from (select 1) seed
    left join public.community_comments c
      on cr.target_type = 'comment' and c.id = cr.target_id
    left join public.manga_reviews comment_review
      on c.review_id = comment_review.id
    left join public.manga_reviews r
      on cr.target_type = 'review' and r.id = cr.target_id
    left join public.manga m
      on m.id = coalesce(r.manga_id, c.manga_id, comment_review.manga_id)
    left join public.profiles p
      on cr.target_type = 'profile' and p.user_id = cr.target_id
    left join public.manga_lists l
      on cr.target_type = 'list' and l.id = cr.target_id
  ) target_data
  where cr.status = 'pending'
  order by cr.created_at asc;
end;
$$;
