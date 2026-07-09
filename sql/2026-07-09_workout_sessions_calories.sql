-- Persist the client-computed calorie estimate at finish time.
-- Needed server-side by the NutriBase webhook (contract: 0 < kcal < 5000).
alter table public.workout_sessions
  add column if not exists calories_kcal numeric
  constraint workout_sessions_calories_kcal_range check (calories_kcal is null or (calories_kcal > 0 and calories_kcal < 5000));
