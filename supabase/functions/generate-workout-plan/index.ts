import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type WorkoutPayload = {
  name: string
  focus: string | null
  notes: string | null
  location?: string | null
}

type WorkoutItemPayload = {
  title: string
  default_sets: number | null
  default_reps: string | null
  rest_seconds: number | null
  notes: string | null
  video_url: string | null
}

type SessionPayload = {
  session: {
    started_at: string
    ended_at: string | null
    duration_seconds: number | null
    workout_name_snapshot: string
    workout_focus_snapshot: string | null
  }
  items: Array<{
    title_snapshot: string
    sets: number | null
    reps: string | null
    rest_seconds: number | null
    weight: number | null
    is_done: boolean
    notes_snapshot: string | null
  }>
}

type ProgressInsightPayload = {
  exerciseName: string
  sessionsCompleted: number
  completionRate: number
  lastWeight: number | null
  previousWeight: number | null
  averageWeight: number | null
  lastReps: string | null
  weightTrend: 'up' | 'down' | 'flat' | 'unknown'
}

type SuggestionPayload = {
  name: string
  focus?: string | null
  notes?: string | null
  summary: string
  rationale: string[]
  items: WorkoutItemPayload[]
}

type SuggestionItemInput = Partial<Record<keyof WorkoutItemPayload, unknown>>
type SuggestionInput = {
  name?: unknown
  focus?: unknown
  notes?: unknown
  summary?: unknown
  rationale?: unknown
  items?: unknown
}

type GenerateWorkoutPlanRequest = {
  workout?: WorkoutPayload
  workoutItems?: WorkoutItemPayload[]
  recentSessions?: SessionPayload[]
  progressInsights?: ProgressInsightPayload[]
  userPrompt?: string
}

type OpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'unexpected_error'

const normalizeSuggestion = (raw: SuggestionInput): SuggestionPayload => {
  const items = Array.isArray(raw?.items) ? raw.items : []

  return {
    name: typeof raw?.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Novo treino sugerido',
    focus: typeof raw?.focus === 'string' ? raw.focus.trim() : null,
    notes: typeof raw?.notes === 'string' ? raw.notes.trim() : null,
    summary: typeof raw?.summary === 'string' && raw.summary.trim()
      ? raw.summary.trim()
      : 'Sugestao de treino gerada a partir do plano atual e da evolucao recente.',
    rationale: Array.isArray(raw?.rationale)
      ? raw.rationale.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0).slice(0, 4)
      : [],
    items: items
      .map((item) => {
        const normalizedItem = (item ?? {}) as SuggestionItemInput
        return {
          title: typeof normalizedItem.title === 'string' ? normalizedItem.title.trim() : '',
          default_sets: typeof normalizedItem.default_sets === 'number' ? Math.min(8, Math.max(1, Math.round(normalizedItem.default_sets))) : null,
          default_reps: typeof normalizedItem.default_reps === 'string' ? normalizedItem.default_reps.trim() : null,
          rest_seconds: typeof normalizedItem.rest_seconds === 'number' ? Math.min(240, Math.max(15, Math.round(normalizedItem.rest_seconds))) : null,
          notes: typeof normalizedItem.notes === 'string' ? normalizedItem.notes.trim() : null,
          video_url: typeof normalizedItem.video_url === 'string' ? normalizedItem.video_url.trim() : null,
        }
      })
      .filter((item: WorkoutItemPayload) => item.title.length > 0)
      .slice(0, 12),
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'missing_authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const accessToken = authHeader.replace('Bearer ', '').trim()
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'missing_access_token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: 'missing_supabase_env' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey)
    const { data: userData, error: userError } = await authClient.auth.getUser(accessToken)
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'invalid_jwt' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const openAiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAiApiKey) {
      return new Response(JSON.stringify({ error: 'missing_openai_api_key' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => null) as GenerateWorkoutPlanRequest | null

    if (!body?.workout) {
      return new Response(JSON.stringify({ error: 'missing_workout_context' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini'

    const workoutLocation = body.workout.location === 'home' ? 'home' : 'gym'

    const systemPrompt = [
      // Papel
      'Voce e um preparador fisico digital especialista em musculacao que revisa e evolui treinos existentes.',
      'Sua tarefa e propor uma nova versao personalizada do treino atual usando todo o contexto recebido: treino, exercicios, local, sessoes recentes e tendencias de progresso.',

      // Formato de saida
      'Responda SOMENTE com JSON valido que siga exatamente o schema solicitado, sem nenhum texto fora do JSON.',
      'Escreva todos os textos de saida (assistantMessage, summary, rationale, notes) em portugues do Brasil, claros e objetivos.',

      // Objetivo e progressao (regras concretas)
      'Preserve o objetivo e o foco muscular principal do treino e proponha progressoes praticas e seguras.',
      'Use explicitamente o historico: analise sessoes recentes, taxa de conclusao (completionRate), cargas, repeticoes e a tendencia (weightTrend) de cada exercicio antes de decidir qualquer mudanca.',
      'Progressao: quando completionRate for alto (>= 0.8) e a tendencia for de alta ou estavel, avance de forma moderada - subir a carga em ~2,5 a 5%, adicionar 1-2 repeticoes dentro da faixa, ou 1 serie nos exercicios principais.',
      'Regressao: quando completionRate for baixo (< 0.7) ou a carga estiver caindo, reduza volume, complexidade ou aumente o descanso para recuperar consistencia e tecnica.',
      'Sem historico suficiente, mantenha progressao conservadora a partir do plano atual.',

      // Variacao de exercicios
      'Prefira variar os exercicios em relacao ao treino atual quando fizer sentido: mude implemento, angulo, pegada, unilateral/bilateral ou padrao de execucao, mantendo o mesmo alvo muscular.',
      'So repita um exercicio atual quando ele for essencial para a logica do treino ou claramente insubstituivel.',

      // Restricao de local / equipamento
      workoutLocation === 'home'
        ? 'Este treino e feito EM CASA: use apenas exercicios viaveis com equipamento domestico basico (peso do corpo, halteres, elasticos, banco ajustavel). Evite maquinas, cabos, barra olimpica e aparelhos de academia - a menos que o treino atual ja os utilize, o que indica que a pessoa possui esse equipamento.'
        : 'Este treino e feito na ACADEMIA: pode usar livremente barras, halteres, maquinas, cabos e demais equipamentos comuns de academia.',
      'Infira o equipamento disponivel tambem pelos exercicios ja presentes no treino atual e respeite essa limitacao.',

      // Pedido do usuario e seguranca
      'Priorize o pedido explicito da pessoa (campo userPrompt) sempre que for seguro e coerente com o foco do treino; se o pedido conflitar com a seguranca, ajuste com bom senso e explique no rationale.',
      'Nao faca alegacoes medicas nem prescreva cargas absolutas arriscadas; trabalhe com faixas de repeticao e progressao relativa.',

      // Explicacao e tamanho
      'No summary e no rationale, explique de forma curta como o historico e o local influenciaram a nova versao.',
      'Inclua entre 3 e 10 exercicios, ordenados de forma logica (dos principais multiarticulares para os acessorios).',
    ].join(' ')

    const userPrompt = JSON.stringify({
      objective: 'Analyze the selected workout history and location, then suggest a personalized replacement workout that respects the available equipment and tracks the student progression over time.',
      location: workoutLocation,
      userPrompt: body.userPrompt ?? '',
      workout: body.workout,
      workoutItems: body.workoutItems ?? [],
      recentSessions: body.recentSessions ?? [],
      progressInsights: body.progressInsights ?? [],
      requiredResponseShape: {
        assistantMessage: 'short string in pt-BR',
        suggestion: {
          name: 'string',
          focus: 'string or null',
          notes: 'string or null',
          summary: 'string',
          rationale: ['string'],
          items: [
            {
              title: 'string',
              default_sets: 'number or null',
              default_reps: 'string or null',
              rest_seconds: 'number or null',
              notes: 'string or null',
              video_url: 'string or null',
            },
          ],
        },
      },
    })

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'workout_suggestion',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                assistantMessage: { type: 'string' },
                suggestion: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    name: { type: 'string' },
                    focus: { type: ['string', 'null'] },
                    notes: { type: ['string', 'null'] },
                    summary: { type: 'string' },
                    rationale: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                          title: { type: 'string' },
                          default_sets: { type: ['number', 'null'] },
                          default_reps: { type: ['string', 'null'] },
                          rest_seconds: { type: ['number', 'null'] },
                          notes: { type: ['string', 'null'] },
                          video_url: { type: ['string', 'null'] },
                        },
                        required: ['title', 'default_sets', 'default_reps', 'rest_seconds', 'notes', 'video_url'],
                      },
                    },
                  },
                  required: ['name', 'focus', 'notes', 'summary', 'rationale', 'items'],
                },
              },
              required: ['assistantMessage', 'suggestion'],
            },
          },
        },
      }),
    })

    if (!response.ok) {
      const details = await response.text()
      console.error('generate-workout-plan: openai request failed', details)
      return new Response(JSON.stringify({ error: 'openai_request_failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = await response.json() as OpenAiChatCompletionResponse
    const content = payload?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      return new Response(JSON.stringify({ error: 'empty_openai_response' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const parsed = JSON.parse(content) as {
      assistantMessage?: unknown
      suggestion?: SuggestionInput
    }
    const suggestion = normalizeSuggestion(parsed?.suggestion ?? {})
    const assistantMessage = typeof parsed?.assistantMessage === 'string' && parsed.assistantMessage.trim()
      ? parsed.assistantMessage.trim()
      : 'Preparei uma nova proposta de treino com base no historico recente e na evolucao do treino selecionado.'

    if (!suggestion.items.length) {
      return new Response(JSON.stringify({ error: 'invalid_suggestion_items' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ assistantMessage, suggestion }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: getErrorMessage(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
