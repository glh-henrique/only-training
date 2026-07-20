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
import { AlertModal } from '../components/ui/alert-modal'
import { BottomNav } from '../components/BottomNav'
import { UserRole } from '../constants/auth'
import { AppRoutes } from '../constants/routes'
import { Home, Dumbbell } from 'lucide-react'


export default function Workouts() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { role, hasActiveCoach } = useAuthStore()
  const { workouts, fetchWorkouts, isLoading, createWorkout, archiveWorkout, deleteWorkout } = useWorkoutStore()
  const { currentSession } = useSessionStore()
  const { sessions: historySessions, fetchHistory } = useHistoryStore()
  const canManageWorkouts = role === UserRole.Instructor || (role === UserRole.Student && !hasActiveCoach)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newWorkoutName, setNewWorkoutName] = useState('')
  const [newWorkoutFocus, setNewWorkoutFocus] = useState('')
  const [newWorkoutNotes, setNewWorkoutNotes] = useState('')
  const [newWorkoutLocation, setNewWorkoutLocation] = useState<'home' | 'gym'>('gym')
  const [isCreating, setIsCreating] = useState(false)
  const [archiveModal, setArchiveModal] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null })
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null })
  const [activeTab, setActiveTab] = useState<'gym' | 'home'>('gym')

  const gymWorkouts = workouts.filter(w => w.location !== 'home')
  const homeWorkouts = workouts.filter(w => w.location === 'home')

  useEffect(() => {
    fetchWorkouts()
    fetchHistory()
  }, [fetchWorkouts, fetchHistory])


  const handleCreateWorkout = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!newWorkoutName || !newWorkoutFocus) return
    setIsCreating(true)
    const newId = await createWorkout(newWorkoutName, newWorkoutFocus, newWorkoutNotes, newWorkoutLocation)
    if (newId) navigate(AppRoutes.WorkoutEdit(newId))
    setIsCreating(false)
    setIsModalOpen(false)
    setNewWorkoutName(''); setNewWorkoutFocus(''); setNewWorkoutNotes(''); setNewWorkoutLocation('gym')
  }

  const handleArchive = async () => {
    if (!archiveModal.id) return
    await archiveWorkout(archiveModal.id)
    setArchiveModal({ isOpen: false, id: null })
  }

  const handleDelete = async () => {
    if (!deleteModal.id) return
    await deleteWorkout(deleteModal.id)
    setDeleteModal({ isOpen: false, id: null })
  }

  const lastCompletedDate = (workoutId: string): string | null => {
    const sessions = historySessions
      .filter(s => s.workout_id === workoutId && s.ended_at)
      .sort((a, b) => new Date(b.ended_at!).getTime() - new Date(a.ended_at!).getTime())
    if (!sessions.length) return null
    const d = new Date(sessions[0].ended_at!)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diffDays === 0) return t('workouts.today_label')
    if (diffDays === 1) return t('workouts.yesterday_label')
    return t('workouts.days_ago', { count: diffDays })
  }

  const renderWorkoutCard = (workout: typeof workouts[number], index: number) => {
    const letter = String.fromCharCode(65 + index)
    const isActive = currentSession?.workout_id === workout.id
    const lastDone = lastCompletedDate(workout.id)
    const count = workout.items_count ?? 0
    const exLabel = t('workouts.exercise_count', { count })
    const doneLabel = lastDone
      ? `${t('workouts.done_label')} ${lastDone}`
      : t('workouts.not_started')

    return (
      <div
        key={workout.id}
        className="flex items-center gap-3.5 rounded-2xl border border-[#e9e9ee] bg-white dark:bg-ot-dark-card p-4 transition-all"
        style={isActive ? { borderColor: '#2a5fff', borderWidth: 1.5 } : undefined}
      >
        {/* Clickable left area */}
        <button
          type="button"
          onClick={() => navigate(AppRoutes.Workout(workout.id))}
          className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
        >
          <div
            className="flex h-12 w-12 flex-none items-center justify-center rounded-[13px] font-display text-[22px] font-extrabold"
            style={isActive
              ? { background: '#0e0e10', color: '#d8ff36' }
              : { background: 'var(--color-ot-accent-bg)', color: 'var(--color-ot-accent-text)' }
            }
          >
            {letter}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[20px] font-bold uppercase leading-none truncate">
              {workout.focus || workout.name}
            </div>
            <div className="mt-1 flex items-center gap-1.5 font-ot-mono text-[10px] tracking-[0.04em]" style={{ color: '#9a9aa2' }}>
              {workout.location === 'home'
                ? <Home className="h-3 w-3 flex-none" />
                : <Dumbbell className="h-3 w-3 flex-none" />}
              <span>{exLabel} · {doneLabel}</span>
            </div>
          </div>
        </button>

        {/* Action buttons — only for managers */}
        {canManageWorkouts && (
          <div className="flex flex-none gap-1.5">
            <button
              type="button"
              title={t('workouts.archive')}
              onClick={() => setArchiveModal({ isOpen: true, id: workout.id })}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-ot-border bg-ot-paper"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9a9aa2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5" rx="1"/><line x1="10" y1="12" x2="14" y2="12"/>
              </svg>
            </button>
            <button
              type="button"
              title={t('common.delete')}
              onClick={() => setDeleteModal({ isOpen: true, id: workout.id })}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-ot-danger-border bg-ot-danger-bg"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-ot-danger-text)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    )
  }

  const renderPanel = (list: typeof workouts, location: 'gym' | 'home') => (
    <div className="w-1/2 flex-none flex flex-col gap-3">
      {list.length > 0
        ? list.map((workout, index) => renderWorkoutCard(workout, index))
        : (
          <div className="rounded-2xl border-2 border-dashed border-ot-border py-12 text-center">
            <p className="text-sm" style={{ color: '#6a6a72' }}>
              {location === 'home' ? t('workouts.empty_home', 'Nenhum treino em casa ainda.') : t('workouts.empty_gym', 'Nenhum treino na academia ainda.')}
            </p>
          </div>
        )}
    </div>
  )

  return (
    <div className="min-h-screen pb-28 font-ui" style={{ background: 'var(--color-ot-paper)', color: 'var(--color-ot-ink)' }}>

      {/* ── Header ── */}
      <div className="flex items-end justify-between px-6 pt-14 pb-0">
        <div>
          <div className="font-ot-mono text-[10px] tracking-[0.16em] uppercase" style={{ color: '#9a9aa2' }}>
            {workouts.length} {t('workouts.programs')}
          </div>
          <h1 className="font-display text-[34px] font-extrabold uppercase leading-none mt-0.5">
            {t('workouts.my_workouts')}
          </h1>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-6 mt-5 flex flex-col gap-3">
        {isLoading && workouts.length === 0 ? (
          <>
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3.5 rounded-2xl border border-[#e9e9ee] bg-white dark:bg-ot-dark-card p-4">
                <Skeleton className="h-12 w-12 rounded-[13px]" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            {/* Create-from-scratch card (top) */}
            {canManageWorkouts && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-3.5 rounded-2xl border-2 border-dashed border-ot-border bg-transparent p-4 text-left transition-all active:scale-[0.98]"
              >
                <div
                  className="flex h-12 w-12 flex-none items-center justify-center rounded-[13px]"
                  style={{ border: '2px solid var(--color-ot-blue)', color: 'var(--color-ot-blue)', fontSize: 26, fontWeight: 300 }}
                >
                  +
                </div>
                <div>
                  <div className="font-display text-[20px] font-bold uppercase leading-none" style={{ color: '#2a5fff' }}>
                    {t('workouts.create_from_scratch')}
                  </div>
                  <div className="mt-1 font-ot-mono text-[10px] tracking-[0.04em]" style={{ color: '#9a9aa2' }}>
                    {t('workouts.own_coach')}
                  </div>
                </div>
              </button>
            )}

            {workouts.length > 0 ? (
              <>
                {/* Tabs: Academia / Casa */}
                <div className="relative mt-2 flex rounded-[14px] border border-ot-border p-1" style={{ background: 'var(--color-ot-card)' }}>
                  <div
                    className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-[11px] bg-ot-blue transition-transform duration-300 ease-out"
                    style={{ transform: activeTab === 'gym' ? 'translateX(0)' : 'translateX(100%)' }}
                  />
                  {(['gym', 'home'] as const).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className="relative z-10 flex flex-1 items-center justify-center gap-2 py-2.5 font-display text-[13px] font-bold uppercase transition-colors"
                      style={{ color: activeTab === tab ? '#fff' : 'var(--color-ot-muted)' }}
                    >
                      {tab === 'gym' ? <Dumbbell className="h-4 w-4" /> : <Home className="h-4 w-4" />}
                      {tab === 'gym' ? t('workouts.location_gym', 'Academia') : t('workouts.location_home', 'Casa')}
                    </button>
                  ))}
                </div>

                {/* Sliding panels */}
                <div className="overflow-hidden">
                  <div
                    className="flex w-[200%] transition-transform duration-300 ease-out"
                    style={{ transform: activeTab === 'gym' ? 'translateX(0)' : 'translateX(-50%)' }}
                  >
                    {renderPanel(gymWorkouts, 'gym')}
                    {renderPanel(homeWorkouts, 'home')}
                  </div>
                </div>
              </>
            ) : !canManageWorkouts ? (
              <div className="rounded-2xl border-2 border-dashed border-ot-border py-12 text-center">
                <p className="text-sm" style={{ color: '#6a6a72' }}>{t('home.no_workouts')}</p>
                <p className="mt-2 text-xs" style={{ color: '#9a9aa2' }}>{t('home.student_no_workouts')}</p>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* ── Bottom nav ── */}
      <BottomNav />

      {/* ── Archive / Delete modals ── */}
      <AlertModal
        isOpen={archiveModal.isOpen}
        onClose={() => setArchiveModal({ isOpen: false, id: null })}
        onConfirm={handleArchive}
        variant="info"
        title={t('workouts.archive_title')}
        description={t('workouts.archive_desc')}
        confirmLabel={t('workouts.archive_confirm')}
      />
      <AlertModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null })}
        onConfirm={handleDelete}
        variant="danger"
        title={t('workouts.delete_title')}
        description={t('workouts.delete_desc_full')}
        confirmLabel={t('common.delete')}
      />

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
                {t('workouts.location_label', 'Local')}
              </label>
              <div className="flex gap-2">
                {([['gym', Dumbbell, t('workouts.location_gym', 'Academia')], ['home', Home, t('workouts.location_home', 'Casa')]] as const).map(([value, Icon, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setNewWorkoutLocation(value)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-[11px] border py-2.5 font-display text-[13px] font-bold uppercase transition-colors"
                    style={newWorkoutLocation === value
                      ? { background: '#2a5fff', borderColor: '#2a5fff', color: '#fff' }
                      : { borderColor: 'var(--color-ot-border)', color: 'var(--color-ot-muted)', background: 'transparent' }}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="font-ot-mono text-[9px] tracking-[0.16em] text-ot-faint uppercase block mb-1.5">
                {t('common.notes')} ({t('common.optional')})
              </label>
              <textarea
                className="flex w-full rounded-md border border-ot-border bg-white dark:bg-ot-dark-card px-3 py-2 text-sm text-ot-ink placeholder:text-ot-faint focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ot-blue h-20 resize-none"
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
