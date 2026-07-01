import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { STORE_KEYS } from '../constants/store'
import { getErrorMessage } from "../lib/utils"
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'
import { useAuthStore } from './useAuthStore'
import { createRequestCache } from '../core'
import { localStorageGateway } from '../lib/storageGateway'

// Dedupes concurrent fetches and avoids refetching the full history on every
// page mount; reset via invalidate() when a session finishes.
const HISTORY_CACHE_TTL_MS = 30_000
const historyCache = createRequestCache(HISTORY_CACHE_TTL_MS)

type WorkoutSession = Database['public']['Tables']['workout_sessions']['Row']
type SessionItem = Database['public']['Tables']['session_items']['Row']

export interface SessionWithWorkout extends WorkoutSession {
  items: SessionItem[]
}

// Histórico cresce sem teto; carrega por página em vez de puxar tudo no boot.
const HISTORY_PAGE_SIZE = 50

const fetchSessionsPage = async (userId: string, from: number, to: number): Promise<SessionWithWorkout[]> => {
  const { data: sessionsData, error: sessionsError } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'finished')
    .order('ended_at', { ascending: false })
    .range(from, to)

  if (sessionsError) throw sessionsError
  if (!sessionsData || sessionsData.length === 0) return []

  const sessionIds = sessionsData.map(s => s.id)
  const { data: itemsData, error: itemsError } = await supabase
    .from('session_items')
    .select('*')
    .in('session_id', sessionIds)
    .order('order_index')

  if (itemsError) throw itemsError

  const itemsBySession: Record<string, SessionItem[]> = {}
  itemsData?.forEach(item => {
    if (!itemsBySession[item.session_id]) itemsBySession[item.session_id] = []
    itemsBySession[item.session_id].push(item)
  })

  return sessionsData.map(s => ({ ...s, items: itemsBySession[s.id] || [] }))
}

interface HistoryState {
  sessions: SessionWithWorkout[]
  isLoading: boolean
  hasFetched: boolean
  hasMore: boolean
  error: string | null
  fetchHistory: (force?: boolean) => Promise<void>
  loadMore: () => Promise<void>
  invalidateHistory: () => void
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      sessions: [],
      isLoading: false,
      hasFetched: false,
      hasMore: true,
      error: null,

      invalidateHistory: () => historyCache.reset(),

      fetchHistory: async (force = false) => {
        const user = useAuthStore.getState().user
        if (!user) {
          set({ error: 'User not authenticated' })
          return
        }

        return historyCache.run(user.id, force, async () => {
          set({ isLoading: true, error: null })
          try {
            const page = await fetchSessionsPage(user.id, 0, HISTORY_PAGE_SIZE - 1)
            set({ sessions: page, hasMore: page.length === HISTORY_PAGE_SIZE })
          } catch (err: unknown) {
            set({ error: getErrorMessage(err) })
          } finally {
            set({ isLoading: false, hasFetched: true })
          }
        })
      },

      loadMore: async () => {
        const user = useAuthStore.getState().user
        const { sessions, isLoading, hasMore } = get()
        if (!user || isLoading || !hasMore) return

        set({ isLoading: true, error: null })
        try {
          const page = await fetchSessionsPage(user.id, sessions.length, sessions.length + HISTORY_PAGE_SIZE - 1)
          set({ sessions: [...sessions, ...page], hasMore: page.length === HISTORY_PAGE_SIZE })
        } catch (err: unknown) {
          set({ error: getErrorMessage(err) })
        } finally {
          set({ isLoading: false })
        }
      }
    }),
    {
      name: STORE_KEYS.history,
      storage: createJSONStorage(() => localStorageGateway),
      partialize: (state) => ({
        sessions: state.sessions,
        hasFetched: state.hasFetched
      }),
    }
  )
)
