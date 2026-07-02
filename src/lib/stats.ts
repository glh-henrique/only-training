// Estatísticas puras de treino, compartilhadas por Home e Profile.

interface SessionLike {
  ended_at?: string | null
}

interface ItemLike {
  default_sets?: number | null
  rest_seconds?: number | null
}

/** Estimativa em minutos: séries × (40s de execução + descanso). */
export function estimateDuration(items: ItemLike[]): number | null {
  if (!items.length) return null
  const secs = items.reduce((acc, item) => {
    const sets = item.default_sets ?? 3
    const rest = item.rest_seconds ?? 60
    return acc + sets * (40 + rest)
  }, 0)
  return Math.round(secs / 60)
}

/**
 * Dias consecutivos com sessão finalizada, contando a partir de hoje.
 * Se hoje ainda não treinou, a sequência que termina ontem continua valendo.
 */
export function computeStreak(sessions: SessionLike[], today: Date = new Date()): number {
  const datesSet = new Set(sessions.filter(s => s.ended_at).map(s => new Date(s.ended_at!).toDateString()))
  let count = 0
  const d = new Date(today)
  d.setHours(0, 0, 0, 0)
  while (datesSet.has(d.toDateString())) { count++; d.setDate(d.getDate() - 1) }
  if (count === 0) {
    const y = new Date(today); y.setDate(y.getDate() - 1); y.setHours(0, 0, 0, 0)
    while (datesSet.has(y.toDateString())) { count++; y.setDate(y.getDate() - 1) }
  }
  return count
}

/** Maior sequência histórica; nunca menor que a sequência atual. */
export function computeLongestStreak(sessions: SessionLike[], currentStreak: number): number {
  const DAY = 86400000
  const days = Array.from(
    new Set(sessions.filter(s => s.ended_at).map(s => {
      const d = new Date(s.ended_at!); d.setHours(0, 0, 0, 0); return d.getTime()
    }))
  ).sort((a, b) => a - b)
  let best = 0, run = 0, prev: number | null = null
  for (const tm of days) {
    run = prev !== null && tm - prev === DAY ? run + 1 : 1
    if (run > best) best = run
    prev = tm
  }
  return Math.max(best, currentStreak)
}
