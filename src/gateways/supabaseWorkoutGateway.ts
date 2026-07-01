import type { Database } from '../types/database.types'
import { supabase } from '../lib/supabase'
import { TableNames, SessionStatus } from '../constants/database'

type Workout = Database['public']['Tables']['workouts']['Row']
type WorkoutItem = Database['public']['Tables']['workout_items']['Row']
type WorkoutInsert = Database['public']['Tables']['workouts']['Insert']
type WorkoutItemInsert = Database['public']['Tables']['workout_items']['Insert']
type WorkoutItemUpdate = Database['public']['Tables']['workout_items']['Update']
type Session = Database['public']['Tables']['workout_sessions']['Row']

export const supabaseWorkoutGateway = {
  fetchActiveWorkouts: async (userId: string): Promise<Workout[]> => {
    const { data, error } = await supabase
      .from(TableNames.Workouts)
      .select('*')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },
  fetchArchivedCount: async (userId: string): Promise<number> => {
    const { count, error } = await supabase
      .from(TableNames.Workouts)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_archived', true)

    if (error) throw error
    return count ?? 0
  },
  fetchItemCountsByWorkout: async (userId: string): Promise<Record<string, number>> => {
    const { data, error } = await supabase
      .from(TableNames.WorkoutItems)
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
  // Só o que os stats da Home/Workouts usam — select(*) aqui puxava o histórico
  // inteiro em duplicidade com o useHistoryStore.
  fetchFinishedSessions: async (userId: string): Promise<Pick<Session, 'workout_id' | 'ended_at' | 'duration_seconds'>[]> => {
    const { data, error } = await supabase
      .from(TableNames.Sessions)
      .select('workout_id, ended_at, duration_seconds')
      .eq('user_id', userId)
      .eq('status', SessionStatus.Finished)
      .order('ended_at', { ascending: false })

    if (error) throw error
    return data ?? []
  },
  createWorkout: async (payload: WorkoutInsert): Promise<Workout> => {
    const { data, error } = await supabase
      .from(TableNames.Workouts)
      .insert(payload)
      .select()
      .single()

    if (error) throw error
    return data
  },
  deleteWorkout: async (userId: string, workoutId: string): Promise<void> => {
    const { error } = await supabase
      .from(TableNames.Workouts)
      .delete()
      .eq('id', workoutId)
      .eq('user_id', userId)

    if (error) throw error
  },
  setWorkoutArchived: async (userId: string, workoutId: string, isArchived: boolean): Promise<void> => {
    const { error } = await supabase
      .from(TableNames.Workouts)
      .update({ is_archived: isArchived })
      .eq('id', workoutId)
      .eq('user_id', userId)

    if (error) throw error
  },
  renameWorkout: async (userId: string, workoutId: string, name: string): Promise<void> => {
    const { error } = await supabase
      .from(TableNames.Workouts)
      .update({ name })
      .eq('id', workoutId)
      .eq('user_id', userId)

    if (error) throw error
  },
  fetchWorkoutItems: async (userId: string, workoutId: string): Promise<WorkoutItem[]> => {
    const { data, error } = await supabase
      .from(TableNames.WorkoutItems)
      .select('*')
      .eq('workout_id', workoutId)
      .eq('user_id', userId)
      .order('order_index')

    if (error) throw error
    return data
  },
  addWorkoutItem: async (payload: WorkoutItemInsert): Promise<WorkoutItem> => {
    const { data, error } = await supabase
      .from(TableNames.WorkoutItems)
      .insert(payload)
      .select()
      .single()

    if (error) throw error
    return data
  },
  addWorkoutItemsBatch: async (payload: WorkoutItemInsert[]): Promise<WorkoutItem[]> => {
    if (payload.length === 0) return []

    const { data, error } = await supabase
      .from(TableNames.WorkoutItems)
      .insert(payload)
      .select()

    if (error) throw error
    return data ?? []
  },
  updateWorkoutItem: async (userId: string, itemId: string, updates: WorkoutItemUpdate): Promise<void> => {
    const { error } = await supabase
      .from(TableNames.WorkoutItems)
      .update(updates)
      .eq('id', itemId)
      .eq('user_id', userId)

    if (error) throw error
  },
  deleteWorkoutItem: async (userId: string, itemId: string): Promise<void> => {
    const { error } = await supabase
      .from(TableNames.WorkoutItems)
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId)

    if (error) throw error
  }
}
