import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '../stores/useSessionStore'
import { useWorkoutStore } from '../stores/useWorkoutStore'
import { useAuthStore } from '../stores/useAuthStore'
import { Loading } from '../components/ui/loading'
import { Check, ArrowLeft, Video } from 'lucide-react'
import { getSafeExternalUrl } from '../lib/utils'
import { Modal } from '../components/ui/modal'
import { AlertModal } from '../components/ui/alert-modal'

const WORKOUT_PLAYLIST_ENABLED = false
void WORKOUT_PLAYLIST_ENABLED

type SummaryItem = {
  id: string
  title: string
  isDone: boolean
  weight: number | null
  sets: number | null
  reps: string | null
}

type SummaryData = {
  workoutName: string
  formattedTime: string
  completedCount: number
  totalCount: number
  items: SummaryItem[]
}

const RING_RADIUS = 80
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export default function WorkoutSession() {
  const { t, i18n } = useTranslation()
  const { workoutId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { role, hasActiveCoach } = useAuthStore()

  const [showFinishModal, setShowFinishModal] = useState(false)
  const [showDiscardModal, setShowDiscardModal] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const [isStarting, setIsStarting] = useState(false)

  // Rest timer
  const [restItemId, setRestItemId] = useState<string | null>(null)
  const [restRemaining, setRestRemaining] = useState<number | null>(null)
  const [restTotalSeconds, setRestTotalSeconds] = useState(0)
  const [restItemTitle, setRestItemTitle] = useState('')

  // Summary (4th screen)
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)

  const {
    currentSession,
    sessionItems,
    startSession,
    duration,
    finishSession,
    toggleItemDone,
    updateItemStats,
    resumeSession,
    finishAllInProgressSessions,
    restartSession,
    isLoading,
    error
  } = useSessionStore()

  const { workouts, fetchWorkouts, activeWorkoutItems, fetchWorkoutItems } = useWorkoutStore()

  const isConflict = !isLoading && currentSession && workoutId && currentSession.workout_id !== workoutId
  const isActive = !!currentSession && !!workoutId && currentSession.workout_id === workoutId
  const autoStart = !!(location.state as { autoStart?: boolean } | null)?.autoStart
  const canManageWorkouts = role === 'instrutor' || (role === 'aluno' && !hasActiveCoach)

  const formattedTime = new Date(duration * 1000).toISOString().slice(11, 19).replace(/^00:/, '')

  const totalItems = isActive ? sessionItems.length : activeWorkoutItems.length
  const completedItems = isActive ? sessionItems.filter(i => i.is_done).length : 0

  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    let isMounted = true
    resumeSession().finally(() => { if (isMounted) setIsInitializing(false) })
    return () => { isMounted = false }
  }, [resumeSession])

  useEffect(() => {
    if (!workoutId) return
    if (workouts.length === 0) fetchWorkouts()
    fetchWorkoutItems(workoutId)
  }, [workoutId, fetchWorkouts, fetchWorkoutItems, workouts.length])

  // Rest countdown tick
  useEffect(() => {
    if (restRemaining == null || restRemaining <= 0) return
    const interval = setInterval(() => {
      setRestRemaining(prev => (prev == null ? prev : prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [restRemaining])

  // Rest done: beep + auto-return to session
  useEffect(() => {
    if (restRemaining !== 0 || !restItemId) return
    try {
      const legacyWindow = window as Window & { webkitAudioContext?: typeof AudioContext }
      const AudioCtx = window.AudioContext || legacyWindow.webkitAudioContext
      if (AudioCtx) {
        const ctx = new AudioCtx()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'; osc.frequency.value = 880; gain.gain.value = 0.2
        osc.connect(gain); gain.connect(ctx.destination)
        osc.start(); osc.stop(ctx.currentTime + 0.5)
        osc.onended = () => ctx.close()
      }
    } catch { /* ignore audio errors */ }
    setRestItemId(null)
    setRestRemaining(null)
  }, [restRemaining, restItemId])

  const startRestTimer = (itemId: string, seconds: number | null, title: string) => {
    if (!seconds || seconds <= 0) return
    setRestItemId(itemId)
    setRestItemTitle(title)
    setRestRemaining(seconds)
    setRestTotalSeconds(seconds)
  }

  const skipRest = () => {
    setRestItemId(null)
    setRestRemaining(null)
    setRestTotalSeconds(0)
  }

  useEffect(() => {
    if (!isInitializing && !isLoading && !currentSession && workoutId && !isExiting && autoStart) {
      ;(async () => {
        setIsStarting(true)
        const result = await startSession(workoutId)
        if (result === 'no_items') navigate(`/workout/${workoutId}/edit`)
        setIsStarting(false)
      })()
    }
  }, [isInitializing, isLoading, currentSession, workoutId, startSession, isExiting, navigate, autoStart])

  const handleStart = async () => {
    if (!workoutId || isStarting) return
    setIsStarting(true)
    const result = await startSession(workoutId)
    if (result === 'no_items') navigate(`/workout/${workoutId}/edit`)
    setIsStarting(false)
  }

  const handleFinish = async () => {
    if (!currentSession) return
    const summary: SummaryData = {
      workoutName: currentSession.workout_focus_snapshot || currentSession.workout_name_snapshot || '',
      formattedTime,
      completedCount: completedItems,
      totalCount: totalItems,
      items: sessionItemsForView.map(i => ({
        id: i.id,
        title: i.title,
        isDone: i.isDone,
        weight: i.weight ?? null,
        sets: i.sets ?? null,
        reps: i.reps ?? null,
      }))
    }
    setIsExiting(true)
    await finishSession()
    setSummaryData(summary)
    setIsExiting(false)
  }

  const handleCancel = async () => {
    if (!workoutId) return
    setIsExiting(true)
    setShowDiscardModal(false)
    try {
      if (isConflict) {
        await restartSession(workoutId)
        setIsExiting(false)
      } else {
        await finishAllInProgressSessions()
        navigate('/')
      }
    } catch {
      setIsExiting(false)
    }
  }

  const handleResumeOld = () => {
    if (currentSession) navigate(`/workout/${currentSession.workout_id}`)
  }

  const workout = workouts.find(w => w.id === workoutId)

  const previewItems = useMemo(() => activeWorkoutItems.map(item => ({
    id: item.id,
    title: item.title,
    restSeconds: item.rest_seconds,
    notes: item.notes,
    videoUrl: item.video_url,
    isDone: false,
    weight: item.default_weight,
    sets: item.default_sets,
    reps: item.default_reps,
  })), [activeWorkoutItems])

  const sessionItemsForView = useMemo(() => sessionItems.map(item => ({
    id: item.id,
    title: item.title_snapshot,
    restSeconds: item.rest_seconds,
    notes: item.notes_snapshot,
    videoUrl: item.video_url,
    isDone: item.is_done,
    weight: item.weight,
    sets: item.sets,
    reps: item.reps,
  })), [sessionItems])

  const itemsForView = isActive ? sessionItemsForView : previewItems

  const lang = i18n.language
  const workout_index = workouts.findIndex(w => w.id === workoutId)
  const planLetter = workout_index >= 0 ? String.fromCharCode(65 + workout_index) : 'A'

  const estMin = useMemo(() => {
    if (!activeWorkoutItems.length) return null
    const secs = activeWorkoutItems.reduce((acc, item) => {
      const sets = item.default_sets ?? 3
      const rest = item.rest_seconds ?? 60
      return acc + sets * (40 + rest)
    }, 0)
    return Math.round(secs / 60)
  }, [activeWorkoutItems])

  // ─────────────────────────────────────────────────────────────
  // TELA 4: RESUMO · CONCLUÍDO
  // (checked before loading so it survives the isExiting→false flip)
  // ─────────────────────────────────────────────────────────────
  if (summaryData) {
    const doneItems = summaryData.items.filter(i => i.isDone)
    const skippedItems = summaryData.items.filter(i => !i.isDone)

    return (
      <div className="min-h-screen pb-32 font-ui" style={{ background: '#f5f5f2', color: '#0e0e10' }}>

        {/* Badge + título */}
        <div className="flex flex-col items-center px-6 pt-16">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-[22px] font-display text-[32px] font-extrabold"
            style={{ background: '#d8ff36', color: '#0e0e10' }}
          >
            ✓
          </div>
          <div className="mt-5 font-ot-mono text-[10px] tracking-[0.18em] uppercase" style={{ color: '#9a9aa2' }}>
            {lang.startsWith('pt') ? 'TREINO CONCLUÍDO' : 'WORKOUT COMPLETE'}
          </div>
          <h1 className="mt-1 font-display text-[36px] font-extrabold uppercase leading-none text-center">
            {summaryData.workoutName}
          </h1>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-2.5 px-6">
          <div className="rounded-[16px] border border-[#e9e9ee] bg-white p-4 text-center">
            <div className="font-display text-[30px] font-extrabold leading-none">{summaryData.formattedTime}</div>
            <div className="mt-1.5 font-ot-mono text-[9px] tracking-[0.12em]" style={{ color: '#9a9aa2' }}>
              {lang.startsWith('pt') ? 'DURAÇÃO' : 'DURATION'}
            </div>
          </div>
          <div className="rounded-[16px] p-4 text-center" style={{ background: '#0e0e10' }}>
            <div className="font-display text-[30px] font-extrabold leading-none">
              <span style={{ color: '#d8ff36' }}>{summaryData.completedCount}</span>
              <span className="text-[18px]" style={{ color: 'rgba(216,255,54,0.35)' }}>/{summaryData.totalCount}</span>
            </div>
            <div className="mt-1.5 font-ot-mono text-[9px] tracking-[0.12em]" style={{ color: '#9a9aa2' }}>
              {lang.startsWith('pt') ? 'EXERC. FEITOS' : 'EXERCISES DONE'}
            </div>
          </div>
        </div>

        {/* Lista de exercícios */}
        <div className="mt-6 space-y-2 px-6">
          {doneItems.length > 0 && (
            <div className="mb-3 font-ot-mono text-[9px] font-bold tracking-[0.14em] uppercase" style={{ color: '#2a5fff' }}>
              {lang.startsWith('pt') ? 'CONCLUÍDOS' : 'COMPLETED'}
            </div>
          )}
          {doneItems.map(item => (
            <div key={item.id} className="flex items-center gap-3 rounded-[14px] border border-[#e9e9ee] bg-white px-4 py-3">
              <div
                className="flex h-7 w-7 flex-none items-center justify-center rounded-[8px]"
                style={{ background: '#2a5fff' }}
              >
                <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
              </div>
              <span className="min-w-0 flex-1 font-display text-[16px] font-bold uppercase leading-none truncate">
                {item.title}
              </span>
              <span className="flex-none font-ot-mono text-[10px]" style={{ color: '#6a6a72' }}>
                {[
                  item.sets != null ? `${item.sets}×` : null,
                  item.reps != null ? item.reps : null,
                  item.weight != null ? `· ${item.weight}kg` : null,
                ].filter(Boolean).join('')}
              </span>
            </div>
          ))}

          {skippedItems.length > 0 && (
            <>
              <div className="mb-3 mt-5 font-ot-mono text-[9px] font-bold tracking-[0.14em] uppercase" style={{ color: '#9a9aa2' }}>
                {lang.startsWith('pt') ? 'NÃO REALIZADOS' : 'SKIPPED'}
              </div>
              {skippedItems.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-[14px] border border-[#e9e9ee] px-4 py-3"
                  style={{ opacity: 0.45 }}
                >
                  <div
                    className="flex h-7 w-7 flex-none items-center justify-center rounded-[8px] font-display text-[14px] font-bold"
                    style={{ background: '#f0f0f3', color: '#b3b3bb' }}
                  >
                    –
                  </div>
                  <span
                    className="min-w-0 flex-1 font-display text-[16px] font-bold uppercase leading-none truncate"
                    style={{ textDecoration: 'line-through' }}
                  >
                    {item.title}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* CTA */}
        <div
          className="fixed inset-x-0 bottom-0 px-6 pb-8 pt-5"
          style={{ background: 'linear-gradient(0deg, #f5f5f2 72%, transparent)' }}
        >
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl py-[18px] font-display text-[22px] font-extrabold uppercase text-white"
            style={{ background: '#0e0e10' }}
          >
            {lang.startsWith('pt') ? 'Voltar ao início' : 'Back to home'}
            <span style={{ color: '#d8ff36' }}>→</span>
          </button>
        </div>
      </div>
    )
  }

  // Loading / transitional states
  if (isInitializing || isLoading || isExiting || isStarting) return <Loading fullPage />

  // ─────────────────────────────────────────────────────────────
  // ERRO
  // ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center font-ui" style={{ background: '#f5f5f2' }}>
        <div className="font-display text-[64px] font-extrabold leading-none" style={{ color: '#e5484d' }}>!</div>
        <p className="font-display text-[22px] font-bold uppercase">{t('common.error', 'Algo deu errado')}</p>
        <p className="font-ot-mono text-[11px] tracking-wider" style={{ color: '#9a9aa2' }}>{error}</p>
        <button
          type="button"
          onClick={() => { useSessionStore.setState({ error: null }); navigate('/') }}
          className="mt-2 rounded-2xl px-8 py-4 font-display text-lg font-extrabold uppercase text-white"
          style={{ background: '#0e0e10' }}
        >
          {t('common.back_to_home', 'Voltar ao início')}
        </button>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // CONFLITO
  // ─────────────────────────────────────────────────────────────
  if (isConflict) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center font-ui" style={{ background: '#f5f5f2', color: '#0e0e10' }}>
        <div className="w-full max-w-sm rounded-[20px] border-2 border-dashed border-[#e0e0e4] px-6 py-8">
          <p className="font-ot-mono text-[10px] tracking-[0.18em]" style={{ color: '#9a9aa2' }}>
            {t('session.conflict.title').toUpperCase()}
          </p>
          <h2 className="mt-3 font-display text-[28px] font-extrabold uppercase leading-none">
            {currentSession.workout_name_snapshot}
          </h2>
          <p className="mt-3 font-ot-mono text-[11px] leading-relaxed" style={{ color: '#6a6a72' }}>
            {t('session.conflict.description', { workout: currentSession.workout_name_snapshot })}
          </p>
          <p className="mt-2 font-ot-mono text-[10px]" style={{ color: '#9a9aa2' }}>
            {t('session.conflict.question')}
          </p>
        </div>
        <div className="flex w-full max-w-sm flex-col gap-3">
          <button
            type="button"
            onClick={handleResumeOld}
            className="w-full rounded-2xl py-4 font-display text-xl font-extrabold uppercase text-white"
            style={{ background: '#2a5fff' }}
          >
            {t('session.conflict.resume', { workout: currentSession.workout_name_snapshot })}
          </button>
          <button
            type="button"
            onClick={() => setShowDiscardModal(true)}
            className="w-full rounded-2xl border border-[#e0e0e4] bg-white py-4 font-display text-xl font-extrabold uppercase"
            style={{ color: '#e5484d' }}
          >
            {t('session.conflict.discard')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="py-3 font-ot-mono text-[11px] tracking-wider"
            style={{ color: '#9a9aa2' }}
          >
            {t('common.cancel')}
          </button>
        </div>
        <AlertModal
          isOpen={showDiscardModal}
          onClose={() => setShowDiscardModal(false)}
          onConfirm={handleCancel}
          variant="danger"
          title={t('session.discard_modal_title')}
          description={t('session.discard_modal_desc')}
          confirmLabel={t('session.conflict.discard')}
        />
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // TELA 3: DESCANSO · TIMER
  // ─────────────────────────────────────────────────────────────
  const isRestActive = isActive && restItemId != null && restRemaining != null && restRemaining > 0

  if (isRestActive) {
    // offset = 0 → full ring (all time remaining)
    // offset = CIRCUMFERENCE → empty ring (time's up)
    const elapsed = restTotalSeconds - (restRemaining ?? 0)
    const strokeDashoffset = RING_CIRCUMFERENCE * (restTotalSeconds > 0 ? elapsed / restTotalSeconds : 0)

    return (
      <div
        className="flex min-h-screen flex-col items-center justify-between px-6 py-14 font-ui"
        style={{ background: '#0e0e10', color: '#ffffff' }}
      >
        {/* Topo: label + exercício */}
        <div className="text-center">
          <div className="font-ot-mono text-[10px] tracking-[0.18em]" style={{ color: '#9a9aa2' }}>
            {lang.startsWith('pt') ? 'DESCANSO' : 'REST'}
          </div>
          <div className="mt-2 font-display text-[20px] font-bold uppercase leading-none">
            {restItemTitle}
          </div>
          <div className="mt-1 font-ot-mono text-[10px]" style={{ color: '#9a9aa2' }}>
            {lang.startsWith('pt') ? 'PRÓXIMO EXERCÍCIO' : 'NEXT EXERCISE'}
          </div>
        </div>

        {/* Anel SVG */}
        <div className="relative flex items-center justify-center">
          <svg
            width="240" height="240" viewBox="0 0 240 240"
            style={{ transform: 'rotate(-90deg)' }}
          >
            {/* Track */}
            <circle
              cx="120" cy="120" r={RING_RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.07)"
              strokeWidth="10"
            />
            {/* Progresso */}
            <circle
              cx="120" cy="120" r={RING_RADIUS}
              fill="none"
              stroke="#d8ff36"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="font-display text-[72px] font-extrabold leading-none" style={{ color: '#d8ff36' }}>
              {restRemaining}
            </span>
            <span className="font-ot-mono text-[11px] tracking-[0.18em]" style={{ color: '#9a9aa2' }}>
              {lang.startsWith('pt') ? 'SEG' : 'SEC'}
            </span>
          </div>
        </div>

        {/* Pular */}
        <button
          type="button"
          onClick={skipRest}
          className="rounded-full px-8 py-3.5 font-display text-[15px] font-bold uppercase transition-opacity"
          style={{ border: '1.5px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.55)' }}
        >
          {lang.startsWith('pt') ? 'Pular descanso' : 'Skip rest'}
        </button>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // TELA 1: PRÉ-TREINO · INICIAR
  // ─────────────────────────────────────────────────────────────
  if (!isActive) {
    return (
      <div className="min-h-screen pb-32 font-ui" style={{ background: '#f5f5f2', color: '#0e0e10' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-12">
          <button type="button" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" style={{ color: '#6a6a72' }} />
          </button>
          <span className="font-ot-mono text-[10px] tracking-[0.18em]" style={{ color: '#9a9aa2' }}>
            {lang.startsWith('pt') ? 'PRÉ-TREINO' : 'PRE-WORKOUT'}
          </span>
          {canManageWorkouts ? (
            <button
              type="button"
              onClick={() => navigate(`/workout/${workoutId}/edit`)}
              className="font-ot-mono text-[10px] tracking-[0.1em]"
              style={{ color: '#2a5fff' }}
            >
              {lang.startsWith('pt') ? 'EDITAR' : 'EDIT'}
            </button>
          ) : <div className="w-10" />}
        </div>

        {/* Info do treino */}
        <div className="mt-4 px-6">
          <div className="font-ot-mono text-[10px] tracking-[0.16em]" style={{ color: '#2a5fff' }}>
            {lang.startsWith('pt') ? `TREINO ${planLetter} · HOJE` : `WORKOUT ${planLetter} · TODAY`}
          </div>
          <h1 className="mt-1 font-display text-[40px] font-extrabold uppercase leading-[0.94]">
            {workout?.focus || workout?.name || t('common.loading')}
          </h1>
          <div className="mt-3.5 flex gap-5">
            {activeWorkoutItems.length > 0 && (
              <div>
                <div className="font-display text-[21px] font-bold leading-none">{activeWorkoutItems.length}</div>
                <div className="mt-1 font-ot-mono text-[9px] tracking-[0.1em]" style={{ color: '#9a9aa2' }}>
                  {lang.startsWith('pt') ? 'EXERC.' : 'EXER.'}
                </div>
              </div>
            )}
            {estMin != null && (
              <div>
                <div className="font-display text-[21px] font-bold leading-none">~{estMin}<span className="text-sm"> min</span></div>
                <div className="mt-1 font-ot-mono text-[9px] tracking-[0.1em]" style={{ color: '#9a9aa2' }}>
                  {lang.startsWith('pt') ? 'DURAÇÃO' : 'DURATION'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Lista de exercícios */}
        <div className="mt-6 px-6">
          <div className="mb-2.5 font-ot-mono text-[10px] tracking-[0.18em]" style={{ color: '#9a9aa2' }}>
            {lang.startsWith('pt') ? 'O QUE VEM HOJE' : "WHAT'S COMING"}
          </div>

          {itemsForView.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-[#e0e0e4] py-10 text-center">
              <p className="font-ot-mono text-[11px]" style={{ color: '#9a9aa2' }}>
                {t('workouts.no_items')}
              </p>
              {canManageWorkouts && (
                <button
                  type="button"
                  onClick={() => navigate(`/workout/${workoutId}/edit`)}
                  className="mt-4 rounded-full px-5 py-2.5 font-display text-sm font-bold uppercase text-white"
                  style={{ background: '#2a5fff' }}
                >
                  {t('editor.add_exercise')}
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {itemsForView.map((item, idx) => {
                const safeVideoUrl = getSafeExternalUrl(item.videoUrl)
                const statsStr = [
                  item.sets != null && item.reps != null ? `${item.sets}×${item.reps}` : null,
                  item.weight != null ? `· ${item.weight}kg` : null,
                ].filter(Boolean).join(' ')

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-[13px] border border-[#e9e9ee] bg-white px-3.5 py-3"
                  >
                    <span className="w-5 flex-none font-display text-[16px] font-bold" style={{ color: '#b3b3bb' }}>
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-[18px] font-semibold uppercase leading-none truncate">
                        {item.title}
                      </div>
                      {safeVideoUrl && (
                        <span className="mt-0.5 flex items-center gap-1 font-ot-mono text-[9px]" style={{ color: '#9a9aa2' }}>
                          <Video className="h-3 w-3" /> VIDEO
                        </span>
                      )}
                    </div>
                    {statsStr && (
                      <span className="flex-none font-ot-mono text-[11px]" style={{ color: '#6a6a72' }}>
                        {statsStr}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* CTA fixo */}
        <div
          className="fixed inset-x-0 bottom-0 px-6 pb-8 pt-6"
          style={{ background: 'linear-gradient(0deg, #f5f5f2 72%, transparent)' }}
        >
          {itemsForView.length > 0 && (
            <button
              type="button"
              onClick={handleStart}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl py-[18px] font-display text-[25px] font-extrabold uppercase text-white"
              style={{ background: '#0e0e10' }}
            >
              {lang.startsWith('pt') ? 'Iniciar agora' : 'Start now'}
              <span style={{ color: '#d8ff36' }}>→</span>
            </button>
          )}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // TELA 2: SESSÃO ATIVA · FOCO
  // ─────────────────────────────────────────────────────────────
  const canFinish = !(completedItems < 3 && totalItems >= 3)

  return (
    <div className="min-h-screen pb-36 font-ui" style={{ background: '#f5f5f2', color: '#0e0e10' }}>

      {/* Status bar fixo */}
      <div
        className="fixed inset-x-0 top-0 z-20 flex items-center justify-between px-6 pb-3 pt-10"
        style={{ background: 'rgba(245,245,242,0.96)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #e9e9ee' }}
      >
        <div className="font-ot-mono text-[11px] tracking-[0.14em]" style={{ color: '#6a6a72' }}>
          {(currentSession.workout_focus_snapshot || currentSession.workout_name_snapshot || '').toUpperCase()}
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="h-2 w-2 rounded-full"
            style={{ background: '#d8ff36', boxShadow: '0 0 6px rgba(216,255,54,0.8)' }}
          />
          <span className="font-ot-mono text-[11px] tracking-[0.14em]" style={{ color: '#d8ff36' }}>
            REC {formattedTime}
          </span>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="fixed inset-x-0 top-[72px] z-20 h-[3px]" style={{ background: '#e9e9ee' }}>
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${totalItems > 0 ? (completedItems / totalItems) * 100 : 0}%`, background: '#2a5fff' }}
        />
      </div>

      {/* Lista de exercícios */}
      <div className="space-y-3 px-6 pt-24">

        {sessionItemsForView.length === 0 && (
          <div className="py-10 text-center">
            <p className="font-ot-mono text-[11px]" style={{ color: '#9a9aa2' }}>{t('session.empty_help')}</p>
            <button
              type="button"
              onClick={handleCancel}
              className="mt-4 rounded-full border border-[#e0e0e4] px-5 py-2.5 font-display text-base font-bold uppercase"
              style={{ color: '#e5484d' }}
            >
              {t('session.conflict.discard')}
            </button>
          </div>
        )}

        {sessionItemsForView.map((item, idx) => {
          const safeVideoUrl = getSafeExternalUrl(item.videoUrl)
          const isRunningRest = restItemId === item.id && restRemaining != null && restRemaining > 0

          return (
            <div
              key={item.id}
              className="overflow-hidden rounded-[16px] border bg-white transition-all"
              style={{ borderColor: item.isDone ? '#2a5fff' : '#e9e9ee', borderWidth: item.isDone ? 1.5 : 1 }}
            >
              {/* Header do card */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] font-display text-[15px] font-bold"
                  style={item.isDone
                    ? { background: '#2a5fff', color: '#fff' }
                    : { background: '#f0f0f3', color: '#6a6a72' }
                  }
                >
                  {item.isDone ? <Check className="h-4 w-4" strokeWidth={3} /> : idx + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <div
                    className="font-display text-[19px] font-bold uppercase leading-none truncate"
                    style={{
                      textDecoration: item.isDone ? 'line-through' : 'none',
                      color: item.isDone ? '#9a9aa2' : '#0e0e10'
                    }}
                  >
                    {item.title}
                  </div>
                  {safeVideoUrl && (
                    <a
                      href={safeVideoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 flex items-center gap-1 font-ot-mono text-[9px]"
                      style={{ color: '#2a5fff' }}
                    >
                      <Video className="h-3 w-3" /> VIDEO
                    </a>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => toggleItemDone(item.id, !item.isDone)}
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-full border-2 transition-all"
                  style={item.isDone
                    ? { background: '#2a5fff', borderColor: '#2a5fff' }
                    : { borderColor: '#d0d0d8' }
                  }
                >
                  {item.isDone && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
                </button>
              </div>

              {/* Peso / séries / reps */}
              {!item.isDone && (
                <div className="grid grid-cols-3 gap-3 border-t border-[#f0f0f3] px-4 py-3">
                  <div>
                    <div className="mb-1.5 font-ot-mono text-[9px] tracking-[0.1em]" style={{ color: '#9a9aa2' }}>
                      {t('common.weight').toUpperCase()} (KG)
                    </div>
                    <input
                      type="number"
                      value={item.weight ?? ''}
                      onChange={(e) => updateItemStats(item.id, Number(e.target.value), item.reps ?? '')}
                      className="w-full rounded-[9px] border border-[#e9e9ee] bg-[#f3f4f7] px-2 py-2 text-center font-display text-[17px] font-bold outline-none focus:border-[#2a5fff]"
                    />
                  </div>
                  <div>
                    <div className="mb-1.5 font-ot-mono text-[9px] tracking-[0.1em]" style={{ color: '#9a9aa2' }}>
                      {t('common.sets').toUpperCase()}
                    </div>
                    <div className="flex h-9 items-center justify-center rounded-[9px] bg-[#f3f4f7] font-display text-[17px] font-bold">
                      {item.sets ?? '–'}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 font-ot-mono text-[9px] tracking-[0.1em]" style={{ color: '#9a9aa2' }}>
                      {t('common.reps').toUpperCase()}
                    </div>
                    <div className="flex h-9 items-center justify-center rounded-[9px] bg-[#f3f4f7] font-display text-[17px] font-bold">
                      {item.reps ?? '–'}
                    </div>
                  </div>
                </div>
              )}

              {/* Timer de descanso */}
              {!item.isDone && item.restSeconds != null && item.restSeconds > 0 && (
                <div className="flex items-center justify-between border-t border-[#f0f0f3] px-4 py-2.5">
                  <span className="font-ot-mono text-[10px]" style={{ color: '#9a9aa2' }}>
                    {t('common.rest')} {item.restSeconds}s
                  </span>
                  <button
                    type="button"
                    onClick={() => startRestTimer(item.id, item.restSeconds, item.title)}
                    disabled={isRunningRest}
                    className="rounded-full border px-3.5 py-1.5 font-ot-mono text-[10px] font-bold transition-all"
                    style={isRunningRest
                      ? { borderColor: '#d8ff36', color: '#0a0a0a', background: '#d8ff36' }
                      : { borderColor: '#e0e0e4', color: '#6a6a72' }
                    }
                  >
                    {isRunningRest
                      ? t('session.rest_running', { seconds: restRemaining })
                      : t('session.start_rest')}
                  </button>
                </div>
              )}

              {/* Notas */}
              {!item.isDone && item.notes && (
                <div className="border-t border-[#f0f0f3] px-4 py-2.5">
                  <p className="font-ot-mono text-[10px] italic" style={{ color: '#9a9aa2' }}>
                    {item.notes}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* CTA fixo */}
      <div
        className="fixed inset-x-0 bottom-0 flex flex-col gap-2 px-6 pb-8 pt-5"
        style={{ background: 'linear-gradient(0deg, #f5f5f2 72%, transparent)' }}
      >
        <button
          type="button"
          onClick={() => setShowFinishModal(true)}
          disabled={!canFinish}
          className="flex w-full flex-col items-center justify-center rounded-2xl py-[17px] font-display text-[25px] font-extrabold uppercase transition-all"
          style={canFinish
            ? { background: '#d8ff36', color: '#0a0a0a' }
            : { background: '#e9e9ee', color: '#b3b3bb' }
          }
        >
          {t('session.finish')} {canFinish && '→'}
          {!canFinish && totalItems >= 3 && (
            <span className="mt-0.5 font-ot-mono text-[9px] tracking-wider" style={{ color: '#9a9aa2' }}>
              {t('session.finish_hint', { count: 3, current: completedItems })}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setShowDiscardModal(true)}
          className="py-2 font-ot-mono text-[10px] tracking-[0.12em]"
          style={{ color: '#9a9aa2' }}
        >
          {t('workouts.cancel_active').toUpperCase()}
        </button>
      </div>

      {/* Modal: confirmar encerramento */}
      <Modal isOpen={showFinishModal} onClose={() => setShowFinishModal(false)} title={t('session.finish_modal_title')}>
        <div className="space-y-4">
          <p className="font-ui text-sm leading-relaxed" style={{ color: '#6a6a72' }}>
            {t('session.finish_modal_desc', { formattedTime })}
          </p>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setShowFinishModal(false)}
              className="flex-1 rounded-[13px] border py-3 font-display text-base font-bold uppercase"
              style={{ borderColor: '#e0e0e4', color: '#6a6a72' }}
            >
              {t('session.keep_training')}
            </button>
            <button
              type="button"
              onClick={() => { setShowFinishModal(false); handleFinish() }}
              className="flex-1 rounded-[13px] py-3 font-display text-base font-bold uppercase text-[#0a0a0a]"
              style={{ background: '#d8ff36' }}
            >
              {t('session.finish')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: descartar sessão */}
      <AlertModal
        isOpen={showDiscardModal}
        onClose={() => setShowDiscardModal(false)}
        onConfirm={handleCancel}
        variant="danger"
        title={t('session.discard_modal_title')}
        description={t('session.discard_modal_desc')}
        confirmLabel={t('session.conflict.discard')}
      />
    </div>
  )
}
