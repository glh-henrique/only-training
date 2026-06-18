import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff, ArrowLeft, Check } from 'lucide-react'
import type { UserRole } from '../types/auth'
import { cn, getErrorMessage } from '../lib/utils'

const getPasswordStrength = (password: string) => {
  if (!password) return 0
  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 10) score++
  if (/[0-9]/.test(password) && /[a-zA-Z]/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password) || (/[a-z]/.test(password) && /[A-Z]/.test(password))) score++
  return score
}

export default function Register() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<UserRole | ''>('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const strength = getPasswordStrength(password)
  const strengthLabel = [t('auth.register.strength.weak'), t('auth.register.strength.weak'), t('auth.register.strength.medium'), t('auth.register.strength.strong'), t('auth.register.strength.strong')][strength]
  const strengthColor = strength <= 1 ? '#e5484d' : strength === 2 ? '#f5a623' : '#16b85c'

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (password !== confirmPassword) {
      setError(t('auth.register.password_mismatch'))
      setLoading(false)
      return
    }

    if (!role) {
      setError(t('auth.register.role_required'))
      setLoading(false)
      return
    }

    if (!acceptedTerms) {
      setError(t('auth.register.terms_required'))
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role
          },
          emailRedirectTo: `${window.location.origin}/#/`
        }
      })

      if (error) throw error
      navigate('/register-confirmation', { state: { email } })
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ot-paper text-ot-ink font-ui">
      <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col px-6 pb-10 pt-8">
        <div className="flex items-center gap-3">
          <Link to="/login" className="font-display text-lg font-bold">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="font-ot-mono text-[10px] tracking-[0.18em] text-ot-faint">
            {t('auth.step', { current: 1, total: 2 })}
          </span>
        </div>

        <div className="mt-3.5 flex gap-1.5">
          <div className="h-1 flex-1 rounded-full bg-ot-blue" />
          <div className="h-1 flex-1 rounded-full bg-[#dfdfe2]" />
        </div>

        <h1 className="mt-6 font-display text-5xl font-extrabold uppercase leading-[0.9]">
          {t('auth.register.headline')}
        </h1>
        <p className="mt-2.5 font-ui text-sm font-medium text-ot-muted">
          {t('auth.register.tagline')}
        </p>

        <form onSubmit={handleRegister} className="mt-6 flex flex-col gap-3.5">
          <div>
            <label htmlFor="fullName" className="font-ot-mono text-[9px] tracking-[0.16em] text-ot-faint">
              {t('auth.register.name_label')}
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Marina Silva"
              className="mt-1.5 w-full rounded-[13px] border border-ot-border bg-white px-4 py-3.5 font-ui text-[15px] outline-none focus:border-ot-blue"
            />
          </div>

          <div>
            <label htmlFor="email" className="font-ot-mono text-[9px] tracking-[0.16em] text-ot-faint">
              {t('auth.register.email_label')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="marina@email.com"
              className="mt-1.5 w-full rounded-[13px] border border-ot-border bg-white px-4 py-3.5 font-ui text-[15px] outline-none focus:border-ot-blue"
            />
          </div>

          <div>
            <label htmlFor="password" className="font-ot-mono text-[9px] tracking-[0.16em] text-ot-faint">
              {t('auth.register.password_label')}
            </label>
            <div className="relative mt-1.5">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="w-full rounded-[13px] border border-ot-border bg-white px-4 py-3.5 pr-12 font-ui text-lg tracking-[0.15em] outline-none focus:border-ot-blue"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ot-faint hover:text-ot-ink focus:outline-none"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {password && (
              <div className="mt-2.5 flex items-center gap-2">
                <div className="flex flex-1 gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-1 flex-1 rounded-full"
                      style={{ background: i < strength ? strengthColor : '#e4e4e9' }}
                    />
                  ))}
                </div>
                <span className="font-ot-mono text-[10px]" style={{ color: strengthColor }}>
                  {strengthLabel.toUpperCase()}
                </span>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="font-ot-mono text-[9px] tracking-[0.16em] text-ot-faint">
              {t('auth.register.confirm_password_label')}
            </label>
            <div className="relative mt-1.5">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="w-full rounded-[13px] border border-ot-border bg-white px-4 py-3.5 pr-12 font-ui text-lg tracking-[0.15em] outline-none focus:border-ot-blue"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ot-faint hover:text-ot-ink focus:outline-none"
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <div className="font-ot-mono text-[10px] tracking-[0.18em] text-ot-faint">
              {t('auth.register.role_question')}
            </div>
            <div className="mt-3 flex gap-2.5">
              {(['aluno', 'instrutor'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRole(option)}
                  className={cn(
                    'flex-1 rounded-2xl p-3.5 text-left transition-colors',
                    role === option ? 'bg-ot-ink text-white' : 'border border-ot-border bg-white text-ot-ink'
                  )}
                >
                  <div className="font-display text-xl font-bold uppercase leading-none">
                    {option === 'aluno' ? t('auth.register.role_student') : t('auth.register.role_instructor_short')}
                  </div>
                  <div className={cn('mt-1.5 text-[11px] leading-snug', role === option ? 'text-[#b4b4be]' : 'text-[#8a8a92]')}>
                    {option === 'aluno' ? t('auth.register.role_student_desc') : t('auth.register.role_instructor_desc')}
                  </div>
                  <div
                    className={cn(
                      'mt-3 flex h-5 w-5 items-center justify-center rounded-full',
                      role === option ? 'bg-ot-blue text-white' : 'border-2 border-[#d4d4d9]'
                    )}
                  >
                    {role === option && <Check className="h-3 w-3" strokeWidth={3} />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2.5 pt-1">
            <span
              onClick={() => setAcceptedTerms(!acceptedTerms)}
              className={cn(
                'mt-0.5 flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px] transition-colors',
                acceptedTerms ? 'bg-ot-blue text-white' : 'border-2 border-ot-border bg-white'
              )}
            >
              {acceptedTerms && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </span>
            <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="sr-only" />
            <span className="text-xs leading-snug text-ot-muted">
              <Trans i18nKey="auth.register.terms">
                Aceito os <span className="font-bold text-ot-ink underline">Termos</span> e a <span className="font-bold text-ot-ink underline">Política de Privacidade</span>.
              </Trans>
            </span>
          </label>

          {error && (
            <div className="rounded-[13px] border border-red-500/20 bg-red-500/10 p-3 font-ui text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-[15px] bg-ot-blue py-[17px] font-display text-2xl font-extrabold uppercase text-white transition-opacity disabled:opacity-60"
          >
            {loading ? t('common.loading') : t('auth.register.submit')}
          </button>
        </form>

        <p className="mt-6 text-center font-ui text-sm text-ot-muted">
          {t('auth.register.has_account')}{' '}
          <Link to="/login" className="font-bold text-ot-blue">
            {t('auth.login.title')}
          </Link>
        </p>
      </div>
    </div>
  )
}
