-- Change reps columns to text to allow per-set reps strings
alter table public.workout_items
  alter column default_reps type text using default_reps::text;

alter table public.session_items
  alter column reps type text using reps::text;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'workout_items_default_reps_nonneg') then
    alter table public.workout_items drop constraint workout_items_default_reps_nonneg;
  end if;
  if exists (select 1 from pg_constraint where conname = 'session_items_reps_nonneg') then
    alter table public.session_items drop constraint session_items_reps_nonneg;
  end if;
end $$;
-- NOTE: This migration failed on apply because numeric check constraints were still present.
-- It was superseded by: 2026-02-02_reps_as_text_fix_order.sql
-- See: 2026-02-02_reps_as_text_noop.sql for audit note.
