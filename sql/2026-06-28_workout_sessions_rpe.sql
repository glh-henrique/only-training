-- Add RPE (rate of perceived exertion / "como foi o esforço") to workout sessions
alter table public.workout_sessions
  add column if not exists rpe smallint
  constraint workout_sessions_rpe_range check (rpe is null or rpe between 1 and 10);
