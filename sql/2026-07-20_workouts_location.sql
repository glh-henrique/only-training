-- Classify a workout as done at home or at the gym (set at creation time).
-- Additive: existing rows default to 'gym'.
alter table public.workouts
  add column if not exists location text not null default 'gym'
  constraint workouts_location_check check (location in ('home', 'gym'));
