import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { parseUserRole, type UserRole } from '../types/auth'
import type { Database } from '../types/database.types'

type ProfileRoleRow = Pick<Database['public']['Tables']['profiles']['Row'], 'role'>

const getRoleFromProfile = async (user: User | null): Promise<UserRole> => {
  if (!user) return 'aluno'

  const fallbackRole = parseUserRole(user.user_metadata?.role)

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle<ProfileRoleRow>()

  if (error) {
    console.error('Failed to fetch profile role:', error)
    return fallbackRole
  }

  if (data?.role) {
    return parseUserRole(data.role)
  }

  const { error: insertError } = await supabase
    .from('profiles')
    .upsert(
      {
        user_id: user.id,
        full_name: user.user_metadata?.full_name ?? null,
        role: fallbackRole
      },
      { onConflict: 'user_id' }
    )

  if (insertError) {
    console.error('Failed to backfill profile role:', insertError)
  }

  return fallbackRole
}

interface AuthState {
  user: User | null
  session: Session | null
  role: UserRole
  isLoading: boolean
  initialize: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  role: 'aluno',
  isLoading: true, // Start loading by default
  initialize: async () => {
    try {
      // Get initial session
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user ?? null
      const role = await getRoleFromProfile(user)
      set({
        session,
        user,
        role,
        isLoading: false
      })

      // Listen for changes
      supabase.auth.onAuthStateChange((_event, session) => {
        const user = session?.user ?? null
        void (async () => {
          const role = await getRoleFromProfile(user)
          set({
            session,
            user,
            role,
            isLoading: false
          })
        })()
      })
    } catch (error) {
      console.error('Auth initialization error:', error)
      set({ isLoading: false })
    }
  },
  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null, role: 'aluno' })
  },
}))
