import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useHistoryStore } from '../stores/useHistoryStore'
import { Skeleton } from '../components/ui/skeleton'
import { BottomNav } from '../components/BottomNav'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function History() {
  const { t, i18n } = useTranslation()
  const { sessions, fetchHistory, isLoading } = useHistoryStore()

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const lang = i18n.language
  const dateLocale = lang.startsWith('pt') ? ptBR : undefined

  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<string>('all')

  const availableYears = useMemo(() => {
    const years = new Set<number>()
    sessions.forEach(s => {
      if (!s.ended_at) return
      years.add(new Date(s.ended_at).getFullYear())
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [sessions])

  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, m) => ({
      value: String(m),
      label: format(new Date(2000, m, 1), 'MMMM', { locale: dateLocale }).toUpperCase()
    })),
    [dateLocale]
  )

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      if (!s.ended_at) return false
      const d = new Date(s.ended_at)
      if (selectedYear !== 'all' && d.getFullYear() !== Number(selectedYear)) return false
      if (selectedMonthIndex !== 'all' && d.getMonth() !== Number(selectedMonthIndex)) return false
      return true
    })
  }, [sessions, selectedYear, selectedMonthIndex])

  // Group sessions by month
  const groupedSessions = useMemo(() => {
    const groups: Record<string, typeof sessions> = {}
    filteredSessions.forEach(session => {
      if (!session.ended_at) return
      const key = format(new Date(session.ended_at), 'MMMM yyyy', { locale: dateLocale })
      if (!groups[key]) groups[key] = []
      groups[key].push(session)
    })
    return Object.entries(groups)
  }, [filteredSessions, dateLocale])

  // Total duration this month
  const thisMonthStats = useMemo(() => {
    const now = new Date()
    const thisMonth = sessions.filter(s => {
      if (!s.ended_at) return false
      const d = new Date(s.ended_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    const totalMin = Math.round(thisMonth.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0) / 60)
    return { count: thisMonth.length, totalMin }
  }, [sessions])

  return (
    <div className="min-h-screen pb-28 font-ui" style={{ background: '#f5f5f2', color: '#0e0e10' }}>

      {/* ── Header ── */}
      <div className="px-6 pt-14">
        <div className="font-ot-mono text-[10px] tracking-[0.16em] uppercase" style={{ color: '#9a9aa2' }}>
          {lang.startsWith('pt') ? 'ÚLTIMAS SESSÕES' : 'RECENT SESSIONS'}
        </div>
        <h1 className="mt-0.5 font-display text-[34px] font-extrabold uppercase leading-none">
          {lang.startsWith('pt') ? 'Sua evolução' : 'Your progress'}
        </h1>

        {sessions.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <select
              value={selectedMonthIndex}
              onChange={(e) => setSelectedMonthIndex(e.target.value)}
              className="rounded-[12px] border border-[#e9e9ee] bg-white px-3 py-2.5 font-ot-mono text-[11px] tracking-[0.08em] uppercase"
              style={{ color: '#0e0e10' }}
            >
              <option value="all">{lang.startsWith('pt') ? 'TODOS OS MESES' : 'ALL MONTHS'}</option>
              {monthOptions.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="rounded-[12px] border border-[#e9e9ee] bg-white px-3 py-2.5 font-ot-mono text-[11px] tracking-[0.08em] uppercase"
              style={{ color: '#0e0e10' }}
            >
              <option value="all">{lang.startsWith('pt') ? 'TODOS OS ANOS' : 'ALL YEARS'}</option>
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Stats row ── */}
      {sessions.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-2.5 px-6">
          <div className="rounded-[14px] border border-[#e9e9ee] bg-white p-4">
            <div className="font-display text-[34px] font-extrabold leading-none">{sessions.length}</div>
            <div className="mt-1 font-ot-mono text-[9px] tracking-[0.12em]" style={{ color: '#9a9aa2' }}>
              {lang.startsWith('pt') ? 'TREINOS TOTAL' : 'TOTAL WORKOUTS'}
            </div>
          </div>
          <div className="rounded-[14px] border border-[#e9e9ee] bg-white p-4">
            <div className="font-display text-[34px] font-extrabold leading-none">{thisMonthStats.count}</div>
            <div className="mt-1 font-ot-mono text-[9px] tracking-[0.12em]" style={{ color: '#9a9aa2' }}>
              {lang.startsWith('pt') ? 'ESTE MÊS' : 'THIS MONTH'}
            </div>
          </div>
        </div>
      )}

      {/* ── Session list ── */}
      <div className="mt-6 px-6 space-y-8">
        {isLoading && sessions.length === 0 ? (
          <div className="space-y-6">
            {[1, 2].map(g => (
              <div key={g} className="space-y-3">
                <Skeleton className="h-3 w-28"  />
                {[1, 2].map(i => (
                  <div key={i} className="rounded-2xl border border-[#e9e9ee] bg-white p-4 space-y-3">
                    <Skeleton className="h-5 w-40"  />
                    <Skeleton className="h-3 w-28"  />
                    <div className="pt-3 border-t border-[#e9e9ee] space-y-2">
                      <Skeleton className="h-4 w-full"  />
                      <Skeleton className="h-4 w-3/4"  />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-20 text-center">
            <div className="font-display text-[64px] font-extrabold leading-none" style={{ color: '#e0e0e4' }}>0</div>
            <p className="mt-3 font-ot-mono text-[11px] tracking-[0.12em]" style={{ color: '#9a9aa2' }}>
              {t('history.no_sessions').toUpperCase()}
            </p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="py-20 text-center">
            <div className="font-display text-[64px] font-extrabold leading-none" style={{ color: '#e0e0e4' }}>0</div>
            <p className="mt-3 font-ot-mono text-[11px] tracking-[0.12em]" style={{ color: '#9a9aa2' }}>
              {lang.startsWith('pt') ? 'NENHUMA SESSÃO NESTE PERÍODO' : 'NO SESSIONS IN THIS PERIOD'}
            </p>
          </div>
        ) : (
          groupedSessions.map(([month, monthSessions]) => (
            <section key={month}>
              {/* Month label */}
              <div className="mb-3 font-ot-mono text-[10px] tracking-[0.18em] uppercase font-bold" style={{ color: '#2a5fff' }}>
                {month.toUpperCase()}
              </div>

              <div className="space-y-3">
                {monthSessions.map((session) => {
                  const durationMin = Math.round((session.duration_seconds ?? 0) / 60)
                  const dateStr = session.ended_at
                    ? format(new Date(session.ended_at), lang.startsWith('pt') ? "EEE, d 'de' MMM" : 'EEE, MMM d', { locale: dateLocale })
                    : ''
                  const doneItems = session.items.filter(i => i.is_done)

                  return (
                    <div
                      key={session.id}
                      className="rounded-2xl border border-[#e9e9ee] bg-white overflow-hidden"
                    >
                      {/* Card header */}
                      <div className="px-4 pt-4 pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-display text-[20px] font-bold uppercase leading-none truncate">
                              {session.workout_focus_snapshot || session.workout_name_snapshot}
                            </h3>
                            <div className="mt-1.5 flex items-center gap-3 font-ot-mono text-[10px]" style={{ color: '#9a9aa2' }}>
                              <span>{dateStr.toUpperCase()}</span>
                              {durationMin > 0 && (
                                <>
                                  <span style={{ color: '#d0d0d8' }}>·</span>
                                  <span>{durationMin} MIN</span>
                                </>
                              )}
                            </div>
                          </div>
                          {doneItems.length > 0 && (
                            <div
                              className="flex-none rounded-[10px] px-2.5 py-1.5 text-center"
                              style={{ background: '#eef2ff' }}
                            >
                              <div className="font-display text-[18px] font-extrabold leading-none" style={{ color: '#2a5fff' }}>
                                {doneItems.length}
                              </div>
                              <div className="font-ot-mono text-[8px] tracking-[0.06em]" style={{ color: '#7a8fff' }}>
                                {lang.startsWith('pt') ? 'EXERC.' : 'EXER.'}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Exercise list */}
                      {session.items.length > 0 && (
                        <div className="border-t border-[#f0f0f3] px-4 py-3 space-y-2">
                          {session.items.map((item, idx) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-3"
                              style={{ opacity: item.is_done ? 1 : 0.4 }}
                            >
                              <span
                                className="w-5 font-display text-[15px] font-bold leading-none flex-none"
                                style={{ color: '#b3b3bb' }}
                              >
                                {idx + 1}
                              </span>
                              <span className="flex-1 font-display text-[17px] font-semibold leading-none truncate">
                                {item.title_snapshot}
                              </span>
                              <span className="font-ot-mono text-[10px] flex-none" style={{ color: '#6a6a72' }}>
                                {[
                                  item.sets != null ? `${item.sets}×` : null,
                                  item.reps != null ? `${item.reps}` : null,
                                  item.weight != null ? `· ${item.weight}kg` : null,
                                ].filter(Boolean).join('')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  )
}
