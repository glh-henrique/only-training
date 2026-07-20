import { useEffect, useMemo, useState } from 'react'
import { Dumbbell, X, Home as HomeIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useWorkoutStore } from '../stores/useWorkoutStore'
import { useSessionStore } from '../stores/useSessionStore'
import { Modal } from '../components/ui/modal'
import { Input } from '../components/ui/input'
import { useAuthStore } from '../stores/useAuthStore'
import { AppRoutes } from '../constants/routes'
import { UserRole } from '../constants/auth'
import { Skeleton } from '../components/ui/skeleton'
import { useHistoryStore } from '../stores/useHistoryStore'
import { fetchDailyWorkoutContext, generateDailyMotivation, type DailyMotivationResult } from '../lib/dailyMotivation'
import { estimateDuration, computeStreak, computeLongestStreak } from '../lib/stats'
import { BottomNav } from '../components/BottomNav'
import { getNextWorkout, isSameCalendarDay } from '../core'
import chamaSvg from '../assets/chama.svg'

const DAILY_MOTIVATION_ENABLED = false

const MON_SUN_INDICES = [1, 2, 3, 4, 5, 6, 0]

function getGreetingKey(): string {
  const h = new Date().getHours()
  if (h < 12) return 'home.greeting_morning'
  if (h < 18) return 'home.greeting_afternoon'
  return 'home.greeting_evening'
}

function formatDateLabel(lang: string) {
  const now = new Date()
  const locale = lang.startsWith('pt') ? 'pt-BR' : 'en-US'
  const weekday = now.toLocaleDateString(locale, { weekday: 'long' }).toUpperCase()
  const day = now.getDate()
  const month = now.toLocaleDateString(locale, { month: 'short' }).toUpperCase().replace('.', '')
  return `${weekday} • ${day} ${month}`
}

export default function Home() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { user, role, hasActiveCoach } = useAuthStore()
  const { workouts, fetchWorkouts, fetchWorkoutItems, activeWorkoutItems, activeItemsWorkoutId, createWorkout, lastSession, isLoading } = useWorkoutStore()
  const { currentSession, resumeSession, duration, hasNotifiedLongWorkout, setHasNotifiedLongWorkout } = useSessionStore()
  const { sessions: historySessions, fetchHistory, hasFetched: historyFetched } = useHistoryStore()
  const canManageWorkouts = role === UserRole.Instructor || (role === UserRole.Student && !hasActiveCoach)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newWorkoutName, setNewWorkoutName] = useState('')
  const [newWorkoutFocus, setNewWorkoutFocus] = useState('')
  const [newWorkoutNotes, setNewWorkoutNotes] = useState('')
  const [newWorkoutLocation, setNewWorkoutLocation] = useState<'home' | 'gym'>('gym')
  const [isCreating, setIsCreating] = useState(false)
  const [motivation, setMotivation] = useState<DailyMotivationResult | null>(null)
  const [isMotivationModalOpen, setIsMotivationModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'gym' | 'home'>('gym')

  useEffect(() => {
    fetchWorkouts()
    resumeSession()
    fetchHistory()
  }, [fetchWorkouts, resumeSession, fetchHistory])

  // Só filtra por local quando existem treinos nas duas categorias.
  const showLocationTabs = useMemo(
    () => workouts.some(w => w.location === 'home') && workouts.some(w => w.location !== 'home'),
    [workouts]
  )
  // Treinos do local selecionado (Academia/Casa). Sem as duas categorias, usa todos.
  const tabWorkouts = useMemo(
    () => showLocationTabs ? workouts.filter(w => activeTab === 'home' ? w.location === 'home' : w.location !== 'home') : workouts,
    [workouts, activeTab, showLocationTabs]
  )

  const heroWorkout = useMemo(() => {
    if (currentSession?.workout_id) return workouts.find(w => w.id === currentSession.workout_id) ?? tabWorkouts[0] ?? null
    return getNextWorkout(tabWorkouts, lastSession)
  }, [currentSession?.workout_id, workouts, tabWorkouts, lastSession])

  const trainedToday = !currentSession && !!lastSession?.ended_at && isSameCalendarDay(new Date(), new Date(lastSession.ended_at))
  const lastWorkout = tabWorkouts.find(w => w.id === lastSession?.workout_id) ?? null
  const nextAfterHero = getNextWorkout(tabWorkouts, heroWorkout ? { workout_id: heroWorkout.id, ended_at: null } : null)

  useEffect(() => {
    // Já carregado para este workout (ex.: StrictMode/remount, volta de navegação): não re-busca.
    if (heroWorkout?.id && heroWorkout.id !== activeItemsWorkoutId) fetchWorkoutItems(heroWorkout.id)
  }, [heroWorkout?.id, activeItemsWorkoutId, fetchWorkoutItems])

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
    const newId = await createWorkout(newWorkoutName, newWorkoutFocus, newWorkoutNotes, newWorkoutLocation)
    if (newId) navigate(`workout/${newId}/edit`)
    setIsCreating(false)
    setIsModalOpen(false)
    setNewWorkoutName(''); setNewWorkoutFocus(''); setNewWorkoutNotes(''); setNewWorkoutLocation('gym')
  }

  const lang = i18n.language
  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] || user?.email?.split('@')[0] || '—'
  const greeting = t(getGreetingKey())
  const dateLabel = formatDateLabel(lang)

  // Itens do hero ainda não chegaram → mostra skeleton no lugar (evita quebra de layout).
  const heroItemsReady = !!heroWorkout && activeItemsWorkoutId === heroWorkout.id
  const heroItemCount = activeWorkoutItems.length
  const heroEstMin = estimateDuration(activeWorkoutItems)
  const heroLastDuration = lastSession?.workout_id === heroWorkout?.id
    ? Math.round((lastSession?.duration_seconds ?? 0) / 60)
    : heroEstMin

  // Streak/recorde/marco dependem do histórico (não persistido) → skeleton até a 1ª carga.
  const streakReady = historyFetched || historySessions.length > 0

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

  const heroIndex = tabWorkouts.findIndex(w => w.id === heroWorkout?.id)
  const planLetter = heroIndex >= 0 ? String.fromCharCode(65 + heroIndex) : 'A'

  const streak = useMemo(() => computeStreak(historySessions, today), [historySessions, today])

  // Longest streak ever (record)
  const longestStreak = useMemo(() => computeLongestStreak(historySessions, streak), [historySessions, streak])

  // Next milestone for the momentum bar
  const MILESTONES = [7, 15, 30, 60, 100, 180, 365]
  const nextMilestone = MILESTONES.find(m => m > streak) ?? streak + 30
  const milestoneRemaining = nextMilestone - streak
  const milestonePct = Math.min(100, Math.round((streak / nextMilestone) * 100))

  // Single-letter weekday labels (Mon→Sun) for the week dots
  const DOW_LETTERS = (t('home.dow_letters').split(','))

  // Tabs Academia/Casa dentro do card preto: só ícones, nas cores do card.
  const tabBar = showLocationTabs && (
    <div className="relative z-10 mb-3 inline-grid w-fit grid-cols-2 self-start rounded-full p-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <div
        className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full transition-transform duration-300 ease-out"
        style={{ transform: activeTab === 'gym' ? 'translateX(0)' : 'translateX(100%)', background: '#d8ff36' }}
      />
      {(['gym', 'home'] as const).map(tab => (
        <button
          key={tab}
          type="button"
          onClick={() => setActiveTab(tab)}
          aria-label={tab === 'gym' ? t('workouts.location_gym', 'Academia') : t('workouts.location_home', 'Casa')}
          className="relative z-10 flex items-center justify-center px-4 py-1.5 transition-colors"
          style={{ color: activeTab === tab ? '#0a0a0a' : '#6a6a72' }}
        >
          {tab === 'gym' ? <Dumbbell className="h-4 w-4" /> : <HomeIcon className="h-4 w-4" />}
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex min-h-[100dvh] flex-col pb-[84px] font-ui" style={{ background: 'var(--color-ot-paper)', color: 'var(--color-ot-ink)' }}>

      {/* ── Top bar: date + greeting ── */}
      <div className="flex flex-none items-start justify-between px-6 pt-14 [@media(max-height:750px)]:pt-7">
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
      <div className="flex flex-1 flex-col gap-4 px-6 pt-5 [@media(max-height:750px)]:gap-2.5 [@media(max-height:750px)]:pt-3">

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
            {tabBar}
            {/* Último treino */}
            {lastWorkout && (
              <div className="relative flex items-center justify-between border-b pb-3" style={{ borderColor: '#232323' }}>
                <p className="font-ot-mono text-[9px] tracking-[0.1em]" style={{ color: '#6a6a72' }}>
                  {t('home.last_workout')}
                </p>
                <p className="font-display text-[15px] font-bold uppercase leading-none" style={{ color: '#9a9aa2' }}>
                  {lastWorkout.focus || lastWorkout.name}
                </p>
              </div>
            )}
            <div className="relative flex flex-1 flex-col justify-center">
              {/* Treino atual */}
              <p className="font-ot-mono text-[10px] tracking-[0.16em]" style={{ color: '#9a9aa2' }}>
                {trainedToday
                  ? (t('home.next_workout_letter', { letter: planLetter }))
                  : (t('home.today_workout_letter', { letter: planLetter }))}
              </p>
              <h2 className="mt-1.5 font-display text-[34px] font-extrabold uppercase leading-[0.96] text-white">
                {heroWorkout.focus || heroWorkout.name}
              </h2>
              <div className="mt-3.5 flex gap-5">
                {!heroItemsReady ? (
                  <>
                    <div>
                      <Skeleton className="h-6 w-8 bg-white/10" />
                      <Skeleton className="mt-1.5 h-2 w-12 bg-white/10" />
                    </div>
                    <div>
                      <Skeleton className="h-6 w-12 bg-white/10" />
                      <Skeleton className="mt-1.5 h-2 w-12 bg-white/10" />
                    </div>
                  </>
                ) : (
                  <>
                    {heroItemCount > 0 && (
                      <div>
                        <p className="font-display text-[24px] font-bold leading-none" style={{ color: '#d8ff36' }}>{heroItemCount}</p>
                        <p className="mt-1 font-ot-mono text-[9px] tracking-[0.1em]" style={{ color: '#9a9aa2' }}>
                          {t('home.stat_exercises')}
                        </p>
                      </div>
                    )}
                    {heroLastDuration != null && heroLastDuration > 0 && (
                      <div>
                        <p className="font-display text-[24px] font-bold leading-none text-white">
                          ~{heroLastDuration}<span className="text-sm"> min</span>
                        </p>
                        <p className="mt-1 font-ot-mono text-[9px] tracking-[0.1em]" style={{ color: '#9a9aa2' }}>
                          {t('home.stat_duration')}
                        </p>
                      </div>
                    )}
                  </>
                )}
                {(heroWorkout.completed_count ?? 0) > 0 && (
                  <div>
                    <p className="font-display text-[24px] font-bold leading-none text-white">{heroWorkout.completed_count}</p>
                    <p className="mt-1 font-ot-mono text-[9px] tracking-[0.1em]" style={{ color: '#9a9aa2' }}>
                      {t('home.stat_sessions')}
                    </p>
                  </div>
                )}
              </div>
              {currentSession?.workout_id === heroWorkout.id ? (
                <Link
                  to={`/workout/${heroWorkout.id}`}
                  className="relative mt-5 flex w-full items-center justify-center rounded-[13px] py-3.5 font-display text-[23px] font-extrabold uppercase"
                  style={{ background: '#d8ff36', color: '#0a0a0a' }}
                >
                  {t('home.continue_workout')}
                </Link>
              ) : (
                <button
                  onClick={() => navigate(AppRoutes.Workout(heroWorkout.id), { state: { autoStart: true } })}
                  className="relative mt-5 flex w-full flex-col items-center justify-center gap-1 rounded-[13px] py-3.5"
                  style={{ background: '#d8ff36', color: '#0a0a0a' }}
                >
                  {trainedToday && (
                    <>
                      <span className="font-display text-[15px] font-extrabold uppercase leading-none">
                        {t('home.trained_today')}
                      </span>
                      <span className="font-ot-mono text-[10px] font-normal normal-case leading-none opacity-70">
                        {t('home.trained_today_hint')}
                      </span>
                    </>
                  )}
                  <span className="font-display text-[23px] font-extrabold uppercase leading-none">
                    {trainedToday
                      ? (t('home.start_workout'))
                      : (t('home.start_workout_arrow'))}
                  </span>
                </button>
              )}
            </div>
            {/* Próximo treino (só faz sentido como prévia quando o hero ainda é o treino de hoje) */}
            {nextAfterHero && !trainedToday && (
              <div className="relative mt-3 flex items-center justify-between border-t pt-3" style={{ borderColor: '#232323' }}>
                <p className="font-ot-mono text-[9px] tracking-[0.1em]" style={{ color: '#6a6a72' }}>
                  {t('home.next_workout')}
                </p>
                <p className="font-display text-[15px] font-bold uppercase leading-none" style={{ color: '#9a9aa2' }}>
                  {nextAfterHero.focus || nextAfterHero.name}
                </p>
              </div>
            )}
          </div>
        ) : workouts.length > 0 ? (
          <div className="relative flex w-full flex-1 flex-col overflow-hidden rounded-[22px] p-5" style={{ background: '#0e0e10' }}>
            <div className="pointer-events-none absolute" style={{ right: -30, top: -30, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(closest-side,rgba(216,255,54,.22),transparent)' }} />
            {tabBar}
            <div className="relative flex flex-1 flex-col items-center justify-center text-center">
              {activeTab === 'home'
                ? <HomeIcon className="mb-3 h-8 w-8" style={{ color: '#6a6a72' }} />
                : <Dumbbell className="mb-3 h-8 w-8" style={{ color: '#6a6a72' }} />}
              <p className="text-sm" style={{ color: '#6a6a72' }}>
                {activeTab === 'home' ? t('workouts.empty_home', 'Nenhum treino em casa ainda.') : t('workouts.empty_gym', 'Nenhum treino na academia ainda.')}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-1 flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-ot-border py-10 text-center">
            <Dumbbell className="mx-auto h-8 w-8 mb-3" style={{ color: '#9a9aa2' }} />
            <p className="text-sm" style={{ color: '#6a6a72' }}>{t('home.no_workouts')}</p>
            {canManageWorkouts && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 font-display text-sm font-bold uppercase text-white"
                style={{ background: 'var(--color-ot-ink)', color: 'var(--color-ot-paper)' }}
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
        <style>{`@keyframes otflame{0%,100%{transform:rotate(-1.5deg) scale(1,1)}25%{transform:rotate(1.5deg) scale(1.04,0.97)}50%{transform:rotate(-1deg) scale(0.97,1.05)}75%{transform:rotate(2deg) scale(1.03,0.98)}}`}</style>
        <div className="pointer-events-none absolute" style={{ right: -30, top: -34, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(closest-side,rgba(216,255,54,.22),transparent)' }} />

        {/* streak + record */}
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={chamaSvg}
              alt=""
              className="inline-block"
              style={{ width: 38, height: 48, transformOrigin: 'bottom center', animation: 'otflame 1.1s ease-in-out infinite' }}
            />
            <div className="flex items-baseline gap-2">
              {streakReady
                ? <span className="font-display font-black" style={{ fontSize: 52, lineHeight: 0.7, color: '#fff' }}>{streak}</span>
                : <Skeleton className="h-10 w-11 bg-white/10" />}
              <span className="font-display font-bold uppercase leading-none" style={{ fontSize: 20, color: '#c6ff3f' }}>
                <>{t('home.streak_unit', { count: streak })}<br />{t('home.on_fire')}</>
              </span>
            </div>
          </div>
          <div className="text-right">
            {streakReady
              ? <div className="font-display font-bold leading-none" style={{ fontSize: 22, color: '#fff' }}>{longestStreak}</div>
              : <Skeleton className="ml-auto h-[18px] w-7 bg-white/10" />}
            <div className="font-ot-mono mt-0.5" style={{ fontSize: 8, letterSpacing: '0.1em', color: '#6e6e6e' }}>
              {t('home.record')}
            </div>
          </div>
        </div>

        {/* momentum bar to next milestone */}
        <div className="relative mt-4">
          <div className="mb-[7px] flex items-center justify-between">
            {streakReady
              ? <span className="font-ot-mono" style={{ fontSize: 9, letterSpacing: '0.12em', color: '#9a9aa2' }}>
                  {t('home.next_milestone', { days: nextMilestone })}
                </span>
              : <Skeleton className="h-2.5 w-32 bg-white/10" />}
            {streakReady
              ? <span className="font-display font-bold uppercase" style={{ fontSize: 14, color: '#c6ff3f' }}>
                  {t('home.milestone_remaining', { count: milestoneRemaining })}
                </span>
              : <Skeleton className="h-3.5 w-16 bg-white/10" />}
          </div>
          <div className="relative overflow-hidden" style={{ height: 10, background: '#1f1f1f', borderRadius: 999 }}>
            {streakReady && <div style={{ width: `${milestonePct}%`, height: '100%', background: 'linear-gradient(90deg,#ff5a2c,#c6ff3f)', borderRadius: 999 }} />}
          </div>
        </div>

        {/* this week */}
        <div className="relative mt-[18px] flex items-center justify-between border-t pt-[13px]" style={{ borderColor: '#232323' }}>
          <span className="font-display font-bold uppercase" style={{ fontSize: 15, color: '#fff' }}>
            {t('home.this_week')}
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
                {t('workouts.location_label', 'Local')}
              </label>
              <div className="flex gap-2">
                {([['gym', Dumbbell, t('workouts.location_gym', 'Academia')], ['home', HomeIcon, t('workouts.location_home', 'Casa')]] as const).map(([value, Icon, label]) => (
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
