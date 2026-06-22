import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// MuscleWiki uses Cloudflare; requests must look like a browser.
const MW_BASE = "https://musclewiki.com/newapi/exercise/exercises/";
const buildHeaders = (lang: string) => ({
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  Referer: "https://musclewiki.com/",
  "Accept-Language": lang,
});

const PAGE_SIZE = 50;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const CONCURRENCY = 6;

// MuscleWiki only ships a handful of locales; map app locales to theirs.
const resolveLang = (raw: string): string => {
  const v = raw.toLowerCase();
  if (v.startsWith("pt")) return "pt-BR";
  return "en-US";
};

type SlimExercise = {
  id: number;
  name: string;
  nameEn: string;
  slug: string | null;
  category: string | null;
  muscle: string | null;
  difficulty: string | null;
  gifUrl: string | null;
  videoUrl: string | null;
};

type MwImage = {
  src_image?: string | null;
  branded_video?: string | null;
  dst_link?: string | null;
};

type MwExercise = {
  id: number;
  name?: string | null;
  name_en_us?: string | null;
  slug?: string | null;
  category?: { name?: string | null } | null;
  difficulty?: { name?: string | null } | null;
  muscles_primary?: Array<{ name?: string | null }> | null;
  muscles?: Array<{ name?: string | null }> | null;
  male_images?: MwImage[] | null;
  female_images?: MwImage[] | null;
};

type MwPage = { count: number; results: MwExercise[] };

// Module-level caches survive across requests on a warm instance (keyed by lang).
const cache = new Map<string, { data: SlimExercise[]; fetchedAt: number }>();
const inFlight = new Map<string, Promise<SlimExercise[]>>();

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "unexpected_error";

const pickImage = (ex: MwExercise): MwImage | null => {
  const list = ex.male_images?.length ? ex.male_images : ex.female_images;
  return list && list.length ? list[0] : null;
};

const slim = (ex: MwExercise): SlimExercise => {
  const img = pickImage(ex);
  return {
    id: ex.id,
    name: ex.name ?? ex.name_en_us ?? "",
    nameEn: ex.name_en_us ?? ex.name ?? "",
    slug: ex.slug ?? null,
    category: ex.category?.name ?? null,
    muscle: ex.muscles_primary?.[0]?.name ?? ex.muscles?.[0]?.name ?? null,
    difficulty: ex.difficulty?.name ?? null,
    gifUrl: img?.src_image ?? null,
    videoUrl: img?.dst_link || img?.branded_video || null,
  };
};

const fetchPage = async (offset: number, lang: string): Promise<MwPage> => {
  const url = `${MW_BASE}?limit=${PAGE_SIZE}&offset=${offset}&lang=${lang}`;
  const res = await fetch(url, { headers: buildHeaders(lang) });
  if (!res.ok) throw new Error(`musclewiki_${res.status}`);
  return (await res.json()) as MwPage;
};

const fetchAllExercises = async (lang: string): Promise<SlimExercise[]> => {
  const first = await fetchPage(0, lang);
  const total = first.count ?? first.results.length;
  const offsets: number[] = [];
  for (let o = PAGE_SIZE; o < total; o += PAGE_SIZE) offsets.push(o);

  const rest: MwExercise[] = [];
  for (let i = 0; i < offsets.length; i += CONCURRENCY) {
    const batch = offsets.slice(i, i + CONCURRENCY);
    const pages = await Promise.all(batch.map((o) => fetchPage(o, lang)));
    for (const p of pages) rest.push(...p.results);
  }

  const all = [...first.results, ...rest].map(slim).filter((e) => e.name);
  // De-dupe by id.
  const seen = new Set<number>();
  return all.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
};

const getExercises = async (lang: string): Promise<SlimExercise[]> => {
  const cached = cache.get(lang);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.data;
  const pending = inFlight.get(lang);
  if (pending) return pending;
  const request = fetchAllExercises(lang)
    .then((data) => {
      cache.set(lang, { data, fetchedAt: Date.now() });
      return data;
    })
    .finally(() => {
      inFlight.delete(lang);
    });
  inFlight.set(lang, request);
  return request;
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const search = (list: SlimExercise[], query: string, limit: number) => {
  const q = normalize(query.trim());
  if (!q) {
    return [...list].sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit);
  }
  const terms = q.split(/\s+/).filter(Boolean);
  const scored: Array<{ e: SlimExercise; score: number }> = [];
  for (const e of list) {
    const name = normalize(e.name);
    const nameEn = normalize(e.nameEn);
    // Match against both localized and English names, plus muscle/category.
    const haystack = `${name} ${nameEn} ${normalize(e.muscle ?? "")} ${normalize(e.category ?? "")}`;
    if (!terms.every((t) => haystack.includes(t))) continue;
    let score = 0;
    if (name === q || nameEn === q) score = 100;
    else if (name.startsWith(q) || nameEn.startsWith(q)) score = 70;
    else if (name.includes(q) || nameEn.includes(q)) score = 40;
    else score = 10;
    scored.push({ e, score });
  }
  scored.sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name));
  return scored.slice(0, limit).map((s) => s.e);
};

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
      return new Response(JSON.stringify({ error: "invalid_jwt" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => null)) as {
      query?: string;
      limit?: number;
      lang?: string;
    } | null;

    const query = String(body?.query ?? "");
    const limit = Math.min(Math.max(Number(body?.limit ?? 25) || 25, 1), 50);
    const lang = resolveLang(String(body?.lang ?? "en-US"));

    const exercises = await getExercises(lang);
    const results = search(exercises, query, limit);

    return new Response(JSON.stringify({ results }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: getErrorMessage(error) }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
