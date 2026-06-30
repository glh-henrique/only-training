import { useState, useEffect } from 'react'
import { getErrorMessage } from "../lib/utils"
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'import { AppRoutes } from '../constants/routes'


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
        navigate(AppRoutes.Login)
      }, 3000)
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('auth.reset_password.error')))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-ot-dark text-[#fafafa] font-ui overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(42,95,255,.14),transparent_70%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-sm flex-col px-6 pb-10 pt-14">
        {/* Back link */}
        <Link
          to="/login"
          className="inline-flex items-center gap-2 font-ot-mono text-[10px] tracking-[0.18em] text-[#6e6e6e] transition-colors hover:text-[#fafafa]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('auth.forgot_password.back_to_login')}
        </Link>

        {phase === 'checking' ? (
          <div className="mt-16 font-ui text-sm text-[#9a9a9a]">
            {t('auth.reset_password.verifying')}
          </div>
        ) : phase === 'invalid' ? (
          <>
            <h1 className="mt-10 font-display text-[48px] font-extrabold uppercase leading-[0.95] tracking-tight">
              {t('auth.reset_password.title')}
            </h1>
            <div className="mt-8 rounded-[13px] border border-red-500/30 bg-red-500/10 p-4 font-ui text-sm text-red-400">
              {t('auth.reset_password.invalid_link')}
            </div>
            <Link
              to="/forgot-password"
              className="mt-6 block w-full rounded-[15px] bg-ot-blue py-[17px] text-center font-display text-2xl font-extrabold uppercase text-white transition-opacity hover:opacity-90"
            >
              {t('auth.reset_password.request_new')}
            </Link>
          </>
        ) : success ? (
          <>
            {/* Success state */}
            <div className="mt-16 flex h-20 w-20 items-center justify-center rounded-[24px] bg-ot-success/15 border border-ot-success/30">
              <svg viewBox="0 0 24 24" className="h-10 w-10 text-ot-success" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>

            <h1 className="mt-8 font-display text-[44px] font-extrabold uppercase leading-[0.95] tracking-tight">
              {t('auth.reset_password.success')}
            </h1>
            <p className="mt-3 font-ui text-sm font-medium text-[#9a9a9a]">
              Redirecionando para o login…
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-10 font-display text-[48px] font-extrabold uppercase leading-[0.95] tracking-tight">
              {t('auth.reset_password.title')}
            </h1>
            <p className="mt-3 font-ui text-sm font-medium text-[#9a9a9a]">
              {t('auth.reset_password.subtitle')}
            </p>

            <form onSubmit={handleResetPassword} className="mt-8 flex flex-col gap-3.5">
              <div>
                <label htmlFor="password" className="font-ot-mono text-[9px] tracking-[0.16em] text-[#6e6e6e]">
                  {t('auth.reset_password.new_password').toUpperCase()}
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full rounded-[13px] border border-ot-dark-border bg-ot-dark-card px-4 py-[15px] pr-12 font-ui text-[15px] text-[#fafafa] placeholder:text-[#5a5a5a] outline-none focus:border-ot-blue"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6e6e6e] hover:text-[#fafafa] focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="font-ot-mono text-[9px] tracking-[0.16em] text-[#6e6e6e]">
                  {t('auth.reset_password.confirm_password').toUpperCase()}
                </label>
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="mt-1.5 w-full rounded-[13px] border border-ot-dark-border bg-ot-dark-card px-4 py-[15px] font-ui text-[15px] text-[#fafafa] placeholder:text-[#5a5a5a] outline-none focus:border-ot-blue"
                />
              </div>

              {error && (
                <div className="rounded-[13px] border border-red-500/30 bg-red-500/10 p-3 font-ui text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-[15px] bg-ot-blue py-[17px] font-display text-2xl font-extrabold uppercase text-white transition-opacity disabled:opacity-60 hover:opacity-90"
              >
                {loading ? t('common.loading') : `${t('auth.reset_password.submit')} →`}
              </button>
            </form>
          </>
        )}

        <p className="mt-auto pt-10 text-center font-ui text-sm text-[#9a9a9a]">
          {t('auth.forgot_password.remembered')}{' '}
          <Link to="/login" className="font-bold text-ot-blue">
            {t('auth.login.title')}
          </Link>
        </p>
      </div>
    </div>
  )
}
