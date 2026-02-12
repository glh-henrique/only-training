-- Coach/student workflow RPCs + invite visibility policy.
create extension if not exists pgcrypto;

drop policy if exists "coach_student_invites_select_for_email_accept" on public.coach_student_invites;
create policy "coach_student_invites_select_for_email_accept"
on public.coach_student_invites
for select
using (
  status = 'pending'
  and expires_at > now()
  and lower(student_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

create or replace function public.create_coach_invite(
  student_email_input text,
  expires_in_hours int default 72
)
returns table (
  invite_id uuid,
  token text,
  student_email text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  coach_uid uuid := auth.uid();
  clean_email text := lower(trim(student_email_input));
  raw_token text := encode(gen_random_bytes(24), 'hex');
  new_invite_id uuid;
  new_expiry timestamptz := now() + make_interval(hours => greatest(expires_in_hours, 1));
begin
  if coach_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_instrutor(coach_uid) then
    raise exception 'only_instrutor_can_invite';
  end if;

  if clean_email = '' then
    raise exception 'invalid_email';
  end if;

  update public.coach_student_invites i
  set status = 'expired'
  where i.coach_id = coach_uid
    and i.status = 'pending'
    and i.expires_at <= now();

  insert into public.coach_student_invites (
    coach_id,
    student_email,
    token_hash,
    status,
    expires_at
  )
  values (
    coach_uid,
    clean_email,
    encode(digest(raw_token, 'sha256'), 'hex'),
    'pending',
    new_expiry
  )
  returning id into new_invite_id;

  return query
  select
    new_invite_id,
    raw_token,
    clean_email,
    new_expiry;
end;
$$;

create or replace function public.accept_coach_invite(
  token_input text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  student_uid uuid := auth.uid();
  student_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  invite_row public.coach_student_invites%rowtype;
  profile_role text;
  new_link_id uuid;
begin
  if student_uid is null then
    raise exception 'not_authenticated';
  end if;

  if trim(coalesce(token_input, '')) = '' then
    raise exception 'invalid_token';
  end if;

  select p.role into profile_role
  from public.profiles p
  where p.user_id = student_uid;

  if profile_role is distinct from 'aluno' then
    raise exception 'only_student_can_accept_invite';
  end if;

  update public.coach_student_invites
  set status = 'expired'
  where status = 'pending'
    and expires_at <= now();

  select *
  into invite_row
  from public.coach_student_invites i
  where i.token_hash = encode(digest(token_input, 'sha256'), 'hex')
    and i.status = 'pending'
    and i.expires_at > now()
  limit 1;

  if invite_row.id is null then
    raise exception 'invite_not_found_or_expired';
  end if;

  if lower(invite_row.student_email) <> student_email then
    raise exception 'invite_email_mismatch';
  end if;

  if exists (
    select 1
    from public.coach_student_links l
    where l.student_id = student_uid
      and l.status = 'active'
  ) then
    raise exception 'student_already_has_active_coach';
  end if;

  insert into public.coach_student_links (
    coach_id,
    student_id,
    status,
    student_can_unlink,
    history_visible_after_end
  )
  values (
    invite_row.coach_id,
    student_uid,
    'active',
    false,
    true
  )
  returning id into new_link_id;

  update public.coach_student_invites
  set
    status = 'accepted',
    accepted_at = now(),
    student_user_id = student_uid,
    link_id = new_link_id
  where id = invite_row.id;

  return new_link_id;
end;
$$;

create or replace function public.request_student_unlink(
  link_id_input uuid,
  message_input text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  student_uid uuid := auth.uid();
  link_row public.coach_student_links%rowtype;
begin
  if student_uid is null then
    raise exception 'not_authenticated';
  end if;

  select *
  into link_row
  from public.coach_student_links l
  where l.id = link_id_input
    and l.student_id = student_uid
    and l.status = 'active'
  limit 1;

  if link_row.id is null then
    raise exception 'active_link_not_found';
  end if;

  if link_row.student_can_unlink then
    update public.coach_student_links
    set
      status = 'ended',
      ended_at = now(),
      ended_by = student_uid,
      end_reason = 'student_unlinked'
    where id = link_row.id;

    return 'ended';
  end if;

  insert into public.coach_student_unlink_requests (
    link_id,
    requested_by,
    status,
    message
  )
  select
    link_row.id,
    student_uid,
    'pending',
    message_input
  where not exists (
    select 1
    from public.coach_student_unlink_requests r
    where r.link_id = link_row.id
      and r.status = 'pending'
  );

  return 'requested';
end;
$$;

create or replace function public.resolve_unlink_request(
  request_id_input uuid,
  approve_input boolean
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  coach_uid uuid := auth.uid();
  req_row public.coach_student_unlink_requests%rowtype;
  link_row public.coach_student_links%rowtype;
begin
  if coach_uid is null then
    raise exception 'not_authenticated';
  end if;

  select *
  into req_row
  from public.coach_student_unlink_requests r
  where r.id = request_id_input
    and r.status = 'pending'
  limit 1;

  if req_row.id is null then
    raise exception 'pending_request_not_found';
  end if;

  select *
  into link_row
  from public.coach_student_links l
  where l.id = req_row.link_id
    and l.coach_id = coach_uid
  limit 1;

  if link_row.id is null then
    raise exception 'coach_not_allowed';
  end if;

  if approve_input then
    update public.coach_student_unlink_requests
    set status = 'approved', resolved_at = now(), resolved_by = coach_uid
    where id = req_row.id;

    update public.coach_student_links
    set
      status = 'ended',
      ended_at = coalesce(ended_at, now()),
      ended_by = coach_uid,
      end_reason = 'coach_approved_unlink'
    where id = req_row.link_id
      and status = 'active';

    return 'approved';
  end if;

  update public.coach_student_unlink_requests
  set status = 'denied', resolved_at = now(), resolved_by = coach_uid
  where id = req_row.id;

  return 'denied';
end;
$$;
