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

export interface SessionDefaultWeightEntry {
  workout_item_id?: string | null
  weight?: number | null
}

export interface FinishSessionSyncAction extends SyncActionBase {
  action: 'finish_session'
  payload: {
    endedAt: string
    duration: number
    defaultWeights: SessionDefaultWeightEntry[]
  }
}

export type SessionSyncAction =
  | ToggleDoneSyncAction
  | UpdateStatsSyncAction
  | FinishSessionSyncAction

export type SessionSyncActionType = SessionSyncAction['action']
