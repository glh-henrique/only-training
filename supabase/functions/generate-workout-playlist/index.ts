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

type PlaylistResponse = {
  playlistName: string;
  playlistDescription: string;
  spotifySearchQuery: string;
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

const buildSpotifySearchUrl = (query: string) =>
  `https://open.spotify.com/search/${encodeURIComponent(query)}`;

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
      motivationMessage?: string;
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
      "Voce e um personal trainer animado com ouvido de DJ de academia.",
      "Analise o treino atual, os exercicios do dia e a frase motivacional recebida.",
      "Sugira uma playlist ou busca de Spotify que combine com o treino de hoje.",
      "A sugestao deve parecer pratica, moderna e facil de abrir no Spotify.",
      "Fale sempre de forma cautelosa e neutra em relacao a genero.",
      "Nao presuma se a pessoa usuaria e homem ou mulher.",
      "Escolha energia musical coerente com o treino: mais agressiva para treino pesado, mais ritmada para cardio, mais focada para tecnica e controle.",
      "Crie um nome curto de playlist, uma descricao curta e uma query de busca objetiva para Spotify.",
      "A query deve ser enxuta e realmente util para achar algo no Spotify.",
      "A descricao deve explicar em uma frase por que essa sonoridade combina com o treino.",
      "Se houver um exercicio marcante, mencione-o como ancora da sugestao.",
      languageInstruction,
      "Responda apenas em JSON valido, seguindo exatamente o schema solicitado pelo usuario.",
    ].join(" ");

    const userPrompt = JSON.stringify({
      date: new Date().toISOString(),
      workout: body.workout,
      workoutItems: body.workoutItems ?? [],
      motivationMessage: body.motivationMessage ?? null,
      requiredResponseShape: {
        playlistName: "short string",
        playlistDescription: "short string",
        spotifySearchQuery: "short string for Spotify search",
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
        temperature: 0.9,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "workout_playlist",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                playlistName: { type: "string" },
                playlistDescription: { type: "string" },
                spotifySearchQuery: { type: "string" },
                exerciseName: { type: "string" },
              },
              required: [
                "playlistName",
                "playlistDescription",
                "spotifySearchQuery",
                "exerciseName",
              ],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      console.error("generate-workout-playlist: openai request failed", details);
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

    const parsed = JSON.parse(content) as Partial<PlaylistResponse>;
    if (
      !parsed.playlistName ||
      !parsed.playlistDescription ||
      !parsed.spotifySearchQuery ||
      !parsed.exerciseName
    ) {
      return new Response(
        JSON.stringify({ error: "invalid_playlist_response" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        ...parsed,
        spotifySearchUrl: buildSpotifySearchUrl(parsed.spotifySearchQuery),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: getErrorMessage(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
