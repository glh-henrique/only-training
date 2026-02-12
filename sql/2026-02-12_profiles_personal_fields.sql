-- Add personal profile fields for editable profile form.
-- Idempotent migration for existing environments.

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists gym_name text;

