import { create } from 'zustand'
import { getErrorMessage } from "../lib/utils"
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'
import { useAuthStore } from './useAuthStore'
import { createRequestCache } from '../core'

// Dedupes concurrent fetches and avoids refetching the full history on every
// page mount; reset via invalidate() when a session finishes.
const HISTORY_CACHE_TTL_MS = 30_000
const historyCache = createRequestCache(HISTORY_CACHE_TTL_MS)

type WorkoutSession = Database['public']['Tables']['workout_sessions']['Row']
type SessionItem = Database['public']['Tables']['session_items']['Row']

export interface SessionWithWorkout extends WorkoutSession {
  items: SessionItem[]
}

interface HistoryState {
  sessions: SessionWithWorkout[]
  isLoading: boolean
  hasFetched: boolean
  error: string | null
  fetchHistory: (force?: boolean) => Promise<void>
  invalidateHistory: () => void
}

export const useHistoryStore = create<HistoryState>((set) => ({
  sessions: [],
  isLoading: false,
  hasFetched: false,
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
      // 1. Fetch finished sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'finished')
        .order('ended_at', { ascending: false })

      if (sessionsError) throw sessionsError

      if (!sessionsData || sessionsData.length === 0) {
        set({ sessions: [] })
        return
      }

      // 2. Fetch all session items for these sessions
      const sessionIds = sessionsData.map(s => s.id)
      const { data: itemsData, error: itemsError } = await supabase
        .from('session_items')
        .select('*')
        .in('session_id', sessionIds)
        .order('order_index')

      if (itemsError) throw itemsError

      // 3. Map items to sessions
      const itemsBySession: Record<string, SessionItem[]> = {}
      itemsData?.forEach(item => {
        if (!itemsBySession[item.session_id]) itemsBySession[item.session_id] = []
        itemsBySession[item.session_id].push(item)
      })

      const sessionsWithItems = sessionsData.map(s => ({
        ...s,
        items: itemsBySession[s.id] || []
      }))

      set({ sessions: sessionsWithItems })
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) })
    } finally {
      set({ isLoading: false, hasFetched: true })
    }
    })
  }
}))
