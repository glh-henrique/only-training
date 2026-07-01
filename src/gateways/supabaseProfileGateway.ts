import type { Database } from '../types/database.types'
import { supabase } from '../lib/supabase'

type ProfileRow = Database['public']['Tables']['profiles']['Row']
type ProfileInsert = Database['public']['Tables']['profiles']['Insert']

const PROFILE_PHOTO_BUCKET = 'profile-photos'

export const supabaseProfileGateway = {
  fetchProfile: async (userId: string): Promise<ProfileRow | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    return data
  },
  fetchProfilesByIds: async (userIds: string[]): Promise<ProfileRow[]> => {
    if (userIds.length === 0) return []
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', userIds)

    if (error) throw error
    return data ?? []
  },
  upsertProfile: async (payload: ProfileInsert): Promise<void> => {
    const { error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'user_id' })

    if (error) throw error
  },
  uploadProfilePhoto: async (userId: string, file: File): Promise<string> => {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const filePath = `${userId}/avatar.${extension}`
    const { error } = await supabase.storage
      .from(PROFILE_PHOTO_BUCKET)
      .upload(filePath, file, { upsert: true, contentType: file.type || 'image/jpeg' })

    if (error) throw error
    const { data } = supabase.storage.from(PROFILE_PHOTO_BUCKET).getPublicUrl(filePath)
    // cache-buster: o upload usa upsert no mesmo path
    return `${data.publicUrl}?t=${Date.now()}`
  }
}
