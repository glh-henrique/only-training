import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'
import { useAuthStore } from './useAuthStore'

type WorkoutSession = Database['public']['Tables']['workout_sessions']['Row']
type SessionItem = Database['public']['Tables']['session_items']['Row']

export interface SessionWithWorkout extends WorkoutSession {
  items: SessionItem[]
}

interface HistoryState {
  sessions: SessionWithWorkout[]
  isLoading: boolean
  error: string | null
  fetchHistory: () => Promise<void>
}

export const useHistoryStore = create<HistoryState>((set) => ({
  sessions: [],
  isLoading: false,
  error: null,

  fetchHistory: async () => {
    set({ isLoading: true, error: null })
    try {
      const user = useAuthStore.getState().user
      if (!user) throw new Error('User not authenticated')

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
    } catch (err: any) {
      set({ error: err.message })
    } finally {
      set({ isLoading: false })
    }
  }
}))
