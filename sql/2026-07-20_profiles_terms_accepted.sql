-- Persist terms/privacy acceptance timestamp (was only checked client-side before).
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, role, terms_accepted_at)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    case
      when lower(coalesce(new.raw_user_meta_data ->> 'role', '')) = 'instrutor' then 'instrutor'
      else 'aluno'
    end,
    (new.raw_user_meta_data ->> 'terms_accepted_at')::timestamptz
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Lock terms_accepted_at against client tampering: only the signup trigger
-- (security definer, bypasses RLS) may set it. Mirrors the role-lock below.
create or replace function public.get_profile_terms_accepted_at(uid uuid default auth.uid())
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select p.terms_accepted_at
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
  and terms_accepted_at is not distinct from public.get_profile_terms_accepted_at(auth.uid())
);
