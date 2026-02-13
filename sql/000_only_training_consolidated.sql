-- Only Training - Consolidated SQL
-- This file consolidates all effective SQL changes found in sql/*.sql
-- and represents the current expected schema/state.
-- It is designed to be idempotent and safe to re-run.

-- ============================================================
-- 1) Extensions
-- ============================================================
create extension if not exists pgcrypto;

-- ============================================================
-- 2) Utility functions
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.session_items_set_done_at()
returns trigger
language plpgsql
as $$
begin
  if new.is_done = true and new.done_at is null then
    new.done_at = now();
  end if;

  if new.is_done = false then
    new.done_at = null;
  end if;

  return new;
end;
$$;

-- ============================================================
-- 3) Tables (latest shape)
-- ============================================================
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  focus text not null,
  notes text,
  is_archived boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workouts_name_nonempty check (char_length(trim(name)) > 0),
  constraint workouts_focus_nonempty check (char_length(trim(focus)) > 0)
);

create table if not exists public.workout_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  title text not null,
  order_index int not null,
  default_weight numeric(6,2),
  default_reps text,
  default_sets int,
  rest_seconds int,
  notes text,
  video_url text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_items_title_nonempty check (char_length(trim(title)) > 0),
  constraint workout_items_order_nonneg check (order_index >= 0),
  constraint workout_items_default_weight_nonneg check (default_weight is null or default_weight >= 0),
  constraint workout_items_rest_nonneg check (rest_seconds is null or rest_seconds >= 0)
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  workout_id uuid references public.workouts(id) on delete set null,
  workout_name_snapshot text not null,
  workout_focus_snapshot text,
  status text not null default 'in_progress',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds int,
  created_at timestamptz not null default now(),
  constraint workout_sessions_status_check check (status in ('in_progress','finished','canceled')),
  constraint workout_sessions_name_nonempty check (char_length(trim(workout_name_snapshot)) > 0),
  constraint workout_sessions_duration_nonneg check (duration_seconds is null or duration_seconds >= 0),
  constraint workout_sessions_ended_after_started check (ended_at is null or ended_at >= started_at)
);

create table if not exists public.session_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  workout_item_id uuid references public.workout_items(id) on delete set null,
  title_snapshot text not null,
  notes_snapshot text,
  video_url text,
  order_index int not null,
  weight numeric(6,2),
  reps text,
  sets int,
  rest_seconds int,
  is_done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  constraint session_items_title_nonempty check (char_length(trim(title_snapshot)) > 0),
  constraint session_items_order_nonneg check (order_index >= 0),
  constraint session_items_weight_nonneg check (weight is null or weight >= 0),
  constraint session_items_sets_nonneg check (sets is null or sets >= 0),
  constraint session_items_rest_nonneg check (rest_seconds is null or rest_seconds >= 0),
  constraint session_items_done_at_consistency check (
    (is_done = false and done_at is null) or
    (is_done = true and done_at is not null)
  )
);

-- ============================================================
-- 4) Compatibility alters (existing installations)
-- ============================================================
alter table public.workouts
  add column if not exists notes text,
  add column if not exists is_archived boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

alter table public.workout_items
  add column if not exists notes text,
  add column if not exists video_url text,
  add column if not exists default_sets int,
  add column if not exists rest_seconds int,
  add column if not exists deleted_at timestamptz;

alter table public.session_items
  add column if not exists notes_snapshot text,
  add column if not exists sets int,
  add column if not exists rest_seconds int;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workout_items'
      and column_name = 'default_reps'
      and data_type <> 'text'
  ) then
    if exists (select 1 from pg_constraint where conname = 'workout_items_default_reps_nonneg') then
      alter table public.workout_items drop constraint workout_items_default_reps_nonneg;
    end if;
    alter table public.workout_items
      alter column default_reps type text using default_reps::text;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'session_items'
      and column_name = 'reps'
      and data_type <> 'text'
  ) then
    if exists (select 1 from pg_constraint where conname = 'session_items_reps_nonneg') then
      alter table public.session_items drop constraint session_items_reps_nonneg;
    end if;
    alter table public.session_items
      alter column reps type text using reps::text;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workout_items_default_sets_nonneg') then
    alter table public.workout_items
      add constraint workout_items_default_sets_nonneg
      check (default_sets is null or default_sets >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'session_items_sets_nonneg') then
    alter table public.session_items
      add constraint session_items_sets_nonneg
      check (sets is null or sets >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'session_items_rest_nonneg') then
    alter table public.session_items
      add constraint session_items_rest_nonneg
      check (rest_seconds is null or rest_seconds >= 0);
  end if;
end $$;

-- ============================================================
-- 5) Indexes
-- ============================================================
create unique index if not exists workouts_user_name_uniq
  on public.workouts (user_id, lower(name));

create index if not exists workouts_user_id_idx
  on public.workouts (user_id);

create index if not exists workout_items_user_id_idx
  on public.workout_items (user_id);

create index if not exists workout_items_workout_id_idx
  on public.workout_items (workout_id);

create unique index if not exists workout_items_workout_order_uniq
  on public.workout_items (workout_id, order_index);

create index if not exists workout_sessions_user_started_idx
  on public.workout_sessions (user_id, started_at desc);

create index if not exists workout_sessions_workout_id_idx
  on public.workout_sessions (workout_id);

create index if not exists session_items_user_id_idx
  on public.session_items (user_id);

create index if not exists session_items_session_id_idx
  on public.session_items (session_id);

create unique index if not exists session_items_session_order_uniq
  on public.session_items (session_id, order_index);

-- Soft-delete focused indexes
create index if not exists workouts_user_active_idx
  on public.workouts (user_id, is_archived, created_at desc)
  where deleted_at is null;

create index if not exists workouts_user_archived_active_idx
  on public.workouts (user_id, updated_at desc)
  where deleted_at is null and is_archived = true;

create index if not exists workout_items_workout_active_idx
  on public.workout_items (workout_id, order_index)
  where deleted_at is null;

-- ============================================================
-- 6) Triggers
-- ============================================================
drop trigger if exists workouts_set_updated_at on public.workouts;
create trigger workouts_set_updated_at
before update on public.workouts
for each row execute function public.set_updated_at();

drop trigger if exists workout_items_set_updated_at on public.workout_items;
create trigger workout_items_set_updated_at
before update on public.workout_items
for each row execute function public.set_updated_at();

drop trigger if exists session_items_set_done_at on public.session_items;
create trigger session_items_set_done_at
before insert or update of is_done, done_at on public.session_items
for each row execute function public.session_items_set_done_at();

-- ============================================================
-- 7) RLS + Policies
-- ============================================================
alter table public.workouts enable row level security;
alter table public.workout_items enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.session_items enable row level security;

drop policy if exists "workouts_select_own" on public.workouts;
drop policy if exists "workouts_insert_own" on public.workouts;
drop policy if exists "workouts_update_own" on public.workouts;
drop policy if exists "workouts_delete_own" on public.workouts;

drop policy if exists "workout_items_select_own" on public.workout_items;
drop policy if exists "workout_items_insert_own" on public.workout_items;
drop policy if exists "workout_items_update_own" on public.workout_items;
drop policy if exists "workout_items_delete_own" on public.workout_items;

drop policy if exists "workout_sessions_select_own" on public.workout_sessions;
drop policy if exists "workout_sessions_insert_own" on public.workout_sessions;
drop policy if exists "workout_sessions_update_own" on public.workout_sessions;
drop policy if exists "workout_sessions_delete_own" on public.workout_sessions;

drop policy if exists "session_items_select_own" on public.session_items;
drop policy if exists "session_items_insert_own" on public.session_items;
drop policy if exists "session_items_update_own" on public.session_items;
drop policy if exists "session_items_delete_own" on public.session_items;

create policy "workouts_select_own"
on public.workouts
for select
using (auth.uid() = user_id and deleted_at is null);

create policy "workouts_insert_own"
on public.workouts
for insert
with check (auth.uid() = user_id);

create policy "workouts_update_own"
on public.workouts
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "workouts_delete_own"
on public.workouts
for delete
using (auth.uid() = user_id);

create policy "workout_items_select_own"
on public.workout_items
for select
using (auth.uid() = user_id and deleted_at is null);

create policy "workout_items_insert_own"
on public.workout_items
for insert
with check (auth.uid() = user_id);

create policy "workout_items_update_own"
on public.workout_items
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "workout_items_delete_own"
on public.workout_items
for delete
using (auth.uid() = user_id);

create policy "workout_sessions_select_own"
on public.workout_sessions
for select
using (auth.uid() = user_id);

create policy "workout_sessions_insert_own"
on public.workout_sessions
for insert
with check (auth.uid() = user_id);

create policy "workout_sessions_update_own"
on public.workout_sessions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "workout_sessions_delete_own"
on public.workout_sessions
for delete
using (auth.uid() = user_id);

create policy "session_items_select_own"
on public.session_items
for select
using (auth.uid() = user_id);

create policy "session_items_insert_own"
on public.session_items
for insert
with check (auth.uid() = user_id);

create policy "session_items_update_own"
on public.session_items
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "session_items_delete_own"
on public.session_items
for delete
using (auth.uid() = user_id);

-- ============================================================
-- 8) Profiles + Role-based Access (recommended)
-- ============================================================
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  avatar_url text,
  first_name text,
  last_name text,
  full_name text,
  gym_name text,
  role text not null default 'aluno',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists full_name text,
  add column if not exists gym_name text,
  add column if not exists role text not null default 'aluno',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('aluno', 'instrutor'));
  end if;
end $$;

create index if not exists profiles_role_idx
  on public.profiles (role);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    case
      when lower(coalesce(new.raw_user_meta_data ->> 'role', '')) = 'instrutor' then 'instrutor'
      else 'aluno'
    end
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

insert into public.profiles (user_id, full_name, role)
select
  au.id,
  au.raw_user_meta_data ->> 'full_name',
  case
    when lower(coalesce(au.raw_user_meta_data ->> 'role', '')) = 'instrutor' then 'instrutor'
    else 'aluno'
  end
from auth.users au
left join public.profiles p on p.user_id = au.id
where p.user_id is null;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own_no_role_change" on public.profiles;

create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = user_id);

create policy "profiles_insert_own"
on public.profiles
for insert
with check (
  auth.uid() = user_id
  and role in ('aluno', 'instrutor')
);

create or replace function public.get_profile_role(uid uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.user_id = uid
  limit 1;
$$;

create policy "profiles_update_own_no_role_change"
on public.profiles
for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and role = public.get_profile_role(auth.uid())
);

create or replace function public.is_instrutor(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = uid
      and p.role = 'instrutor'
  );
$$;

drop policy if exists "workouts_insert_own" on public.workouts;
drop policy if exists "workouts_update_own" on public.workouts;
drop policy if exists "workouts_delete_own" on public.workouts;

create policy "workouts_insert_own"
on public.workouts
for insert
with check (auth.uid() = user_id and public.is_instrutor());

create policy "workouts_update_own"
on public.workouts
for update
using (auth.uid() = user_id and public.is_instrutor())
with check (auth.uid() = user_id and public.is_instrutor());

create policy "workouts_delete_own"
on public.workouts
for delete
using (auth.uid() = user_id and public.is_instrutor());

drop policy if exists "workout_items_insert_own" on public.workout_items;
drop policy if exists "workout_items_update_own" on public.workout_items;
drop policy if exists "workout_items_delete_own" on public.workout_items;

create policy "workout_items_insert_own"
on public.workout_items
for insert
with check (auth.uid() = user_id and public.is_instrutor());

create policy "workout_items_update_own"
on public.workout_items
for update
using (auth.uid() = user_id and public.is_instrutor())
with check (auth.uid() = user_id and public.is_instrutor());

create policy "workout_items_delete_own"
on public.workout_items
for delete
using (auth.uid() = user_id and public.is_instrutor());

-- ============================================================
-- 9) Coach-Student Relationships (phase 1)
-- ============================================================
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

-- ============================================================
-- 10) Coach-Student Workflow RPCs (phase 2)
-- ============================================================
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

-- ============================================================
-- 11) Workout Structure Guard (student with active coach)
-- ============================================================
create or replace function public.can_manage_workout_structure(
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
    (
      actor_uid = target_user_id
      and (
        coalesce((select p.role from public.profiles p where p.user_id = actor_uid), 'aluno') <> 'aluno'
        or not exists (
          select 1
          from public.coach_student_links l
          where l.student_id = actor_uid
            and l.status = 'active'
        )
      )
    )
    or public.is_active_coach_for_student(actor_uid, target_user_id);
$$;

drop policy if exists "workouts_insert_own" on public.workouts;
drop policy if exists "workouts_update_own" on public.workouts;
drop policy if exists "workouts_delete_own" on public.workouts;

create policy "workouts_insert_own"
on public.workouts
for insert
with check (public.can_manage_workout_structure(user_id));

create policy "workouts_update_own"
on public.workouts
for update
using (public.can_manage_workout_structure(user_id))
with check (public.can_manage_workout_structure(user_id));

create policy "workouts_delete_own"
on public.workouts
for delete
using (public.can_manage_workout_structure(user_id));

drop policy if exists "workout_items_insert_own" on public.workout_items;
drop policy if exists "workout_items_update_own" on public.workout_items;
drop policy if exists "workout_items_delete_own" on public.workout_items;

create policy "workout_items_insert_own"
on public.workout_items
for insert
with check (public.can_manage_workout_structure(user_id));

create policy "workout_items_update_own"
on public.workout_items
for update
using (public.can_manage_workout_structure(user_id))
with check (public.can_manage_workout_structure(user_id));

create policy "workout_items_delete_own"
on public.workout_items
for delete
using (public.can_manage_workout_structure(user_id));

-- ============================================================
-- 12) Profiles visibility for linked coach/student
-- ============================================================
drop policy if exists "profiles_select_own" on public.profiles;

create policy "profiles_select_own"
on public.profiles
for select
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.coach_student_links l
    where
      (l.coach_id = auth.uid() and l.student_id = profiles.user_id)
      or (l.student_id = auth.uid() and l.coach_id = profiles.user_id)
  )
);

-- ============================================================
-- 13) Profile photos storage
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile_photos_public_read" on storage.objects;
create policy "profile_photos_public_read"
on storage.objects
for select
using (bucket_id = 'profile-photos');

drop policy if exists "profile_photos_insert_own" on storage.objects;
create policy "profile_photos_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile_photos_update_own" on storage.objects;
create policy "profile_photos_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile_photos_delete_own" on storage.objects;
create policy "profile_photos_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
