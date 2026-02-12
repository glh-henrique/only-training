-- Fix recursion in profiles update policy by avoiding self-select under RLS.

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

drop policy if exists "profiles_update_own_no_role_change" on public.profiles;

create policy "profiles_update_own_no_role_change"
on public.profiles
for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and role = public.get_profile_role(auth.uid())
);

