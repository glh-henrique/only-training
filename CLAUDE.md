# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A detailed flow-by-flow walkthrough already lives in `AGENTS.md` (auth, workout, history, notifications, PWA). Read it for feature-level detail. This file covers the build/test commands and the layered architecture that `AGENTS.md` does not.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — `tsc -b` (typecheck, all `tsconfig.*.json`) then `vite build`. This is the typecheck gate; there is no separate `typecheck` script.
- `npm run lint` — ESLint
- `npm test` — Vitest (`vitest run src`). Run a single file: `npx vitest run src/lib/calories.test.ts`. Watch: `npx vitest src`
- `npm run deploy` — `predeploy` bumps the version (`scripts/bump-deploy.mjs`) + builds, then `gh-pages` publishes `dist/`. Deploys to the custom domain in `package.json` `homepage`.

`node scripts/test-core-regression.mjs` is a standalone regression check runnable outside Vitest.

## Architecture

React 19 + TypeScript + Vite 5, Tailwind v4, Supabase (auth + Postgres + storage + edge functions), Zustand for state, i18next (pt/en). `HashRouter` (see `src/main.tsx`) — required for static hosting; do not switch to `BrowserRouter`. Note `vite.config.ts` `base` is `/` (custom domain), even though `AGENTS.md` still mentions the old `/only-training/` GitHub Pages path.

Data flows through distinct layers — respect them when adding features:

- **`src/gateways/`** — the ONLY place that touches Supabase tables/auth (`supabase*Gateway.ts`). Stores and pages never call `supabase.from(...)` directly; they call a gateway method. Add new queries here.
- **`src/stores/`** — Zustand stores (auth, workout, session, history, theme). They call gateways, hold UI state, and own the offline sync queue + request cache. `useWorkoutStore` and `useSessionStore` persist via `zustand/persist` into localStorage.
- **`src/core/`** — pure, side-effect-free logic, unit-tested in isolation: `sync-queue` (offline action ordering/dedup), `request-cache` (dedupes concurrent fetches + TTL freshness window so tab navigation doesn't refetch), `workout-stats`, `session`, `domain`, `url`. Re-exported from `src/core/index.ts`.
- **`src/lib/`** — `supabase.ts` (client), `storageGateway.ts` (localStorage wrapper), pure tested helpers (`calories.ts`, `stats.ts`), and AI/integration helpers (`aiWorkoutCoach`, `dailyMotivation`, `workoutPlaylist`, `muscleWiki`).

**Offline-first:** mutations queue in localStorage via the sync-queue when offline; `useWorkoutStore.processSyncQueue()` flushes them when connectivity returns (`App.tsx` wires the online/offline banner and trigger). Preserve this — don't make write paths assume the network is up.

**Table names & enums** are centralized in `src/constants/database.ts` (`TableNames`, `SessionStatus`) and `src/constants/` generally (`routes.ts`, `store.ts`, `auth.ts`). Generated DB types live in `src/types/database.types.ts`. Use these constants rather than string literals.

## Backend (Supabase)

- **SQL migrations** are hand-written files in `sql/`, named `YYYY-MM-DD_description.sql` (plus the `000_only_training_consolidated.sql` baseline). They must be **idempotent** (`add column if not exists`, `drop policy if exists` before `create policy`, `create or replace function`). Apply them to the project via the Supabase MCP `apply_migration`, and keep the `.sql` file in the repo as the source of record.
- **RLS everywhere.** Every table has row-level security. When adding a column that must not be client-tampered (like `terms_accepted_at` or `role`), lock it in the `profiles_update_*` policy via a `security definer` getter comparing old vs new — see `sql/2026-07-20_profiles_terms_accepted.sql` for the pattern. The signup trigger `handle_new_user_profile()` (security definer) is what seeds profile rows from `auth.users` metadata.
- **Edge functions** in `supabase/functions/` (AI workout plan/motivation/playlist, MuscleWiki proxy, coach invite email).
- **NutriBase integration** is server-to-server: a Postgres trigger POSTs `{email, date, kcal}` to an external function when a session finishes — see `docs/06_NUTRIBASE_INTEGRATION.md`. The frontend does not call it.

## Conventions

- **Additive changes only** — never break existing behavior; new features extend rather than replace (this is the maintainer's stated top priority).
- **i18n:** all UI text goes through i18next; update BOTH `src/i18n/locales/pt.json` and `en.json`.
- **Styling:** Tailwind utility classes with custom `ot-*` design tokens (`bg-ot-paper`, `text-ot-ink`, `font-ot-mono`, `font-ot-display`, etc.) defined in `src/index.css`. Reuse these rather than raw hex.
- Do not edit `dist/` or `node_modules/`. Keep TypeScript strict; keep diffs small.
- Extended product/design/data docs are in `docs/` (00–11 + SECURITY-AUDIT, ANDROID-TWA).
