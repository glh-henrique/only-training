import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { getSafeExternalUrl } from '../lib/utils'
import type { Database } from '../types/database.types'
import {
  createRequestCache,
  mergeWorkoutsWithSessionStats,
  sortSyncQueueByTimestamp,
  type WorkoutSyncAction,
  upsertSyncQueueAction
} from '../core'
import { localStorageGateway } from '../lib/storageGateway'
import { supabaseWorkoutGateway } from '../gateways/supabaseWorkoutGateway'

type Workout = Database['public']['Tables']['workouts']['Row']
type WorkoutItem = Database['public']['Tables']['workout_items']['Row']
type WorkoutInsert = Database['public']['Tables']['workouts']['Insert']
type WorkoutItemInsert = Database['public']['Tables']['workout_items']['Insert']

export interface SuggestedWorkoutItemInput {
  title: string
  default_sets?: number | null
  default_reps?: string | null
  rest_seconds?: number | null
  notes?: string | null
  video_url?: string | null
}

export interface SuggestedWorkoutInput {
  name: string
  focus?: string | null
  notes?: string | null
  items: SuggestedWorkoutItemInput[]
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unexpected error'

// Dedupes concurrent fetches and skips refetching within this window, so
// navigating between tabs (Home/Workouts/...) doesn't re-hit the backend.
const WORKOUTS_CACHE_TTL_MS = 30_000
const workoutsCache = createRequestCache(WORKOUTS_CACHE_TTL_MS)

export interface WorkoutWithStats extends Workout {
  completed_count?: number
  last_completed_at?: string
  items_count?: number
}

interface WorkoutState {
  workouts: WorkoutWithStats[]
  archivedCount: number
  isLoading: boolean
  error: string | null
  lastSession: SessionWithWorkout | null
  fetchWorkouts: (ownerUserId?: string, force?: boolean) => Promise<void>
  invalidateWorkouts: () => void
  createWorkout: (name: string, focus: string, notes?: string, ownerUserId?: string) => Promise<string | null>
  applySuggestedWorkout: (
    sourceWorkoutId: string,
    suggestion: SuggestedWorkoutInput,
    ownerUserId?: string
  ) => Promise<string | null>
  deleteWorkout: (id: string, ownerUserId?: string) => Promise<void>
  archiveWorkout: (id: string, ownerUserId?: string) => Promise<void>
  unarchiveWorkout: (id: string, ownerUserId?: string) => Promise<void>
  // Item management
  activeWorkoutItems: WorkoutItem[]
  fetchWorkoutItems: (workoutId: string, ownerUserId?: string) => Promise<void>
  addWorkoutItem: (
    workoutId: string,
    title: string,
    orderIndex: number,
    defaultReps?: string,
    defaultSets?: number,
    restSeconds?: number,
    notes?: string,
    videoUrl?: string,
    ownerUserId?: string
  ) => Promise<void>
  updateWorkoutItem: (
    itemId: string,
    updates: { title?: string, default_reps?: string, default_sets?: number, rest_seconds?: number, notes?: string, video_url?: string },
    ownerUserId?: string
  ) => Promise<void>
  deleteWorkoutItem: (itemId: string, ownerUserId?: string) => Promise<void>
  // Sync
  syncQueue: WorkoutSyncAction[]
  processSyncQueue: () => Promise<void>
}

// Reuse type from history
import type { SessionWithWorkout } from './useHistoryStore'
import { useAuthStore } from './useAuthStore'

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => {
      const queueSyncAction = (nextAction: WorkoutSyncAction) => {
        set((state) => ({
          syncQueue: upsertSyncQueueAction(
            state.syncQueue,
            nextAction,
            (existing, incoming) => existing.action === incoming.action && existing.id === incoming.id
          )
        }))
      }

      return ({
      workouts: [],
      archivedCount: 0,
      lastSession: null,
      activeWorkoutItems: [],
      isLoading: false,
      error: null,
      syncQueue: [],

      processSyncQueue: async () => {
        if (!navigator.onLine || get().syncQueue.length === 0) return
        
        const queue = sortSyncQueueByTimestamp(get().syncQueue)
        set({ syncQueue: [] }) // Clear queue before processing to avoid loops

        for (const item of queue) {
          try {
            if (item.action === 'archive') await get().archiveWorkout(item.id)
            if (item.action === 'unarchive') await get().unarchiveWorkout(item.id)
            if (item.action === 'delete') await get().deleteWorkout(item.id)
          } catch (err) {
            console.error('Failed to sync item:', item, err)
            // Put it back in queue if not a 404 or similar permanent error
            queueSyncAction(item)
          }
        }
      },

      invalidateWorkouts: () => workoutsCache.reset(),

      fetchWorkouts: async (ownerUserId, force = false) => {
    const user = useAuthStore.getState().user
    if (!user) return
    const targetUserId = ownerUserId ?? user.id

    return workoutsCache.run(targetUserId, force, async () => {
    set({ isLoading: true, error: null })
    try {
      // 1. Fetch workouts
      const workoutsData = await supabaseWorkoutGateway.fetchActiveWorkouts(targetUserId)

      // 1.1 Fetch archived count
      const archivedCount = await supabaseWorkoutGateway.fetchArchivedCount(targetUserId)

      // 2. Fetch counts and last date of finished sessions
      const sessionsData = await supabaseWorkoutGateway.fetchFinishedSessions(targetUserId)

      // 2.1 Fetch exercise counts per workout
      const itemCounts = await supabaseWorkoutGateway.fetchItemCountsByWorkout(targetUserId)

      // 3. Merge stats
      const workoutsWithStats: WorkoutWithStats[] = mergeWorkoutsWithSessionStats(workoutsData, sessionsData)
        .map(w => ({ ...w, items_count: itemCounts[w.id] ?? 0 }))

      // 4. Set absolute last session
      const absoluteLast = sessionsData && sessionsData.length > 0 ? (sessionsData[0] as SessionWithWorkout) : null

      set({ 
        workouts: workoutsWithStats, 
        lastSession: absoluteLast,
        archivedCount: archivedCount || 0 
      })
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) })
    } finally {
      set({ isLoading: false })
    }
    })
  },

  createWorkout: async (name, focus, notes, ownerUserId) => {
    set({ isLoading: true, error: null })
    try {
      const user = useAuthStore.getState().user
      if (!user) throw new Error('User not authenticated')
      const targetUserId = ownerUserId ?? user.id

      const data = await supabaseWorkoutGateway.createWorkout({
          user_id: targetUserId,
          name,
          focus,
          notes,
        })
      const currentWorkouts = get().workouts
      set({ workouts: [data, ...currentWorkouts] })
      workoutsCache.reset()
      return data.id
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) })
      return null
    } finally {
      set({ isLoading: false })
    }
  },

  applySuggestedWorkout: async (sourceWorkoutId, suggestion, ownerUserId) => {
    set({ isLoading: true, error: null })
    let createdWorkoutId: string | null = null

    try {
      const user = useAuthStore.getState().user
      if (!user) throw new Error('User not authenticated')
      const targetUserId = ownerUserId ?? user.id

      const workoutPayload: WorkoutInsert = {
        user_id: targetUserId,
        name: suggestion.name.trim(),
        focus: suggestion.focus?.trim() || null,
        notes: suggestion.notes?.trim() || null,
      }

      const createdWorkout = await supabaseWorkoutGateway.createWorkout(workoutPayload)
      createdWorkoutId = createdWorkout.id

      const itemPayloads: WorkoutItemInsert[] = suggestion.items.map((item, index) => {
        const safeVideoUrl = getSafeExternalUrl(item.video_url)
        return {
          workout_id: createdWorkout.id,
          user_id: targetUserId,
          order_index: index,
          title: item.title.trim(),
          default_sets: item.default_sets ?? null,
          default_reps: item.default_reps?.trim() || null,
          rest_seconds: item.rest_seconds ?? null,
          notes: item.notes?.trim() || null,
          ...(safeVideoUrl ? { video_url: safeVideoUrl } : {})
        }
      })

      await supabaseWorkoutGateway.addWorkoutItemsBatch(itemPayloads)
      await supabaseWorkoutGateway.setWorkoutArchived(targetUserId, sourceWorkoutId, true)
      await get().fetchWorkouts(ownerUserId, true)

      return createdWorkout.id
    } catch (err: unknown) {
      if (createdWorkoutId) {
        try {
          const user = useAuthStore.getState().user
          const targetUserId = ownerUserId ?? user?.id
          if (targetUserId) {
            await supabaseWorkoutGateway.deleteWorkout(targetUserId, createdWorkoutId)
          }
        } catch (cleanupError) {
          console.error('Failed to rollback suggested workout creation', cleanupError)
        }
      }

      set({ error: getErrorMessage(err) })
      return null
    } finally {
      set({ isLoading: false })
    }
  },

  deleteWorkout: async (id, ownerUserId) => {
    const currentWorkouts = get().workouts
    set({ workouts: currentWorkouts.filter(w => w.id !== id) })
    workoutsCache.reset()

    if (!navigator.onLine) {
      queueSyncAction({ id, action: 'delete', timestamp: Date.now() })
      return
    }

    set({ isLoading: true, error: null })
    try {
      const user = useAuthStore.getState().user
      if (!user) throw new Error('User not authenticated')
      const targetUserId = ownerUserId ?? user.id
      await supabaseWorkoutGateway.deleteWorkout(targetUserId, id)
    } catch (err: unknown) {
      set({ error: getErrorMessage(err), workouts: currentWorkouts })
    } finally {
      set({ isLoading: false })
    }
  },

  archiveWorkout: async (id, ownerUserId) => {
    // Optimistic Update
    const currentWorkouts = get().workouts
    set({ workouts: currentWorkouts.filter(w => w.id !== id) })
    workoutsCache.reset()

    if (!navigator.onLine) {
      queueSyncAction({ id, action: 'archive', timestamp: Date.now() })
      return
    }

    set({ isLoading: true, error: null })
    try {
      const user = useAuthStore.getState().user
      if (!user) throw new Error('User not authenticated')
      const targetUserId = ownerUserId ?? user.id
      await supabaseWorkoutGateway.setWorkoutArchived(targetUserId, id, true)
    } catch (err: unknown) {
      set({ error: getErrorMessage(err), workouts: currentWorkouts }) // Revert
    } finally {
      set({ isLoading: false })
    }
  },

  unarchiveWorkout: async (id, ownerUserId) => {
    if (!navigator.onLine) {
      queueSyncAction({ id, action: 'unarchive', timestamp: Date.now() })
      return
    }
    
    set({ isLoading: true, error: null })
    try {
      const user = useAuthStore.getState().user
      if (!user) throw new Error('User not authenticated')
      const targetUserId = ownerUserId ?? user.id
      await supabaseWorkoutGateway.setWorkoutArchived(targetUserId, id, false)
      // Re-fetch to get stats and order right
      await get().fetchWorkouts(undefined, true)
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchWorkoutItems: async (workoutId, ownerUserId) => {
    set({ isLoading: true, error: null })
    try {
      const user = useAuthStore.getState().user
      if (!user) throw new Error('User not authenticated')
      const targetUserId = ownerUserId ?? user.id
      const data = await supabaseWorkoutGateway.fetchWorkoutItems(targetUserId, workoutId)
      set({ activeWorkoutItems: data })
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) })
    } finally {
      set({ isLoading: false })
    }
  },

  addWorkoutItem: async (workoutId, title, orderIndex, defaultReps, defaultSets, restSeconds, notes, videoUrl, ownerUserId) => {
    set({ isLoading: true, error: null })
    try {
      const user = useAuthStore.getState().user
      if (!user) throw new Error('User not authenticated')
      const targetUserId = ownerUserId ?? user.id

      const safeVideoUrl = getSafeExternalUrl(videoUrl)
      const insertData: Database['public']['Tables']['workout_items']['Insert'] = {
        workout_id: workoutId,
        user_id: targetUserId,
        title,
        order_index: orderIndex,
        default_reps: defaultReps,
        default_sets: defaultSets,
        rest_seconds: restSeconds,
        notes: notes,
        ...(safeVideoUrl ? { video_url: safeVideoUrl } : {})
      }

      const data = await supabaseWorkoutGateway.addWorkoutItem(insertData)
      const currentItems = get().activeWorkoutItems
      set({ activeWorkoutItems: [...currentItems, data] })
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) })
    } finally {
      set({ isLoading: false })
    }
  },

  updateWorkoutItem: async (itemId, updates, ownerUserId) => {
    // Optimistic
    const currentItems = get().activeWorkoutItems
    set({ 
      activeWorkoutItems: currentItems.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      ) 
    })

    try {
      const user = useAuthStore.getState().user
      if (!user) throw new Error('User not authenticated')
      const targetUserId = ownerUserId ?? user.id
      const safeVideoUrl = getSafeExternalUrl(updates.video_url)
      const updateData = { ...updates }
      if (safeVideoUrl) {
        updateData.video_url = safeVideoUrl
      } else {
        delete updateData.video_url
      }

      await supabaseWorkoutGateway.updateWorkoutItem(targetUserId, itemId, updateData)
    } catch (err: unknown) {
      set({ error: getErrorMessage(err), activeWorkoutItems: currentItems }) // Revert
    }
  },

  deleteWorkoutItem: async (itemId, ownerUserId) => {
     // Optimistic
     const currentItems = get().activeWorkoutItems
     set({ activeWorkoutItems: currentItems.filter(i => i.id !== itemId) })

     try {
       const user = useAuthStore.getState().user
       if (!user) throw new Error('User not authenticated')
       const targetUserId = ownerUserId ?? user.id
       await supabaseWorkoutGateway.deleteWorkoutItem(targetUserId, itemId)
     } catch (err: unknown) {
       set({ error: getErrorMessage(err) })
       // Revert
       set({ activeWorkoutItems: currentItems })
     }
    }
  })
  },
  {
    name: 'only-training-workouts',
    storage: createJSONStorage(() => localStorageGateway),
    partialize: (state) => ({ 
      workouts: state.workouts, 
      archivedCount: state.archivedCount,
      syncQueue: state.syncQueue 
    }),
  })
)
