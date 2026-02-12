import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { parseUserRole, type UserRole } from '../types/auth'
import type { Database } from '../types/database.types'

type ProfileRoleRow = Pick<Database['public']['Tables']['profiles']['Row'], 'role'>

const getProfileContext = async (user: User | null): Promise<{ role: UserRole, hasActiveCoach: boolean }> => {
  if (!user) return { role: 'aluno', hasActiveCoach: false }

  const fallbackRole = parseUserRole(user.user_metadata?.role)

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle<ProfileRoleRow>()

  if (error) {
    console.error('Failed to fetch profile role:', error)
    return { role: fallbackRole, hasActiveCoach: false }
  }

  const role = parseUserRole(data?.role ?? fallbackRole)

  if (!data?.role) {
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
  }

  if (role !== 'aluno') {
    return { role, hasActiveCoach: false }
  }

  const { data: linkData, error: linkError } = await supabase
    .from('coach_student_links')
    .select('id')
    .eq('student_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (linkError) {
    console.error('Failed to fetch active coach link:', linkError)
    return { role, hasActiveCoach: false }
  }

  return { role, hasActiveCoach: !!linkData?.id }
}

interface AuthState {
  user: User | null
  session: Session | null
  role: UserRole
  hasActiveCoach: boolean
  isLoading: boolean
  initialize: () => Promise<void>
  refreshProfileContext: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  role: 'aluno',
  hasActiveCoach: false,
  isLoading: true, // Start loading by default
  initialize: async () => {
    try {
      // Get initial session
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user ?? null
      const { role, hasActiveCoach } = await getProfileContext(user)
      set({
        session,
        user,
        role,
        hasActiveCoach,
        isLoading: false
      })

      // Listen for changes
      supabase.auth.onAuthStateChange((_event, session) => {
        const user = session?.user ?? null
        void (async () => {
          const { role, hasActiveCoach } = await getProfileContext(user)
          set({
            session,
            user,
            role,
            hasActiveCoach,
            isLoading: false
          })
        })()
      })
    } catch (error) {
      console.error('Auth initialization error:', error)
      set({ isLoading: false })
    }
  },
  refreshProfileContext: async () => {
    const user = useAuthStore.getState().user
    const { role, hasActiveCoach } = await getProfileContext(user)
    set({ role, hasActiveCoach })
  },
  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null, role: 'aluno', hasActiveCoach: false })
  },
}))
