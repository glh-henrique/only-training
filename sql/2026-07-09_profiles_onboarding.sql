-- First-access onboarding wizard: null onboarded_at = wizard pending.
-- Backfill existing accounts so only new signups see the wizard.
alter table public.profiles
  add column if not exists onboarded_at timestamptz;

update public.profiles
  set onboarded_at = now()
  where onboarded_at is null;
