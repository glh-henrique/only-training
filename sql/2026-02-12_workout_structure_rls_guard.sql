-- Guard workout structure writes:
-- Student with active coach cannot mutate workouts/workout_items directly.

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
