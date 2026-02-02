-- Adds default_sets/sets columns and constraints for series tracking
alter table public.workout_items
  add column if not exists default_sets int;

alter table public.session_items
  add column if not exists sets int;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workout_items_default_sets_nonneg'
  ) then
    alter table public.workout_items
      add constraint workout_items_default_sets_nonneg
      check (default_sets is null or default_sets >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'session_items_sets_nonneg'
  ) then
    alter table public.session_items
      add constraint session_items_sets_nonneg
      check (sets is null or sets >= 0);
  end if;
end $$;
