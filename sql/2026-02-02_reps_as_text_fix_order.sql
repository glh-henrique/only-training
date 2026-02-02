-- Drop numeric constraints before changing reps types to text

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'workout_items_default_reps_nonneg') then
    alter table public.workout_items drop constraint workout_items_default_reps_nonneg;
  end if;
  if exists (select 1 from pg_constraint where conname = 'session_items_reps_nonneg') then
    alter table public.session_items drop constraint session_items_reps_nonneg;
  end if;
end $$;

alter table public.workout_items
  alter column default_reps type text using default_reps::text;

alter table public.session_items
  alter column reps type text using reps::text;
