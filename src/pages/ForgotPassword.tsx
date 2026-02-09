import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'

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
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md space-y-8">
        <Link 
          to="/login" 
          className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('auth.forgot_password.back_to_login')}
        </Link>

        <div className="text-center">
          <h2 className="text-3xl font-bold">{t('auth.forgot_password.title')}</h2>
          <p className="mt-2 text-neutral-400">{t('auth.forgot_password.subtitle')}</p>
        </div>

        {success ? (
          <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            </div>
            <p className="text-emerald-500 font-medium">
              {t('auth.forgot_password.success')}
            </p>
            <Button asChild className="w-full">
              <Link to="/login">{t('auth.forgot_password.back_to_login')}</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleResetRequest} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                {t('common.email')}
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>

            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-500/10 rounded-md">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('common.loading') : t('auth.forgot_password.submit')}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
