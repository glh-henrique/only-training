import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { validateRole, type Role } from '../types/auth'
import { UserRole } from '../constants/auth'
import type { Database } from '../types/database.types'
import { supabaseAuthGateway } from '../gateways/supabaseAuthGateway'

type ProfileRoleRow = Pick<Database['public']['Tables']['profiles']['Row'], 'role'>

const getProfileContext = async (user: User | null): Promise<{ role: Role, hasActiveCoach: boolean }> => {
  if (!user) return { role: UserRole.Student, hasActiveCoach: false }

  const fallbackRole = validateRole(user.user_metadata?.role)

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle<ProfileRoleRow>()

  if (error) {
    console.error('Failed to fetch profile role:', error)
    return { role: fallbackRole, hasActiveCoach: false }
  }

  const role = validateRole(data?.role ?? fallbackRole)

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

// Garante um único listener mesmo se initialize() rodar de novo (StrictMode/remount).
let authListenerBound = false

interface AuthState {
  user: User | null
  session: Session | null
  role: Role
  hasActiveCoach: boolean
  isLoading: boolean
  initialize: () => Promise<void>
  refreshProfileContext: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  role: UserRole.Student,
  hasActiveCoach: false,
  isLoading: true, // Start loading by default
  initialize: async () => {
    try {
      // Get initial session
      const session = await supabaseAuthGateway.getSession()
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
      if (!authListenerBound) {
        authListenerBound = true
        supabaseAuthGateway.onAuthStateChange((session) => {
          const nextUser = session?.user ?? null
          // TOKEN_REFRESHED/INITIAL_SESSION do mesmo usuário: só atualiza a sessão,
          // sem refazer as queries de perfil/coach.
          if ((nextUser?.id ?? null) === (useAuthStore.getState().user?.id ?? null)) {
            set({ session, user: nextUser, isLoading: false })
            return
          }
          // setTimeout(0): queries dentro do callback do onAuthStateChange seguram
          // o auth lock do supabase-js e podem travar o refresh de token.
          setTimeout(() => {
            void (async () => {
              const { role, hasActiveCoach } = await getProfileContext(nextUser)
              set({
                session,
                user: nextUser,
                role,
                hasActiveCoach,
                isLoading: false
              })
            })()
          }, 0)
        })
      }
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
    await supabaseAuthGateway.signOut()
    set({ session: null, user: null, role: UserRole.Student, hasActiveCoach: false })
    // Para o timer de sessão e limpa estado local (import dinâmico evita ciclo de módulos).
    const { useSessionStore } = await import('./useSessionStore')
    await useSessionStore.getState().resumeSession()
  },
}))
