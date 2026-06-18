import type { Database } from '../types/database.types'
import { supabase } from '../lib/supabase'

type Session = Database['public']['Tables']['workout_sessions']['Row']
type SessionInsert = Database['public']['Tables']['workout_sessions']['Insert']
type SessionItem = Database['public']['Tables']['session_items']['Row']
type SessionItemInsert = Database['public']['Tables']['session_items']['Insert']
type Workout = Database['public']['Tables']['workouts']['Row']
type WorkoutItem = Database['public']['Tables']['workout_items']['Row']

export const supabaseSessionGateway = {
  fetchInProgressSessions: async (userId: string): Promise<Session[]> => {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .order('started_at', { ascending: false })

    if (error) throw error
    return data ?? []
  },
  fetchSessionItems: async (sessionId: string): Promise<SessionItem[]> => {
    const { data, error } = await supabase
      .from('session_items')
      .select('*')
      .eq('session_id', sessionId)
      .order('order_index')

    if (error) throw error
    return data ?? []
  },
  setSessionFinished: async (userId: string, sessionId: string, endedAt: string, duration: number): Promise<void> => {
    const { error } = await supabase
      .from('workout_sessions')
      .update({
        status: 'finished',
        ended_at: endedAt,
        duration_seconds: duration
      })
      .eq('id', sessionId)
      .eq('user_id', userId)

    if (error) throw error
  },
  updateWorkoutItemDefaultWeight: async (userId: string, workoutItemId: string, weight: number): Promise<void> => {
    const { error } = await supabase
      .from('workout_items')
      .update({ default_weight: weight })
      .eq('id', workoutItemId)
      .eq('user_id', userId)

    if (error) throw error
  },
  updateSessionItemDone: async (userId: string, itemId: string, isDone: boolean, doneAt: string | null): Promise<void> => {
    const { error } = await supabase
      .from('session_items')
      .update({ is_done: isDone, done_at: doneAt })
      .eq('id', itemId)
      .eq('user_id', userId)

    if (error) throw error
  },
  updateSessionItemStats: async (userId: string, itemId: string, weight: number, reps: string): Promise<void> => {
    const { error } = await supabase
      .from('session_items')
      .update({ weight, reps })
      .eq('id', itemId)
      .eq('user_id', userId)

    if (error) throw error
  },
  fetchWorkoutById: async (userId: string, workoutId: string): Promise<Workout | null> => {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('id', workoutId)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    return data
  },
  fetchWorkoutItems: async (userId: string, workoutId: string): Promise<WorkoutItem[]> => {
    const { data, error } = await supabase
      .from('workout_items')
      .select('*')
      .eq('workout_id', workoutId)
      .eq('user_id', userId)
      .order('order_index')

    if (error) throw error
    return data ?? []
  },
  createSession: async (payload: SessionInsert): Promise<Session> => {
    const { data, error } = await supabase
      .from('workout_sessions')
      .insert(payload)
      .select()
      .single()

    if (error) throw error
    return data
  },
  createSessionItems: async (items: SessionItemInsert[]): Promise<void> => {
    const { error } = await supabase
      .from('session_items')
      .insert(items)

    if (error) throw error
  },
  finishAllInProgressSessions: async (userId: string, endedAt: string): Promise<void> => {
    const { error } = await supabase
      .from('workout_sessions')
      .update({
        status: 'finished',
        ended_at: endedAt
      })
      .eq('user_id', userId)
      .eq('status', 'in_progress')

    if (error) throw error
  },
  cancelAllInProgressSessions: async (userId: string): Promise<void> => {
    const { error } = await supabase
      .from('workout_sessions')
      .update({ status: 'cancelled' })
      .eq('user_id', userId)
      .eq('status', 'in_progress')

    if (error) throw error
  },
  fetchInProgressSessionIds: async (userId: string): Promise<string[]> => {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'in_progress')

    if (error) throw error
    return (data ?? []).map((s) => s.id)
  },
  deleteSessionItemsBySessionIds: async (userId: string, sessionIds: string[]): Promise<void> => {
    const { error } = await supabase
      .from('session_items')
      .delete()
      .in('session_id', sessionIds)
      .eq('user_id', userId)

    if (error) throw error
  },
  deleteSessionsByIds: async (userId: string, sessionIds: string[]): Promise<void> => {
    const { error } = await supabase
      .from('workout_sessions')
      .delete()
      .in('id', sessionIds)
      .eq('user_id', userId)

    if (error) throw error
  },
  deleteSessionItemsBySessionId: async (userId: string, sessionId: string): Promise<void> => {
    const { error } = await supabase
      .from('session_items')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', userId)

    if (error) throw error
  },
  deleteSessionById: async (userId: string, sessionId: string): Promise<void> => {
    const { error } = await supabase
      .from('workout_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', userId)

    if (error) throw error
  }
}
