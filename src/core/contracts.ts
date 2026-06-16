export interface StorageGateway {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export interface AuthGateway<User, Session> {
  getSession: () => Promise<Session | null>
  onAuthStateChange: (callback: (session: Session | null) => void) => () => void
  signOut: () => Promise<void>
  getCurrentUser: () => Promise<User | null>
}

export interface WorkoutGateway<Workout, WorkoutItem, Session> {
  fetchWorkouts: (userId: string) => Promise<Workout[]>
  fetchArchivedCount: (userId: string) => Promise<number>
  fetchFinishedSessions: (userId: string) => Promise<Session[]>
  createWorkout: (userId: string, payload: { name: string, focus: string, notes?: string }) => Promise<Workout>
  deleteWorkout: (userId: string, workoutId: string) => Promise<void>
  archiveWorkout: (userId: string, workoutId: string) => Promise<void>
  unarchiveWorkout: (userId: string, workoutId: string) => Promise<void>
  fetchWorkoutItems: (userId: string, workoutId: string) => Promise<WorkoutItem[]>
}

export interface SessionGateway<Session, SessionItem> {
  fetchInProgressSessions: (userId: string) => Promise<Session[]>
  fetchSessionItems: (userId: string, sessionId: string) => Promise<SessionItem[]>
  finishSession: (userId: string, sessionId: string, payload: { endedAt: string, duration: number }) => Promise<void>
}
