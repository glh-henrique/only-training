-- RLS policies for OnlyTraining tables
-- Review before applying in Supabase.

-- Enable RLS
alter table public.workouts enable row level security;
alter table public.workout_items enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.session_items enable row level security;

-- Drop existing policies if you want a clean re-create
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

-- workouts
create policy "workouts_select_own"
on public.workouts
for select
using (auth.uid() = user_id);

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

-- workout_items
create policy "workout_items_select_own"
on public.workout_items
for select
using (auth.uid() = user_id);

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

-- workout_sessions
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

-- session_items
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
