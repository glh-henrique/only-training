import { useEffect, useState } from 'react'
import { Plus, History as HistoryIcon, Zap } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'
import { useWorkoutStore } from '../stores/useWorkoutStore'
import { useSessionStore } from '../stores/useSessionStore'
import { Button } from '../components/ui/button'
import { WorkoutCard } from '../components/WorkoutCard'
import { Modal } from '../components/ui/modal'
import { Input } from '../components/ui/input'
import { useAuthStore } from '../stores/useAuthStore'
import { Skeleton } from '../components/ui/skeleton'

export default function Home() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, role, hasActiveCoach } = useAuthStore()
  const { workouts, fetchWorkouts, createWorkout, lastSession, isLoading } = useWorkoutStore()
  const { currentSession, resumeSession, duration, hasNotifiedLongWorkout, setHasNotifiedLongWorkout } = useSessionStore()
  const canManageWorkouts = role === 'instrutor' || (role === 'aluno' && !hasActiveCoach)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newWorkoutName, setNewWorkoutName] = useState('')
  const [newWorkoutFocus, setNewWorkoutFocus] = useState('')
  const [newWorkoutNotes, setNewWorkoutNotes] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    fetchWorkouts()
    resumeSession() // Check for active session
  }, [fetchWorkouts, resumeSession])


  const handleCreateWorkout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWorkoutName || !newWorkoutFocus) return

    setIsCreating(true)
    const newId = await createWorkout(newWorkoutName, newWorkoutFocus, newWorkoutNotes)
    if (newId) {
       // Navigate to edit page to add items
       // We can iterate on this UX later
       // Use relative path for better HashRouter compatibility on GitHub Pages
       navigate(`workout/${newId}/edit`)
    }
    
    setIsCreating(false)
    setIsModalOpen(false)
    setNewWorkoutName('')
    setNewWorkoutFocus('')
    setNewWorkoutNotes('')
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pb-20 transition-colors">
      {/* Header */}
      <header className="p-4 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md z-10 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">
            {t('home.greeting', { name: user?.user_metadata?.full_name || user?.email?.split('@')[0] })}
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('home.ready')}</p>
        </div>
        <div className="flex items-center gap-2">
            <Link to="/history">
                <Button size="icon" variant="ghost" className="rounded-full text-neutral-500 dark:text-neutral-400 hover:text-emerald-500 hover:bg-emerald-500/10">
                    <HistoryIcon className="h-5 w-5" />
                </Button>
            </Link>
            <Link to="/profile">
                <Button size="icon" variant="ghost" className="rounded-full">
                    <div className="h-8 w-8 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center text-sm font-semibold text-neutral-900 dark:text-neutral-50 transition-colors">
                      {(user?.user_metadata?.full_name?.[0] || user?.email?.[0] || '?').toUpperCase()}
                    </div>
                </Button>
            </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 space-y-6">
        {/* Last Activity */}
        {isLoading && !lastSession ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-32 px-1" />
            <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </div>
        ) : lastSession && (() => {

          return (
            <div className="space-y-3">
               <h2 className="text-sm font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-1">{t('home.last_activity')}</h2>
               <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 flex items-center justify-between transition-all">
                  <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500">
                          <Zap className="h-6 w-6 fill-current opacity-80" />
                      </div>
                      <div>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400">
                              <Trans i18nKey="home.last_activity_text" values={{ workout: lastSession.workout_name_snapshot }}>
                                 You trained <span className="text-emerald-500 font-semibold">{lastSession.workout_name_snapshot}</span>
                              </Trans>
                          </p>
                          <p className="text-xs text-neutral-400 dark:text-neutral-600 mt-0.5">
                             {lastSession.workout_focus_snapshot} • {t('home.duration', { minutes: Math.round((lastSession.duration_seconds || 0) / 60) })}
                          </p>
                      </div>
                  </div>
               </div>
            </div>
          )
        })()}

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('home.workouts')}</h2>
        </div>

        {isLoading && workouts.length === 0 ? (
           <div className="space-y-3">
             {[1, 2, 3].map((i) => (
               <div key={i} className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex flex-col gap-3">
                 <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                 </div>
                 <Skeleton className="h-4 w-24" />
                 <div className="flex gap-2">
                    <Skeleton className="h-4 w-12 rounded-full" />
                    <Skeleton className="h-4 w-12 rounded-full" />
                 </div>
               </div>
             ))}
           </div>
        ) : workouts.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
            <p className="text-neutral-500 dark:text-neutral-400 mb-4">{t('home.no_workouts')}</p>
            {canManageWorkouts ? (
              <Button variant="outline" onClick={() => setIsModalOpen(true)}>{t('home.create_first')}</Button>
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('home.student_no_workouts')}</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {workouts.map(workout => (
              <WorkoutCard 
                key={workout.id} 
                workout={workout} 
                isActive={currentSession?.workout_id === workout.id}
              />
            ))}
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      {canManageWorkouts && (
        <Button
          onClick={() => setIsModalOpen(true)}
          size="icon"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl bg-emerald-600 hover:bg-emerald-700 hover:scale-110 active:scale-95 transition-all text-white border-none z-50 ring-offset-white dark:ring-offset-neutral-950 shadow-emerald-500/20"
        >
          <Plus className="h-7 w-7" />
        </Button>
      )}

      {/* Create Workout Modal */}
      {canManageWorkouts && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={t('home.create_modal_title')}
        >
          <form onSubmit={handleCreateWorkout} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-neutral-900 dark:text-neutral-200">{t('common.name')}</label>
              <Input
                value={newWorkoutName}
                onChange={(e) => setNewWorkoutName(e.target.value)}
                placeholder={t('common.name')}
                required
                className="bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-neutral-900 dark:text-neutral-200">{t('home.focus')}</label>
              <Input
                value={newWorkoutFocus}
                onChange={(e) => setNewWorkoutFocus(e.target.value)}
                placeholder={t('home.focus')}
                required
                className="bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-neutral-900 dark:text-neutral-200">{t('common.notes')} ({t('common.optional')})</label>
              <textarea
                className="flex w-full rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-3 py-2 text-sm ring-offset-white dark:ring-offset-neutral-950 placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-neutral-900 dark:text-neutral-50 h-20 resize-none"
                value={newWorkoutNotes}
                onChange={(e) => setNewWorkoutNotes(e.target.value)}
                placeholder={t('home.notes_placeholder')}
              />
            </div>
            <div className="pt-2">
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isCreating}>
                {isCreating ? t('common.loading') : t('common.create')}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Long Workout Warning Modal */}
      <Modal
        isOpen={!!currentSession && duration >= 3600 && !hasNotifiedLongWorkout}
        onClose={() => setHasNotifiedLongWorkout(true)}
        title={t('session.long_workout_notification')}
      >
        <div className="space-y-4">
          <p className="text-neutral-600 dark:text-neutral-400">
            {t('session.long_workout_modal_desc')}
          </p>
          <Button 
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => setHasNotifiedLongWorkout(true)}
          >
            {t('common.save')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
