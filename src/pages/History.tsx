import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useHistoryStore } from '../stores/useHistoryStore'
import { Button } from '../components/ui/button'
import { ArrowLeft, Calendar, Clock, Trophy } from 'lucide-react'
import { format } from 'date-fns'
import { Skeleton } from '../components/ui/skeleton'

export default function History() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { sessions, fetchHistory, isLoading } = useHistoryStore()

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Group sessions by month
  const groupedSessions = sessions.reduce((acc, session) => {
    const month = format(new Date(session.ended_at!), 'MMMM yyyy')
    if (!acc[month]) acc[month] = []
    acc[month].push(session)
    return acc
  }, {} as Record<string, typeof sessions>)

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pb-10 transition-colors">
      {/* Header */}
      <header className="p-4 flex items-center gap-4 sticky top-0 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md z-10 border-b border-neutral-200 dark:border-neutral-800">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-neutral-500 dark:text-neutral-400">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-white">{t('history.title')}</h1>
      </header>

      <main className="p-4 space-y-8">
        {isLoading && sessions.length === 0 ? (
          <div className="space-y-6">
            {[1, 2].map((group) => (
              <div key={group} className="space-y-4">
                <Skeleton className="h-4 w-32 px-1" />
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <Skeleton className="h-6 w-40" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                        <Skeleton className="h-6 w-20 rounded-full" />
                      </div>
                      <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20">
            <Trophy className="h-12 w-12 text-neutral-200 dark:text-neutral-800 mx-auto mb-4" />
            <p className="text-neutral-500 dark:text-neutral-400">{t('history.no_sessions')}</p>
          </div>
        ) : (
          Object.entries(groupedSessions).map(([month, monthSessions]) => (
            <section key={month} className="space-y-4">
              <h2 className="text-sm font-bold text-emerald-500 uppercase tracking-wider px-1">{month}</h2>
              <div className="space-y-3">
                {monthSessions.map((session) => (
                  <div 
                    key={session.id}
                    className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 transition-all hover:border-emerald-500/30"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-lg text-neutral-900 dark:text-white">{session.workout_name_snapshot}</h3>
                        <div className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(session.ended_at!), 'EEE, MMM d')}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {Math.round((session.duration_seconds || 0) / 60)} min
                          </div>
                        </div>
                      </div>
                      <span className="text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-2 py-1 rounded-full border border-neutral-200 dark:border-neutral-700">
                        {session.workout_focus_snapshot}
                      </span>
                    </div>

                    {/* Exercise details */}
                    <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                       {session.items.map((item, idx) => (
                         <div key={item.id} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2">
                               <span className="text-neutral-400 dark:text-neutral-500 w-4 text-[10px]">{idx + 1}.</span>
                               <span className={item.is_done ? "text-neutral-700 dark:text-neutral-200" : "text-neutral-400 dark:text-neutral-500 italic"}>
                                 {item.title_snapshot}
                               </span>
                            </div>
                            <div className="text-neutral-500 dark:text-neutral-400 font-mono text-xs">
                               {item.weight}kg <span className="mx-1 text-neutral-300 dark:text-neutral-600">×</span> {item.reps}
                            </div>
                         </div>
                       ))}
                       {session.items.length === 0 && (
                         <p className="text-xs text-neutral-400 dark:text-neutral-600 italic">No exercises logged.</p>
                       )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  )
}
