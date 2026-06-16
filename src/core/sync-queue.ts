export interface SyncQueueAction {
  id: string
  action: string
  timestamp: number
}

export function sortSyncQueueByTimestamp<T extends SyncQueueAction>(queue: T[]): T[] {
  return [...queue].sort((a, b) => a.timestamp - b.timestamp)
}

export function upsertSyncQueueAction<T extends SyncQueueAction>(
  queue: T[],
  nextAction: T,
  match: (existing: T, incoming: T) => boolean
): T[] {
  const filtered = queue.filter((item) => !match(item, nextAction))
  return [...filtered, nextAction]
}
