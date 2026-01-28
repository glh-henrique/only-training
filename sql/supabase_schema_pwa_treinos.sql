-- ============================================================
-- PWA Treinos (Supabase/Postgres) — Schema completo
-- Pronto para colar no Supabase SQL Editor
-- Inclui: tabelas, constraints, índices, triggers, RLS e policies
-- ============================================================

-- 1) Extensões
create extension if not exists pgcrypto;

-- 2) Funções utilitárias (updated_at)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 3) Tabelas
-- Observação: por padrão, não criamos FK para auth.users por questões de permissões.
-- user_id é uuid e será protegido via RLS + policies.

-- 3.1) workouts
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  focus text not null,
  notes text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workouts_name_nonempty check (char_length(trim(name)) > 0),
  constraint workouts_focus_nonempty check (char_length(trim(focus)) > 0)
);

-- Evita dois treinos com o mesmo "nome" para o mesmo usuário (A, B, C...)
create unique index if not exists workouts_user_name_uniq
  on public.workouts (user_id, lower(name));

create index if not exists workouts_user_id_idx
  on public.workouts (user_id);

-- Trigger updated_at
drop trigger if exists workouts_set_updated_at on public.workouts;
create trigger workouts_set_updated_at
before update on public.workouts
for each row execute function public.set_updated_at();

-- 3.2) workout_items
create table if not exists public.workout_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  title text not null,
  order_index int not null,
  default_weight numeric(6,2),
  default_reps int,
  rest_seconds int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_items_title_nonempty check (char_length(trim(title)) > 0),
  constraint workout_items_order_nonneg check (order_index >= 0),
  constraint workout_items_default_weight_nonneg check (default_weight is null or default_weight >= 0),
  constraint workout_items_default_reps_nonneg check (default_reps is null or default_reps >= 0),
  constraint workout_items_rest_nonneg check (rest_seconds is null or rest_seconds >= 0)
);

create index if not exists workout_items_user_id_idx
  on public.workout_items (user_id);

create index if not exists workout_items_workout_id_idx
  on public.workout_items (workout_id);

-- Garante que não existam dois itens com a mesma posição dentro do mesmo treino
create unique index if not exists workout_items_workout_order_uniq
  on public.workout_items (workout_id, order_index);

drop trigger if exists workout_items_set_updated_at on public.workout_items;
create trigger workout_items_set_updated_at
before update on public.workout_items
for each row execute function public.set_updated_at();

-- 3.3) workout_sessions
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  workout_id uuid references public.workouts(id) on delete set null,
  workout_name_snapshot text not null,
  workout_focus_snapshot text,
  status text not null default 'in_progress',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds int,
  created_at timestamptz not null default now(),
  constraint workout_sessions_status_check check (status in ('in_progress','finished','canceled')),
  constraint workout_sessions_name_nonempty check (char_length(trim(workout_name_snapshot)) > 0),
  constraint workout_sessions_duration_nonneg check (duration_seconds is null or duration_seconds >= 0),
  constraint workout_sessions_ended_after_started check (ended_at is null or ended_at >= started_at)
);

create index if not exists workout_sessions_user_started_idx
  on public.workout_sessions (user_id, started_at desc);

create index if not exists workout_sessions_workout_id_idx
  on public.workout_sessions (workout_id);

-- 3.4) session_items
create table if not exists public.session_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  workout_item_id uuid references public.workout_items(id) on delete set null,
  title_snapshot text not null,
  order_index int not null,
  weight numeric(6,2),
  reps int,
  is_done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  constraint session_items_title_nonempty check (char_length(trim(title_snapshot)) > 0),
  constraint session_items_order_nonneg check (order_index >= 0),
  constraint session_items_weight_nonneg check (weight is null or weight >= 0),
  constraint session_items_reps_nonneg check (reps is null or reps >= 0),
  constraint session_items_done_at_consistency check (
    (is_done = false and done_at is null) or
    (is_done = true and done_at is not null)
  )
);

create index if not exists session_items_user_id_idx
  on public.session_items (user_id);

create index if not exists session_items_session_id_idx
  on public.session_items (session_id);

create unique index if not exists session_items_session_order_uniq
  on public.session_items (session_id, order_index);

-- 4) Trigger para manter done_at consistente (opcional, mas ajuda)
create or replace function public.session_items_set_done_at()
returns trigger
language plpgsql
as $$
begin
  -- Se marcar como feito e não tiver done_at, define agora
  if new.is_done = true and new.done_at is null then
    new.done_at = now();
  end if;

  -- Se desmarcar, limpa done_at
  if new.is_done = false then
    new.done_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists session_items_set_done_at on public.session_items;
create trigger session_items_set_done_at
before insert or update of is_done, done_at on public.session_items
for each row execute function public.session_items_set_done_at();

-- ============================================================
-- 5) RLS + Policies
-- ============================================================

-- 5.1) Habilitar RLS
alter table public.workouts enable row level security;
alter table public.workout_items enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.session_items enable row level security;

-- 5.2) Policies padrão: cada usuário só vê/manipula seus dados
-- Workouts
drop policy if exists "workouts_select_own" on public.workouts;
create policy "workouts_select_own"
on public.workouts
for select
using (user_id = auth.uid());

drop policy if exists "workouts_insert_own" on public.workouts;
create policy "workouts_insert_own"
on public.workouts
for insert
with check (user_id = auth.uid());

drop policy if exists "workouts_update_own" on public.workouts;
create policy "workouts_update_own"
on public.workouts
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "workouts_delete_own" on public.workouts;
create policy "workouts_delete_own"
on public.workouts
for delete
using (user_id = auth.uid());

-- Workout Items
drop policy if exists "workout_items_select_own" on public.workout_items;
create policy "workout_items_select_own"
on public.workout_items
for select
using (user_id = auth.uid());

drop policy if exists "workout_items_insert_own" on public.workout_items;
create policy "workout_items_insert_own"
on public.workout_items
for insert
with check (user_id = auth.uid());

drop policy if exists "workout_items_update_own" on public.workout_items;
create policy "workout_items_update_own"
on public.workout_items
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "workout_items_delete_own" on public.workout_items;
create policy "workout_items_delete_own"
on public.workout_items
for delete
using (user_id = auth.uid());

-- Workout Sessions
drop policy if exists "workout_sessions_select_own" on public.workout_sessions;
create policy "workout_sessions_select_own"
on public.workout_sessions
for select
using (user_id = auth.uid());

drop policy if exists "workout_sessions_insert_own" on public.workout_sessions;
create policy "workout_sessions_insert_own"
on public.workout_sessions
for insert
with check (user_id = auth.uid());

drop policy if exists "workout_sessions_update_own" on public.workout_sessions;
create policy "workout_sessions_update_own"
on public.workout_sessions
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "workout_sessions_delete_own" on public.workout_sessions;
create policy "workout_sessions_delete_own"
on public.workout_sessions
for delete
using (user_id = auth.uid());

-- Session Items
drop policy if exists "session_items_select_own" on public.session_items;
create policy "session_items_select_own"
on public.session_items
for select
using (user_id = auth.uid());

drop policy if exists "session_items_insert_own" on public.session_items;
create policy "session_items_insert_own"
on public.session_items
for insert
with check (user_id = auth.uid());

drop policy if exists "session_items_update_own" on public.session_items;
create policy "session_items_update_own"
on public.session_items
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "session_items_delete_own" on public.session_items;
create policy "session_items_delete_own"
on public.session_items
for delete
using (user_id = auth.uid());

-- ============================================================
-- 6) Notas finais (boas práticas)
-- ============================================================
-- 1) Recomenda-se criar/alterar dados sensíveis (como start/finish de sessão)
--    via Edge Functions, para validar coerência (workout pertence ao user etc).
-- 2) Mesmo usando Edge Functions, as policies acima continuam sendo a sua
--    barreira de segurança final.
-- 3) Caso você use service-role key na Edge Function, lembre-se de validar
--    o JWT do usuário e setar user_id corretamente no server.
