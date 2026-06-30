export const WORKOUTS_CACHE_TTL_MS = 30_000

export const SyncActionType = {
  Archive: 'archive',
  Unarchive: 'unarchive',
  Delete: 'delete'
} as const

export const STORE_KEYS = {
  workouts: 'only-training-workouts',
  theme: 'theme-storage',
  session: 'only-training-session',
  history: 'only-training-history'
} as const

export const SessionStartResult = {
  Started: 'started',
  NoItems: 'no_items',
  Error: 'error'
} as const
