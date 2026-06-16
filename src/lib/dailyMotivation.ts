import { supabase } from './supabase'
import type { Database } from '../types/database.types'

type Workout = Database['public']['Tables']['workouts']['Row']
type WorkoutItem = Database['public']['Tables']['workout_items']['Row']

export interface DailyWorkoutContext {
  workout: Workout
  workoutItems: WorkoutItem[]
  locale: string
  trainingFocusLabel: string
}

export interface DailyMotivationResult {
  message: string
  detailsTitle: string
  detailsBody: string
  improvementTip: string
  exerciseName: string
  source: 'ai' | 'fallback'
}

const inFlightRequests = new Map<string, Promise<DailyMotivationResult>>()

const inferTrainingFocusLabel = (context: Pick<DailyWorkoutContext, 'workout' | 'workoutItems' | 'locale'>) => {
  const explicitFocus = context.workout.focus?.trim()
  if (explicitFocus) return explicitFocus

  const combinedText = context.workoutItems
    .map((item) => `${item.title} ${item.notes ?? ''}`.toLowerCase())
    .join(' ')

  const focusMatchers: Array<{ labelPt: string; labelEn: string; patterns: RegExp[] }> = [
    { labelPt: 'peito', labelEn: 'chest', patterns: [/\bsupino\b/, /\bcrucifixo\b/, /\bpeck deck\b/, /\bchest\b/, /\bpeito\b/] },
    { labelPt: 'costas', labelEn: 'back', patterns: [/\bremada\b/, /\bpuxada\b/, /\bbarra fixa\b/, /\blat\b/, /\bcostas\b/, /\bback\b/] },
    { labelPt: 'ombros', labelEn: 'shoulders', patterns: [/\bdesenvolvimento\b/, /\beleva(c|ç)(a|ã)o lateral\b/, /\bshoulder\b/, /\bombro\b/] },
    { labelPt: 'quadriceps e gluteos', labelEn: 'quads and glutes', patterns: [/\bagachamento\b/, /\bleg press\b/, /\bafundo\b/, /\bextensora\b/, /\bquadriceps\b/, /\bgluteo\b/, /\bglute\b/] },
    { labelPt: 'posteriores e gluteos', labelEn: 'hamstrings and glutes', patterns: [/\bstiff\b/, /\bterra romeno\b/, /\bmesa flexora\b/, /\bposterior\b/, /\bhamstring\b/] },
    { labelPt: 'bracos', labelEn: 'arms', patterns: [/\brosca\b/, /\btriceps\b/, /\bbiceps\b/, /\bskull crusher\b/, /\barm\b/, /\bbraco\b/] },
    { labelPt: 'core', labelEn: 'core', patterns: [/\bprancha\b/, /\babdominal\b/, /\bcore\b/, /\bcrunch\b/] },
    { labelPt: 'cardio', labelEn: 'cardio', patterns: [/\bbike\b/, /\besteira\b/, /\bremo\b/, /\bcardio\b/, /\brun\b/] },
  ]

  const localeIsEnglish = context.locale.toLowerCase().startsWith('en')
  const matchedFocus = focusMatchers.find((focus) => focus.patterns.some((pattern) => pattern.test(combinedText)))
  if (matchedFocus) {
    return localeIsEnglish ? matchedFocus.labelEn : matchedFocus.labelPt
  }

  return localeIsEnglish ? 'strength training' : 'treino de forca'
}

const getAccessToken = async () => {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const accessToken = data.session?.access_token
  if (!accessToken) throw new Error('missing_access_token')
  return accessToken
}

const buildFallbackMotivation = (context: DailyWorkoutContext): DailyMotivationResult => {
  const featuredExercise = context.workoutItems[0]
  const exerciseName = featuredExercise?.title ?? context.workout.name
  const isEnglish = context.locale.toLowerCase().startsWith('en')

  return {
    source: 'fallback',
    message: isEnglish
      ? `Attack ${context.trainingFocusLabel} today and make every rep look intentional.`
      : `Hoje e dia de ${context.trainingFocusLabel}. Entra forte e faz cada repeticao contar.`,
    detailsTitle: isEnglish ? `About ${exerciseName}` : `Curiosidade sobre ${exerciseName}`,
    detailsBody: featuredExercise
      ? isEnglish
        ? `Did you know? ${exerciseName} gets better when you control the lowering phase. A stable eccentric improves tension, technique, and muscle awareness.`
        : `Voce sabia? ${exerciseName} ganha muito mais qualidade quando voce controla a fase de descida. Uma eccentrica estavel melhora tensao, tecnica e percepcao muscular.`
      : isEnglish
        ? `Did you know? Even without exercises loaded yet, defining the session focus before starting already improves consistency and execution.`
        : `Voce sabia? Mesmo sem exercicios cadastrados, definir o foco do treino antes de comecar ja melhora consistencia e execucao ao longo da sessao.`,
    improvementTip: featuredExercise
      ? isEnglish
        ? `Use one lighter warm-up set and keep the same range of motion on every rep before increasing load.`
        : `Faca uma serie de aquecimento mais leve e mantenha a mesma amplitude em todas as repeticoes antes de subir a carga.`
      : isEnglish
        ? `Start the session with a clear pace goal so the workout stays consistent from start to finish.`
        : `Comece a sessao com uma meta clara de ritmo para manter o treino consistente do inicio ao fim.`,
    exerciseName,
  }
}

export const fetchDailyWorkoutContext = async (
  userId: string,
  workoutId: string,
  locale: string,
  workoutFromList?: Workout | null,
): Promise<DailyWorkoutContext> => {
  const [{ data: workout, error: workoutError }, { data: workoutItems, error: itemsError }] = await Promise.all([
    workoutFromList
      ? Promise.resolve({ data: workoutFromList, error: null })
      : supabase
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
      .order('order_index')
      .limit(6),
  ])

  if (workoutError) throw workoutError
  if (itemsError) throw itemsError

  return {
    workout,
    workoutItems: workoutItems ?? [],
    locale,
    trainingFocusLabel: inferTrainingFocusLabel({
      workout,
      workoutItems: workoutItems ?? [],
      locale,
    }),
  }
}

const requestDailyMotivation = async (
  context: DailyWorkoutContext,
): Promise<DailyMotivationResult> => {
  try {
    const accessToken = await getAccessToken()
    const { data, error } = await supabase.functions.invoke('generate-daily-motivation', {
      body: context,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (error) throw error
    if (!data?.message || !data?.detailsBody || !data?.improvementTip) {
      throw new Error('invalid_motivation_response')
    }

    return {
      source: 'ai',
      message: data.message as string,
      detailsTitle: data.detailsTitle as string,
      detailsBody: data.detailsBody as string,
      improvementTip: data.improvementTip as string,
      exerciseName: data.exerciseName as string,
    }
  } catch (error) {
    console.error('[dailyMotivation] Falling back to local motivation', error)
    return buildFallbackMotivation(context)
  }
}

export const generateDailyMotivation = async (
  userId: string,
  context: DailyWorkoutContext,
): Promise<DailyMotivationResult> => {
  const workoutId = context.workout.id
  const requestKey = `${userId}:${workoutId}:${context.locale}`
  const inFlightRequest = inFlightRequests.get(requestKey)
  if (inFlightRequest) {
    return inFlightRequest
  }

  const request = requestDailyMotivation(context)
    .finally(() => {
      inFlightRequests.delete(requestKey)
    })

  inFlightRequests.set(requestKey, request)
  return request
}
