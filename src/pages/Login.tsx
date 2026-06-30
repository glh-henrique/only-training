import { useState } from 'react'
import { getErrorMessage } from "../lib/utils"
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff } from 'lucide-react'
import { AppRoutes } from '../constants/routes'

export default function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      navigate(AppRoutes.Home)
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="relative min-h-screen bg-ot-dark text-[#fafafa] font-ui overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(216,255,54,.16),transparent_70%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-sm flex-col px-6 pb-10 pt-16">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ot-lime">
            <div className="h-3.5 w-3.5 rounded-full border-[3px] border-ot-dark" />
          </div>
          <span className="font-ot-mono text-xs tracking-[0.3em] text-[#fafafa]">ONLY TRAINING</span>
        </div>

        <h1 className="mt-10 font-display text-[54px] font-extrabold uppercase leading-[0.95] tracking-tight">
          {t('auth.login.headline')}
        </h1>
        <p className="mt-3 font-ui text-sm font-medium text-[#9a9a9a]">
          {t('auth.login.tagline')}
        </p>

        <form onSubmit={handleLogin} className="mt-8 flex flex-col gap-3.5">
          <div>
            <label htmlFor="email" className="font-ot-mono text-[9px] tracking-[0.16em] text-[#6e6e6e]">
              {t('common.email').toUpperCase()}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="marina@email.com"
              className="mt-1.5 w-full rounded-[13px] border border-ot-dark-border bg-ot-dark-card px-4 py-[15px] font-ui text-[15px] text-[#fafafa] placeholder:text-[#5a5a5a] outline-none focus:border-ot-lime"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="font-ot-mono text-[9px] tracking-[0.16em] text-[#6e6e6e]">
                {t('common.password').toUpperCase()}
              </label>
              <Link to="/forgot-password" className="font-ot-mono text-[9px] tracking-[0.1em] text-ot-lime">
                {t('auth.login.forgot_short')}
              </Link>
            </div>
            <div className="relative mt-1.5">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••••"
                className="w-full rounded-[13px] border border-ot-dark-border bg-ot-dark-card px-4 py-[15px] pr-12 font-ui text-[18px] tracking-[0.15em] text-[#fafafa] outline-none focus:border-ot-lime"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6e6e6e] hover:text-[#fafafa] focus:outline-none"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-[13px] border border-red-500/30 bg-red-500/10 p-3 font-ui text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-[15px] bg-ot-lime py-[17px] font-display text-2xl font-extrabold uppercase text-ot-dark transition-opacity disabled:opacity-60"
          >
            {loading ? t('common.loading') : `${t('auth.login.submit')} →`}
          </button>
        </form>

        <p className="mt-auto pt-10 text-center font-ui text-sm text-[#9a9a9a]">
          {t('auth.login.new_here')}{' '}
          <Link to="/register" className="font-bold text-ot-lime">
            {t('auth.register.title')}
          </Link>
        </p>
      </div>
    </div>
  )
}
