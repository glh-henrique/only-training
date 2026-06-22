import { useEffect, useMemo, useState } from 'react'
import { Dumbbell, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useWorkoutStore } from '../stores/useWorkoutStore'
import { useSessionStore } from '../stores/useSessionStore'
import { Modal } from '../components/ui/modal'
import { Input } from '../components/ui/input'
import { useAuthStore } from '../stores/useAuthStore'
import { Skeleton } from '../components/ui/skeleton'
import { useHistoryStore } from '../stores/useHistoryStore'
import { fetchDailyWorkoutContext, generateDailyMotivation, type DailyMotivationResult } from '../lib/dailyMotivation'
import { BottomNav } from '../components/BottomNav'

const DAILY_MOTIVATION_ENABLED = false

const MON_SUN_INDICES = [1, 2, 3, 4, 5, 6, 0]

function getGreeting(lang: string): string {
  const h = new Date().getHours()
  if (lang.startsWith('pt')) {
    if (h < 12) return 'Bom dia,'
    if (h < 18) return 'Boa tarde,'
    return 'Boa noite,'
  }
  if (h < 12) return 'Good morning,'
  if (h < 18) return 'Good afternoon,'
  return 'Good evening,'
}

function formatDateLabel(lang: string) {
  const now = new Date()
  const locale = lang.startsWith('pt') ? 'pt-BR' : 'en-US'
  const weekday = now.toLocaleDateString(locale, { weekday: 'long' }).toUpperCase()
  const day = now.getDate()
  const month = now.toLocaleDateString(locale, { month: 'short' }).toUpperCase().replace('.', '')
  return `${weekday} • ${day} ${month}`
}

function estimateDuration(items: { default_sets?: number | null; rest_seconds?: number | null }[]) {
  if (!items.length) return null
  const secs = items.reduce((acc, item) => {
    const sets = item.default_sets ?? 3
    const rest = item.rest_seconds ?? 60
    return acc + sets * (40 + rest)
  }, 0)
  return Math.round(secs / 60)
}

export default function Home() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { user, role, hasActiveCoach } = useAuthStore()
  const { workouts, fetchWorkouts, fetchWorkoutItems, activeWorkoutItems, createWorkout, lastSession, isLoading } = useWorkoutStore()
  const { currentSession, resumeSession, duration, hasNotifiedLongWorkout, setHasNotifiedLongWorkout } = useSessionStore()
  const { sessions: historySessions, fetchHistory } = useHistoryStore()
  const canManageWorkouts = role === 'instrutor' || (role === 'aluno' && !hasActiveCoach)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newWorkoutName, setNewWorkoutName] = useState('')
  const [newWorkoutFocus, setNewWorkoutFocus] = useState('')
  const [newWorkoutNotes, setNewWorkoutNotes] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [motivation, setMotivation] = useState<DailyMotivationResult | null>(null)
  const [isMotivationModalOpen, setIsMotivationModalOpen] = useState(false)

  useEffect(() => {
    fetchWorkouts()
    resumeSession()
    fetchHistory()
  }, [fetchWorkouts, resumeSession, fetchHistory])

  const heroWorkout = useMemo(() => {
    if (currentSession?.workout_id) return workouts.find(w => w.id === currentSession.workout_id) ?? workouts[0] ?? null
    return workouts[0] ?? null
  }, [currentSession?.workout_id, workouts])

  useEffect(() => {
    if (heroWorkout?.id) fetchWorkoutItems(heroWorkout.id)
  }, [heroWorkout?.id, fetchWorkoutItems])

  const workoutOfDayId = heroWorkout?.id ?? null
  const workoutOfDay = heroWorkout

  useEffect(() => {
    if (!DAILY_MOTIVATION_ENABLED || !user?.id || !workoutOfDayId) { return }
    let cancelled = false
    const load = async () => {
      try {
        const context = await fetchDailyWorkoutContext(user.id, workoutOfDayId, i18n.language, workoutOfDay)
        const result = await generateDailyMotivation(user.id, context)
        if (!cancelled) setMotivation(result)
      } catch { if (!cancelled) setMotivation(null) }
    }
    void load()
    return () => { cancelled = true }
  }, [i18n.language, user?.id, workoutOfDayId, workoutOfDay])

  const handleCreateWorkout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWorkoutName || !newWorkoutFocus) return
    setIsCreating(true)
    const newId = await createWorkout(newWorkoutName, newWorkoutFocus, newWorkoutNotes)
    if (newId) navigate(`workout/${newId}/edit`)
    setIsCreating(false)
    setIsModalOpen(false)
    setNewWorkoutName(''); setNewWorkoutFocus(''); setNewWorkoutNotes('')
  }

  const lang = i18n.language
  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] || user?.email?.split('@')[0] || '—'
  const greeting = getGreeting(lang)
  const dateLabel = formatDateLabel(lang)

  const heroItemCount = activeWorkoutItems.length
  const heroEstMin = estimateDuration(activeWorkoutItems)
  const heroLastDuration = lastSession?.workout_id === heroWorkout?.id
    ? Math.round((lastSession?.duration_seconds ?? 0) / 60)
    : heroEstMin

  const today = useMemo(() => new Date(), [])
  const startOfWeek = useMemo(() => {
    const dow = today.getDay()
    const d = new Date(today)
    d.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
    d.setHours(0, 0, 0, 0)
    return d
  }, [today])

  const completedDates = useMemo(() => {
    const s = new Set<string>()
    historySessions.forEach(sess => {
      if (!sess.ended_at) return
      const d = new Date(sess.ended_at)
      if (d >= startOfWeek) s.add(d.toDateString())
    })
    return s
  }, [historySessions, startOfWeek])

  const weekDates = MON_SUN_INDICES.map((_, i) => {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    return d
  })

  const heroIndex = workouts.findIndex(w => w.id === heroWorkout?.id)
  const planLetter = heroIndex >= 0 ? String.fromCharCode(65 + heroIndex) : 'A'

  const streak = useMemo(() => {
    const datesSet = new Set(historySessions.filter(s => s.ended_at).map(s => new Date(s.ended_at!).toDateString()))
    let count = 0
    const d = new Date(today)
    d.setHours(0, 0, 0, 0)
    while (datesSet.has(d.toDateString())) { count++; d.setDate(d.getDate() - 1) }
    if (count === 0) {
      const y = new Date(today); y.setDate(y.getDate() - 1); y.setHours(0, 0, 0, 0)
      while (datesSet.has(y.toDateString())) { count++; y.setDate(y.getDate() - 1) }
    }
    return count
  }, [historySessions, today])

  // Longest streak ever (record)
  const longestStreak = useMemo(() => {
    const DAY = 86400000
    const days = Array.from(
      new Set(historySessions.filter(s => s.ended_at).map(s => {
        const d = new Date(s.ended_at!); d.setHours(0, 0, 0, 0); return d.getTime()
      }))
    ).sort((a, b) => a - b)
    let best = 0, run = 0, prev: number | null = null
    for (const tm of days) {
      run = prev !== null && tm - prev === DAY ? run + 1 : 1
      if (run > best) best = run
      prev = tm
    }
    return Math.max(best, streak)
  }, [historySessions, streak])

  // Next milestone for the momentum bar
  const MILESTONES = [7, 15, 30, 60, 100, 180, 365]
  const nextMilestone = MILESTONES.find(m => m > streak) ?? streak + 30
  const milestoneRemaining = nextMilestone - streak
  const milestonePct = Math.min(100, Math.round((streak / nextMilestone) * 100))

  // Single-letter weekday labels (Mon→Sun) for the week dots
  const DOW_LETTERS = (lang.startsWith('pt') ? ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'])

  return (
    <div className="flex min-h-[100dvh] flex-col pb-[84px] font-ui" style={{ background: '#f5f5f2', color: '#0e0e10' }}>

      {/* ── Top bar: date + greeting ── */}
      <div className="flex flex-none items-start justify-between px-6 pt-14">
        <div>
          <div className="font-ot-mono text-[10px] tracking-[0.16em] uppercase" style={{ color: '#9a9aa2' }}>
            {dateLabel}
          </div>
          <h1 className="font-display text-[30px] font-extrabold uppercase leading-none mt-0.5">
            {greeting} {firstName}
          </h1>
        </div>
      </div>

      {/* ── Cards (fill remaining space) ── */}
      <div className="flex flex-1 flex-col gap-4 px-6 pt-5">

      {/* ── Hero card ── */}
      <div className="flex flex-1">
        {isLoading && !heroWorkout ? (
          <div className="w-full flex-1 rounded-[22px] p-5 space-y-4" style={{ background: '#0e0e10' }}>
            <Skeleton className="h-3 w-36 bg-white/10" />
            <Skeleton className="h-8 w-3/4 bg-white/10" />
            <div className="flex gap-4 mt-2">
              <Skeleton className="h-12 w-16 bg-white/10" />
              <Skeleton className="h-12 w-16 bg-white/10" />
              <Skeleton className="h-12 w-16 bg-white/10" />
            </div>
            <Skeleton className="h-12 w-full rounded-2xl bg-white/10 mt-2" />
          </div>
        ) : heroWorkout ? (
          <div className="relative flex w-full flex-1 flex-col justify-between overflow-hidden rounded-[22px] p-5" style={{ background: '#0e0e10' }}>
            {/* lime glow */}
            <div
              className="pointer-events-none absolute"
              style={{ right: -30, top: -30, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(closest-side,rgba(216,255,54,.22),transparent)' }}
            />
            <div className="relative">
              <p className="font-ot-mono text-[10px] tracking-[0.16em]" style={{ color: '#9a9aa2' }}>
                {lang.startsWith('pt') ? `TREINO DE HOJE · ${planLetter}` : `TODAY'S WORKOUT · ${planLetter}`}
              </p>
              <h2 className="mt-1.5 font-display text-[34px] font-extrabold uppercase leading-[0.96] text-white">
                {heroWorkout.focus || heroWorkout.name}
              </h2>
              <div className="mt-3.5 flex gap-5">
                {heroItemCount > 0 && (
                  <div>
                    <p className="font-display text-[24px] font-bold leading-none" style={{ color: '#d8ff36' }}>{heroItemCount}</p>
                    <p className="mt-1 font-ot-mono text-[9px] tracking-[0.1em]" style={{ color: '#9a9aa2' }}>
                      {lang.startsWith('pt') ? 'EXERCÍCIOS' : 'EXERCISES'}
                    </p>
                  </div>
                )}
                {heroLastDuration != null && heroLastDuration > 0 && (
                  <div>
                    <p className="font-display text-[24px] font-bold leading-none text-white">
                      ~{heroLastDuration}<span className="text-sm"> min</span>
                    </p>
                    <p className="mt-1 font-ot-mono text-[9px] tracking-[0.1em]" style={{ color: '#9a9aa2' }}>
                      {lang.startsWith('pt') ? 'DURAÇÃO' : 'DURATION'}
                    </p>
                  </div>
                )}
                {(heroWorkout.completed_count ?? 0) > 0 && (
                  <div>
                    <p className="font-display text-[24px] font-bold leading-none text-white">{heroWorkout.completed_count}</p>
                    <p className="mt-1 font-ot-mono text-[9px] tracking-[0.1em]" style={{ color: '#9a9aa2' }}>
                      {lang.startsWith('pt') ? 'SESSÕES' : 'SESSIONS'}
                    </p>
                  </div>
                )}
              </div>
            </div>
            {currentSession?.workout_id === heroWorkout.id ? (
              <Link
                to={`/workout/${heroWorkout.id}`}
                className="relative mt-4 flex w-full items-center justify-center rounded-[13px] py-3.5 font-display text-[23px] font-extrabold uppercase"
                style={{ background: '#d8ff36', color: '#0a0a0a' }}
              >
                {lang.startsWith('pt') ? 'CONTINUAR TREINO →' : 'CONTINUE WORKOUT →'}
              </Link>
            ) : (
              <button
                onClick={() => navigate(`/workout/${heroWorkout.id}`, { state: { autoStart: true } })}
                className="relative mt-4 w-full rounded-[13px] py-3.5 font-display text-[23px] font-extrabold uppercase"
                style={{ background: '#d8ff36', color: '#0a0a0a' }}
              >
                {lang.startsWith('pt') ? 'INICIAR TREINO →' : 'START WORKOUT →'}
              </button>
            )}
          </div>
        ) : (
          <div className="flex w-full flex-1 flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-[#e0e0e4] py-10 text-center">
            <Dumbbell className="mx-auto h-8 w-8 mb-3" style={{ color: '#9a9aa2' }} />
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

      {/* ── Ofensiva / momentum ── */}
      <div className="relative flex flex-1 flex-col justify-between overflow-hidden rounded-[20px] p-[17px_18px]" style={{ background: '#0e0e10' }}>
        <style>{`@keyframes otbob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`}</style>
        <div className="pointer-events-none absolute" style={{ right: -30, top: -34, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(closest-side,rgba(216,255,54,.22),transparent)' }} />

        {/* streak + record */}
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="inline-block"
              style={{ width: 30, height: 38, background: '#ff5a2c', clipPath: 'polygon(50% 0,80% 45%,65% 45%,90% 100%,50% 70%,10% 100%,35% 45%,20% 45%)', animation: 'otbob 2.4s ease-in-out infinite' }}
            />
            <div className="flex items-baseline gap-2">
              <span className="font-display font-black" style={{ fontSize: 52, lineHeight: 0.7, color: '#fff' }}>{streak}</span>
              <span className="font-display font-bold uppercase leading-none" style={{ fontSize: 20, color: '#c6ff3f' }}>
                {lang.startsWith('pt') ? <>dias<br />em chamas</> : <>days<br />on fire</>}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display font-bold leading-none" style={{ fontSize: 22, color: '#fff' }}>{longestStreak}</div>
            <div className="font-ot-mono mt-0.5" style={{ fontSize: 8, letterSpacing: '0.1em', color: '#6e6e6e' }}>
              {lang.startsWith('pt') ? 'RECORDE' : 'RECORD'}
            </div>
          </div>
        </div>

        {/* momentum bar to next milestone */}
        <div className="relative mt-4">
          <div className="mb-[7px] flex items-center justify-between">
            <span className="font-ot-mono" style={{ fontSize: 9, letterSpacing: '0.12em', color: '#9a9aa2' }}>
              {lang.startsWith('pt') ? `PRÓXIMO MARCO · ${nextMilestone} DIAS` : `NEXT MILESTONE · ${nextMilestone} DAYS`}
            </span>
            <span className="font-display font-bold uppercase" style={{ fontSize: 14, color: '#c6ff3f' }}>
              {lang.startsWith('pt') ? `faltam ${milestoneRemaining}` : `${milestoneRemaining} to go`}
            </span>
          </div>
          <div className="relative overflow-hidden" style={{ height: 10, background: '#1f1f1f', borderRadius: 999 }}>
            <div style={{ width: `${milestonePct}%`, height: '100%', background: 'linear-gradient(90deg,#ff5a2c,#c6ff3f)', borderRadius: 999 }} />
          </div>
        </div>

        {/* this week */}
        <div className="relative mt-[18px] flex items-center justify-between border-t pt-[13px]" style={{ borderColor: '#232323' }}>
          <span className="font-display font-bold uppercase" style={{ fontSize: 15, color: '#fff' }}>
            {lang.startsWith('pt') ? 'Esta semana' : 'This week'}
          </span>
          <div className="flex items-center gap-[7px]">
            {weekDates.map((d, i) => {
              const isDone = completedDates.has(d.toDateString())
              const isToday = d.toDateString() === today.toDateString()
              const isFuture = d > today
              const isMissed = !isDone && !isToday && !isFuture
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span
                    className="inline-flex items-center justify-center"
                    style={{
                      width: 18, height: 18, borderRadius: '50%',
                      ...(isDone
                        ? { background: '#c6ff3f' }
                        : isToday
                        ? { background: '#0e0e10', border: '2px solid #c6ff3f' }
                        : isFuture
                        ? { background: '#1a1a1a' }
                        : { background: '#2a1414', border: '1px solid #ff3b3b' }),
                    }}
                  >
                    {isMissed && <X size={12} strokeWidth={3} color="#ff3b3b" />}
                  </span>
                  <span className="font-ot-mono" style={{ fontSize: 8, color: isToday ? '#c6ff3f' : '#6e6e6e', fontWeight: isToday ? 700 : 400 }}>
                    {DOW_LETTERS[i]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      </div>

      {/* ── Bottom nav ── */}
      <BottomNav />

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

      {/* ── Long Workout Warning Modal ── */}
      <Modal
        isOpen={!!currentSession && duration >= 3600 && !hasNotifiedLongWorkout}
        onClose={() => setHasNotifiedLongWorkout(true)}
        title={t('session.long_workout_notification')}
      >
        <div className="space-y-4">
          <p className="text-ot-muted">{t('session.long_workout_modal_desc')}</p>
          <button
            className="w-full rounded-[15px] bg-ot-lime py-[15px] font-display text-xl font-extrabold uppercase text-ot-ink"
            onClick={() => setHasNotifiedLongWorkout(true)}
          >
            {t('common.save')}
          </button>
        </div>
      </Modal>

      {/* ── Motivation Modal ── */}
      <Modal
        isOpen={isMotivationModalOpen && !!motivation}
        onClose={() => setIsMotivationModalOpen(false)}
        title={motivation?.detailsTitle ?? t('home.motivation_title')}
      >
        <div className="space-y-4">
          <p className="text-sm font-semibold text-ot-blue">{motivation?.message}</p>
          <p className="text-ot-muted">{motivation?.detailsBody}</p>
          <div className="rounded-2xl border border-ot-border bg-ot-paper px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-ot-ink">
              {t('home.motivation_tip_title')}
            </p>
            <p className="mt-2 text-sm text-ot-muted">{motivation?.improvementTip}</p>
          </div>
          <button
            className="w-full rounded-[15px] bg-ot-blue py-[15px] font-display text-xl font-extrabold uppercase text-white"
            onClick={() => setIsMotivationModalOpen(false)}
          >
            {t('common.ok')}
          </button>
        </div>
      </Modal>
    </div>
  )
}
