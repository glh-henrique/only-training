import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '../stores/useSessionStore'
import { useWorkoutStore } from '../stores/useWorkoutStore'
import { useAuthStore } from '../stores/useAuthStore'
import { Loading } from '../components/ui/loading'
import { ArrowLeft, List, Video } from 'lucide-react'
import { getSafeExternalUrl } from '../lib/utils'
import { AlertModal } from '../components/ui/alert-modal'
import { VideoModal } from '../components/VideoModal'
import { Modal } from '../components/ui/modal'

const WORKOUT_PLAYLIST_ENABLED = false
void WORKOUT_PLAYLIST_ENABLED

const RING_RADIUS = 104
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export default function WorkoutSession() {
  const { t, i18n } = useTranslation()
  const { workoutId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { role, hasActiveCoach } = useAuthStore()
  const lang = i18n.language

  // ── Modal state ──
  const [showDiscardModal, setShowDiscardModal] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const [isStarting, setIsStarting] = useState(false)

  // ── Rest timer ──
  const [restItemId, setRestItemId] = useState<string | null>(null)
  const [restRemaining, setRestRemaining] = useState<number | null>(null)
  const [restTotalSeconds, setRestTotalSeconds] = useState(0)

  // ── Per-series flow ──
  const [currentExerciseIdx, setCurrentExerciseIdx] = useState(0)
  const [seriesCompleted, setSeriesCompleted] = useState<Record<string, number>>({})
  const [exerciseWeights, setExerciseWeights] = useState<Record<string, number>>({})
  const [isSessionInitialized, setIsSessionInitialized] = useState(false)
  const [pendingExerciseAdvance, setPendingExerciseAdvance] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [rpeScore, setRpeScore] = useState<number | null>(null)
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [showExerciseList, setShowExerciseList] = useState(false)

  // ── Rest context ("A SEGUIR" card) ──
  const [restContextBadge, setRestContextBadge] = useState('')
  const [restContextLabel, setRestContextLabel] = useState('')
  const [restContextDetail, setRestContextDetail] = useState('')
  const [restStatusLabel, setRestStatusLabel] = useState('')

  const {
    currentSession,
    sessionItems,
    startSession,
    duration,
    finishSession,
    toggleItemDone,
    updateItemStats,
    resumeSession,
    cancelSession,
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

  // ── Effects ──

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

  useEffect(() => {
    if (restRemaining == null || restRemaining <= 0) return
    const interval = setInterval(() => {
      setRestRemaining(prev => (prev == null ? prev : prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [restRemaining])

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
    if (pendingExerciseAdvance) {
      setCurrentExerciseIdx(prev => prev + 1)
      setPendingExerciseAdvance(false)
    }
    setRestItemId(null)
    setRestRemaining(null)
  }, [restRemaining, restItemId, pendingExerciseAdvance])

  const autoStartTriedRef = useRef(false)

  useEffect(() => {
    if (autoStartTriedRef.current) return
    if (!isInitializing && !isLoading && !currentSession && workoutId && !isExiting && autoStart) {
      autoStartTriedRef.current = true
      ;(async () => {
        setIsStarting(true)
        const result = await startSession(workoutId)
        if (result === 'no_items') navigate(`/workout/${workoutId}/edit`)
        setIsStarting(false)
      })()
    }
  }, [isInitializing, isLoading, currentSession, workoutId, startSession, isExiting, navigate, autoStart])

  useEffect(() => {
    if (isActive && sessionItemsForView.length > 0 && !isSessionInitialized) {
      const firstIncomplete = sessionItemsForView.findIndex(i => !i.isDone)
      if (firstIncomplete === -1) {
        setShowSummary(true)
      } else {
        setCurrentExerciseIdx(firstIncomplete)
      }
      const initialWeights: Record<string, number> = {}
      sessionItemsForView.forEach(item => {
        if (item.weight != null) initialWeights[item.id] = item.weight
      })
      setExerciseWeights(initialWeights)
      setIsSessionInitialized(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isSessionInitialized])

  // ── Derived data ──

  const previewItems = useMemo(() => activeWorkoutItems.map(item => ({
    id: item.id, title: item.title, restSeconds: item.rest_seconds, notes: item.notes,
    videoUrl: item.video_url, isDone: false, weight: item.default_weight,
    sets: item.default_sets, reps: item.default_reps,
  })), [activeWorkoutItems])

  const sessionItemsForView = useMemo(() => sessionItems.map(item => ({
    id: item.id, title: item.title_snapshot, restSeconds: item.rest_seconds,
    notes: item.notes_snapshot, videoUrl: item.video_url, isDone: item.is_done,
    weight: item.weight, sets: item.sets, reps: item.reps,
  })), [sessionItems])

  const itemsForView = isActive ? sessionItemsForView : previewItems

  const workout = workouts.find(w => w.id === workoutId)
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

  // Current exercise state
  const currentExercise = sessionItemsForView[currentExerciseIdx] ?? null
  const seriesDone = currentExercise ? (seriesCompleted[currentExercise.id] ?? 0) : 0
  const totalSeries = currentExercise?.sets ?? 3
  const currentWeightValue = currentExercise
    ? (exerciseWeights[currentExercise.id] ?? currentExercise.weight ?? 0)
    : 0

  // Summary stats (computed from local + store state)
  const totalSeriesCount = useMemo(
    () => Object.values(seriesCompleted).reduce((a, b) => a + b, 0),
    [seriesCompleted]
  )
  const totalVolumeKg = useMemo(
    () => sessionItemsForView
      .filter(i => i.isDone)
      .reduce((acc, item) => {
        const w = exerciseWeights[item.id] ?? item.weight ?? 0
        const s = seriesCompleted[item.id] ?? item.sets ?? 0
        const r = typeof item.reps === 'string' ? (parseInt(item.reps) || 0) : (item.reps ?? 0)
        return acc + w * s * r
      }, 0),
    [sessionItemsForView, exerciseWeights, seriesCompleted]
  )

  // ── Handlers ──

  const handleStart = async () => {
    if (!workoutId || isStarting) return
    setIsStarting(true)
    const result = await startSession(workoutId)
    if (result === 'no_items') navigate(`/workout/${workoutId}/edit`)
    setIsStarting(false)
  }

  const handleFinish = async () => {
    setIsExiting(true)
    await finishSession(rpeScore)
    navigate('/')
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
        await cancelSession()
        navigate('/')
      }
    } catch {
      setIsExiting(false)
    }
  }

  const handleResumeOld = () => {
    if (currentSession) navigate(`/workout/${currentSession.workout_id}`)
  }

  const skipRest = () => {
    if (pendingExerciseAdvance) {
      setCurrentExerciseIdx(prev => prev + 1)
      setPendingExerciseAdvance(false)
    }
    setRestItemId(null)
    setRestRemaining(null)
    setRestTotalSeconds(0)
  }

  const adjustRest = (delta: number) => {
    setRestRemaining(prev => prev == null ? prev : Math.max(0, prev + delta))
    setRestTotalSeconds(prev => Math.max(0, prev + delta))
  }

  const handleRegisterSeries = async () => {
    if (!currentExercise || !workoutId) return

    const newSeriesDone = seriesDone + 1
    setSeriesCompleted(prev => ({ ...prev, [currentExercise.id]: newSeriesDone }))

    if (currentWeightValue) {
      await updateItemStats(currentExercise.id, currentWeightValue, currentExercise.reps ?? '')
    }

    if (newSeriesDone >= totalSeries) {
      // All series for this exercise done
      await toggleItemDone(currentExercise.id, true)

      const nextIdx = currentExerciseIdx + 1
      if (nextIdx < sessionItemsForView.length) {
        const nextEx = sessionItemsForView[nextIdx]
        const nextWeight = exerciseWeights[nextEx.id] ?? nextEx.weight ?? null
        setPendingExerciseAdvance(true)
        setRestStatusLabel(`${currentExercise.title.toUpperCase()} · ${newSeriesDone}/${totalSeries}`)
        setRestContextBadge(String.fromCharCode(65 + nextIdx))
        setRestContextLabel(nextEx.title.toUpperCase())
        setRestContextDetail(`${nextEx.reps ?? '–'} reps${nextWeight ? ` · ${nextWeight} kg` : ''}`)

        const restSecs = currentExercise.restSeconds ?? 90
        setRestItemId(currentExercise.id)
        setRestRemaining(restSecs)
        setRestTotalSeconds(restSecs)
      } else {
        setShowSummary(true)
      }
    } else {
      // More series → rest between sets
      const nextSeries = newSeriesDone + 1
      setRestStatusLabel(`${currentExercise.title.toUpperCase()} · ${newSeriesDone}/${totalSeries}`)
      setRestContextBadge(String(nextSeries).padStart(2, '0'))
      setRestContextLabel(lang.startsWith('pt') ? 'MESMA SÉRIE' : 'SAME EXERCISE')
      setRestContextDetail(`${currentExercise.reps ?? '–'} reps · ${currentWeightValue} kg`)

      const restSecs = currentExercise.restSeconds ?? 90
      setRestItemId(currentExercise.id)
      setRestRemaining(restSecs)
      setRestTotalSeconds(restSecs)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // TELA 4: RESUMO · CONCLUÍDO  (reads from live store — session still open)
  // ─────────────────────────────────────────────────────────────
  if (showSummary && isActive) {
    const doneItems = sessionItemsForView.filter(i => i.isDone)
    const skippedItems = sessionItemsForView.filter(i => !i.isDone)
    const volumeTonnes = totalVolumeKg / 1000

    return (
      <div className="min-h-screen pb-36 font-ui" style={{ background: '#0a0a0a', color: '#fafafa' }}>

        {/* Top */}
        <div style={{ padding: '50px 26px 0', textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', background: '#d8ff36',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto', fontSize: 32, color: '#0a0a0a', fontWeight: 700,
          }}>✓</div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: '0.24em', color: '#6e6e6e', marginTop: 18 }}>
            {(currentSession.workout_focus_snapshot || currentSession.workout_name_snapshot || '').toUpperCase()}
          </div>
          <div style={{ fontFamily: "'Saira Condensed', sans-serif", fontWeight: 800, fontSize: 46, lineHeight: 0.9, textTransform: 'uppercase', marginTop: 6 }}>
            {lang.startsWith('pt') ? 'Concluído.' : 'Done.'}
          </div>
        </div>

        {/* Stats 2×2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '26px 24px 0' }}>
          {[
            { value: formattedTime, label: lang.startsWith('pt') ? 'DURAÇÃO' : 'DURATION', highlight: false },
            { value: volumeTonnes > 0 ? `${volumeTonnes.toFixed(1)}t` : `${completedItems}`, label: volumeTonnes > 0 ? 'VOLUME TOTAL' : (lang.startsWith('pt') ? 'EXERC. FEITOS' : 'EXERCISES'), highlight: false },
            { value: String(totalSeriesCount || completedItems), label: lang.startsWith('pt') ? 'SÉRIES' : 'SETS', highlight: false },
            { value: `${completedItems}/${totalItems}`, label: lang.startsWith('pt') ? 'EXERC. FEITOS' : 'DONE', highlight: true },
          ].map((stat, i) => (
            <div key={i} style={{
              background: stat.highlight ? '#d8ff36' : '#141414',
              border: stat.highlight ? 'none' : '1px solid #242424',
              borderRadius: 14, padding: 14,
            }}>
              <div style={{ fontFamily: "'Saira Condensed', sans-serif", fontWeight: 800, fontSize: 34, lineHeight: 0.9, color: stat.highlight ? '#0a0a0a' : '#fafafa' }}>
                {stat.value}
              </div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: stat.highlight ? '#0a0a0a' : '#6e6e6e', letterSpacing: '0.12em', marginTop: 4, opacity: stat.highlight ? 0.7 : 1 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Exercise list */}
        <div style={{ padding: '20px 24px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {doneItems.map((item) => (
            <div key={item.id} style={{ background: '#141414', border: '1px solid #242424', borderRadius: 13, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#d8ff36', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0a0a0a', fontFamily: "'Saira Condensed', sans-serif", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                ✓
              </div>
              <span style={{ flex: 1, fontFamily: "'Saira Condensed', sans-serif", fontWeight: 700, fontSize: 18, textTransform: 'uppercase', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.title}
              </span>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: '#6e6e6e', flexShrink: 0 }}>
                {[
                  seriesCompleted[item.id] != null ? `${seriesCompleted[item.id]}×` : (item.sets != null ? `${item.sets}×` : null),
                  item.reps != null ? item.reps : null,
                  (exerciseWeights[item.id] ?? item.weight) != null ? `· ${exerciseWeights[item.id] ?? item.weight}kg` : null,
                ].filter(Boolean).join('')}
              </span>
            </div>
          ))}
          {skippedItems.map(item => (
            <div key={item.id} style={{ border: '1px solid #242424', borderRadius: 13, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: 0.35 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6e6e6e', fontFamily: "'Saira Condensed', sans-serif", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>–</div>
              <span style={{ flex: 1, fontFamily: "'Saira Condensed', sans-serif", fontWeight: 700, fontSize: 18, textTransform: 'uppercase', lineHeight: 1, textDecoration: 'line-through', color: '#6e6e6e' }}>
                {item.title}
              </span>
            </div>
          ))}
        </div>

        {/* RPE */}
        <div style={{ padding: '24px 24px 0', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.16em', color: '#6e6e6e', marginBottom: 12 }}>
            {lang.startsWith('pt') ? 'COMO FOI O ESFORÇO?' : 'HOW WAS THE EFFORT?'}
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
            {[6, 7, 8, 9, 10].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setRpeScore(n)}
                style={{
                  width: 38, height: 38, borderRadius: '50%',
                  border: rpeScore === n ? 'none' : '1.5px solid #2a2a2a',
                  background: rpeScore === n ? '#d8ff36' : 'transparent',
                  color: rpeScore === n ? '#0a0a0a' : '#6e6e6e',
                  fontFamily: "'Saira Condensed', sans-serif",
                  fontWeight: 800, fontSize: 15, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '16px 24px 28px', background: 'linear-gradient(0deg, #0a0a0a 72%, transparent)' }}>
          <button
            type="button"
            onClick={handleFinish}
            style={{ width: '100%', border: 'none', background: '#fafafa', color: '#0a0a0a', fontFamily: "'Saira Condensed', sans-serif", fontWeight: 800, fontSize: 25, textTransform: 'uppercase', padding: '16px 0', borderRadius: 16, cursor: 'pointer' }}
          >
            {lang.startsWith('pt') ? 'Salvar e finalizar' : 'Save & finish'}
          </button>
          <button
            type="button"
            onClick={() => setShowDiscardModal(true)}
            style={{ width: '100%', marginTop: 10, border: 'none', background: 'transparent', color: '#6e6e6e', fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: '0.1em', cursor: 'pointer', padding: '6px 0' }}
          >
            {lang.startsWith('pt') ? 'DESCARTAR TREINO' : 'DISCARD WORKOUT'}
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

  if (isInitializing || isLoading || isExiting || isStarting) return <Loading fullPage />

  // ── Erro ──
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center font-ui" style={{ background: 'var(--color-ot-paper)', color: 'var(--color-ot-ink)' }}>
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

  // ── Conflito ──
  if (isConflict) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center font-ui" style={{ background: 'var(--color-ot-paper)', color: 'var(--color-ot-ink)' }}>
        <div className="w-full max-w-sm rounded-[20px] border-2 border-dashed border-ot-border px-6 py-8">
          <p className="font-ot-mono text-[10px] tracking-[0.18em]" style={{ color: '#9a9aa2' }}>
            {t('session.conflict.title').toUpperCase()}
          </p>
          <h2 className="mt-3 font-display text-[28px] font-extrabold uppercase leading-none">
            {currentSession.workout_name_snapshot}
          </h2>
          <p className="mt-3 font-ot-mono text-[11px] leading-relaxed" style={{ color: '#6a6a72' }}>
            {t('session.conflict.description', { workout: currentSession.workout_name_snapshot })}
          </p>
        </div>
        <div className="flex w-full max-w-sm flex-col gap-3">
          <button type="button" onClick={handleResumeOld}
            className="w-full rounded-2xl py-4 font-display text-xl font-extrabold uppercase text-white"
            style={{ background: '#2a5fff' }}>
            {t('session.conflict.resume', { workout: currentSession.workout_name_snapshot })}
          </button>
          <button type="button" onClick={() => setShowDiscardModal(true)}
            className="w-full rounded-2xl border border-ot-border bg-white dark:bg-ot-dark-card py-4 font-display text-xl font-extrabold uppercase"
            style={{ color: '#e5484d' }}>
            {t('session.conflict.discard')}
          </button>
          <button type="button" onClick={() => navigate('/')}
            className="py-3 font-ot-mono text-[11px] tracking-wider"
            style={{ color: '#9a9aa2' }}>
            {t('common.cancel')}
          </button>
        </div>
        <AlertModal isOpen={showDiscardModal} onClose={() => setShowDiscardModal(false)}
          onConfirm={handleCancel} variant="danger"
          title={t('session.discard_modal_title')} description={t('session.discard_modal_desc')}
          confirmLabel={t('session.conflict.discard')} />
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // TELA 3: DESCANSO · TIMER
  // ─────────────────────────────────────────────────────────────
  const isRestActive = isActive && restItemId != null && restRemaining != null && restRemaining > 0

  if (isRestActive) {
    const elapsed = restTotalSeconds - (restRemaining ?? 0)
    const strokeDashoffset = RING_CIRCUMFERENCE * (restTotalSeconds > 0 ? elapsed / restTotalSeconds : 0)
    const ringSize = (RING_RADIUS + 20) * 2

    const restMins = Math.floor((restRemaining ?? 0) / 60)
    const restSecs = (restRemaining ?? 0) % 60
    const restDisplay = restMins > 0
      ? `${restMins}:${String(restSecs).padStart(2, '0')}`
      : String(restRemaining)

    const totalMins = Math.floor(restTotalSeconds / 60)
    const totalSec = restTotalSeconds % 60
    const totalDisplay = totalMins > 0
      ? `${totalMins}:${String(totalSec).padStart(2, '0')}`
      : String(restTotalSeconds)

    return (
      <div style={{ height: '100dvh', background: '#0a0a0a', color: '#fafafa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '52px 24px 36px', fontFamily: "'Archivo', sans-serif", overflow: 'hidden' }}>

        {/* Status */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: '0.14em', color: '#6e6e6e' }}>
            {restStatusLabel}
          </span>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: '0.14em', color: '#6e6e6e' }}>
            TOTAL {formattedTime}
          </span>
        </div>

        {/* Label */}
        <div style={{ textAlign: 'center', marginTop: -20 }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: '0.34em', color: '#6e6e6e', textTransform: 'uppercase' }}>
            {lang.startsWith('pt') ? 'Descanso' : 'Rest'}
          </div>
        </div>

        {/* Ring */}
        <div style={{ position: 'relative', width: ringSize, height: ringSize, marginTop: -10 }}>
          <div style={{
            position: 'absolute', inset: 8, borderRadius: '50%',
            background: 'radial-gradient(closest-side, rgba(216,255,54,0.18), transparent 72%)',
            animation: 'otpulse 2.2s ease-out infinite',
          }} />
          <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`} style={{ position: 'absolute', top: 0, left: 0 }}>
            <style>{`@keyframes otpulse{0%{transform:scale(.9);opacity:.55}70%{transform:scale(1.18);opacity:0}100%{opacity:0}}`}</style>
            <circle cx={ringSize / 2} cy={ringSize / 2} r={RING_RADIUS} fill="none" stroke="#1f1f1f" strokeWidth="14" />
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={RING_RADIUS}
              fill="none" stroke="#d8ff36" strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
              strokeDashoffset={strokeDashoffset}
              transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontFamily: "'Saira Condensed', sans-serif", fontWeight: 800, fontSize: 82, lineHeight: 0.8, letterSpacing: '-0.02em' }}>
              {restDisplay}
            </div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: '0.18em', color: '#6e6e6e', marginTop: 8 }}>
              DE {totalDisplay}
            </div>
          </div>
        </div>

        {/* +15 / -15 */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          {[{ label: '+15s', delta: 15 }, { label: '−15s', delta: -15 }].map(({ label, delta }) => (
            <button
              key={label}
              type="button"
              onClick={() => adjustRest(delta)}
              style={{ border: '1.5px solid #2a2a2a', background: 'transparent', color: '#fafafa', fontFamily: "'Saira Condensed', sans-serif", fontWeight: 700, fontSize: 18, textTransform: 'uppercase', padding: '11px 22px', borderRadius: 999, cursor: 'pointer' }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* A SEGUIR card + skip */}
        <div style={{ width: '100%' }}>
          <div style={{ background: '#141414', border: '1px solid #242424', borderRadius: 18, padding: '15px 17px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: '#d8ff36', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Saira Condensed', sans-serif", fontWeight: 800, fontSize: 18, color: '#0a0a0a', flexShrink: 0 }}>
              {restContextBadge}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.14em', color: '#6e6e6e' }}>
                {lang.startsWith('pt') ? 'A SEGUIR ·' : 'NEXT ·'} {restContextLabel}
              </div>
              <div style={{ fontFamily: "'Saira Condensed', sans-serif", fontWeight: 700, fontSize: 22, lineHeight: 1, textTransform: 'uppercase', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {restContextDetail}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={skipRest}
            style={{ width: '100%', marginTop: 11, border: 'none', background: '#d8ff36', color: '#0a0a0a', fontFamily: "'Saira Condensed', sans-serif", fontWeight: 800, fontSize: 25, textTransform: 'uppercase', padding: '16px 0', borderRadius: 16, cursor: 'pointer' }}
          >
            {lang.startsWith('pt') ? 'Pular descanso ⏵' : 'Skip rest ⏵'}
          </button>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // TELA 1: PRÉ-TREINO · INICIAR
  // ─────────────────────────────────────────────────────────────
  if (!isActive) {
    return (
      <div className="min-h-screen pb-32 font-ui" style={{ background: 'var(--color-ot-paper)', color: 'var(--color-ot-ink)' }}>
        <div className="flex items-center justify-between px-6 pt-12">
          <button type="button" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" style={{ color: '#6a6a72' }} />
          </button>
          <span className="font-ot-mono text-[10px] tracking-[0.18em]" style={{ color: '#9a9aa2' }}>
            {lang.startsWith('pt') ? 'PRÉ-TREINO' : 'PRE-WORKOUT'}
          </span>
          {canManageWorkouts ? (
            <button type="button" onClick={() => navigate(`/workout/${workoutId}/edit`)}
              className="font-ot-mono text-[10px] tracking-[0.1em]" style={{ color: '#2a5fff' }}>
              {lang.startsWith('pt') ? 'EDITAR' : 'EDIT'}
            </button>
          ) : <div className="w-10" />}
        </div>

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

        <div className="mt-6 px-6">
          <div className="mb-2.5 font-ot-mono text-[10px] tracking-[0.18em]" style={{ color: '#9a9aa2' }}>
            {lang.startsWith('pt') ? 'O QUE VEM HOJE' : "WHAT'S COMING"}
          </div>
          {itemsForView.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-ot-border py-10 text-center">
              <p className="font-ot-mono text-[11px]" style={{ color: '#9a9aa2' }}>{t('workouts.no_items')}</p>
              {canManageWorkouts && (
                <button type="button" onClick={() => navigate(`/workout/${workoutId}/edit`)}
                  className="mt-4 rounded-full px-5 py-2.5 font-display text-sm font-bold uppercase text-white"
                  style={{ background: '#2a5fff' }}>
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
                  <div key={item.id} className="flex items-center gap-3 rounded-[13px] border border-[#e9e9ee] bg-white dark:bg-ot-dark-card px-3.5 py-3">
                    <span className="w-5 flex-none font-display text-[16px] font-bold" style={{ color: '#b3b3bb' }}>{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-[18px] font-semibold uppercase leading-none truncate">{item.title}</div>
                      {safeVideoUrl && (
                        <span className="mt-0.5 flex items-center gap-1 font-ot-mono text-[9px]" style={{ color: '#9a9aa2' }}>
                          <Video className="h-3 w-3" /> VIDEO
                        </span>
                      )}
                    </div>
                    {statsStr && <span className="flex-none font-ot-mono text-[11px]" style={{ color: '#6a6a72' }}>{statsStr}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="fixed inset-x-0 bottom-0 px-6 pb-8 pt-6" style={{ background: 'linear-gradient(0deg, var(--color-ot-paper) 72%, transparent)' }}>
          {itemsForView.length > 0 && (
            <button type="button" onClick={handleStart}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl py-[18px] font-display text-[25px] font-extrabold uppercase text-white"
              style={{ background: '#0e0e10' }}>
              {lang.startsWith('pt') ? 'Iniciar agora' : 'Start now'}
              <span style={{ color: '#d8ff36' }}>→</span>
            </button>
          )}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // TELA 2: SESSÃO ATIVA · FOCO (uma série por vez)
  // ─────────────────────────────────────────────────────────────
  if (!currentExercise) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '0 24px' }}>
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: '#6e6e6e', textAlign: 'center' }}>
          {t('session.empty_help')}
        </p>
        <button type="button" onClick={() => setShowSummary(true)}
          style={{ border: '1.5px solid #d8ff36', background: 'transparent', color: '#d8ff36', fontFamily: "'Saira Condensed', sans-serif", fontWeight: 700, fontSize: 18, textTransform: 'uppercase', padding: '12px 28px', borderRadius: 999, cursor: 'pointer' }}>
          {lang.startsWith('pt') ? 'Ver resumo' : 'See summary'}
        </button>
      </div>
    )
  }

  const safeVideoUrl = getSafeExternalUrl(currentExercise.videoUrl)
  const currentSeriesNumber = seriesDone + 1
  const nextExercise = sessionItemsForView[currentExerciseIdx + 1] ?? null

  return (
    <div style={{
      height: '100dvh',
      background: '#0a0a0a',
      color: '#fafafa',
      fontFamily: "'Archivo', sans-serif",
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <style>{`
        .ot-weight-input::-webkit-inner-spin-button,
        .ot-weight-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .ot-weight-input { -moz-appearance: textfield; }
      `}</style>

      {/* Status bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '48px 22px 0', flexShrink: 0, gap: 10 }}>
        <button
          type="button"
          onClick={() => setShowExerciseList(true)}
          style={{ background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0, cursor: 'pointer' }}
          aria-label={lang.startsWith('pt') ? 'Ver lista de exercícios' : 'View exercise list'}
        >
          <List className="h-4 w-4" style={{ color: '#6e6e6e' }} />
        </button>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.12em', color: '#6e6e6e', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {(currentSession.workout_focus_snapshot || '').toUpperCase()}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d8ff36', display: 'inline-block' }} />
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.12em', color: '#d8ff36' }}>
            REC {formattedTime}
          </span>
        </span>
      </div>

      {/* Exercise counter + name */}
      <div style={{ padding: '14px 22px 0', flexShrink: 0 }}>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.18em', color: '#6e6e6e' }}>
          {lang.startsWith('pt') ? 'EXERCÍCIO' : 'EXERCISE'} {String(currentExerciseIdx + 1).padStart(2, '0')} / {String(totalItems).padStart(2, '0')}
        </div>
        <div style={{ fontFamily: "'Saira Condensed', sans-serif", fontWeight: 800, fontSize: 36, lineHeight: 1, textTransform: 'uppercase', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentExercise.title}
        </div>
        {safeVideoUrl && (
          <button type="button" onClick={() => setShowVideoModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4, fontFamily: "'Space Mono', monospace", fontSize: 10, color: '#2a5fff', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            <Video className="h-3 w-3" /> VIDEO
          </button>
        )}
      </div>

      {/* Weight — big number (flex: 1 fills remaining vertical space) */}
      <div style={{ flex: 1, padding: '0 22px', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden', position: 'relative', minHeight: 0 }}>
        {/* KG label — vertical, right side */}
        <span style={{
          position: 'absolute', right: 22, top: '50%', transform: 'translateY(-50%)',
          fontFamily: "'Saira Condensed', sans-serif", fontWeight: 700, fontSize: 92,
          letterSpacing: '0.18em', color: '#6e6e6e', writingMode: 'vertical-rl',
          userSelect: 'none',
        }}>KG</span>

        <input
          className="ot-weight-input"
          type="number"
          inputMode="decimal"
          value={currentWeightValue || ''}
          placeholder="0.0"
          onChange={(e) => setExerciseWeights(prev => ({ ...prev, [currentExercise.id]: Number(e.target.value) }))}
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            fontFamily: "'Saira Condensed', sans-serif", fontWeight: 900,
            fontSize: 'clamp(72px, 34vw, 148px)',
            lineHeight: 0.82, letterSpacing: '-0.04em', color: '#fafafa',
            width: 'calc(100% - 36px)', padding: 0, display: 'block',
          }}
        />
        <style>{`.ot-weight-input::placeholder { color: #2a2a2a; }`}</style>

        {/* Reps target row — only shown when reps are defined */}
        {currentExercise.reps != null && currentExercise.reps !== '' && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 10 }}>
            <span style={{ fontFamily: "'Saira Condensed', sans-serif", fontWeight: 800, fontSize: 44, lineHeight: 0.85, color: '#d8ff36' }}>
              {currentExercise.reps}
            </span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.16em', color: '#6e6e6e', textTransform: 'uppercase' }}>
              {lang.startsWith('pt') ? 'reps alvo' : 'target reps'}
            </span>
          </div>
        )}
      </div>

      {/* Series grid */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(totalSeries, 6)}, 1fr)`, gap: 5, padding: '0 22px 14px', flexShrink: 0 }}>
        {Array.from({ length: totalSeries }, (_, i) => {
          const sIdx = i + 1
          const isDone = sIdx <= seriesDone
          const isCurrent = sIdx === currentSeriesNumber
          return (
            <div key={i} style={{
              border: isCurrent ? '1.5px solid #d8ff36' : '1.5px solid #2a2a2a',
              background: isCurrent ? '#d8ff36' : isDone ? '#161616' : 'transparent',
              padding: '10px 0', textAlign: 'center', borderRadius: 5,
            }}>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: isCurrent ? '#0a0a0a' : '#6e6e6e' }}>
                {String(sIdx).padStart(2, '0')}
              </div>
              <div style={{ fontFamily: "'Saira Condensed', sans-serif", fontWeight: 800, fontSize: 17, marginTop: 2, color: isCurrent ? '#0a0a0a' : isDone ? '#fafafa' : '#3a3a3a' }}>
                {isDone ? '✓' : isCurrent ? '●' : '–'}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom actions — natural flow, no fixed positioning */}
      <div style={{ padding: '0 22px 32px', flexShrink: 0 }}>
        {nextExercise && (
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.12em', color: '#6e6e6e', marginBottom: 10 }}>
            {lang.startsWith('pt') ? 'PRÓXIMO ▸' : 'NEXT ▸'} {nextExercise.title.toUpperCase()}
          </div>
        )}
        <button
          type="button"
          onClick={handleRegisterSeries}
          style={{
            width: '100%', border: 'none', background: '#d8ff36', color: '#0a0a0a',
            fontFamily: "'Saira Condensed', sans-serif", fontWeight: 800, fontSize: 26,
            letterSpacing: '0.02em', textTransform: 'uppercase',
            padding: '17px 0', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 10, cursor: 'pointer', borderRadius: 8,
          }}
        >
          {lang.startsWith('pt') ? 'Registrar série' : 'Register set'}
          <span style={{ fontSize: 22 }}>→</span>
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <button type="button" onClick={() => setShowSummary(true)}
            style={{ border: 'none', background: 'transparent', color: '#6e6e6e', fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer', padding: '4px 0' }}>
            {lang.startsWith('pt') ? 'ENCERRAR' : 'FINISH'}
          </button>
          <button type="button" onClick={() => setShowDiscardModal(true)}
            style={{ border: 'none', background: 'transparent', color: '#3a3a3a', fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer', padding: '4px 0' }}>
            {lang.startsWith('pt') ? 'CANCELAR' : 'CANCEL'}
          </button>
        </div>
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

      <VideoModal
        isOpen={showVideoModal}
        onClose={() => setShowVideoModal(false)}
        title={currentExercise.title}
        videoUrl={safeVideoUrl}
      />

      <Modal
        isOpen={showExerciseList}
        onClose={() => setShowExerciseList(false)}
        title={lang.startsWith('pt') ? 'Exercícios do treino' : 'Workout exercises'}
      >
        <div className="flex flex-col gap-2">
          {sessionItemsForView.map((item, idx) => {
            const isCurrent = idx === currentExerciseIdx
            const statsStr = [
              item.sets != null && item.reps != null ? `${item.sets}×${item.reps}` : null,
              item.weight != null ? `· ${item.weight}kg` : null,
            ].filter(Boolean).join(' ')
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => { setCurrentExerciseIdx(idx); setShowExerciseList(false) }}
                className="flex w-full items-center gap-3 rounded-[13px] border px-3.5 py-3 text-left"
                style={{
                  borderColor: isCurrent ? 'var(--color-ot-blue)' : '#e9e9ee',
                  background: item.isDone ? '#f7f7fa' : '#fff',
                }}
              >
                <span
                  className="flex h-7 w-7 flex-none items-center justify-center rounded-md font-display text-[13px] font-bold"
                  style={{ background: item.isDone ? '#d8ff36' : '#f0f0f3', color: item.isDone ? '#0a0a0a' : '#9a9aa2' }}
                >
                  {item.isDone ? '✓' : idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[16px] font-semibold uppercase leading-none truncate">
                    {item.title}
                  </div>
                  {statsStr && (
                    <div className="mt-1 font-ot-mono text-[10px]" style={{ color: '#9a9aa2' }}>{statsStr}</div>
                  )}
                </div>
                {isCurrent && (
                  <span className="flex-none font-ot-mono text-[9px] uppercase" style={{ color: 'var(--color-ot-blue)' }}>
                    {lang.startsWith('pt') ? 'AGORA' : 'NOW'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </Modal>
    </div>
  )
}
