import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type WorkoutPayload = {
  id?: string;
  name: string;
  focus: string | null;
  notes: string | null;
};

type WorkoutItemPayload = {
  title: string;
  default_sets: number | null;
  default_reps: string | null;
  rest_seconds: number | null;
  notes: string | null;
};

type MotivationResponse = {
  message: string;
  detailsTitle: string;
  detailsBody: string;
  improvementTip: string;
  exerciseName: string;
};

type OpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "unexpected_error";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "method_not_allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing_authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = authHeader.replace("Bearer ", "").trim();
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "missing_access_token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: "missing_supabase_env" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: userData, error: userError } =
      await authClient.auth.getUser(accessToken);
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "invalid_jwt" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiApiKey) {
      return new Response(JSON.stringify({ error: "missing_openai_api_key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => null)) as {
      workout?: WorkoutPayload;
      workoutItems?: WorkoutItemPayload[];
      locale?: string;
      trainingFocusLabel?: string;
    } | null;

    if (!body?.workout) {
      return new Response(
        JSON.stringify({ error: "missing_workout_context" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const locale = String(body.locale ?? "pt").toLowerCase();
    const languageInstruction = locale.startsWith("en")
      ? "Write every field in natural English."
      : "Escreva todos os campos em portugues natural.";

    const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
    const systemPrompt = [
      "Voce e um personal trainer eletrico, confiante e inspirador.",
      "Fale sempre de forma cautelosa e neutra em relacao a genero.",
      "Nao presuma se a pessoa usuaria e homem ou mulher.",
      "Evite palavras marcadas por genero, como aluno, aluna, preparado, preparada, pronto ou pronta.",
      "Prefira termos neutros, como pessoa, voce, quem vai treinar hoje e corpo em movimento.",
      "Fale de um jeito mais informal, proximo e com energia de academia.",
      "Soe como incentivo espontaneo, tipo 'Vamos la, campeao', 'Hoje e dia', 'Bora treinar forte' ou 'Grande dia pra malhar', mas sem copiar sempre as mesmas frases.",
      "Sua frase motivacional precisa soar intensa, energica e pronta para fazer a pessoa querer treinar agora.",
      "Analise o treino do dia e gere uma frase motivacional curta, uma curiosidade interessante sobre um exercicio do treino e uma dica pratica de melhoria para esse treino ou exercicio.",
      "Evite usar o titulo do treino na frase motivacional.",
      "Quando houver foco definido, prefira mencionar o foco do treino.",
      "Se nao houver foco definido, infira o grupo muscular principal a partir dos exercicios recebidos e use isso como referencia.",
      "A frase motivacional deve ter no maximo 16 palavras.",
      "Comece a frase com verbo forte ou comando de acao sempre que possivel.",
      "Prefira ritmo, impacto e urgencia a delicadeza, calma ou reflexao.",
      "Soe como um coach excelente nos 10 segundos antes da primeira serie: direto, vivo, memoravel, humano e coloquial.",
      "Evite frases mornas, contemplativas, genericas, corporativas ou excessivamente poeticas.",
      "Nao use autoajuda vaga nem frases de calendario.",
      "Pode usar ousadia leve, desde que continue positiva e elegante.",
      "A curiosidade deve ser curta, pratica, interessante e facil de entender.",
      "A curiosidade deve sempre comecar no estilo 'Voce sabia?' ou 'Did you know?' de acordo com o idioma.",
      "Use humor e ironia de forma leve, inteligente e motivadora.",
      "A curiosidade pode incluir contexto historico, cientifico, cultural ou biomecanico, desde que continue relevante para o exercicio.",
      "Evite alegacoes medicas, promessas de resultado ou exagero caricatural.",
      languageInstruction,
      "Responda apenas em JSON valido, seguindo exatamente o schema solicitado pelo usuario.",
    ].join(" ");

    const userPrompt = JSON.stringify({
      date: new Date().toISOString(),
      workout: body.workout,
      workoutItems: body.workoutItems ?? [],
      trainingFocusLabel: body.trainingFocusLabel ?? null,
      requiredResponseShape: {
        message: locale.startsWith("en")
          ? "short string in English"
          : "short string in pt-BR or pt-PT",
        detailsTitle: "short string",
        detailsBody: "short paragraph",
        improvementTip: "short practical tip",
        exerciseName: "string",
      },
    });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.95,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "daily_motivation",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                message: { type: "string" },
                detailsTitle: { type: "string" },
                detailsBody: { type: "string" },
                improvementTip: { type: "string" },
                exerciseName: { type: "string" },
              },
              required: [
                "message",
                "detailsTitle",
                "detailsBody",
                "improvementTip",
                "exerciseName",
              ],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      console.error("generate-daily-motivation: openai request failed", details);
      return new Response(
        JSON.stringify({ error: "openai_request_failed" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const payload = (await response.json()) as OpenAiChatCompletionResponse;
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return new Response(JSON.stringify({ error: "empty_openai_response" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(content) as Partial<MotivationResponse>;
    if (
      !parsed.message ||
      !parsed.detailsBody ||
      !parsed.detailsTitle ||
      !parsed.improvementTip ||
      !parsed.exerciseName
    ) {
      return new Response(
        JSON.stringify({ error: "invalid_motivation_response" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: getErrorMessage(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
