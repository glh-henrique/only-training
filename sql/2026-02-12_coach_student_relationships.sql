-- Coach/student relationship model (phase 1)
-- Rules:
-- - Student can have only one active coach.
-- - Coach can view student history after unlink if history_visible_after_end = true.
-- - Coach can edit student data only while link is active.

alter table public.workouts
  add column if not exists deleted_at timestamptz;

alter table public.workout_items
  add column if not exists deleted_at timestamptz;

create table if not exists public.coach_student_links (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(user_id) on delete cascade,
  student_id uuid not null references public.profiles(user_id) on delete cascade,
  status text not null default 'pending',
  student_can_unlink boolean not null default false,
  history_visible_after_end boolean not null default true,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  ended_at timestamptz,
  ended_by uuid references public.profiles(user_id) on delete set null,
  end_reason text,
  constraint coach_student_links_status_check check (status in ('pending', 'active', 'ended', 'rejected')),
  constraint coach_student_links_not_self check (coach_id <> student_id),
  constraint coach_student_links_active_timestamp_check check (
    (status = 'active' and activated_at is not null) or (status <> 'active')
  ),
  constraint coach_student_links_ended_timestamp_check check (
    (status = 'ended' and ended_at is not null) or (status <> 'ended')
  )
);

create unique index if not exists coach_student_single_active_student_uniq
  on public.coach_student_links (student_id)
  where status = 'active';

create unique index if not exists coach_student_single_open_pair_uniq
  on public.coach_student_links (coach_id, student_id)
  where status in ('pending', 'active');

create index if not exists coach_student_links_coach_idx
  on public.coach_student_links (coach_id, status, created_at desc);

create index if not exists coach_student_links_student_idx
  on public.coach_student_links (student_id, status, created_at desc);

create table if not exists public.coach_student_invites (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(user_id) on delete cascade,
  student_email text not null,
  student_user_id uuid references public.profiles(user_id) on delete set null,
  token_hash text not null,
  status text not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  link_id uuid references public.coach_student_links(id) on delete set null,
  constraint coach_student_invites_status_check check (status in ('pending', 'accepted', 'expired', 'revoked'))
);

create unique index if not exists coach_student_invites_token_hash_uniq
  on public.coach_student_invites (token_hash);

create index if not exists coach_student_invites_coach_idx
  on public.coach_student_invites (coach_id, status, created_at desc);

create index if not exists coach_student_invites_email_idx
  on public.coach_student_invites (lower(student_email), status);

create table if not exists public.coach_student_unlink_requests (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.coach_student_links(id) on delete cascade,
  requested_by uuid not null references public.profiles(user_id) on delete cascade,
  status text not null default 'pending',
  message text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(user_id) on delete set null,
  constraint coach_student_unlink_requests_status_check check (status in ('pending', 'approved', 'denied', 'cancelled'))
);

create unique index if not exists coach_student_unlink_requests_one_pending_uniq
  on public.coach_student_unlink_requests (link_id)
  where status = 'pending';

create index if not exists coach_student_unlink_requests_requested_by_idx
  on public.coach_student_unlink_requests (requested_by, status, created_at desc);

create index if not exists coach_student_unlink_requests_link_idx
  on public.coach_student_unlink_requests (link_id, status, created_at desc);

create or replace function public.coach_student_links_set_timestamps()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if new.coach_id <> old.coach_id or new.student_id <> old.student_id then
      raise exception 'coach_id and student_id are immutable';
    end if;
  end if;

  if new.status = 'active' and new.activated_at is null then
    new.activated_at = now();
  end if;

  if new.status = 'ended' and new.ended_at is null then
    new.ended_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists coach_student_links_set_timestamps on public.coach_student_links;
create trigger coach_student_links_set_timestamps
before insert or update on public.coach_student_links
for each row execute function public.coach_student_links_set_timestamps();

create or replace function public.is_active_coach_for_student(
  coach_uid uuid,
  student_uid uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.coach_student_links l
    where l.coach_id = coach_uid
      and l.student_id = student_uid
      and l.status = 'active'
  );
$$;

create or replace function public.can_read_user_training_data(
  target_user_id uuid,
  actor_uid uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_user_id = actor_uid
    or exists (
      select 1
      from public.coach_student_links l
      where l.coach_id = actor_uid
        and l.student_id = target_user_id
        and (
          l.status = 'active'
          or (l.status = 'ended' and l.history_visible_after_end = true)
        )
    );
$$;

create or replace function public.can_write_user_training_data(
  target_user_id uuid,
  actor_uid uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_user_id = actor_uid
    or public.is_active_coach_for_student(actor_uid, target_user_id);
$$;

alter table public.coach_student_links enable row level security;
alter table public.coach_student_invites enable row level security;
alter table public.coach_student_unlink_requests enable row level security;

drop policy if exists "coach_student_links_select_participants" on public.coach_student_links;
drop policy if exists "coach_student_links_insert_by_coach" on public.coach_student_links;
drop policy if exists "coach_student_links_update_by_coach" on public.coach_student_links;

create policy "coach_student_links_select_participants"
on public.coach_student_links
for select
using (auth.uid() = coach_id or auth.uid() = student_id);

create policy "coach_student_links_insert_by_coach"
on public.coach_student_links
for insert
with check (
  auth.uid() = coach_id
  and public.is_instrutor(auth.uid())
);

create policy "coach_student_links_update_by_coach"
on public.coach_student_links
for update
using (auth.uid() = coach_id and public.is_instrutor(auth.uid()))
with check (auth.uid() = coach_id and public.is_instrutor(auth.uid()));

drop policy if exists "coach_student_invites_select_participants" on public.coach_student_invites;
drop policy if exists "coach_student_invites_insert_by_coach" on public.coach_student_invites;
drop policy if exists "coach_student_invites_update_by_coach" on public.coach_student_invites;

create policy "coach_student_invites_select_participants"
on public.coach_student_invites
for select
using (auth.uid() = coach_id or auth.uid() = student_user_id);

create policy "coach_student_invites_insert_by_coach"
on public.coach_student_invites
for insert
with check (
  auth.uid() = coach_id
  and public.is_instrutor(auth.uid())
);

create policy "coach_student_invites_update_by_coach"
on public.coach_student_invites
for update
using (auth.uid() = coach_id and public.is_instrutor(auth.uid()))
with check (auth.uid() = coach_id and public.is_instrutor(auth.uid()));

drop policy if exists "coach_student_unlink_requests_select_participants" on public.coach_student_unlink_requests;
drop policy if exists "coach_student_unlink_requests_insert_by_student" on public.coach_student_unlink_requests;
drop policy if exists "coach_student_unlink_requests_update_participants" on public.coach_student_unlink_requests;

create policy "coach_student_unlink_requests_select_participants"
on public.coach_student_unlink_requests
for select
using (
  auth.uid() = requested_by
  or exists (
    select 1
    from public.coach_student_links l
    where l.id = link_id
      and (l.coach_id = auth.uid() or l.student_id = auth.uid())
  )
);

create policy "coach_student_unlink_requests_insert_by_student"
on public.coach_student_unlink_requests
for insert
with check (
  auth.uid() = requested_by
  and exists (
    select 1
    from public.coach_student_links l
    where l.id = link_id
      and l.student_id = auth.uid()
      and l.status = 'active'
  )
);

create policy "coach_student_unlink_requests_update_participants"
on public.coach_student_unlink_requests
for update
using (
  auth.uid() = requested_by
  or exists (
    select 1
    from public.coach_student_links l
    where l.id = link_id
      and l.coach_id = auth.uid()
  )
)
with check (
  auth.uid() = requested_by
  or exists (
    select 1
    from public.coach_student_links l
    where l.id = link_id
      and l.coach_id = auth.uid()
  )
);

drop policy if exists "workouts_select_own" on public.workouts;
drop policy if exists "workouts_insert_own" on public.workouts;
drop policy if exists "workouts_update_own" on public.workouts;
drop policy if exists "workouts_delete_own" on public.workouts;

create policy "workouts_select_own"
on public.workouts
for select
using (
  deleted_at is null
  and public.can_read_user_training_data(user_id)
);

create policy "workouts_insert_own"
on public.workouts
for insert
with check (
  public.can_write_user_training_data(user_id)
);

create policy "workouts_update_own"
on public.workouts
for update
using (public.can_write_user_training_data(user_id))
with check (public.can_write_user_training_data(user_id));

create policy "workouts_delete_own"
on public.workouts
for delete
using (public.can_write_user_training_data(user_id));

drop policy if exists "workout_items_select_own" on public.workout_items;
drop policy if exists "workout_items_insert_own" on public.workout_items;
drop policy if exists "workout_items_update_own" on public.workout_items;
drop policy if exists "workout_items_delete_own" on public.workout_items;

create policy "workout_items_select_own"
on public.workout_items
for select
using (
  deleted_at is null
  and public.can_read_user_training_data(user_id)
);

create policy "workout_items_insert_own"
on public.workout_items
for insert
with check (public.can_write_user_training_data(user_id));

create policy "workout_items_update_own"
on public.workout_items
for update
using (public.can_write_user_training_data(user_id))
with check (public.can_write_user_training_data(user_id));

create policy "workout_items_delete_own"
on public.workout_items
for delete
using (public.can_write_user_training_data(user_id));

drop policy if exists "workout_sessions_select_own" on public.workout_sessions;
drop policy if exists "workout_sessions_insert_own" on public.workout_sessions;
drop policy if exists "workout_sessions_update_own" on public.workout_sessions;
drop policy if exists "workout_sessions_delete_own" on public.workout_sessions;

create policy "workout_sessions_select_own"
on public.workout_sessions
for select
using (public.can_read_user_training_data(user_id));

create policy "workout_sessions_insert_own"
on public.workout_sessions
for insert
with check (public.can_write_user_training_data(user_id));

create policy "workout_sessions_update_own"
on public.workout_sessions
for update
using (public.can_write_user_training_data(user_id))
with check (public.can_write_user_training_data(user_id));

create policy "workout_sessions_delete_own"
on public.workout_sessions
for delete
using (public.can_write_user_training_data(user_id));

drop policy if exists "session_items_select_own" on public.session_items;
drop policy if exists "session_items_insert_own" on public.session_items;
drop policy if exists "session_items_update_own" on public.session_items;
drop policy if exists "session_items_delete_own" on public.session_items;

create policy "session_items_select_own"
on public.session_items
for select
using (public.can_read_user_training_data(user_id));

create policy "session_items_insert_own"
on public.session_items
for insert
with check (public.can_write_user_training_data(user_id));

create policy "session_items_update_own"
on public.session_items
for update
using (public.can_write_user_training_data(user_id))
with check (public.can_write_user_training_data(user_id));

create policy "session_items_delete_own"
on public.session_items
for delete
using (public.can_write_user_training_data(user_id));
