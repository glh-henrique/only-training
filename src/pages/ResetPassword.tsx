import { useState, useEffect } from 'react'
import { getErrorMessage } from "../lib/utils"
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react'

type Phase = 'checking' | 'ready' | 'invalid'

export default function ResetPassword() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('checking')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // The recovery link carries a token that must become a session before we can
  // call updateUser. With HashRouter the token can land in a secondary hash
  // fragment (implicit flow) or as a ?code= query (PKCE), so handle both.
  useEffect(() => {
    let active = true
    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setPhase('ready')
      }
    })

    const detectRecoverySession = async () => {
      // 1. Session may already exist (e.g. Supabase auto-detected the token).
      const { data: { session } } = await supabase.auth.getSession()
      if (session) { if (active) setPhase('ready'); return }

      // 2. PKCE flow: ?code=... (real query string, before the hash).
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (active) setPhase(exchangeError ? 'invalid' : 'ready')
        return
      }

      // 3. Implicit flow under HashRouter: tokens sit in a second hash fragment,
      //    e.g. #/reset-password#access_token=...&refresh_token=...&type=recovery
      const tokenFragment = window.location.hash.split('#').find(part => part.includes('access_token'))
      if (tokenFragment) {
        const params = new URLSearchParams(tokenFragment)
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')
        if (access_token && refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token })
          if (active) setPhase(sessionError ? 'invalid' : 'ready')
          return
        }
      }

      if (active) setPhase('invalid')
    }

    void detectRecoverySession()

    return () => {
      active = false
      authSub.subscription.unsubscribe()
    }
  }, [])

  const handleResetPassword = async (e: React.SyntheticEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      setError(t('auth.register.password_mismatch') || 'Passwords do not match')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) throw error
      setSuccess(true)

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('auth.reset_password.error')))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold">{t('auth.reset_password.title')}</h2>
          <p className="mt-2 text-neutral-400">{t('auth.reset_password.subtitle')}</p>
        </div>

        {phase === 'checking' ? (
          <div className="p-6 text-center text-neutral-400">
            {t('auth.reset_password.verifying')}
          </div>
        ) : phase === 'invalid' ? (
          <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-center space-y-4">
            <p className="text-red-500 font-medium">
              {t('auth.reset_password.invalid_link')}
            </p>
            <Link
              to="/forgot-password"
              className="inline-block rounded-md bg-neutral-100 dark:bg-neutral-800 px-5 py-2.5 text-sm font-medium"
            >
              {t('auth.reset_password.request_new')}
            </Link>
          </div>
        ) : success ? (
          <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            </div>
            <p className="text-emerald-500 font-medium">
              {t('auth.reset_password.success')}
            </p>
            <p className="text-sm text-neutral-400">
              Redirecionando para o login...
            </p>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1">
                  {t('auth.reset_password.new_password')}
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-400 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
                  {t('auth.reset_password.confirm_password')}
                </label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-500/10 rounded-md">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('common.loading') : t('auth.reset_password.submit')}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
