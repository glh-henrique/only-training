import { supabase } from './supabase'

export interface MuscleWikiExercise {
  id: number
  name: string
  nameEn?: string
  slug: string | null
  category: string | null
  muscle: string | null
  difficulty: string | null
  gifUrl: string | null
  videoUrl: string | null
}

const cache = new Map<string, MuscleWikiExercise[]>()

const getAccessToken = async () => {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const accessToken = data.session?.access_token
  if (!accessToken) throw new Error('missing_access_token')
  return accessToken
}

/**
 * Searches MuscleWiki exercises through the `musclewiki-search` edge function
 * (proxies the public newapi, handling Cloudflare + CORS + text filtering).
 * Returns [] on any failure so callers can degrade gracefully.
 */
export const searchMuscleWikiExercises = async (
  query: string,
  lang = 'en',
  limit = 20,
): Promise<MuscleWikiExercise[]> => {
  const normalized = query.trim().toLowerCase()
  const cacheKey = `${lang}:${normalized}:${limit}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  try {
    const accessToken = await getAccessToken()
    const { data, error } = await supabase.functions.invoke('musclewiki-search', {
      body: { query: normalized, limit, lang },
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (error) throw error
    const results = Array.isArray(data?.results)
      ? (data.results as MuscleWikiExercise[])
      : []
    cache.set(cacheKey, results)
    return results
  } catch (error) {
    console.error('[muscleWiki] search failed', error)
    return []
  }
}
