export interface SyncActionBase {
  id: string
  timestamp: number
}

export type WorkoutSyncActionType = 'archive' | 'unarchive' | 'delete' | 'create'
export type SessionSyncActionType = 'toggle_done' | 'update_stats' | 'finish_session'

export interface WorkoutSyncAction extends SyncActionBase {
  action: WorkoutSyncActionType
  payload?: any
}

export interface SessionSyncAction extends SyncActionBase {
  action: SessionSyncActionType
  payload?: any
}
