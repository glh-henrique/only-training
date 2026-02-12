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
