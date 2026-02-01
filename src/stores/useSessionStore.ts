import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'
import { useAuthStore } from './useAuthStore'

type Session = Database['public']['Tables']['workout_sessions']['Row']
type SessionItem = Database['public']['Tables']['session_items']['Row']

interface SessionSyncAction {
  id: string
  action: 'toggle_done' | 'update_stats' | 'finish_session'
  payload?: any
  timestamp: number
}

interface SessionState {
  currentSession: Session | null
  sessionItems: SessionItem[]
  isLoading: boolean
  error: string | null
  duration: number
  intervalId: number | null
  hasNotifiedLongWorkout: boolean
  syncQueue: SessionSyncAction[]
  
  startSession: (workoutId: string) => Promise<'started' | 'no_items' | 'error'>
  finishSession: () => Promise<void>
  toggleItemDone: (itemId: string, isDone: boolean) => Promise<void>
  updateItemStats: (itemId: string, weight: number, reps: number) => Promise<void>
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

        const queue = [...get().syncQueue].sort((a, b) => a.timestamp - b.timestamp)
        set({ syncQueue: [] })

        for (const item of queue) {
          try {
            if (item.action === 'toggle_done') {
              await supabase
                .from('session_items')
                .update({ is_done: item.payload.isDone, done_at: item.payload.doneAt })
                .eq('id', item.id)
            }

            if (item.action === 'update_stats') {
              await supabase
                .from('session_items')
                .update({ weight: item.payload.weight, reps: item.payload.reps })
                .eq('id', item.id)
            }

            if (item.action === 'finish_session') {
              await supabase
                .from('workout_sessions')
                .update({
                  status: 'finished',
                  ended_at: item.payload.endedAt,
                  duration_seconds: item.payload.duration
                })
                .eq('id', item.id)

              if (item.payload.defaultWeights && item.payload.defaultWeights.length > 0) {
                for (const entry of item.payload.defaultWeights) {
                  if (!entry.workout_item_id || entry.weight == null) continue
                  await supabase
                    .from('workout_items')
                    .update({ default_weight: entry.weight })
                    .eq('id', entry.workout_item_id)
                }
              }
            }
          } catch (err) {
            console.error('Failed to sync session item:', item, err)
            set(state => ({ syncQueue: [...state.syncQueue, item] }))
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
        try {
          set({ isLoading: true, error: null })

          const { data: sessions, error } = await supabase
            .from('workout_sessions')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'in_progress')
            .order('started_at', { ascending: false })

          if (error) {
            console.error("Failed to sync session", error)
            return
          }

          const session = sessions?.[0] || null

          if (session) {
            stopTimer()
            // Fetch items
            const { data: items } = await supabase
              .from('session_items')
              .select('*')
              .eq('session_id', session.id)
              .order('order_index')

            const now = new Date()
            const start = new Date(session.started_at)
            
            // Check if session started on a previous day
            const isSameDay = now.getFullYear() === start.getFullYear() && 
                              now.getMonth() === start.getMonth() && 
                              now.getDate() === start.getDate()

            if (!isSameDay) {
              console.log('Session expired (started on previous day), auto-finalizing...')
              await supabase
                .from('workout_sessions')
                .update({ 
                   status: 'finished', 
                   ended_at: new Date(start.setHours(23, 59, 59, 999)).toISOString(),
                   duration_seconds: Math.max(0, Math.floor((new Date(start.setHours(23,59,59,999)).getTime() - start.getTime()) / 1000))
                })
                .eq('id', session.id)
              
              set({ currentSession: null, sessionItems: [], duration: 0, hasNotifiedLongWorkout: false })
              return
            }

            const diffSeconds = Math.floor((now.getTime() - start.getTime()) / 1000)

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
        } catch (err: any) {
          console.error("Failed to resume session", err)
        } finally {
          set({ isLoading: false })
        }
      },

      startSession: async (workoutId) => {
        if (get().isLoading || get().currentSession) return 'error'
        set({ isLoading: true, error: null })
        try {
          const user = useAuthStore.getState().user
          if (!user) throw new Error('User not authenticated')

          const { data: workout } = await supabase
            .from('workouts')
            .select('*')
            .eq('id', workoutId)
            .maybeSingle()
          
          if (!workout) throw new Error('Workout not found')

          const { data: workoutItems } = await supabase
            .from('workout_items')
            .select('*')
            .eq('workout_id', workout.id)
            .order('order_index')

          if (!workoutItems || workoutItems.length === 0) {
            set({ isLoading: false })
            return 'no_items'
          }

          const { data: session, error: sessionError } = await supabase
            .from('workout_sessions')
            .insert({
              user_id: user.id,
              workout_id: workout.id,
              workout_name_snapshot: workout.name,
              workout_focus_snapshot: workout.focus,
              status: 'in_progress',
              started_at: new Date().toISOString()
            })
            .select()
            .single()

          if (sessionError) throw sessionError

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
            is_done: false
          }))

          const { error: itemsError } = await supabase
            .from('session_items')
            .insert(sessionItemsData)
          
          if (itemsError) throw itemsError

          // Fetch created items back
          const { data: createdItems } = await supabase
            .from('session_items')
            .select('*')
            .eq('session_id', session.id)
            .order('order_index')

          set({ sessionItems: createdItems || [] })

          set({ currentSession: session, duration: 0 })

          startTimer()

          return 'started'
        } catch (err: any) {
          set({ error: err.message })
          return 'error'
        } finally {
          set({ isLoading: false })
        }
      },

      incrementDuration: () => {
        const { currentSession, finishSession } = get()
        if (!currentSession) return

        const now = new Date()
        const start = new Date(currentSession.started_at)
        
        const isSameDay = now.getFullYear() === start.getFullYear() && 
                          now.getMonth() === start.getMonth() && 
                          now.getDate() === start.getDate()
        
        if (!isSameDay) {
          console.log('Day changed, auto-finalizing session...')
          finishSession()
          return
        }

        const diffSeconds = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000))
        set(state => (state.duration === diffSeconds ? {} : { duration: diffSeconds }))
      },

      toggleItemDone: async (itemId, isDone) => {
        const items = get().sessionItems.map(i => 
          i.id === itemId ? { ...i, is_done: isDone } : i
        )
        set({ sessionItems: items })

        if (!navigator.onLine) {
          set(state => ({
            syncQueue: [
              ...state.syncQueue.filter(
                item => !(item.action === 'toggle_done' && item.id === itemId)
              ),
              {
                id: itemId,
                action: 'toggle_done',
                payload: { isDone, doneAt: isDone ? new Date().toISOString() : null },
                timestamp: Date.now()
              }
            ]
          }))
          return
        }

        try {
          await supabase
            .from('session_items')
            .update({ is_done: isDone, done_at: isDone ? new Date().toISOString() : null })
            .eq('id', itemId)
        } catch (err) {
          console.error(err)
          set(state => ({
            syncQueue: [
              ...state.syncQueue.filter(
                item => !(item.action === 'toggle_done' && item.id === itemId)
              ),
              {
                id: itemId,
                action: 'toggle_done',
                payload: { isDone, doneAt: isDone ? new Date().toISOString() : null },
                timestamp: Date.now()
              }
            ]
          }))
        }
      },

      updateItemStats: async (itemId, weight, reps) => {
         const items = get().sessionItems.map(i => 
          i.id === itemId ? { ...i, weight, reps } : i
        )
        set({ sessionItems: items })

        if (!navigator.onLine) {
          set(state => ({
            syncQueue: [
              ...state.syncQueue.filter(
                item => !(item.action === 'update_stats' && item.id === itemId)
              ),
              {
                id: itemId,
                action: 'update_stats',
                payload: { weight, reps },
                timestamp: Date.now()
              }
            ]
          }))
          return
        }

        try {
          await supabase
            .from('session_items')
            .update({ weight, reps })
            .eq('id', itemId)
        } catch (err) {
          console.error(err)
          set(state => ({
            syncQueue: [
              ...state.syncQueue.filter(
                item => !(item.action === 'update_stats' && item.id === itemId)
              ),
              {
                id: itemId,
                action: 'update_stats',
                payload: { weight, reps },
                timestamp: Date.now()
              }
            ]
          }))
        }
      },

      finishSession: async () => {
        const { currentSession, duration, intervalId } = get()
        if (!currentSession) return

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
          set(state => ({
            syncQueue: [
              ...state.syncQueue.filter(
                item => !(item.action === 'finish_session' && item.id === currentSession.id)
              ),
              {
                id: currentSession.id,
                action: 'finish_session',
                payload: { endedAt: endAt, duration, defaultWeights },
                timestamp: Date.now()
              }
            ],
            currentSession: null,
            sessionItems: [],
            isLoading: false
          }))
          return
        }

        try {
          await supabase
            .from('workout_sessions')
            .update({ 
              status: 'finished', 
              ended_at: endAt,
              duration_seconds: duration
            })
            .eq('id', currentSession.id)

          const { sessionItems } = get()
          for (const item of sessionItems) {
            if (item.workout_item_id && item.weight) {
               await supabase
                 .from('workout_items')
                 .update({ default_weight: item.weight })
                 .eq('id', item.workout_item_id)
            }
          }
          
          set({ currentSession: null, sessionItems: [] })
        } catch (err: any) {
          set({ error: err.message })
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
          // 1. Finish existing
          await supabase
            .from('workout_sessions')
            .update({ 
               status: 'finished', 
               ended_at: new Date().toISOString() 
            })
            .eq('user_id', user.id)
            .eq('status', 'in_progress')

          // 2. Clear local state
          set({ currentSession: null, sessionItems: [], duration: 0 })

          // 3. Start new one
          const { data: workout } = await supabase
            .from('workouts')
            .select('*')
            .eq('id', workoutId)
            .single()
          
          if (!workout) throw new Error('Workout not found')

          const { data: session, error: sessionError } = await supabase
            .from('workout_sessions')
            .insert({
              user_id: user.id,
              workout_id: workout.id,
              workout_name_snapshot: workout.name,
              workout_focus_snapshot: workout.focus,
              status: 'in_progress',
              started_at: new Date().toISOString()
            })
            .select()
            .single()

          if (sessionError) throw sessionError

          const { data: workoutItems } = await supabase
            .from('workout_items')
            .select('*')
            .eq('workout_id', workout.id)
            .order('order_index')

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
              is_done: false
            }))

            await supabase
              .from('session_items')
              .insert(sessionItemsData)

            const { data: createdItems } = await supabase
              .from('session_items')
              .select('*')
              .eq('session_id', session.id)
              .order('order_index')

            set({ sessionItems: createdItems || [] })
          }

          set({ currentSession: session, duration: 0 })

          startTimer()

        } catch (err: any) {
          console.error('[Store] restartSession failed:', err)
          set({ error: err.message || 'Failed to restart session' })
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
          const { error } = await supabase
            .from('workout_sessions')
            .update({ 
              status: 'finished', 
              ended_at: new Date().toISOString() 
            })
            .eq('user_id', user.id)
            .eq('status', 'in_progress')
          
          if (error) throw error
          
          set({ currentSession: null, sessionItems: [], duration: 0 })
        } catch (err: any) {
          console.error('[Store] finishAllInProgressSessions failed:', err)
          set({ error: err.message || 'Failed to finish sessions' })
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
            const { data: activeSessions } = await supabase
              .from('workout_sessions')
              .select('id')
              .eq('user_id', user.id)
              .eq('status', 'in_progress')
            
            if (activeSessions && activeSessions.length > 0) {
                const sessionIds = activeSessions.map(s => s.id)
                
                await supabase
                  .from('session_items')
                  .delete()
                  .in('session_id', sessionIds)

                const { error: sessionError } = await supabase
                  .from('workout_sessions')
                  .delete()
                  .in('id', sessionIds)
                
                if (sessionError) throw sessionError
            }
          } else if (currentSession) {
            // Delete items first to avoid FK issues if cascade is not set
            const { error: itemsError } = await supabase
              .from('session_items')
              .delete()
              .eq('session_id', currentSession.id)
            
            if (itemsError) throw itemsError

            const { error: sessionError } = await supabase
              .from('workout_sessions')
              .delete()
              .eq('id', currentSession.id)
            
            if (sessionError) throw sessionError
          }
          
          set({ currentSession: null, sessionItems: [] })
        } catch (err: any) {
          console.error('[Store] cancelSession failed:', err)
          set({ error: err.message || 'Failed to cancel session' })
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
      name: 'only-training-session',
      storage: createJSONStorage(() => localStorage),
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
