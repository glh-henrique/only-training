-- Adds rest_seconds snapshot to session_items
alter table public.session_items
  add column if not exists rest_seconds int;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'session_items_rest_nonneg'
  ) then
    alter table public.session_items
      add constraint session_items_rest_nonneg
      check (rest_seconds is null or rest_seconds >= 0);
  end if;
end $$;
