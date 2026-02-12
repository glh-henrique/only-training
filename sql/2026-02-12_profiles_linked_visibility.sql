-- Allow coach/student linked users to read each other's profile names.

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
