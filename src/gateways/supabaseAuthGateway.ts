import type { Session, User } from '@supabase/supabase-js'
import type { AuthGateway } from '../core'
import { supabase } from '../lib/supabase'

export const supabaseAuthGateway: AuthGateway<User, Session> = {
  getSession: async () => {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    return data.session
  },
  onAuthStateChange: (callback) => {
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
