-- Role-based access with profiles as source of truth.
-- Idempotent migration for existing environments.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  avatar_url text,
  full_name text,
  role text not null default 'aluno',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists full_name text,
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
