export interface RequestCache {
  /**
   * Runs `fn` unless a fresh result for `key` already exists (within `ttlMs`)
   * or an identical request is already in flight. Deduplicates concurrent
   * callers (e.g. React StrictMode double-mounts, rapid tab navigation) and
   * skips refetching data that was just loaded.
   *
   * Pass `force = true` to bypass the freshness window (an in-flight request is
   * still reused, since it is already loading fresh data).
   */
  run: (key: string, force: boolean, fn: () => Promise<void>) => Promise<void>
  /** Drops the cached freshness marker so the next `run` refetches. */
  reset: () => void
}

/**
 * Creates a tiny per-resource cache that prevents redundant API calls.
 * Intended to wrap store fetchers that would otherwise re-hit the backend on
 * every component mount.
 */
export function createRequestCache(ttlMs: number): RequestCache {
  let lastKey: string | null = null
  let lastAt = 0
  let inFlight: Promise<void> | null = null

  return {
    run(key, force, fn) {
      // An identical request is already loading: reuse it instead of firing again.
      if (inFlight) return inFlight

      const now = Date.now()
      if (!force && key === lastKey && now - lastAt < ttlMs) {
        return Promise.resolve()
      }

      const promise = fn()
        .then(() => {
          // Only mark as fresh on success, so failures are retried next time.
          lastKey = key
          lastAt = Date.now()
        })
        .finally(() => {
          if (inFlight === promise) inFlight = null
        })

      inFlight = promise
      return promise
    },
    reset() {
      lastKey = null
      lastAt = 0
    },
  }
}
