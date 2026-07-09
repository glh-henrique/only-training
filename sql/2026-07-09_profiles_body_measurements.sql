-- Optional body measurements: height feeds BMR (Mifflin-St Jeor);
-- neck/waist/hip feed body fat % (US Navy) -> lean mass -> BMR (Katch-McArdle).
alter table public.profiles
  add column if not exists height_cm numeric
  constraint profiles_height_cm_range check (height_cm is null or (height_cm > 0 and height_cm < 300));

alter table public.profiles
  add column if not exists neck_cm numeric
  constraint profiles_neck_cm_range check (neck_cm is null or (neck_cm > 0 and neck_cm < 100));

alter table public.profiles
  add column if not exists waist_cm numeric
  constraint profiles_waist_cm_range check (waist_cm is null or (waist_cm > 0 and waist_cm < 300));

alter table public.profiles
  add column if not exists hip_cm numeric
  constraint profiles_hip_cm_range check (hip_cm is null or (hip_cm > 0 and hip_cm < 300));
