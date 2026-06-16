import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useWorkoutStore } from '../stores/useWorkoutStore'
import { useSessionStore } from '../stores/useSessionStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useHistoryStore } from '../stores/useHistoryStore'
import { Skeleton } from '../components/ui/skeleton'
import { Modal } from '../components/ui/modal'
import { Input } from '../components/ui/input'
import { BottomNav } from '../components/BottomNav'

export default function Workouts() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { role, hasActiveCoach } = useAuthStore()
  const { workouts, fetchWorkouts, isLoading, createWorkout } = useWorkoutStore()
  const { currentSession } = useSessionStore()
  const { sessions: historySessions, fetchHistory } = useHistoryStore()
  const canManageWorkouts = role === 'instrutor' || (role === 'aluno' && !hasActiveCoach)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newWorkoutName, setNewWorkoutName] = useState('')
  const [newWorkoutFocus, setNewWorkoutFocus] = useState('')
  const [newWorkoutNotes, setNewWorkoutNotes] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    fetchWorkouts()
    fetchHistory()
  }, [fetchWorkouts, fetchHistory])

  const lang = i18n.language

  const handleCreateWorkout = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!newWorkoutName || !newWorkoutFocus) return
    setIsCreating(true)
    const newId = await createWorkout(newWorkoutName, newWorkoutFocus, newWorkoutNotes)
    if (newId) navigate(`/workout/${newId}/edit`)
    setIsCreating(false)
    setIsModalOpen(false)
    setNewWorkoutName(''); setNewWorkoutFocus(''); setNewWorkoutNotes('')
  }

  const lastCompletedDate = (workoutId: string): string | null => {
    const sessions = historySessions
      .filter(s => s.workout_id === workoutId && s.ended_at)
      .sort((a, b) => new Date(b.ended_at!).getTime() - new Date(a.ended_at!).getTime())
    if (!sessions.length) return null
    const d = new Date(sessions[0].ended_at!)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diffDays === 0) return lang.startsWith('pt') ? 'HOJE' : 'TODAY'
    if (diffDays === 1) return lang.startsWith('pt') ? 'ONTEM' : 'YESTERDAY'
    return lang.startsWith('pt') ? `HÁ ${diffDays} DIAS` : `${diffDays}D AGO`
  }

  return (
    <div className="min-h-screen pb-28 font-ui" style={{ background: '#f5f5f2', color: '#0e0e10' }}>

      {/* ── Header ── */}
      <div className="flex items-end justify-between px-6 pt-14 pb-0">
        <div>
          <div className="font-ot-mono text-[10px] tracking-[0.16em] uppercase" style={{ color: '#9a9aa2' }}>
            {workouts.length} {lang.startsWith('pt') ? 'PROGRAMAS' : 'PROGRAMS'}
          </div>
          <h1 className="font-display text-[34px] font-extrabold uppercase leading-none mt-0.5">
            {lang.startsWith('pt') ? 'Meus treinos' : 'My workouts'}
          </h1>
        </div>
        {canManageWorkouts && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="rounded-[11px] bg-ot-blue px-3.5 py-2.5 font-display text-base font-bold uppercase text-white"
          >
            + {lang.startsWith('pt') ? 'Criar' : 'Create'}
          </button>
        )}
      </div>

      {/* ── Workout list ── */}
      <div className="px-6 mt-5 flex flex-col gap-3">
        {isLoading && workouts.length === 0 ? (
          <>
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3.5 rounded-2xl border border-[#e9e9ee] bg-white p-4">
                <Skeleton className="h-12 w-12 rounded-[13px]" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
            ))}
          </>
        ) : workouts.length > 0 ? (
          <>
            {workouts.map((workout, index) => {
              const letter = String.fromCharCode(65 + index)
              const isActive = currentSession?.workout_id === workout.id
              const lastDone = lastCompletedDate(workout.id)

              return (
                <button
                  key={workout.id}
                  onClick={() => navigate(`/workout/${workout.id}`)}
                  className="flex items-center gap-3.5 rounded-2xl border border-[#e9e9ee] bg-white p-4 text-left transition-all active:scale-[0.98]"
                  style={isActive ? { borderColor: '#2a5fff', borderWidth: 1.5 } : undefined}
                >
                  <div
                    className="flex h-12 w-12 flex-none items-center justify-center rounded-[13px] font-display text-[22px] font-extrabold"
                    style={isActive
                      ? { background: '#0e0e10', color: '#d8ff36' }
                      : { background: '#eef2ff', color: '#2a5fff' }
                    }
                  >
                    {letter}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[20px] font-bold uppercase leading-none truncate">
                      {workout.focus || workout.name}
                    </div>
                    <div className="mt-1 font-ot-mono text-[10px] tracking-[0.04em]" style={{ color: '#9a9aa2' }}>
                      {lastDone
                        ? `${lang.startsWith('pt') ? 'FEITO' : 'DONE'} ${lastDone}`
                        : lang.startsWith('pt') ? 'NUNCA INICIADO' : 'NOT STARTED YET'
                      }
                    </div>
                  </div>
                  <span style={{ color: '#c3c3cb', fontSize: 20 }}>›</span>
                </button>
              )
            })}

            {canManageWorkouts && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-3.5 rounded-2xl border-2 border-dashed border-[#c8c8d0] bg-transparent p-4 text-left transition-all active:scale-[0.98]"
              >
                <div
                  className="flex h-12 w-12 flex-none items-center justify-center rounded-[13px]"
                  style={{ border: '2px solid #2a5fff', color: '#2a5fff', fontSize: 26, fontWeight: 300 }}
                >
                  +
                </div>
                <div>
                  <div className="font-display text-[20px] font-bold uppercase leading-none" style={{ color: '#2a5fff' }}>
                    {lang.startsWith('pt') ? 'Criar do zero' : 'Create from scratch'}
                  </div>
                  <div className="mt-1 font-ot-mono text-[10px] tracking-[0.04em]" style={{ color: '#9a9aa2' }}>
                    {lang.startsWith('pt') ? 'VOCÊ É O SEU COACH' : "YOU'RE YOUR OWN COACH"}
                  </div>
                </div>
              </button>
            )}
          </>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-[#e0e0e4] py-12 text-center">
            <p className="text-sm" style={{ color: '#6a6a72' }}>{t('home.no_workouts')}</p>
            {canManageWorkouts && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 font-display text-sm font-bold uppercase text-white"
                style={{ background: '#0e0e10' }}
              >
                {t('home.create_first')}
              </button>
            )}
            {!canManageWorkouts && (
              <p className="mt-2 text-xs" style={{ color: '#9a9aa2' }}>{t('home.student_no_workouts')}</p>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom nav ── */}
      <BottomNav onPressFAB={canManageWorkouts ? () => setIsModalOpen(true) : undefined} />

      {/* ── Create Workout Modal ── */}
      {canManageWorkouts && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('home.create_modal_title')}>
          <form onSubmit={handleCreateWorkout} className="space-y-4">
            <div>
              <label className="font-ot-mono text-[9px] tracking-[0.16em] text-ot-faint uppercase block mb-1.5">
                {t('common.name')}
              </label>
              <Input
                value={newWorkoutName}
                onChange={(e) => setNewWorkoutName(e.target.value)}
                placeholder={t('common.name')}
                required
              />
            </div>
            <div>
              <label className="font-ot-mono text-[9px] tracking-[0.16em] text-ot-faint uppercase block mb-1.5">
                {t('home.focus')}
              </label>
              <Input
                value={newWorkoutFocus}
                onChange={(e) => setNewWorkoutFocus(e.target.value)}
                placeholder={t('home.focus')}
                required
              />
            </div>
            <div>
              <label className="font-ot-mono text-[9px] tracking-[0.16em] text-ot-faint uppercase block mb-1.5">
                {t('common.notes')} ({t('common.optional')})
              </label>
              <textarea
                className="flex w-full rounded-md border border-ot-border bg-white px-3 py-2 text-sm text-ot-ink placeholder:text-ot-faint focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ot-blue h-20 resize-none"
                value={newWorkoutNotes}
                onChange={(e) => setNewWorkoutNotes(e.target.value)}
                placeholder={t('home.notes_placeholder')}
              />
            </div>
            <div className="pt-1">
              <button
                type="submit"
                disabled={isCreating}
                className="w-full rounded-[15px] bg-ot-blue py-[15px] font-display text-xl font-extrabold uppercase text-white transition-opacity disabled:opacity-60"
              >
                {isCreating ? t('common.loading') : t('common.create')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
