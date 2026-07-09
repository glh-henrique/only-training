-- Body metrics for calorie estimation (weight + age + sex feed MET/Keytel formulas)
alter table public.profiles
  add column if not exists body_weight_kg numeric
  constraint profiles_body_weight_kg_range check (body_weight_kg is null or (body_weight_kg > 0 and body_weight_kg < 500));

alter table public.profiles
  add column if not exists birth_date date;

alter table public.profiles
  add column if not exists sex text
  constraint profiles_sex_values check (sex is null or sex in ('male', 'female'));
