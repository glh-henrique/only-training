# Modelo de Dados

# Banco de Dados (Supabase/Postgres) — PWA Treinos

Este documento descreve o esquema do banco para um app PWA de treinos com:

- Autenticação via **Supabase Auth** (tabela `auth.users`)
- Dados isolados por usuário via **RLS (Row Level Security)**
- Execução de “backend” via **Edge Functions**
- Separação clara entre:
  - **Modelos editáveis** (treinos e itens)
  - **Histórico imutável** (sessões e itens da sessão / snapshot)

---

## 1) Extensões e Convenções

### Extensões recomendadas

- `pgcrypto` (para `gen_random_uuid()`)

### Convenções

- PKs como `uuid`
- `created_at`, `updated_at` em tabelas editáveis
- `user_id` em todas as tabelas com RLS
- Índices para `user_id` e FKs principais
- `order_index` para ordenação de itens no treino

---

## 2) Entidades e Relacionamentos

### Visão geral

- `workouts` (Treino A/B/C)
  - 1:N `workout_items` (exercícios do treino)
- `workout_sessions` (um treino executado em um dia)
  - 1:N `session_items` (snapshot dos exercícios naquele dia)

---

## 3) Tabelas

## 3.1) workouts

Armazena os treinos criados pelo usuário (ex: A – Costas).

**Campos**

- `id` uuid PK
- `user_id` uuid (FK lógica para `auth.users.id`)
- `name` text (ex: "A")
- `focus` text (ex: "Costas")
- `notes` text (opcional)
- `is_archived` boolean default false
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()

**Regras**

- `user_id` obrigatório
- `name` obrigatório
- opcional: `unique(user_id, name)` (evita dois “Treino A”)

---

## 3.2) workout_items

Itens dentro de um treino (exercícios) + defaults.

**Campos**

- `id` uuid PK
- `user_id` uuid (FK lógica para `auth.users.id`)
- `workout_id` uuid FK -> `workouts.id` ON DELETE CASCADE
- `title` text (ex: "Supino reto")
- `order_index` int (0..n)
- `default_weight` numeric(6,2) (kg) opcional
- `default_reps` int opcional
- `rest_seconds` int opcional
- `notes` text opcional
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()

**Regras**

- `title` obrigatório
- `order_index` obrigatório
- opcional: `unique(workout_id, order_index)` para consistência de ordenação

---

## 3.3) workout_sessions

Histórico de execuções (cada vez que o usuário faz um treino).

**Campos**

- `id` uuid PK
- `user_id` uuid (FK lógica para `auth.users.id`)
- `workout_id` uuid FK -> `workouts.id` ON DELETE SET NULL (histórico não morre)
- `workout_name_snapshot` text (nome do treino no momento)
- `workout_focus_snapshot` text (foco no momento) opcional
- `status` text check in ('in_progress','finished','canceled') default 'in_progress'
- `started_at` timestamptz default now()
- `ended_at` timestamptz (nullable)
- `duration_seconds` int (nullable; preenchido ao finalizar)
- `created_at` timestamptz default now()

**Notas**

- `workout_*_snapshot` garante histórico consistente mesmo se o treino for editado/deletado.
- `status='in_progress'` permite retomar sessão (inclusive offline/sync).

---

## 3.4) session_items

Snapshot dos itens do treino dentro de uma sessão (com carga/reps e check).

**Campos**

- `id` uuid PK
- `user_id` uuid (FK lógica para `auth.users.id`)
- `session_id` uuid FK -> `workout_sessions.id` ON DELETE CASCADE
- `workout_item_id` uuid FK -> `workout_items.id` ON DELETE SET NULL (referência opcional)
- `title_snapshot` text
- `order_index` int
- `weight` numeric(6,2) (kg) nullable
- `reps` int nullable
- `is_done` boolean default false
- `done_at` timestamptz nullable
- `created_at` timestamptz default now()

**Regras**

- `title_snapshot` obrigatório
- `order_index` obrigatório
- ao marcar `is_done=true`, preencher `done_at=now()` (via Edge Function ou trigger)

---

## 4) Índices recomendados

- `workouts(user_id)`
- `workout_items(workout_id)`
- `workout_items(user_id)`
- `workout_sessions(user_id, started_at desc)`
- `session_items(session_id)`
- `session_items(user_id)`

---

## 5) RLS (Row Level Security)

> Habilitar RLS em todas as tabelas acima e criar policies para isolar por usuário.

### Padrão de policy (CRUD)

- SELECT: `user_id = auth.uid()`
- INSERT: `user_id = auth.uid()`
- UPDATE: `user_id = auth.uid()`
- DELETE: `user_id = auth.uid()`

**Tabelas**

- `workouts`
- `workout_items`
- `workout_sessions`
- `session_items`

**Boas práticas**

- Sempre setar `user_id` no server-side (Edge Function) para evitar cliente malicioso.
- Validar que `workout_id` e `session_id` pertencem ao mesmo `user_id`.

---

## 6) Fluxos de negócio (Edge Functions)

### 6.1) Criar sessão (start workout)

1. Cliente chama `POST /start-session` com `workout_id`
2. Edge Function:
   - valida `workout` pertence ao usuário
   - cria `workout_sessions` com snapshots
   - busca `workout_items` do treino
   - cria `session_items` (snapshot) para cada item
3. Retorna `session_id` + itens da sessão

### 6.2) Atualizar item em treino (durante execução)

- `PATCH /session-item/:id`
- Atualiza `weight`, `reps`, `is_done`
- Se `is_done=true`, preencher `done_at`

### 6.3) Finalizar sessão

- `POST /finish-session`
- Edge Function:
  - valida sessão do usuário
  - garante `ended_at`, `duration_seconds`
  - opcional: se todos os itens estão `is_done=true`, auto-finaliza
  - retorna resumo para UI e share

---

## 7) Observações para Offline-First (opcional)

- Persistir no cliente:
  - `session_id` atual
  - estado dos `session_items`
  - `started_at`
- Ao voltar a rede:
  - sincronizar diffs (peso/reps/check)
  - finalizar sessão via Edge Function

---

## 8) Possíveis evoluções futuras (sem quebrar o schema)

- `exercise_library` (presets do usuário)
- `sets` por exercício:
  - criar `session_item_sets` para múltiplas séries (peso/reps por série)
- Métricas:
  - volume total, PRs, séries concluídas etc.

---

Ver arquivo SQL oficial:
supabase_schema_pwa_treinos.sql
