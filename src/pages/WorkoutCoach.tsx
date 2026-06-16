import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Bot, Check, Dumbbell, Info, Sparkles } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { useWorkoutStore } from '../stores/useWorkoutStore'
import { useAuthStore } from '../stores/useAuthStore'
import {
  fetchWorkoutCoachContext,
  generateWorkoutSuggestion,
  type AiWorkoutSuggestion,
} from '../lib/aiWorkoutCoach'

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback

export default function WorkoutCoach() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, role, hasActiveCoach } = useAuthStore()
  const { workouts, fetchWorkouts, applySuggestedWorkout } = useWorkoutStore()
  const canManageWorkouts = role === 'instrutor' || (role === 'aluno' && !hasActiveCoach)

  const [selectedWorkoutId, setSelectedWorkoutId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [suggestion, setSuggestion] = useState<AiWorkoutSuggestion | null>(null)
  const [suggestionSource, setSuggestionSource] = useState<'ai' | 'fallback' | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isInfoVisible, setIsInfoVisible] = useState(false)

  useEffect(() => {
    void fetchWorkouts()
  }, [fetchWorkouts])

  useEffect(() => {
    if (!selectedWorkoutId && workouts.length > 0) {
      setSelectedWorkoutId(workouts[0].id)
    }
  }, [workouts, selectedWorkoutId])

  const selectedWorkout = useMemo(
    () => workouts.find((workout) => workout.id === selectedWorkoutId) ?? null,
    [selectedWorkoutId, workouts],
  )

  const handleGenerate = async () => {
    if (!user || !selectedWorkout) return

    setIsGenerating(true)
    setFeedback(null)
    setSuggestion(null)
    setSuggestionSource(null)

    try {
      const context = await fetchWorkoutCoachContext(user.id, selectedWorkout.id)
      const result = await generateWorkoutSuggestion({
        ...context,
        userPrompt: prompt.trim(),
      })

      setSuggestion(result.suggestion)
      setSuggestionSource(result.source)
      setPrompt('')
    } catch (error: unknown) {
      setFeedback(getErrorMessage(error, t('coach_ai.generate_error')))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleAccept = async () => {
    if (!selectedWorkout || !suggestion) return

    setIsApplying(true)
    setFeedback(null)
    try {
      const createdWorkoutId = await applySuggestedWorkout(selectedWorkout.id, suggestion)
      if (!createdWorkoutId) {
        throw new Error(t('coach_ai.apply_error'))
      }

      setFeedback(t('coach_ai.apply_success'))
      navigate(`/workout/${createdWorkoutId}/edit`)
    } catch (error: unknown) {
      setFeedback(getErrorMessage(error, t('coach_ai.apply_error')))
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white pb-20">
      <header className="p-4 flex items-center gap-4 sticky top-0 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md z-10 border-b border-neutral-200 dark:border-neutral-800">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl font-bold">{t('coach_ai.title')}</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('coach_ai.subtitle')}</p>
        </div>
      </header>

      <main className="p-4 max-w-4xl mx-auto space-y-6">
        {!canManageWorkouts ? (
          <section className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-5">
            <p className="text-sm text-amber-700 dark:text-amber-300">{t('coach_ai.readonly_notice')}</p>
          </section>
        ) : null}

        <section className="rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-linear-to-br from-emerald-500/[0.12] via-white to-sky-500/[0.08] dark:from-emerald-500/10 dark:via-neutral-950 dark:to-sky-500/10 p-5 shadow-sm">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <Bot className="h-3.5 w-3.5" />
                {t('coach_ai.single_session')}
              </div>
              <button
                type="button"
                onClick={() => setIsInfoVisible((current) => !current)}
                aria-label={t('coach_ai.info_toggle')}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white/80 text-neutral-500 transition-colors hover:text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-400 dark:hover:text-white"
              >
                <Info className="h-4 w-4" />
              </button>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">{t('coach_ai.hero_title')}</h2>
            <p className="max-w-2xl text-sm text-neutral-600 dark:text-neutral-300">{t('coach_ai.hero_desc')}</p>
            {isInfoVisible ? (
              <div className="max-w-2xl rounded-2xl border border-neutral-200/80 bg-white/80 px-4 py-3 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950/70 dark:text-neutral-300">
                {t('coach_ai.intro')}
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 overflow-hidden">
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t('coach_ai.workout_label')}</label>
                <select
                  value={selectedWorkoutId}
                  onChange={(event) => setSelectedWorkoutId(event.target.value)}
                  className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {workouts.map((workout) => (
                    <option key={workout.id} value={workout.id}>
                      {workout.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t('coach_ai.prompt_label')}</label>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder={t('coach_ai.prompt_placeholder')}
                  className="w-full min-h-32 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 py-3 text-sm outline-none resize-y focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={!selectedWorkout || isGenerating}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Sparkles className="h-4 w-4" />
                {isGenerating ? t('coach_ai.generating') : t('coach_ai.generate')}
              </Button>

              {feedback ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                  {feedback}
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            <section className="rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-500 dark:text-neutral-400">
                <Dumbbell className="h-4 w-4" />
                {t('coach_ai.suggestion_title')}
              </div>

              {isGenerating ? (
                <div className="mt-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-6 w-40" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                    <Skeleton className="h-7 w-24 rounded-full" />
                  </div>

                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>

                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full rounded-2xl" />
                    <Skeleton className="h-16 w-full rounded-2xl" />
                    <Skeleton className="h-16 w-full rounded-2xl" />
                  </div>

                  <Skeleton className="h-12 w-full rounded-xl" />
                </div>
              ) : !suggestion ? (
                <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">{t('coach_ai.empty_state')}</p>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold">{suggestion.name}</h3>
                      {suggestion.focus ? (
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">{suggestion.focus}</p>
                      ) : null}
                    </div>

                    {suggestionSource ? (
                      <span className="rounded-full border border-neutral-200 dark:border-neutral-700 px-2.5 py-1 text-xs font-medium text-neutral-500 dark:text-neutral-300">
                        {suggestionSource === 'ai' ? t('coach_ai.source_ai') : t('coach_ai.source_fallback')}
                      </span>
                    ) : null}
                  </div>

                  <p className="text-sm text-neutral-600 dark:text-neutral-300">{suggestion.summary}</p>

                  {suggestion.rationale.length > 0 ? (
                    <div className="space-y-2">
                      {suggestion.rationale.map((reason) => (
                        <div key={reason} className="rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 px-4 py-3 text-sm">
                          {reason}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    {suggestion.items.map((item, index) => (
                      <div key={`${item.title}-${index}`} className="rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{item.title}</p>
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                              {[item.default_sets ? `${item.default_sets} ${t('common.sets').toLowerCase()}` : null, item.default_reps ? `${item.default_reps} ${t('common.reps').toLowerCase()}` : null, item.rest_seconds ? `${item.rest_seconds}s ${t('common.rest').toLowerCase()}` : null]
                                .filter(Boolean)
                                .join(' | ')}
                            </p>
                          </div>
                        </div>
                        {item.notes ? <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">{item.notes}</p> : null}
                      </div>
                    ))}
                  </div>

                  {suggestion.notes ? (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
                      {suggestion.notes}
                    </div>
                  ) : null}

                  <Button
                    onClick={handleAccept}
                    disabled={!canManageWorkouts || isApplying}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Check className="h-4 w-4" />
                    {isApplying ? t('coach_ai.applying') : t('coach_ai.accept')}
                  </Button>
                </div>
              )}
            </section>
          </div>
        </section>
      </main>
    </div>
  )
}
