export function isSameCalendarDay(current: Date, startedAt: Date): boolean {
  return (
    current.getFullYear() === startedAt.getFullYear() &&
    current.getMonth() === startedAt.getMonth() &&
    current.getDate() === startedAt.getDate()
  )
}

export function calculateDurationSeconds(current: Date, startedAt: Date): number {
  return Math.max(0, Math.floor((current.getTime() - startedAt.getTime()) / 1000))
}

export function formatDurationMMSS(durationSeconds: number): string {
  return new Date(durationSeconds * 1000).toISOString().substring(14, 19)
}
