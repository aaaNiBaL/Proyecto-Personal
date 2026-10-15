alter table public.community_reports
  drop constraint community_reports_target_type_check;
alter table public.community_reports
  add constraint community_reports_target_type_check
  check (target_type in ('review', 'profile', 'list', 'comment', 'manga'));

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
  target_exists boolean := false;
  report_id uuid;
begin
  if current_user_id is null then
    raise exception 'Debes iniciar sesión para enviar una denuncia.'
      using errcode = '42501';
  end if;
  if target_type is null
    or target_type not in ('review', 'profile', 'list', 'comment', 'manga') then
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
  elsif target_type = 'comment' then
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
  else
    select exists (
      select 1 from public.manga m
      where m.id = target_id and m.visibility = 'published'
    ) into target_exists;
  end if;

  if target_type = 'manga' then
    if not target_exists then
      raise exception 'El contenido no existe o no está disponible públicamente.';
    end if;
  elsif target_owner_id is null then
    raise exception 'El contenido no existe o no está disponible públicamente.';
  elsif target_owner_id = current_user_id then
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
        when 'manga' then m.canonical_title
      end as target_title,
      case cr.target_type
        when 'review' then left(coalesce(r.review_text, 'Puntuación sin comentario.'), 2000)
        when 'profile' then left(coalesce(p.bio, ''), 500)
        when 'list' then left(coalesce(l.description, ''), 500)
        when 'comment' then left(coalesce(c.comment_text, ''), 2000)
        when 'manga' then left(coalesce(m.synopsis, ''), 2000)
      end as target_excerpt,
      case cr.target_type
        when 'review' then '/manga/' || r.manga_id::text
        when 'profile' then '/usuario/' || p.username
        when 'list' then '/listas/' || l.id::text
        when 'comment' then '/manga/' || m.id::text
        when 'manga' then '/manga/' || m.id::text
      end as target_path
    from (select 1) seed
    left join public.community_comments c
      on cr.target_type = 'comment' and c.id = cr.target_id
    left join public.manga_reviews comment_review
      on c.review_id = comment_review.id
    left join public.manga_reviews r
      on cr.target_type = 'review' and r.id = cr.target_id
    left join public.manga m
      on m.id = case
        when cr.target_type = 'manga' then cr.target_id
        else coalesce(r.manga_id, c.manga_id, comment_review.manga_id)
      end
    left join public.profiles p
      on cr.target_type = 'profile' and p.user_id = cr.target_id
    left join public.manga_lists l
      on cr.target_type = 'list' and l.id = cr.target_id
  ) target_data
  where cr.status = 'pending'
  order by cr.created_at asc;
end;
$$;
