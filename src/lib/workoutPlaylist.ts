import { supabase } from './supabase'
import type { DailyWorkoutContext } from './dailyMotivation'

export interface WorkoutPlaylistResult {
  playlistName: string
  playlistDescription: string
  spotifySearchQuery: string
  spotifySearchUrl: string
  exerciseName: string
  source: 'ai' | 'fallback'
}

const inFlightRequests = new Map<string, Promise<WorkoutPlaylistResult>>()

const getAccessToken = async () => {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const accessToken = data.session?.access_token
  if (!accessToken) throw new Error('missing_access_token')
  return accessToken
}

const buildSpotifySearchUrl = (query: string) =>
  `https://open.spotify.com/search/${encodeURIComponent(query)}`

const buildFallbackPlaylist = (
  context: DailyWorkoutContext,
  motivationMessage?: string,
): WorkoutPlaylistResult => {
  const featuredExercise = context.workoutItems[0]
  const exerciseName = featuredExercise?.title ?? context.workout.name
  const isEnglish = context.locale.toLowerCase().startsWith('en')
  const baseQuery = context.workout.focus ?? context.workout.name
  const spotifySearchQuery = isEnglish
    ? `${baseQuery} gym workout mix`
    : `${baseQuery} treino academia mix`

  return {
    source: 'fallback',
    playlistName: isEnglish ? 'Gym Focus Mix' : 'Mix de Foco para Treinar',
    playlistDescription: isEnglish
      ? `${motivationMessage ?? 'Strong pace for the session.'} Open a steady Spotify mix that matches ${exerciseName.toLowerCase()}.`
      : `${motivationMessage ?? 'Hoje é dia de entrar forte.'} Abre uma seleção no Spotify que combine com ${exerciseName.toLowerCase()}.`,
    spotifySearchQuery,
    spotifySearchUrl: buildSpotifySearchUrl(spotifySearchQuery),
    exerciseName,
  }
}

const requestWorkoutPlaylist = async (
  context: DailyWorkoutContext,
  motivationMessage?: string,
): Promise<WorkoutPlaylistResult> => {
  try {
    const accessToken = await getAccessToken()
    const { data, error } = await supabase.functions.invoke('generate-workout-playlist', {
      body: {
        ...context,
        motivationMessage,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (error) throw error
    if (!data?.playlistName || !data?.spotifySearchUrl) {
      throw new Error('invalid_playlist_response')
    }

    return {
      source: 'ai',
      playlistName: data.playlistName as string,
      playlistDescription: data.playlistDescription as string,
      spotifySearchQuery: data.spotifySearchQuery as string,
      spotifySearchUrl: data.spotifySearchUrl as string,
      exerciseName: data.exerciseName as string,
    }
  } catch (error) {
    console.error('[workoutPlaylist] Falling back to local playlist suggestion', error)
    return buildFallbackPlaylist(context, motivationMessage)
  }
}

export const generateWorkoutPlaylist = async (
  userId: string,
  context: DailyWorkoutContext,
  motivationMessage?: string,
): Promise<WorkoutPlaylistResult> => {
  const workoutId = context.workout.id
  const requestKey = `${userId}:${workoutId}:${context.locale}:${motivationMessage ?? 'none'}`
  const inFlightRequest = inFlightRequests.get(requestKey)
  if (inFlightRequest) {
    return inFlightRequest
  }

  const request = requestWorkoutPlaylist(context, motivationMessage)
    .finally(() => {
      inFlightRequests.delete(requestKey)
    })

  inFlightRequests.set(requestKey, request)
  return request
}
