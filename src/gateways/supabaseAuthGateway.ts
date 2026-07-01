import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export const supabaseAuthGateway = {
  getSession: async () => {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    return data.session
  },
  onAuthStateChange: (callback: (session: Session | null) => void) => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session)
    })
    return () => listener.subscription.unsubscribe()
  },
  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },
  getCurrentUser: async () => {
    const { data, error } = await supabase.auth.getUser()
    if (error) throw error
    return data.user
  }
}
