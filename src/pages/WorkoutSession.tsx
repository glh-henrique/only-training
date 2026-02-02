import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'
import { useSessionStore } from '../stores/useSessionStore'
import { useWorkoutStore } from '../stores/useWorkoutStore'
import { Loading } from '../components/ui/loading'
import { Button } from '../components/ui/button'
import { Check, ArrowLeft, Clock, AlertCircle, Video, Play } from 'lucide-react'
import { cn, getSafeExternalUrl } from '../lib/utils'
import { Input } from '../components/ui/input'
import { Modal } from '../components/ui/modal'
import { AlertModal } from '../components/ui/alert-modal'

export default function WorkoutSession() {
  const { t } = useTranslation()
  const { workoutId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [showFinishModal, setShowFinishModal] = useState(false)
  const [showDiscardModal, setShowDiscardModal] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [restItemId, setRestItemId] = useState<string | null>(null)
  const [restRemaining, setRestRemaining] = useState<number | null>(null)
  const [restItemTitle, setRestItemTitle] = useState('')
  const [showRestDoneModal, setShowRestDoneModal] = useState(false)

  
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
  const {
    workouts,
    fetchWorkouts,
    activeWorkoutItems,
    fetchWorkoutItems
  } = useWorkoutStore()

  // Check for conflict: Active session exists but for a different workout type
  const isConflict = !isLoading && currentSession && workoutId && currentSession.workout_id !== workoutId
  const isActive = !!currentSession && !!workoutId && currentSession.workout_id === workoutId
  const autoStart = !!(location.state as { autoStart?: boolean } | null)?.autoStart

  // Format seconds to MM:SS
  const formattedTime = new Date(duration * 1000).toISOString().substr(14, 5)

  // Progress Calculation (active session only)
  const totalItems = isActive ? sessionItems.length : activeWorkoutItems.length
  const completedItems = isActive ? sessionItems.filter(i => i.is_done).length : 0
  const progress = isActive && totalItems > 0 ? (completedItems / totalItems) * 100 : 0

  const [isInitializing, setIsInitializing] = useState(true)
  
  useEffect(() => {
    let isMounted = true
    resumeSession().finally(() => {
      if (isMounted) setIsInitializing(false)
    })
    return () => { isMounted = false }
  }, [resumeSession])

  useEffect(() => {
    if (!workoutId) return
    if (workouts.length === 0) {
      fetchWorkouts()
    }
    fetchWorkoutItems(workoutId)
  }, [workoutId, fetchWorkouts, fetchWorkoutItems, workouts.length])

  useEffect(() => {
    if (restRemaining == null || restRemaining <= 0) return
    const interval = setInterval(() => {
      setRestRemaining(prev => {
        if (prev == null) return prev
        if (prev <= 1) return 0
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [restRemaining])

  useEffect(() => {
    if (restRemaining !== 0 || !restItemId) return

    const playBeep = () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        const ctx = new AudioCtx()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = 880
        gain.gain.value = 0.2
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.5)
        osc.onended = () => ctx.close()
      } catch {
        // Ignore audio errors (e.g., autoplay restrictions)
      }
    }

    playBeep()
    setShowRestDoneModal(true)
    setRestItemId(null)
  }, [restRemaining, restItemId])

  const startRestTimer = (itemId: string, seconds: number | null, title: string) => {
    if (!seconds || seconds <= 0) return
    setRestItemId(itemId)
    setRestItemTitle(title)
    setRestRemaining(seconds)
  }

  useEffect(() => {
    // Only try to start a new session if:
    // 1. We finished the initial check (isInitializing is false)
    // 2. No session is currently loading (isLoading is false)
    // 3. There is no active session (currentSession is null)
    // 4. We actually have a workoutId to start
    // 5. We are NOT in the process of exiting (finishing/canceling)
    // 6. Auto-start was requested (from Play button)
    if (!isInitializing && !isLoading && !currentSession && workoutId && !isExiting && autoStart) {
      ;(async () => {
        setIsStarting(true)
        const result = await startSession(workoutId)
        if (result === 'no_items') {
          navigate(`/workout/${workoutId}/edit`)
        }
        setIsStarting(false)
      })()
    }
  }, [isInitializing, isLoading, currentSession, workoutId, startSession, isExiting, navigate, autoStart])

  const handleStart = async () => {
    if (!workoutId || isStarting) return
    setIsStarting(true)
    const result = await startSession(workoutId)
    if (result === 'no_items') {
      navigate(`/workout/${workoutId}/edit`)
    }
    setIsStarting(false)
  }

  const workout = workouts.find(w => w.id === workoutId)
  const previewItems = useMemo(() => {
    return activeWorkoutItems.map(item => ({
      id: item.id,
      title: item.title,
      restSeconds: item.rest_seconds,
      notes: item.notes,
      videoUrl: item.video_url,
      isDone: false,
      weight: item.default_weight,
      sets: item.default_sets,
      reps: item.default_reps
    }))
  }, [activeWorkoutItems])

  const sessionItemsForView = useMemo(() => {
    return sessionItems.map(item => ({
      id: item.id,
      title: item.title_snapshot,
      restSeconds: item.rest_seconds,
      notes: item.notes_snapshot,
      videoUrl: item.video_url,
      isDone: item.is_done,
      weight: item.weight,
      sets: item.sets,
      reps: item.reps
    }))
  }, [sessionItems])

  const itemsForView = isActive ? sessionItemsForView : previewItems

  const handleFinish = async () => {
    setIsExiting(true)
    await finishSession()
    navigate('/')
  }

  const handleCancel = async () => {
    console.log('[WorkoutSession] handleCancel called', { isConflict, workoutId })
    if (!workoutId) return
    
    setIsExiting(true)
    setShowDiscardModal(false)
    
    try {
      if (isConflict) {
          await restartSession(workoutId)
          // When restartSession completes, currentSession updates, isConflict becomes false
          // We need to stop "exiting" so the UI can render the new workout
          setIsExiting(false)
      } else {
          await finishAllInProgressSessions()
          navigate('/')
      }
    } catch (err) {
      console.error('[WorkoutSession] handleCancel failed:', err)
      setIsExiting(false)
    }
  }

  const handleResumeOld = () => {
      // Go to the active session
      if (currentSession) {
          navigate(`/workout/${currentSession.workout_id}`)
      }
  }

  if (isInitializing || isLoading || isExiting || isStarting) {
    return <Loading fullPage />
  }

  if (error) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white p-6 text-center space-y-4 transition-colors">
            <div className="bg-red-500/10 p-4 rounded-full text-red-500">
                <AlertCircle className="h-10 w-10" />
            </div>
            <h2 className="text-xl font-bold">{t('common.error', 'Something went wrong')}</h2>
            <p className="text-sm text-neutral-500 max-w-xs">{error}</p>
            <Button onClick={() => {
                // Clear error and go home
                useSessionStore.setState({ error: null })
                navigate('/')
            }}>{t('common.back_to_home', 'Back to Home')}</Button>
        </div>
    )
  }

  if (isConflict) {
      // (Keep existing conflict screen logic)
      return (
        <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white flex flex-col items-center justify-center p-6 text-center space-y-6 transition-colors">
            <div className="bg-yellow-500/10 p-4 rounded-full">
                <Clock className="h-10 w-10 text-yellow-500" />
            </div>
            <div className="space-y-2">
                <h2 className="text-xl font-bold">{t('session.conflict.title')}</h2>
                <div className="text-neutral-600 dark:text-neutral-400">
                  <Trans 
                    i18nKey="session.conflict.description" 
                    values={{ workout: currentSession.workout_name_snapshot }}
                  >
                    You have an active session for <span className="text-emerald-500 font-semibold">{currentSession.workout_name_snapshot}</span>.
                  </Trans>
                </div>
                <p className="text-sm text-neutral-500">
                    {t('session.conflict.question')}
                </p>
            </div>
            <div className="flex flex-col w-full gap-3 max-w-xs">
                <Button onClick={handleResumeOld} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                    {t('session.conflict.resume', { workout: currentSession.workout_name_snapshot })}
                </Button>
                <Button variant="outline" onClick={() => setShowDiscardModal(true)} className="w-full text-red-500 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30">
                    {t('session.conflict.discard', 'Discard & Start New')}
                </Button>
                <Button variant="ghost" onClick={() => navigate('/')} className="text-neutral-500">
                    {t('common.cancel')}
                </Button>
            </div>

            <AlertModal
              isOpen={showDiscardModal}
              onClose={() => {
                console.log('[WorkoutSession/Conflict] Closing Discard Modal')
                setShowDiscardModal(false)
              }}
              onConfirm={handleCancel}
              variant="danger"
              title={t('session.discard_modal_title', 'Discard Session?')}
              description={t('session.discard_modal_desc', 'Are you sure you want to discard this session? All currently recorded data will be lost.')}
              confirmLabel={t('session.conflict.discard', 'Discard')}
            />
        </div>
      )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white pb-24 transition-colors">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/90 dark:bg-neutral-900/90 backdrop-blur z-10 transition-all border-b border-neutral-200 dark:border-neutral-800">
        <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="text-neutral-500 dark:text-neutral-400">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="font-bold text-lg leading-tight text-neutral-900 dark:text-white">
                  {isActive ? currentSession.workout_name_snapshot : (workout?.name || t('common.loading', 'Loading'))}
                </h1>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {isActive ? currentSession.workout_focus_snapshot : (workout?.focus || t('session.not_started', 'Workout not started'))}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isActive ? (
                <>
                  <div className="flex items-center gap-2 font-mono text-xl font-bold text-emerald-600 dark:text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-md">
                    <Clock className="h-4 w-4" />
                    {formattedTime}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setShowDiscardModal(true)} className="text-red-500 hover:text-red-400 hover:bg-red-500/10">
                    {t('common.cancel')}
                  </Button>
                </>
              ) : (
                <Button onClick={handleStart} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Play className="h-4 w-4 mr-2" />
                  {t('workouts.start_workout')}
                </Button>
              )}
            </div>
        </div>
        {/* Progress Bar */}
        <div className="h-1 w-full bg-neutral-100 dark:bg-neutral-800">
            <div 
                className="h-full bg-emerald-500 transition-all duration-500 ease-out" 
                style={{ width: `${progress}%` }}
            />
        </div>
      </header>

      {/* List */}
      <div className={cn("pt-24 px-4 space-y-4", !isActive && "opacity-80")}>
        {itemsForView.length === 0 && (
          isActive ? (
            <div className="text-center py-10 space-y-4">
              <p className="text-neutral-400">{t('history.no_sessions')}</p>
              <p className="text-sm text-neutral-500">
                {t('session.empty_help', 'If you recently added exercises to this workout, this session might be using an old snapshot. Discarding it will let you start a fresh one.')}
              </p>
              <Button variant="outline" onClick={handleCancel} className="text-red-400 border-red-900/50 hover:bg-red-950/30">
                {t('session.conflict.discard', 'Discard & Restart')}
              </Button>
            </div>
          ) : (
            <div className="text-center py-10 space-y-4">
              <p className="text-neutral-400">{t('workouts.no_items', 'No exercises yet')}</p>
              <Button variant="outline" onClick={() => navigate(`/workout/${workoutId}/edit`)} className="text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10">
                {t('workouts.edit', 'Edit Workout')}
              </Button>
            </div>
          )
        )}
        {itemsForView.map((item) => {
          const safeVideoUrl = getSafeExternalUrl(item.videoUrl)
          return (
          <div 
            key={item.id} 
            className={cn(
              "bg-neutral-50 dark:bg-neutral-900 rounded-xl p-4 border transition-all",
              item.isDone ? "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/10" : "border-neutral-200 dark:border-neutral-800"
            )}
          >
            <div className="flex items-start justify-between mb-4 gap-3">
              <div className="space-y-1">
                <h3 className={cn("font-medium text-lg", item.isDone ? "text-neutral-400 dark:text-neutral-500 line-through" : "text-neutral-900 dark:text-white")}>
                  {item.title}
                </h3>
                {safeVideoUrl && (
                  isActive ? (
                    <a
                      href={safeVideoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-xs text-emerald-600 hover:text-emerald-700"
                    >
                      <span>Video Exemplo</span>
                      <Video className="h-4 w-4" />
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-xs text-neutral-400">
                      <span>Video Exemplo</span>
                      <Video className="h-4 w-4" />
                    </span>
                  )
                )}
              </div>
              <button
                onClick={() => {
                  if (!isActive) return
                  toggleItemDone(item.id, !item.isDone)
                }}
                disabled={!isActive}
                className={cn(
                  "h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0",
                  !isActive && "opacity-50 cursor-not-allowed",
                  item.isDone 
                    ? "bg-emerald-500 border-emerald-500 text-black" 
                    : "border-neutral-600 hover:border-emerald-500"
                )}
              >
                {item.isDone && <Check className="h-5 w-5" />}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-neutral-500 mb-1 block">{t('common.weight')} (kg)</label>
                <Input 
                  type="number" 
                  value={item.weight ?? ''} 
                  onChange={(e) => {
                    if (!isActive) return
                    updateItemStats(item.id, Number(e.target.value), item.reps ?? '')
                  }}
                  disabled={!isActive || item.isDone}
                  className={cn(
                      "bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 h-10 transition-opacity text-neutral-900 dark:text-white", 
                      (!isActive || item.isDone) && "opacity-50 cursor-not-allowed"
                  )}
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500 mb-1 block">{t('common.sets')} ({t('session.target', 'Target')})</label>
                <div className="h-10 px-3 flex items-center text-neutral-900 dark:text-white font-medium text-lg">
                  {item.sets ?? '-'}
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-500 mb-1 block">{t('common.reps')} ({t('session.target', 'Target')})</label>
                <div className="h-10 px-3 flex items-center text-neutral-900 dark:text-white font-medium text-lg">
                  {item.reps ?? '-'}
                </div>
              </div>
            </div>

            {item.restSeconds != null && (
              <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {t('common.rest')}: {item.restSeconds}s
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!isActive) return
                      startRestTimer(item.id, item.restSeconds, item.title)
                    }}
                    disabled={!isActive || (restItemId === item.id && restRemaining != null && restRemaining > 0)}
                    className={cn(
                      "text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10",
                      !isActive && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {restItemId === item.id && restRemaining != null
                      ? t('session.rest_running', { seconds: restRemaining })
                      : t('session.start_rest')}
                  </Button>
                </div>
              </div>
            )}
            {item.notes && (
              <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <p className="text-sm text-neutral-500 dark:text-neutral-400 italic">
                  {t('common.notes')}: {item.notes}
                </p>
              </div>
            )}
          </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent space-y-2">
        {isActive ? (
          <Button 
            size="lg" 
            disabled={completedItems < 3 && totalItems >= 3}
            className={cn(
              "w-full font-bold h-14 text-lg shadow-lg transition-all",
              completedItems < 3 && totalItems >= 3
                ? "bg-neutral-800 text-neutral-500 cursor-not-allowed shadow-none"
                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/50"
            )}
            onClick={() => setShowFinishModal(true)}
          >
            <span className="flex flex-col items-center leading-tight">
              <span>{t('session.finish')}</span>
              {completedItems < 3 && totalItems >= 3 && (
                <span className="text-xs font-normal opacity-80">
                  {t('session.finish_hint', { count: 3, current: completedItems })}
                </span>
              )}
            </span>
          </Button>
        ) : (
          <Button 
            size="lg"
            className="w-full font-bold h-14 text-lg shadow-lg transition-all bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/50"
            onClick={handleStart}
          >
            <span className="flex items-center justify-center gap-2">
              <Play className="h-5 w-5" />
              <span>{t('workouts.start_workout')}</span>
            </span>
          </Button>
        )}
      </div>

      {isActive && (
        <Modal 
          isOpen={showFinishModal} 
          onClose={() => setShowFinishModal(false)}
          title={t('session.finish_modal_title', 'Finish Workout?')}
        >
          <div className="space-y-4">
            <div className="text-neutral-300">
              <Trans 
                i18nKey="session.finish_modal_desc" 
                values={{ formattedTime }}
              >
                Great job! You've been training for <span className="text-emerald-500 font-bold">{formattedTime}</span>.
              </Trans>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowFinishModal(false)}>
                {t('session.keep_training', 'Keep Training')}
              </Button>
              <Button 
                className="flex-1 bg-emerald-600 text-white" 
                onClick={handleFinish}
                disabled={completedItems < 3 && totalItems >= 3}
              >
                {t('session.finish')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {isActive && (
        <AlertModal
          isOpen={showDiscardModal}
          onClose={() => {
            console.log('[WorkoutSession] Closing Discard Modal')
            setShowDiscardModal(false)
          }}
          onConfirm={handleCancel}
          variant="danger"
          title={t('session.discard_modal_title', 'Discard Session?')}
          description={t('session.discard_modal_desc', 'Are you sure you want to discard this session? All currently recorded data will be lost.')}
          confirmLabel={t('session.conflict.discard', 'Discard')}
        />
      )}

      <Modal
        isOpen={showRestDoneModal}
        onClose={() => setShowRestDoneModal(false)}
        title={t('session.rest_done_title')}
      >
        <div className="space-y-4">
          <div className="text-neutral-300">
            {t('session.rest_done_desc', { exercise: restItemTitle })}
          </div>
          <Button className="w-full bg-emerald-600 text-white" onClick={() => setShowRestDoneModal(false)}>
            {t('common.ok', 'OK')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
