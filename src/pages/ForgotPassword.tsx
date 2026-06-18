import { useState } from 'react'
import { getErrorMessage } from "../lib/utils"
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { ArrowLeft } from 'lucide-react'

export default function ForgotPassword() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [email, setEmail] = useState('')

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/#/reset-password`,
      })

      if (error) throw error
      setSuccess(true)
    } catch (err: unknown) {
      setError(getErrorMessage(err))
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

        {!success ? (
          <>
            {/* Icon */}
            <div className="mt-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-ot-dark-card border border-ot-dark-border">
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-ot-blue" fill="none" stroke="currentColor" strokeWidth={1.6}>
                <rect x="3" y="8" width="18" height="13" rx="2" />
                <path d="M3 10l9 6 9-6" />
                <path d="M8 8V6a4 4 0 018 0v2" />
              </svg>
            </div>

            <h1 className="mt-6 font-display text-[48px] font-extrabold uppercase leading-[0.95] tracking-tight">
              {t('auth.forgot_password.headline')}
            </h1>
            <p className="mt-3 font-ui text-sm font-medium text-[#9a9a9a]">
              {t('auth.forgot_password.tagline')}
            </p>

            <form onSubmit={handleResetRequest} className="mt-8 flex flex-col gap-3.5">
              <div>
                <label htmlFor="forgot-email" className="font-ot-mono text-[9px] tracking-[0.16em] text-[#6e6e6e]">
                  {t('common.email').toUpperCase()}
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="marina@email.com"
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
                {loading ? t('common.loading') : `${t('auth.forgot_password.submit')} →`}
              </button>
            </form>
          </>
        ) : (
          <>
            {/* Success state */}
            <div className="mt-16 flex h-20 w-20 items-center justify-center rounded-[24px] bg-ot-success/15 border border-ot-success/30">
              <svg viewBox="0 0 24 24" className="h-10 w-10 text-ot-success" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>

            <h1 className="mt-8 font-display text-[44px] font-extrabold uppercase leading-[0.95] tracking-tight">
              {t('auth.forgot_password.sent_headline')}
            </h1>
            <p className="mt-3 font-ui text-sm font-medium text-[#9a9a9a]">
              {t('auth.forgot_password.success')}
            </p>

            <Link
              to="/login"
              className="mt-10 block w-full rounded-[15px] bg-ot-blue py-[17px] text-center font-display text-2xl font-extrabold uppercase text-white transition-opacity hover:opacity-90"
            >
              {t('auth.forgot_password.back_to_login')}
            </Link>
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
