export interface SyncActionBase {
  id: string
  timestamp: number
}

export type WorkoutSyncActionType = 'archive' | 'unarchive' | 'delete' | 'create'

export interface WorkoutSyncAction extends SyncActionBase {
  action: WorkoutSyncActionType
}

// ── Session sync actions (discriminated union by `action`) ──

export interface ToggleDoneSyncAction extends SyncActionBase {
  action: 'toggle_done'
  payload: { isDone: boolean; doneAt: string | null }
}

export interface UpdateStatsSyncAction extends SyncActionBase {
  action: 'update_stats'
  payload: { weight: number; reps: string }
}

export interface UpdateCardioStatsSyncAction extends SyncActionBase {
  action: 'update_cardio_stats'
  payload: { durationMinutes: number | null; distanceKm: number | null }
}

export interface SessionDefaultWeightEntry {
  workout_item_id?: string | null
  weight?: number | null
}

export interface FinishSessionSyncAction extends SyncActionBase {
  action: 'finish_session'
  payload: {
    endedAt: string
    duration: number
    rpe: number | null
    // opcionais: ações antigas na fila persistida não têm os campos
    avgHeartRate?: number | null
    caloriesKcal?: number | null
    defaultWeights: SessionDefaultWeightEntry[]
  }
}

export type SessionSyncAction =
  | ToggleDoneSyncAction
  | UpdateStatsSyncAction
  | UpdateCardioStatsSyncAction
  | FinishSessionSyncAction

export type SessionSyncActionType = SessionSyncAction['action']
