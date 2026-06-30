import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Info, X } from 'lucide-react'
import { useWorkoutStore } from '../stores/useWorkoutStore'
import { useAuthStore } from '../stores/useAuthStore'
import { UserRole } from '../constants/auth'import { AppRoutes } from '../constants/routes'

import {
  fetchWorkoutCoachContext,
  generateWorkoutSuggestion,
  type AiWorkoutSuggestion,
} from '../lib/aiWorkoutCoach'

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback

const Shimmer = ({ h, w = '100%', r = 12 }: { h: number; w?: string; r?: number }) => (
  <div style={{
    height: h, width: w, borderRadius: r,
    background: 'linear-gradient(90deg, var(--color-ot-border) 25%, var(--color-ot-paper) 50%, var(--color-ot-border) 75%)',
    backgroundSize: '200% 100%',
    animation: 'ot-shimmer 1.4s ease-in-out infinite',
  }} />
)

export default function WorkoutCoach() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, role, hasActiveCoach } = useAuthStore()
  const { workouts, fetchWorkouts, applySuggestedWorkout } = useWorkoutStore()
  const canManageWorkouts = role === UserRole.Instructor || (role === UserRole.Student && !hasActiveCoach)

  const [selectedWorkoutId, setSelectedWorkoutId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [suggestion, setSuggestion] = useState<AiWorkoutSuggestion | null>(null)
  const [suggestionSource, setSuggestionSource] = useState<'ai' | 'fallback' | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showInfo, setShowInfo] = useState(false)

  useEffect(() => { void fetchWorkouts() }, [fetchWorkouts])

  useEffect(() => {
    if (!selectedWorkoutId && workouts.length > 0) setSelectedWorkoutId(workouts[0].id)
  }, [workouts, selectedWorkoutId])

  const selectedWorkout = useMemo(
    () => workouts.find(w => w.id === selectedWorkoutId) ?? null,
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
      const result = await generateWorkoutSuggestion({ ...context, userPrompt: prompt.trim() })
      setSuggestion(result.suggestion)
      setSuggestionSource(result.source)
      setPrompt('')
    } catch (error: unknown) {
      setFeedback({ type: 'error', text: getErrorMessage(error, t('coach_ai.generate_error')) })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleAccept = async () => {
    if (!selectedWorkout || !suggestion) return
    setIsApplying(true)
    setFeedback(null)
    try {
      const createdId = await applySuggestedWorkout(selectedWorkout.id, suggestion)
      if (!createdId) throw new Error(t('coach_ai.apply_error'))
      setFeedback({ type: 'success', text: t('coach_ai.apply_success') })
      navigate(AppRoutes.WorkoutEdit(createdId))
    } catch (error: unknown) {
      setFeedback({ type: 'error', text: getErrorMessage(error, t('coach_ai.apply_error')) })
    } finally {
      setIsApplying(false)
    }
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--color-ot-card)',
    border: '1px solid var(--color-ot-border)',
    borderRadius: 20,
    padding: '18px 16px',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: "'Space Mono', monospace",
    fontSize: 10,
    letterSpacing: '0.18em',
    color: '#9a9aa2',
    marginBottom: 8,
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-ot-paper)', color: 'var(--color-ot-ink)', paddingBottom: 88, fontFamily: "'Archivo', sans-serif" }}>
      <style>{`@keyframes ot-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '48px 22px 0' }}>
        <button type="button" onClick={() => navigate(AppRoutes.Home)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
          <ArrowLeft className="h-5 w-5" style={{ color: '#6a6a72' }} />
        </button>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.2em', color: '#9a9aa2' }}>
          {t('coach_ai.title').toUpperCase()}
        </span>
        <button
          type="button"
          onClick={() => setShowInfo(v => !v)}
          style={{ background: showInfo ? 'var(--color-ot-ink)' : 'none', border: '1.5px solid var(--color-ot-border)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          aria-label={t('coach_ai.info_toggle')}
        >
          {showInfo
            ? <X className="h-3.5 w-3.5" style={{ color: 'var(--color-ot-lime)' }} />
            : <Info className="h-3.5 w-3.5" style={{ color: '#6a6a72' }} />}
        </button>
      </div>

      <div style={{ padding: '0 22px' }}>

        {/* Hero block */}
        <div style={{ marginTop: 24, background: '#0e0e10', borderRadius: 22, padding: '22px 20px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(216,255,54,0.12)', border: '1px solid rgba(216,255,54,0.25)', borderRadius: 999, padding: '4px 11px', marginBottom: 14 }}>
            <span style={{ fontSize: 13 }}>✦</span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.16em', color: '#d8ff36' }}>
              {t('coach_ai.single_session').toUpperCase()}
            </span>
          </div>
          <div style={{ fontFamily: "'Saira Condensed', sans-serif", fontWeight: 800, fontSize: 34, lineHeight: 0.92, textTransform: 'uppercase', color: '#fafafa', marginBottom: 12 }}>
            {t('coach_ai.hero_title')}
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: '#9a9aa2', margin: 0 }}>
            {t('coach_ai.hero_desc')}
          </p>
        </div>

        {/* Info panel */}
        {showInfo && (
          <div style={{ marginTop: 10, background: '#fff', border: '1px solid #e9e9ee', borderRadius: 16, padding: '14px 16px' }}>
            <p style={{ fontSize: 13, lineHeight: 1.65, color: '#4a4a52', margin: 0 }}>
              {t('coach_ai.intro')}
            </p>
          </div>
        )}

        {/* Readonly notice */}
        {!canManageWorkouts && (
          <div style={{ marginTop: 12, background: 'rgba(245, 208, 0, 0.12)', border: '1.5px solid rgba(245, 208, 0, 0.25)', borderRadius: 14, padding: '12px 14px' }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: 'var(--color-ot-ink)', margin: 0, lineHeight: 1.6 }}>
              {t('coach_ai.readonly_notice')}
            </p>
          </div>
        )}

        {/* Form card */}
        <div style={{ ...cardStyle, marginTop: 18 }}>
          {/* Workout selector */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{t('coach_ai.workout_label').toUpperCase()}</label>
            <div style={{ position: 'relative' }}>
              <select
                value={selectedWorkoutId}
                onChange={e => setSelectedWorkoutId(e.target.value)}
                style={{
                  width: '100%', appearance: 'none', WebkitAppearance: 'none',
                  background: 'var(--color-ot-paper)', border: '1.5px solid var(--color-ot-border)', borderRadius: 12,
                  padding: '12px 40px 12px 14px',
                  fontFamily: "'Saira Condensed', sans-serif", fontWeight: 700,
                  fontSize: 17, color: 'var(--color-ot-ink)', outline: 'none', cursor: 'pointer',
                }}
              >
                {workouts.map(w => (
                  <option key={w.id} value={w.id}>{w.focus || w.name}</option>
                ))}
              </select>
              <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9a9aa2', fontSize: 12 }}>▾</span>
            </div>
          </div>

          {/* Prompt textarea */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{t('coach_ai.prompt_label').toUpperCase()}</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={t('coach_ai.prompt_placeholder')}
              rows={4}
              style={{
                width: '100%', boxSizing: 'border-box', resize: 'vertical',
                background: 'var(--color-ot-paper)', border: '1.5px solid var(--color-ot-border)', borderRadius: 12,
                padding: '12px 14px',
                fontFamily: "'Archivo', sans-serif", fontSize: 14, lineHeight: 1.6,
                color: 'var(--color-ot-ink)', outline: 'none',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--color-ot-blue)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--color-ot-border)' }}
            />
          </div>

          {/* Generate button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!selectedWorkout || isGenerating}
            style={{
              width: '100%', border: 'none', borderRadius: 12, padding: '15px 0',
              background: !selectedWorkout || isGenerating ? 'var(--color-ot-border)' : 'var(--color-ot-ink)',
              color: !selectedWorkout || isGenerating ? 'var(--color-ot-faint)' : 'var(--color-ot-lime)',
              fontFamily: "'Saira Condensed', sans-serif", fontWeight: 800,
              fontSize: 22, letterSpacing: '0.02em', textTransform: 'uppercase',
              cursor: !selectedWorkout || isGenerating ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            {isGenerating ? (
              <>
                <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid #d8ff3640', borderTopColor: '#d8ff36', animation: 'spin 0.8s linear infinite' }} />
                {t('coach_ai.generating')}
              </>
            ) : (
              <>{t('coach_ai.generate')} ✦</>
            )}
          </button>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

          {/* Feedback */}
          {feedback && (
            <div style={{
              marginTop: 12, borderRadius: 12, padding: '11px 14px',
              background: feedback.type === 'success' ? 'var(--color-ot-success-bg)' : 'var(--color-ot-danger-bg)',
              border: `1px solid ${feedback.type === 'success' ? 'var(--color-ot-success-border)' : 'var(--color-ot-danger-border)'}`,
            }}>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, margin: 0, lineHeight: 1.6, color: feedback.type === 'success' ? 'var(--color-ot-success-text)' : 'var(--color-ot-danger-text)' }}>
                {feedback.text}
              </p>
            </div>
          )}
        </div>

        {/* Suggestion area */}
        <div style={{ marginTop: 18 }}>
          {isGenerating ? (
            <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <Shimmer h={22} w="55%" />
                  <Shimmer h={14} w="38%" />
                </div>
                <Shimmer h={24} w="70px" r={999} />
              </div>
              <Shimmer h={14} />
              <Shimmer h={14} w="88%" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Shimmer h={60} />
                <Shimmer h={60} />
                <Shimmer h={60} />
              </div>
              <Shimmer h={50} r={12} />
            </div>
          ) : !suggestion ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: '36px 20px' }}>
              <div style={{ fontFamily: "'Saira Condensed', sans-serif", fontWeight: 700, fontSize: 48, color: '#e0e0e4', lineHeight: 1, marginBottom: 12 }}>✦</div>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: '#9a9aa2', letterSpacing: '0.1em', lineHeight: 1.7, margin: 0 }}>
                {t('coach_ai.empty_state')}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Suggestion header */}
              <div style={{ ...cardStyle }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "'Saira Condensed', sans-serif", fontWeight: 800, fontSize: 30, lineHeight: 0.9, textTransform: 'uppercase' }}>
                      {suggestion.name}
                    </div>
                    {suggestion.focus && (
                      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.14em', color: '#2a5fff', marginTop: 6 }}>
                        {suggestion.focus.toUpperCase()}
                      </div>
                    )}
                  </div>
                  {suggestionSource && (
                    <span style={{
                      flexShrink: 0, fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: '0.12em',
                      background: suggestionSource === 'ai' ? 'var(--color-ot-accent-bg)' : 'var(--color-ot-paper)',
                      color: suggestionSource === 'ai' ? 'var(--color-ot-accent-text)' : 'var(--color-ot-faint)',
                      border: `1px solid ${suggestionSource === 'ai' ? 'var(--color-ot-accent-border)' : 'var(--color-ot-border)'}`,
                      borderRadius: 999, padding: '4px 10px',
                    }}>
                      {suggestionSource === 'ai' ? t('coach_ai.source_ai') : t('coach_ai.source_fallback')}
                    </span>
                  )}
                </div>
                {suggestion.summary && (
                  <p style={{ fontSize: 14, lineHeight: 1.65, color: '#4a4a52', margin: 0 }}>
                    {suggestion.summary}
                  </p>
                )}
              </div>

              {/* Rationale */}
              {suggestion.rationale.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {suggestion.rationale.map((reason, i) => (
                    <div key={i} style={{ background: 'var(--color-ot-card)', border: '1px solid var(--color-ot-border)', borderRadius: 14, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--color-ot-lime)', background: 'var(--color-ot-ink)', borderRadius: 6, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>✓</span>
                      <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-ot-muted)', margin: 0 }}>{reason}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Exercise list */}
              <div style={{ ...cardStyle }}>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.18em', color: '#9a9aa2', marginBottom: 12 }}>
                  {t('editor.exercises', 'EXERCÍCIOS').toUpperCase()} · {suggestion.items.length}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {suggestion.items.map((item, idx) => {
                    const stats = [
                      item.default_sets ? `${item.default_sets}×` : null,
                      item.default_reps ? item.default_reps : null,
                      item.rest_seconds ? `${item.rest_seconds}s` : null,
                    ].filter(Boolean).join(' ')
                    return (
                      <div key={`${item.title}-${idx}`} style={{ background: 'var(--color-ot-paper)', borderRadius: 13, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <span style={{ fontFamily: "'Saira Condensed', sans-serif", fontWeight: 800, fontSize: 14, color: '#b3b3bb', flexShrink: 0, marginTop: 2 }}>
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "'Saira Condensed', sans-serif", fontWeight: 700, fontSize: 18, textTransform: 'uppercase', lineHeight: 1 }}>
                            {item.title}
                          </div>
                          {stats && (
                            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: 'var(--color-ot-muted)', marginTop: 4 }}>
                              {stats}
                            </div>
                          )}
                          {item.notes && (
                            <p style={{ fontSize: 12, color: 'var(--color-ot-muted)', marginTop: 6, lineHeight: 1.5 }}>{item.notes}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Notes */}
              {suggestion.notes && (
                <div style={{ background: 'var(--color-ot-success-bg)', border: '1px solid var(--color-ot-success-border)', borderRadius: 14, padding: '13px 15px' }}>
                  <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--color-ot-success-text)', margin: 0 }}>{suggestion.notes}</p>
                </div>
              )}

              {/* Accept button */}
              <button
                type="button"
                onClick={handleAccept}
                disabled={!canManageWorkouts || isApplying}
                style={{
                  width: '100%', border: 'none', borderRadius: 12, padding: '16px 0',
                  background: !canManageWorkouts || isApplying ? 'var(--color-ot-border)' : 'var(--color-ot-blue)',
                  color: !canManageWorkouts || isApplying ? 'var(--color-ot-faint)' : '#fff',
                  fontFamily: "'Saira Condensed', sans-serif", fontWeight: 800,
                  fontSize: 22, textTransform: 'uppercase', letterSpacing: '0.02em',
                  cursor: !canManageWorkouts || isApplying ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}
              >
                {isApplying ? (
                  <>
                    <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid #ffffff40', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite' }} />
                    {t('coach_ai.applying')}
                  </>
                ) : (
                  <>{t('coach_ai.accept')} →</>
                )}
              </button>

              {/* Reset */}
              <button
                type="button"
                onClick={() => { setSuggestion(null); setSuggestionSource(null); setFeedback(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '0.14em', color: '#9a9aa2', textAlign: 'center', padding: '4px 0', width: '100%' }}
              >
                {t('coach_ai.reset').toUpperCase()}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
