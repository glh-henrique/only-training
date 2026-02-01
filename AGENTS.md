# AGENTS.md

This file documents how to work in this repo for future agents.

## Project overview
- React 19 + TypeScript + Vite 5 app.
- Tailwind CSS v4 for styling.
- React Router uses HashRouter (required for GitHub Pages).
- Supabase for auth and data.
- PWA via vite-plugin-pwa with custom service worker.

## Key commands
- `npm run dev` - local dev server
- `npm run build` - typecheck + build
- `npm run preview` - preview build
- `npm run lint` - eslint
- `npm run deploy` - deploy to GitHub Pages

## Environment
- Required env vars in `.env`:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

## Routing / deploy
- Router: `HashRouter` in `src/main.tsx`.
- Base path: `/only-training/` (see `vite.config.ts`).
- Do not switch to BrowserRouter unless deploy strategy changes.

## App flow (high level)
- App boot: `src/App.tsx` initializes auth state, applies theme to `documentElement`, and wires online/offline handlers.
- If offline: a banner appears (bottom) and sync is deferred.
- When connectivity returns: `useWorkoutStore.processSyncQueue()` runs to push queued changes.
- All protected screens sit behind `ProtectedRoute` (auth required).

## Auth flow
- `useAuthStore.initialize()` fetches the current session on app mount.
- Public routes:
  - `/login` and `/register` redirect to `/` if already authenticated.
  - `/register-confirmation` shows the post-signup confirmation UI.
  - `/forgot-password` triggers Supabase email reset.
  - `/reset-password` updates the user password after email flow.
- Session changes are handled via Supabase auth callbacks in `useAuthStore.ts`.

## Workout flow
- Home is the main entry point for current workouts and start/resume actions.
- Active session state and timer logic live in `useSessionStore.ts`.
- `WorkoutSession` handles the in-progress session view and item updates.
- `WorkoutEditor` manages editing workout metadata and items.
- Completed sessions are persisted to `workout_sessions` and `session_items`.

## History & archive flow
- `History` reads from `workout_sessions` + `session_items`.
- `ArchivedWorkouts` shows archived `workouts` and supports restore/unarchive.

## Notifications / long workout
- `useWorkoutMonitor` watches the timer and triggers a notification after 300 seconds.
- When the document is hidden, the SW shows a notification with "continue" and "finish".
- If the user taps "finish", the SW posts `FINISH_WORKOUT` back to the app; `useSessionStore.finishSession()` handles it.

## PWA / service worker
- PWA uses `injectManifest` with `src/sw.ts`.
- Notifications send `FINISH_WORKOUT` messages back to the app.

## Data layer (Supabase)
Tables used in code:
- `workouts`
- `workout_items`
- `workout_sessions`
- `session_items`

Key files:
- Client: `src/lib/supabase.ts`
- Auth store: `src/stores/useAuthStore.ts`
- Workouts: `src/stores/useWorkoutStore.ts`
- Sessions: `src/stores/useSessionStore.ts`
- History: `src/stores/useHistoryStore.ts`

## i18n
- i18next config: `src/i18n/config.ts`
- Locales: `src/i18n/locales/en.json` and `src/i18n/locales/pt.json`
- When adding UI text, update both locale files.

## UI conventions
- Tailwind utility classes; keep JSX functional components.
- Offline banner in `src/App.tsx`.
- Theme stored in `src/stores/useThemeStore.ts` and applied on root.

## Repo hygiene
- Do not edit `dist/` or `node_modules/`.
- Prefer small, focused diffs and keep TypeScript strict.
