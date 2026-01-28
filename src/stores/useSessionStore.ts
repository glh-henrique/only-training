import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'
import { useAuthStore } from './useAuthStore'

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
  
  startSession: (workoutId: string) => Promise<void>
  finishSession: () => Promise<void>
  toggleItemDone: (itemId: string, isDone: boolean) => Promise<void>
  updateItemStats: (itemId: string, weight: number, reps: number) => Promise<void>
  incrementDuration: () => void
  resumeSession: () => Promise<void>
  cancelSession: (clearAll?: boolean) => Promise<void>
  finishAllInProgressSessions: () => Promise<void>
  restartSession: (workoutId: string) => Promise<void>
  setHasNotifiedLongWorkout: (value: boolean) => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      currentSession: null,
      sessionItems: [],
      isLoading: false,
      error: null,
      duration: 0,
      intervalId: null,
      hasNotifiedLongWorkout: false,

      resumeSession: async () => {
        const user = useAuthStore.getState().user
        if (!user) {
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
              hasNotifiedLongWorkout: diffSeconds >= 3600 // If resuming after 1h, consider it "already notified" or handle in next increment
            })
            
            // Start timer
            const interval = setInterval(() => {
              get().incrementDuration()
            }, 1000)
            set({ intervalId: Number(interval) })
          } else {
            // No active session in DB, clear any local stale data
            set({ currentSession: null, sessionItems: [], duration: 0, hasNotifiedLongWorkout: false })
          }
        } catch (err: any) {
          console.error("Failed to resume session", err)
        } finally {
          set({ isLoading: false })
        }
      },

      startSession: async (workoutId) => {
        if (get().isLoading || get().currentSession) return
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
          }

          set({ currentSession: session, duration: 0 })

          if (get().intervalId) clearInterval(get().intervalId as number)
          const interval = setInterval(() => {
            get().incrementDuration()
          }, 1000)
          set({ intervalId: Number(interval) })

        } catch (err: any) {
          set({ error: err.message })
        } finally {
          set({ isLoading: false })
        }
      },

      incrementDuration: () => {
        const { currentSession, finishSession } = get()
        if (currentSession) {
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
        }
        set(state => ({ duration: state.duration + 1 }))
      },

      toggleItemDone: async (itemId, isDone) => {
        const items = get().sessionItems.map(i => 
          i.id === itemId ? { ...i, is_done: isDone } : i
        )
        set({ sessionItems: items })

        try {
          await supabase
            .from('session_items')
            .update({ is_done: isDone, done_at: isDone ? new Date().toISOString() : null })
            .eq('id', itemId)
        } catch (err) {
          console.error(err)
        }
      },

      updateItemStats: async (itemId, weight, reps) => {
         const items = get().sessionItems.map(i => 
          i.id === itemId ? { ...i, weight, reps } : i
        )
        set({ sessionItems: items })

        try {
          await supabase
            .from('session_items')
            .update({ weight, reps })
            .eq('id', itemId)
        } catch (err) {
          console.error(err)
        }
      },

      finishSession: async () => {
        const { currentSession, duration, intervalId } = get()
        if (!currentSession) return

        set({ isLoading: true })
        if (intervalId) clearInterval(intervalId)
        set({ intervalId: null })

        try {
          await supabase
            .from('workout_sessions')
            .update({ 
              status: 'finished', 
              ended_at: new Date().toISOString(),
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
        const { intervalId } = get()
        if (intervalId) clearInterval(intervalId)
        set({ intervalId: null })

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

          const newInterval = setInterval(() => {
            get().incrementDuration()
          }, 1000)
          set({ intervalId: Number(newInterval) })

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
        const { intervalId } = get()
        if (intervalId) clearInterval(intervalId)
        set({ intervalId: null })

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
        if (intervalId) clearInterval(intervalId)
        set({ intervalId: null })

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
    }),
    {
      name: 'only-training-session',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        currentSession: state.currentSession, 
        sessionItems: state.sessionItems,
        duration: state.duration
      }),
    }
  )
)
