import type { Database } from '../types/database.types'
import { supabase } from '../lib/supabase'

type Workout = Database['public']['Tables']['workouts']['Row']
type WorkoutItem = Database['public']['Tables']['workout_items']['Row']
type WorkoutInsert = Database['public']['Tables']['workouts']['Insert']
type WorkoutItemInsert = Database['public']['Tables']['workout_items']['Insert']
type WorkoutItemUpdate = Database['public']['Tables']['workout_items']['Update']
type Session = Database['public']['Tables']['workout_sessions']['Row']

export const supabaseWorkoutGateway = {
  fetchActiveWorkouts: async (userId: string): Promise<Workout[]> => {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },
  fetchArchivedCount: async (userId: string): Promise<number> => {
    const { count, error } = await supabase
      .from('workouts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_archived', true)

    if (error) throw error
    return count ?? 0
  },
  fetchItemCountsByWorkout: async (userId: string): Promise<Record<string, number>> => {
    const { data, error } = await supabase
      .from('workout_items')
      .select('workout_id')
      .eq('user_id', userId)

    if (error) throw error
    const counts: Record<string, number> = {}
    for (const row of data ?? []) {
      const id = (row as { workout_id: string }).workout_id
      counts[id] = (counts[id] ?? 0) + 1
    }
    return counts
  },
  fetchFinishedSessions: async (userId: string): Promise<Session[]> => {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'finished')
      .order('ended_at', { ascending: false })

    if (error) throw error
    return data ?? []
  },
  createWorkout: async (payload: WorkoutInsert): Promise<Workout> => {
    const { data, error } = await supabase
      .from('workouts')
      .insert(payload)
      .select()
      .single()

    if (error) throw error
    return data
  },
  deleteWorkout: async (userId: string, workoutId: string): Promise<void> => {
    const { error } = await supabase
      .from('workouts')
      .delete()
      .eq('id', workoutId)
      .eq('user_id', userId)

    if (error) throw error
  },
  setWorkoutArchived: async (userId: string, workoutId: string, isArchived: boolean): Promise<void> => {
    const { error } = await supabase
      .from('workouts')
      .update({ is_archived: isArchived })
      .eq('id', workoutId)
      .eq('user_id', userId)

    if (error) throw error
  },
  fetchWorkoutItems: async (userId: string, workoutId: string): Promise<WorkoutItem[]> => {
    const { data, error } = await supabase
      .from('workout_items')
      .select('*')
      .eq('workout_id', workoutId)
      .eq('user_id', userId)
      .order('order_index')

    if (error) throw error
    return data
  },
  addWorkoutItem: async (payload: WorkoutItemInsert): Promise<WorkoutItem> => {
    const { data, error } = await supabase
      .from('workout_items')
      .insert(payload)
      .select()
      .single()

    if (error) throw error
    return data
  },
  addWorkoutItemsBatch: async (payload: WorkoutItemInsert[]): Promise<WorkoutItem[]> => {
    if (payload.length === 0) return []

    const { data, error } = await supabase
      .from('workout_items')
      .insert(payload)
      .select()

    if (error) throw error
    return data ?? []
  },
  updateWorkoutItem: async (userId: string, itemId: string, updates: WorkoutItemUpdate): Promise<void> => {
    const { error } = await supabase
      .from('workout_items')
      .update(updates)
      .eq('id', itemId)
      .eq('user_id', userId)

    if (error) throw error
  },
  deleteWorkoutItem: async (userId: string, itemId: string): Promise<void> => {
    const { error } = await supabase
      .from('workout_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId)

    if (error) throw error
  }
}
