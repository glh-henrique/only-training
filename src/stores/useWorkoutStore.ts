import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'

type Workout = Database['public']['Tables']['workouts']['Row']
type WorkoutItem = Database['public']['Tables']['workout_items']['Row']

export interface WorkoutWithStats extends Workout {
  completed_count?: number
  last_completed_at?: string
}

interface SyncAction {
  id: string
  action: 'archive' | 'unarchive' | 'delete' | 'create'
  payload?: any
  timestamp: number
}

interface WorkoutState {
  workouts: WorkoutWithStats[]
  archivedCount: number
  isLoading: boolean
  error: string | null
  lastSession: SessionWithWorkout | null
  fetchWorkouts: () => Promise<void>
  createWorkout: (name: string, focus: string, notes?: string) => Promise<string | null>
  deleteWorkout: (id: string) => Promise<void>
  archiveWorkout: (id: string) => Promise<void>
  unarchiveWorkout: (id: string) => Promise<void>
  // Item management
  activeWorkoutItems: WorkoutItem[]
  fetchWorkoutItems: (workoutId: string) => Promise<void>
  addWorkoutItem: (
    workoutId: string,
    title: string,
    orderIndex: number,
    defaultReps?: string,
    defaultSets?: number,
    restSeconds?: number,
    notes?: string,
    videoUrl?: string
  ) => Promise<void>
  updateWorkoutItem: (
    itemId: string,
    updates: { title?: string, default_reps?: string, default_sets?: number, rest_seconds?: number, notes?: string, video_url?: string }
  ) => Promise<void>
  deleteWorkoutItem: (itemId: string) => Promise<void>
  // Sync
  syncQueue: SyncAction[]
  processSyncQueue: () => Promise<void>
}

// Reuse type from history
import type { SessionWithWorkout } from './useHistoryStore'
import { useAuthStore } from './useAuthStore'

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      workouts: [],
      archivedCount: 0,
      lastSession: null,
      activeWorkoutItems: [],
      isLoading: false,
      error: null,
      syncQueue: [],

      processSyncQueue: async () => {
        if (!navigator.onLine || get().syncQueue.length === 0) return
        
        const queue = [...get().syncQueue].sort((a, b) => a.timestamp - b.timestamp)
        set({ syncQueue: [] }) // Clear queue before processing to avoid loops

        for (const item of queue) {
          try {
            if (item.action === 'archive') await get().archiveWorkout(item.id)
            if (item.action === 'unarchive') await get().unarchiveWorkout(item.id)
            if (item.action === 'delete') await get().deleteWorkout(item.id)
          } catch (err) {
            console.error('Failed to sync item:', item, err)
            // Put it back in queue if not a 404 or similar permanent error
            set(state => ({ syncQueue: [...state.syncQueue, item] }))
          }
        }
      },

      fetchWorkouts: async () => {
    set({ isLoading: true, error: null })
    try {
      const user = useAuthStore.getState().user
      if (!user) return

      // 1. Fetch workouts
      const { data: workoutsData, error: workoutsError } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })

      if (workoutsError) throw workoutsError

      // 1.1 Fetch archived count
      const { count: archivedCount, error: countError } = await supabase
        .from('workouts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_archived', true)

      if (countError) throw countError


      // 2. Fetch counts and last date of finished sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'finished')
        .order('ended_at', { ascending: false }) // Order to easily find max
      
      if (sessionsError) throw sessionsError

      // 3. Merge stats
      const counts: Record<string, number> = {}
      const lastDates: Record<string, string> = {}

      sessionsData?.forEach(s => {
          if (s.workout_id) {
            counts[s.workout_id] = (counts[s.workout_id] || 0) + 1
            
            // Because we ordered by descending, the first one we find for a ID is the latest
            if (!lastDates[s.workout_id] && s.ended_at) {
                lastDates[s.workout_id] = s.ended_at
            }
          }
      })

      const workoutsWithStats: WorkoutWithStats[] = workoutsData.map(w => ({
          ...w,
          completed_count: counts[w.id] || 0,
          last_completed_at: lastDates[w.id]
      }))

      // 4. Set absolute last session
      const absoluteLast = sessionsData && sessionsData.length > 0 ? (sessionsData[0] as SessionWithWorkout) : null

      set({ 
        workouts: workoutsWithStats, 
        lastSession: absoluteLast,
        archivedCount: archivedCount || 0 
      })
    } catch (err: any) {
      set({ error: err.message })
    } finally {
      set({ isLoading: false })
    }
  },

  createWorkout: async (name, focus, notes) => {
    set({ isLoading: true, error: null })
    try {
      const user = useAuthStore.getState().user
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('workouts')
        .insert({
          user_id: user.id,
          name,
          focus,
          notes,
        })
        .select()
        .single()

      if (error) throw error
      const currentWorkouts = get().workouts
      set({ workouts: [data, ...currentWorkouts] })
      return data.id
    } catch (err: any) {
      set({ error: err.message })
      return null
    } finally {
      set({ isLoading: false })
    }
  },

  deleteWorkout: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const { error } = await supabase
        .from('workouts')
        .delete()
        .eq('id', id)

      if (error) throw error
      const currentWorkouts = get().workouts
      set({ workouts: currentWorkouts.filter(w => w.id !== id) })
    } catch (err: any) {
      set({ error: err.message })
    } finally {
      set({ isLoading: false })
    }
  },

  archiveWorkout: async (id) => {
    // Optimistic Update
    const currentWorkouts = get().workouts
    set({ workouts: currentWorkouts.filter(w => w.id !== id) })

    if (!navigator.onLine) {
      set(state => ({ 
        syncQueue: [...state.syncQueue, { id, action: 'archive', timestamp: Date.now() }] 
      }))
      return
    }

    set({ isLoading: true, error: null })
    try {
      const { error } = await supabase
        .from('workouts')
        .update({ is_archived: true })
        .eq('id', id)

      if (error) throw error
    } catch (err: any) {
      set({ error: err.message, workouts: currentWorkouts }) // Revert
    } finally {
      set({ isLoading: false })
    }
  },

  unarchiveWorkout: async (id) => {
    if (!navigator.onLine) {
      set(state => ({ 
        syncQueue: [...state.syncQueue, { id, action: 'unarchive', timestamp: Date.now() }] 
      }))
      return
    }
    
    set({ isLoading: true, error: null })
    try {
      const { error } = await supabase
        .from('workouts')
        .update({ is_archived: false })
        .eq('id', id)

      if (error) throw error
      // Re-fetch to get stats and order right
      await get().fetchWorkouts()
    } catch (err: any) {
      set({ error: err.message })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchWorkoutItems: async (workoutId) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('workout_items')
        .select('*')
        .eq('workout_id', workoutId)
        .order('order_index')

      if (error) throw error
      set({ activeWorkoutItems: data })
    } catch (err: any) {
      set({ error: err.message })
    } finally {
      set({ isLoading: false })
    }
  },

  addWorkoutItem: async (workoutId, title, orderIndex, defaultReps, defaultSets, restSeconds, notes, videoUrl) => {
    set({ isLoading: true, error: null })
    try {
      const user = useAuthStore.getState().user
      if (!user) throw new Error('User not authenticated')

      const trimmedVideoUrl = videoUrl?.trim()
      const insertData: Database['public']['Tables']['workout_items']['Insert'] = {
        workout_id: workoutId,
        user_id: user.id,
        title,
        order_index: orderIndex,
        default_reps: defaultReps,
        default_sets: defaultSets,
        rest_seconds: restSeconds,
        notes: notes,
        ...(trimmedVideoUrl ? { video_url: trimmedVideoUrl } : {})
      }

      const { data, error } = await supabase
        .from('workout_items')
        .insert(insertData)
        .select()
        .single()

      if (error) throw error
      const currentItems = get().activeWorkoutItems
      set({ activeWorkoutItems: [...currentItems, data] })
    } catch (err: any) {
      set({ error: err.message })
    } finally {
      set({ isLoading: false })
    }
  },

  updateWorkoutItem: async (itemId, updates) => {
    // Optimistic
    const currentItems = get().activeWorkoutItems
    set({ 
      activeWorkoutItems: currentItems.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      ) 
    })

    try {
      const trimmedVideoUrl = updates.video_url?.trim()
      const updateData = { ...updates }
      if (trimmedVideoUrl) {
        updateData.video_url = trimmedVideoUrl
      } else {
        delete updateData.video_url
      }

      const { error } = await supabase
        .from('workout_items')
        .update(updateData)
        .eq('id', itemId)

      if (error) throw error
    } catch (err: any) {
      set({ error: err.message, activeWorkoutItems: currentItems }) // Revert
    }
  },

  deleteWorkoutItem: async (itemId) => {
     // Optimistic
     const currentItems = get().activeWorkoutItems
     set({ activeWorkoutItems: currentItems.filter(i => i.id !== itemId) })

     try {
       const { error } = await supabase
         .from('workout_items')
         .delete()
         .eq('id', itemId)
       
       if (error) throw error
     } catch (err: any) {
       set({ error: err.message })
       // Revert
       set({ activeWorkoutItems: currentItems })
     }
    }
  }),
  {
    name: 'only-training-workouts',
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({ 
      workouts: state.workouts, 
      archivedCount: state.archivedCount,
      syncQueue: state.syncQueue 
    }),
  })
)
