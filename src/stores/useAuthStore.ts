import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  initialize: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true, // Start loading by default
  initialize: async () => {
    try {
      // Get initial session
      const { data: { session } } = await supabase.auth.getSession()
      set({ session, user: session?.user ?? null, isLoading: false })

      // Listen for changes
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, user: session?.user ?? null, isLoading: false })
      })
    } catch (error) {
      console.error('Auth initialization error:', error)
      set({ isLoading: false })
    }
  },
  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null })
  },
}))
