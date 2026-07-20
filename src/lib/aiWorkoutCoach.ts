import { supabase } from './supabase'
import type { Database } from '../types/database.types'

type Workout = Database['public']['Tables']['workouts']['Row']
type WorkoutItem = Database['public']['Tables']['workout_items']['Row']
type WorkoutSession = Database['public']['Tables']['workout_sessions']['Row']
type SessionItem = Database['public']['Tables']['session_items']['Row']

export interface AiCoachSessionSummary {
  session: WorkoutSession
  items: SessionItem[]
}

export interface AiExerciseProgressInsight {
  exerciseName: string
  sessionsCompleted: number
  completionRate: number
  lastWeight: number | null
  previousWeight: number | null
  averageWeight: number | null
  lastReps: string | null
  weightTrend: 'up' | 'down' | 'flat' | 'unknown'
}

export interface AiWorkoutSuggestionItem {
  title: string
  default_sets?: number | null
  default_reps?: string | null
  rest_seconds?: number | null
  notes?: string | null
  video_url?: string | null
}

export interface AiWorkoutSuggestion {
  name: string
  focus?: string | null
  notes?: string | null
  summary: string
  rationale: string[]
  items: AiWorkoutSuggestionItem[]
}

export interface GenerateWorkoutSuggestionInput {
  workout: Workout
  workoutItems: WorkoutItem[]
  recentSessions: AiCoachSessionSummary[]
  progressInsights: AiExerciseProgressInsight[]
  userPrompt: string
}

export interface GenerateWorkoutSuggestionResult {
  suggestion: AiWorkoutSuggestion
  assistantMessage: string
  source: 'ai' | 'fallback'
}

const clampRest = (value: number | null | undefined, fallback: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.min(240, Math.max(30, Math.round(value)))
}

const clampSets = (value: number | null | undefined, fallback: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.min(8, Math.max(2, Math.round(value)))
}

const average = (values: number[]) => {
  if (values.length === 0) return null
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1))
}

const buildExerciseVariationTitle = (title: string, index: number) => {
  const normalized = title.trim()
  if (!normalized) return `Exercicio alternativo ${index + 1}`

  const variationPatterns: Array<[RegExp, string]> = [
    [/\bbarra\b/i, 'halteres'],
    [/\bhalter(es)?\b/i, 'barra'],
    [/\bmaquina\b/i, 'cabos'],
    [/\bcabos?\b/i, 'maquina'],
    [/\blivre\b/i, 'guiado'],
    [/\bguiado\b/i, 'livre'],
    [/\binclinado\b/i, 'reto'],
    [/\breto\b/i, 'inclinado'],
    [/\bsentado\b/i, 'em pe'],
    [/\bem pe\b/i, 'sentado'],
    [/\bunilateral\b/i, 'bilateral'],
    [/\bbilateral\b/i, 'unilateral'],
  ]

  for (const [pattern, replacement] of variationPatterns) {
    if (pattern.test(normalized)) {
      return normalized.replace(pattern, replacement)
    }
  }

  return `${normalized} variacao`
}

const buildProgressInsights = (recentSessions: AiCoachSessionSummary[]): AiExerciseProgressInsight[] => {
  const grouped = new Map<string, SessionItem[]>()

  for (const sessionSummary of recentSessions) {
    for (const item of sessionSummary.items) {
      const key = item.title_snapshot.trim()
      if (!key) continue
      const current = grouped.get(key) ?? []
      current.push(item)
      grouped.set(key, current)
    }
  }

  return Array.from(grouped.entries())
    .map(([exerciseName, items]) => {
      const completedItems = items.filter((item) => item.is_done)
      const weightedItems = completedItems.filter((item) => typeof item.weight === 'number' && item.weight > 0)
      const lastWeightedItem = weightedItems[0] ?? null
      const previousWeightedItem = weightedItems[1] ?? null
      const lastWeight = lastWeightedItem?.weight ?? null
      const previousWeight = previousWeightedItem?.weight ?? null
      const weightTrend: AiExerciseProgressInsight['weightTrend'] =
        typeof lastWeight === 'number' && typeof previousWeight === 'number'
          ? lastWeight > previousWeight
            ? 'up'
            : lastWeight < previousWeight
              ? 'down'
              : 'flat'
          : 'unknown'

      return {
        exerciseName,
        sessionsCompleted: completedItems.length,
        completionRate: Number((completedItems.length / Math.max(items.length, 1)).toFixed(2)),
        lastWeight,
        previousWeight,
        averageWeight: average(weightedItems.map((item) => item.weight as number)),
        lastReps: completedItems[0]?.reps ?? null,
        weightTrend,
      }
    })
    .sort((left, right) => right.sessionsCompleted - left.sessionsCompleted)
    .slice(0, 10)
}

const buildFallbackSuggestion = ({
  workout,
  workoutItems,
  progressInsights,
  userPrompt,
}: GenerateWorkoutSuggestionInput): GenerateWorkoutSuggestionResult => {
  const prompt = userPrompt.trim()
  const progressByExercise = new Map(
    progressInsights.map((insight) => [insight.exerciseName.toLowerCase(), insight]),
  )

  const rotatedItems = workoutItems.length > 0
    ? workoutItems.map((item, index) => {
        const isMainLift = index < 2
        const progress = progressByExercise.get(item.title.toLowerCase())
        const trendNote = progress?.weightTrend === 'up'
          ? 'Houve evolucao recente de carga; mantenha progressao conservadora.'
          : progress?.weightTrend === 'down'
            ? 'A carga recente caiu; reduza complexidade e recupere execucao.'
            : progress?.completionRate != null && progress.completionRate < 0.7
              ? 'A taxa de conclusao recente caiu; simplifique para recuperar consistencia.'
              : 'Use progressao simples, sem sacrificar tecnica.'

        return {
          title: buildExerciseVariationTitle(item.title, index),
          default_sets: clampSets(
            item.default_sets,
            progress?.completionRate != null && progress.completionRate < 0.7
              ? Math.max(2, (item.default_sets ?? (isMainLift ? 4 : 3)) - 1)
              : isMainLift ? 4 : 3,
          ),
          default_reps: item.default_reps ?? (isMainLift ? '6-8' : '10-12'),
          rest_seconds: clampRest(
            item.rest_seconds,
            progress?.completionRate != null && progress.completionRate < 0.7
              ? (isMainLift ? 120 : 75)
              : isMainLift ? 90 : 60,
          ),
          notes: item.notes
            ? `${item.notes} ${trendNote}`
            : isMainLift
              ? trendNote
              : `${trendNote} Controle o tempo da fase concentrica e evite compensacoes.`,
          video_url: item.video_url,
        }
      })
    : [
        {
          title: 'Aquecimento geral',
          default_sets: 2,
          default_reps: '5-8 min',
          rest_seconds: 30,
          notes: 'Use bike, remo ou caminhada rapida para elevar a temperatura corporal.',
        },
        {
          title: 'Exercicio principal',
          default_sets: 4,
          default_reps: '8-10',
          rest_seconds: 90,
          notes: 'Escolha um movimento multiarticular compativel com o foco do treino.',
        },
        {
          title: 'Exercicio acessorio',
          default_sets: 3,
          default_reps: '10-12',
          rest_seconds: 60,
          notes: 'Controle amplitude e cadencia para aumentar a qualidade do estimulo.',
        },
      ]

  return {
    source: 'fallback',
    assistantMessage: prompt
      ? `Montei uma nova versao do treino com base no pedido "${prompt}" e na evolucao recente do treino selecionado.`
      : 'Montei uma nova versao do treino com base no plano atual e na evolucao recente do treino selecionado.',
    suggestion: {
      name: `${workout.name} v2`,
      focus: workout.focus,
      notes: `Sugestao gerada a partir do treino "${workout.name}". ${prompt ? `Pedido do usuario: ${prompt}.` : ''}`.trim(),
      summary: 'Nova versao do treino baseada no plano atual e no historico recente, preservando o foco e priorizando variacoes de exercicios.',
      rationale: [
        'Mantive o foco do treino anterior, mas priorizei variacoes para nao repetir exatamente os mesmos exercicios.',
        progressInsights.length > 0
          ? 'Usei o historico do treino selecionado para identificar consistencia e tendencia de carga nos exercicios.'
          : 'Como ainda nao ha historico suficiente, mantive uma progressao conservadora a partir do treino atual.',
        'Ajustei series, repeticoes e descanso para estimular progressao sem refazer tudo do zero.',
        'Ao aceitar, o treino atual sera arquivado e a nova versao ficara como principal.',
      ],
      items: rotatedItems,
    },
  }
}

export const fetchWorkoutCoachContext = async (userId: string, workoutId: string) => {
  const [{ data: workout, error: workoutError }, { data: workoutItems, error: itemsError }, { data: sessions, error: sessionsError }] = await Promise.all([
    supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .eq('id', workoutId)
      .single(),
    supabase
      .from('workout_items')
      .select('*')
      .eq('user_id', userId)
      .eq('workout_id', workoutId)
      .order('order_index'),
    supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('workout_id', workoutId)
      .eq('status', 'finished')
      .order('ended_at', { ascending: false })
      .limit(8),
  ])

  if (workoutError) throw workoutError
  if (itemsError) throw itemsError
  if (sessionsError) throw sessionsError

  const sessionIds = (sessions ?? []).map((session) => session.id)
  const { data: sessionItems, error: sessionItemsError } = sessionIds.length === 0
    ? { data: [] as SessionItem[], error: null }
    : await supabase
        .from('session_items')
        .select('*')
        .in('session_id', sessionIds)
        .order('order_index')

  if (sessionItemsError) throw sessionItemsError

  const itemsBySession = new Map<string, SessionItem[]>()
  for (const item of sessionItems ?? []) {
    const current = itemsBySession.get(item.session_id) ?? []
    current.push(item)
    itemsBySession.set(item.session_id, current)
  }

  const recentSessions = (sessions ?? []).map((session) => ({
    session,
    items: itemsBySession.get(session.id) ?? [],
  }))

  return {
    workout,
    workoutItems: workoutItems ?? [],
    recentSessions,
    progressInsights: buildProgressInsights(recentSessions),
  }
}

// Divisao padrao A/B/C (empurrar / puxar / pernas + core).
const PLAN_SPLIT = [
  { letter: 'A', focus: 'Empurrar (peito, ombros, triceps)' },
  { letter: 'B', focus: 'Puxar (costas, biceps)' },
  { letter: 'C', focus: 'Pernas e core (quadriceps, posteriores, gluteos, panturrilhas, abdomen)' },
] as const

export interface GenerateFullPlanResult {
  workouts: AiWorkoutSuggestion[]
  source: 'ai' | 'fallback' | 'mixed'
}

// Gera um plano completo A/B/C: 3 chamadas em paralelo, cada uma com o foco do dia.
// Cada chamada cai no fallback local individualmente, entao sempre retornam 3 treinos.
export const generateFullPlan = async ({
  userId,
  location,
  userPrompt,
}: {
  userId: string
  location: 'home' | 'gym'
  userPrompt: string
}): Promise<GenerateFullPlanResult> => {
  const results = await Promise.all(
    PLAN_SPLIT.map(({ letter, focus }) => {
      const blankWorkout = {
        id: 'new', user_id: userId, name: `Treino ${letter}`, focus, notes: null,
        location, is_archived: false, created_at: '', updated_at: '',
      } as Workout
      const goal = [
        userPrompt.trim(),
        `Este e o TREINO ${letter} de um plano A/B/C de 3 dias. Foco deste dia: ${focus}.`,
        'Garanta que os tres treinos sejam complementares e cubram o corpo todo ao longo da semana, sem repetir os mesmos grupos musculares como principais.',
      ].filter(Boolean).join(' ')

      return generateWorkoutSuggestion({
        workout: blankWorkout,
        workoutItems: [],
        recentSessions: [],
        progressInsights: [],
        userPrompt: goal,
      })
    }),
  )

  const sources = new Set(results.map((r) => r.source))
  return {
    workouts: results.map((r, i) => ({
      ...r.suggestion,
      name: r.suggestion.name?.trim() || `Treino ${PLAN_SPLIT[i].letter}`,
      focus: r.suggestion.focus?.trim() || PLAN_SPLIT[i].focus,
    })),
    source: sources.size > 1 ? 'mixed' : (results[0]?.source ?? 'fallback'),
  }
}

export const generateWorkoutSuggestion = async (
  input: GenerateWorkoutSuggestionInput,
): Promise<GenerateWorkoutSuggestionResult> => {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError

    const accessToken = sessionData.session?.access_token
    if (!accessToken) {
      throw new Error('missing_access_token')
    }

    const { data, error } = await supabase.functions.invoke('generate-workout-plan', {
      body: input,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (error) throw error
    if (!data?.suggestion || !Array.isArray(data?.suggestion?.items)) {
      throw new Error('invalid_ai_response')
    }

    return {
      source: 'ai',
      assistantMessage: typeof data.assistantMessage === 'string'
        ? data.assistantMessage
        : 'Preparei uma nova proposta de treino com base no historico recente e na evolucao do treino selecionado.',
      suggestion: data.suggestion as AiWorkoutSuggestion,
    }
  } catch (error) {
    console.error('[aiWorkoutCoach] Falling back to local suggestion', error)
    return buildFallbackSuggestion(input)
  }
}
