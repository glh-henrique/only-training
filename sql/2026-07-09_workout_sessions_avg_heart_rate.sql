-- Average heart rate (bpm) entered at the end of a workout, used for calorie estimation
alter table public.workout_sessions
  add column if not exists avg_heart_rate smallint
  constraint workout_sessions_avg_heart_rate_range check (avg_heart_rate is null or avg_heart_rate between 30 and 250);
