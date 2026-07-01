import { create } from 'zustand'
import { getErrorMessage } from "../lib/utils"
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Database } from '../types/database.types'
import { useAuthStore } from './useAuthStore'
import {
  calculateDurationSeconds,
  createRequestCache,
  isSameCalendarDay,
  type SessionSyncAction,
  sortSyncQueueByTimestamp,
  upsertSyncQueueAction
} from '../core'
import { localStorageGateway } from '../lib/storageGateway'
import { supabaseSessionGateway } from '../gateways/supabaseSessionGateway'
import { STORE_KEYS, SessionStartResult } from '../constants/store'
import { useHistoryStore } from './useHistoryStore'
import { useWorkoutStore } from './useWorkoutStore'

// A finished session changes both the workout history and per-workout stats
// (completed_count / last session), so invalidate those caches to force a
// fresh load on the next visit instead of serving stale aggregates.
const invalidateDerivedCaches = () => {
  useHistoryStore.getState().invalidateHistory()
  useWorkoutStore.getState().invalidateWorkouts()
}

// Home e WorkoutSession chamam resumeSession a cada mount; sem isso, toda
// navegação entre telas re-busca as sessões in-progress.
const RESUME_CACHE_TTL_MS = 30_000
const resumeCache = createRequestCache(RESUME_CACHE_TTL_MS)

type Session = Database['public']['Tables']['workout_sessions']['Row']
type SessionItem = Database['public']['Tables']['session_items']['Row']

interface SessionState {
  currentSession: Session | null
  sessionItems: SessionItem[]
  isLoading: boolean
  error: string | null
  duration: number
  intervalId: number | null
  hasNotifiedLongWorkout: boolean
  syncQueue: SessionSyncAction[]

  startSession: (workoutId: string) => Promise<typeof SessionStartResult[keyof typeof SessionStartResult]>
  finishSession: (rpe?: number | null) => Promise<void>
  toggleItemDone: (itemId: string, isDone: boolean) => Promise<void>
  updateItemStats: (itemId: string, weight: number, reps: string) => Promise<void>
  updateCardioStats: (itemId: string, durationMinutes: number | null, distanceKm: number | null) => Promise<void>
  addExtraSessionItem: (title: string, sets?: number, reps?: string) => Promise<void>
  incrementDuration: () => void
  resumeSession: () => Promise<void>
  cancelSession: (clearAll?: boolean) => Promise<void>
  finishAllInProgressSessions: () => Promise<void>
  restartSession: (workoutId: string) => Promise<void>
  setHasNotifiedLongWorkout: (value: boolean) => void
  processSyncQueue: () => Promise<void>
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => {
      const queueSessionSyncAction = (nextAction: SessionSyncAction) => {
        set((state) => ({
          syncQueue: upsertSyncQueueAction(
            state.syncQueue,
            nextAction,
            (existing, incoming) => existing.action === incoming.action && existing.id === incoming.id
          )
        }))
      }

      const stopTimer = () => {
        const { intervalId } = get()
        if (intervalId) clearInterval(intervalId)
        set({ intervalId: null })
      }

      const startTimer = () => {
        stopTimer()
        const tick = () => get().incrementDuration()
        tick()
        const interval = setInterval(tick, 1000)
        set({ intervalId: Number(interval) })
      }

      return ({
      currentSession: null,
      sessionItems: [],
      isLoading: false,
      error: null,
      duration: 0,
      intervalId: null,
      hasNotifiedLongWorkout: false,
      syncQueue: [],

      processSyncQueue: async () => {
        if (!navigator.onLine || get().syncQueue.length === 0) return
        const user = useAuthStore.getState().user
        if (!user) return

        const queue = sortSyncQueueByTimestamp(get().syncQueue)
        set({ syncQueue: [] })

        for (const item of queue) {
          try {
            if (item.action === 'toggle_done') {
              await supabaseSessionGateway.updateSessionItemDone(
                user.id,
                item.id,
                item.payload.isDone,
                item.payload.doneAt
              )
            }

            if (item.action === 'update_stats') {
              await supabaseSessionGateway.updateSessionItemStats(
                user.id,
                item.id,
                item.payload.weight,
                item.payload.reps
              )
            }

            if (item.action === 'update_cardio_stats') {
              await supabaseSessionGateway.updateSessionItemCardioStats(
                user.id,
                item.id,
                item.payload.durationMinutes,
                item.payload.distanceKm
              )
            }

            if (item.action === 'finish_session') {
              await supabaseSessionGateway.setSessionFinished(
                user.id,
                item.id,
                item.payload.endedAt,
                item.payload.duration,
                item.payload.rpe
              )

              if (item.payload.defaultWeights && item.payload.defaultWeights.length > 0) {
                for (const entry of item.payload.defaultWeights) {
                  if (!entry.workout_item_id || entry.weight == null) continue
                  await supabaseSessionGateway.updateWorkoutItemDefaultWeight(
                    user.id,
                    entry.workout_item_id,
                    entry.weight
                  )
                }
              }

              invalidateDerivedCaches()
            }
          } catch (err) {
            console.error('Failed to sync session item:', item, err)
            queueSessionSyncAction(item)
          }
        }
      },

      resumeSession: async () => {
        const user = useAuthStore.getState().user
        if (!user) {
          stopTimer()
          set({ currentSession: null, sessionItems: [], duration: 0, isLoading: false, hasNotifiedLongWorkout: false })
          return
        }
        
        if (get().isLoading) return
        return resumeCache.run(user.id, false, async () => {
        try {
          set({ isLoading: true, error: null })

          const sessions = await supabaseSessionGateway.fetchInProgressSessions(user.id)

          const session = sessions?.[0] || null

          if (session) {
            stopTimer()
            // Fetch items
            const items = await supabaseSessionGateway.fetchSessionItems(session.id)

            const now = new Date()
            const start = new Date(session.started_at)
            
            const isSameDay = isSameCalendarDay(now, start)

            if (!isSameDay) {
              console.log('Session expired (started on previous day), auto-finalizing...')
              const endedAt = new Date(start.setHours(23, 59, 59, 999)).toISOString()
              const duration = Math.max(0, Math.floor((new Date(start.setHours(23,59,59,999)).getTime() - start.getTime()) / 1000))
              await supabaseSessionGateway.setSessionFinished(user.id, session.id, endedAt, duration)
              
              set({ currentSession: null, sessionItems: [], duration: 0, hasNotifiedLongWorkout: false })
              return
            }

            const diffSeconds = calculateDurationSeconds(now, start)

            set({ 
              currentSession: session, 
              sessionItems: items || [],
              duration: diffSeconds,
              hasNotifiedLongWorkout: diffSeconds >= 3600 // If resuming after 1h, consider it "already notified"
            })
            
            // Start timer
            startTimer()
          } else {
            // No active session in DB, clear any local stale data
            stopTimer()
            set({ currentSession: null, sessionItems: [], duration: 0, hasNotifiedLongWorkout: false })
          }
        } catch (err: unknown) {
          console.error("Failed to resume session", err)
        } finally {
          set({ isLoading: false })
        }
        })
      },

      startSession: async (workoutId) => {
        if (get().isLoading || get().currentSession) return SessionStartResult.Error
        set({ isLoading: true, error: null })
        try {
          const user = useAuthStore.getState().user
          if (!user) throw new Error('User not authenticated')

          const workout = await supabaseSessionGateway.fetchWorkoutById(user.id, workoutId)
          
          if (!workout) throw new Error('Workout not found')

          const workoutItems = await supabaseSessionGateway.fetchWorkoutItems(user.id, workout.id)

          if (!workoutItems || workoutItems.length === 0) {
            set({ isLoading: false })
            return SessionStartResult.NoItems
          }

          const session = await supabaseSessionGateway.createSession({
            user_id: user.id,
            workout_id: workout.id,
            workout_name_snapshot: workout.name,
            workout_focus_snapshot: workout.focus,
            status: 'in_progress',
            started_at: new Date().toISOString()
          })

          const sessionItemsData = workoutItems.map(item => ({
            user_id: user.id,
            session_id: session.id,
            workout_item_id: item.id,
            title_snapshot: item.title,
            notes_snapshot: item.notes,
            video_url: item.video_url,
            order_index: item.order_index,
            weight: item.default_weight,
            reps: item.default_reps,
            sets: item.default_sets,
            rest_seconds: item.rest_seconds,
            item_type: item.item_type,
            duration_minutes: item.duration_minutes,
            is_done: false
          }))

          await supabaseSessionGateway.createSessionItems(sessionItemsData)

          // Fetch created items back
          const createdItems = await supabaseSessionGateway.fetchSessionItems(session.id)

          set({ sessionItems: createdItems || [] })

          set({ currentSession: session, duration: 0 })

          startTimer()

          return SessionStartResult.Started
        } catch (err: unknown) {
          set({ error: getErrorMessage(err), isLoading: false })
          return SessionStartResult.Error
        } finally {
          set({ isLoading: false })
        }
      },

      incrementDuration: () => {
        const { currentSession, finishSession } = get()
        if (!currentSession) return

        const now = new Date()
        const start = new Date(currentSession.started_at)
        
        const isSameDay = isSameCalendarDay(now, start)
        
        if (!isSameDay) {
          console.log('Day changed, auto-finalizing session...')
          finishSession()
          return
        }

        const diffSeconds = calculateDurationSeconds(now, start)
        set(state => (state.duration === diffSeconds ? {} : { duration: diffSeconds }))
      },

      toggleItemDone: async (itemId, isDone) => {
        const user = useAuthStore.getState().user
        if (!user) return
        const items = get().sessionItems.map(i => 
          i.id === itemId ? { ...i, is_done: isDone } : i
        )
        set({ sessionItems: items })

        if (!navigator.onLine) {
          queueSessionSyncAction({
            id: itemId,
            action: 'toggle_done',
            payload: { isDone, doneAt: isDone ? new Date().toISOString() : null },
            timestamp: Date.now()
          })
          return
        }

        try {
          await supabaseSessionGateway.updateSessionItemDone(
            user.id,
            itemId,
            isDone,
            isDone ? new Date().toISOString() : null
          )
        } catch (err) {
          console.error(err)
          queueSessionSyncAction({
            id: itemId,
            action: 'toggle_done',
            payload: { isDone, doneAt: isDone ? new Date().toISOString() : null },
            timestamp: Date.now()
          })
        }
      },

      updateItemStats: async (itemId, weight, reps) => {
        const user = useAuthStore.getState().user
        if (!user) return
         const items = get().sessionItems.map(i => 
          i.id === itemId ? { ...i, weight, reps } : i
        )
        set({ sessionItems: items })

        if (!navigator.onLine) {
          queueSessionSyncAction({
            id: itemId,
            action: 'update_stats',
            payload: { weight, reps },
            timestamp: Date.now()
          })
          return
        }

        try {
          await supabaseSessionGateway.updateSessionItemStats(user.id, itemId, weight, reps)
        } catch (err) {
          console.error(err)
          queueSessionSyncAction({
            id: itemId,
            action: 'update_stats',
            payload: { weight, reps },
            timestamp: Date.now()
          })
        }
      },

      // Espelha updateItemStats: minutos/km reais do cardio, com fila offline.
      updateCardioStats: async (itemId, durationMinutes, distanceKm) => {
        const user = useAuthStore.getState().user
        if (!user) return
        const items = get().sessionItems.map(i =>
          i.id === itemId ? { ...i, duration_minutes: durationMinutes, distance_km: distanceKm } : i
        )
        set({ sessionItems: items })

        if (!navigator.onLine) {
          queueSessionSyncAction({
            id: itemId,
            action: 'update_cardio_stats',
            payload: { durationMinutes, distanceKm },
            timestamp: Date.now()
          })
          return
        }

        try {
          await supabaseSessionGateway.updateSessionItemCardioStats(user.id, itemId, durationMinutes, distanceKm)
        } catch (err) {
          console.error(err)
          queueSessionSyncAction({
            id: itemId,
            action: 'update_cardio_stats',
            payload: { durationMinutes, distanceKm },
            timestamp: Date.now()
          })
        }
      },

      // Exercício feito fora da ficha, registrado direto na sessão (sem workout_item_id).
      addExtraSessionItem: async (title, sets, reps) => {
        const { currentSession, sessionItems } = get()
        const user = useAuthStore.getState().user
        if (!currentSession || !user) return

        const orderIndex = sessionItems.length
          ? Math.max(...sessionItems.map(i => i.order_index)) + 1
          : 0

        try {
          await supabaseSessionGateway.createSessionItems([{
            session_id: currentSession.id,
            user_id: user.id,
            workout_item_id: null,
            title_snapshot: title,
            order_index: orderIndex,
            sets: sets ?? null,
            reps: reps ?? null,
            is_done: true,
            done_at: new Date().toISOString(),
          }])
          const items = await supabaseSessionGateway.fetchSessionItems(currentSession.id)
          set({ sessionItems: items })
        } catch (err) {
          set({ error: getErrorMessage(err) })
        }
      },

      finishSession: async (rpe: number | null = null) => {
        const { currentSession, duration, intervalId } = get()
        if (!currentSession) return
        const user = useAuthStore.getState().user
        if (!user) return

        set({ isLoading: true })
        if (intervalId) stopTimer()

        const endAt = new Date().toISOString()
        const defaultWeights = get().sessionItems
          .filter(item => item.workout_item_id && item.weight != null)
          .map(item => ({
            workout_item_id: item.workout_item_id,
            weight: item.weight
          }))

        if (!navigator.onLine) {
          queueSessionSyncAction({
            id: currentSession.id,
            action: 'finish_session',
            payload: { endedAt: endAt, duration, rpe, defaultWeights },
            timestamp: Date.now()
          })
          set({
            currentSession: null,
            sessionItems: [],
            isLoading: false
          })
          return
        }

        try {
          await supabaseSessionGateway.setSessionFinished(user.id, currentSession.id, endAt, duration, rpe)

          const { sessionItems } = get()
          for (const item of sessionItems) {
              if (item.workout_item_id && item.weight) {
               await supabaseSessionGateway.updateWorkoutItemDefaultWeight(user.id, item.workout_item_id, item.weight)
            }
          }
          
          invalidateDerivedCaches()
          set({ currentSession: null, sessionItems: [] })
        } catch (err: unknown) {
          set({ error: getErrorMessage(err) })
        } finally {
          set({ isLoading: false })
        }
      },

      restartSession: async (workoutId) => {
        const user = useAuthStore.getState().user
        if (!user) return

        set({ isLoading: true, error: null })
        stopTimer()

        try {
          // 1. Delete existing in-progress sessions (cancel, not finish — must not count as done)
          const oldIds = await supabaseSessionGateway.fetchInProgressSessionIds(user.id)
          if (oldIds.length > 0) {
            await supabaseSessionGateway.deleteSessionItemsBySessionIds(user.id, oldIds)
            await supabaseSessionGateway.deleteSessionsByIds(user.id, oldIds)
          }

          // 2. Clear local state
          set({ currentSession: null, sessionItems: [], duration: 0 })

          // 3. Start new one
          const workout = await supabaseSessionGateway.fetchWorkoutById(user.id, workoutId)
          
          if (!workout) throw new Error('Workout not found')

          const session = await supabaseSessionGateway.createSession({
            user_id: user.id,
            workout_id: workout.id,
            workout_name_snapshot: workout.name,
            workout_focus_snapshot: workout.focus,
            status: 'in_progress',
            started_at: new Date().toISOString()
          })

          const workoutItems = await supabaseSessionGateway.fetchWorkoutItems(user.id, workout.id)

          if (workoutItems && workoutItems.length > 0) {
            const sessionItemsData = workoutItems.map(item => ({
              user_id: user.id,
              session_id: session.id,
              workout_item_id: item.id,
              title_snapshot: item.title,
              notes_snapshot: item.notes,
              video_url: item.video_url,
              order_index: item.order_index,
              weight: item.default_weight,
              reps: item.default_reps,
              sets: item.default_sets,
              rest_seconds: item.rest_seconds,
              is_done: false
            }))

            await supabaseSessionGateway.createSessionItems(sessionItemsData)
            const createdItems = await supabaseSessionGateway.fetchSessionItems(session.id)

            set({ sessionItems: createdItems || [] })
          }

          set({ currentSession: session, duration: 0 })

          startTimer()

        } catch (err: unknown) {
          console.error('[Store] restartSession failed:', err)
          set({ error: getErrorMessage(err, 'Failed to restart session') })
        } finally {
          set({ isLoading: false })
        }
      },

      finishAllInProgressSessions: async () => {
        const user = useAuthStore.getState().user
        if (!user) return

        set({ isLoading: true, error: null })
        stopTimer()

        try {
          // Update all 'in_progress' sessions for this user to 'finished'
          // We set ended_at to now. Duration will be whatever was recorded or 0.
          await supabaseSessionGateway.finishAllInProgressSessions(user.id, new Date().toISOString())

          invalidateDerivedCaches()
          set({ currentSession: null, sessionItems: [], duration: 0 })
        } catch (err: unknown) {
          console.error('[Store] finishAllInProgressSessions failed:', err)
          set({ error: getErrorMessage(err, 'Failed to finish sessions') })
        } finally {
          set({ isLoading: false })
        }
      },

      cancelSession: async (clearAll = false) => {
        const user = useAuthStore.getState().user
        if (!user) return

        const { currentSession, intervalId } = get()
        if (!currentSession && !clearAll) return

        set({ isLoading: true, error: null })
        if (intervalId) stopTimer()

        try {
          if (clearAll) {
            // Delete all in-progress sessions and their items for this user
            // We fetch IDs first because we might need to delete session_items manually if cascade is not set
            const sessionIds = await supabaseSessionGateway.fetchInProgressSessionIds(user.id)
            if (sessionIds.length > 0) {
                await supabaseSessionGateway.deleteSessionItemsBySessionIds(user.id, sessionIds)
                await supabaseSessionGateway.deleteSessionsByIds(user.id, sessionIds)
            }
          } else if (currentSession) {
            // Delete items first to avoid FK issues if cascade is not set
            await supabaseSessionGateway.deleteSessionItemsBySessionId(user.id, currentSession.id)
            await supabaseSessionGateway.deleteSessionById(user.id, currentSession.id)
          }
          
          set({ currentSession: null, sessionItems: [] })
        } catch (err: unknown) {
          console.error('[Store] cancelSession failed:', err)
          set({ error: getErrorMessage(err, 'Failed to cancel session') })
        } finally {
          set({ isLoading: false })
        }
      },

      setHasNotifiedLongWorkout: (value: boolean) => {
        set({ hasNotifiedLongWorkout: value })
      }
    })
    },
    {
      name: STORE_KEYS.session,
      storage: createJSONStorage(() => localStorageGateway),
      partialize: (state) => ({ 
        currentSession: state.currentSession, 
        sessionItems: state.sessionItems,
        duration: state.duration,
        hasNotifiedLongWorkout: state.hasNotifiedLongWorkout,
        syncQueue: state.syncQueue
      }),
    }
  )
)
