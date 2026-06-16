export interface WorkoutLike {
  id: string
}

export interface FinishedSessionLike {
  workout_id: string | null
  ended_at: string | null
}

export interface WorkoutWithSessionStats {
  completed_count: number
  last_completed_at?: string
}

export function mergeWorkoutsWithSessionStats<TWorkout extends WorkoutLike>(
  workouts: TWorkout[],
  finishedSessions: FinishedSessionLike[]
): Array<TWorkout & WorkoutWithSessionStats> {
  const counts: Record<string, number> = {}
  const lastDates: Record<string, string> = {}

  finishedSessions.forEach((session) => {
    if (!session.workout_id) return

    counts[session.workout_id] = (counts[session.workout_id] || 0) + 1
    if (!session.ended_at) return

    const currentLast = lastDates[session.workout_id]
    if (!currentLast || new Date(session.ended_at).getTime() > new Date(currentLast).getTime()) {
      lastDates[session.workout_id] = session.ended_at
    }
  })

  return workouts.map((workout) => ({
    ...workout,
    completed_count: counts[workout.id] || 0,
    last_completed_at: lastDates[workout.id]
  }))
}
