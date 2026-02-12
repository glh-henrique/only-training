import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'
import { Button } from '../components/ui/button'

export default function AcceptInvite() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const role = useAuthStore(state => state.role)
  const refreshProfileContext = useAuthStore(state => state.refreshProfileContext)

  const token = useMemo(() => new URLSearchParams(location.search).get('token') || '', [location.search])
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const handleAccept = async () => {
    if (!token) {
      setStatus('error')
      setError(t('coach.accept.invalid_token'))
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const { error } = await supabase.rpc('accept_coach_invite', {
        token_input: token
      })
      if (error) throw error
      await refreshProfileContext()
      setStatus('success')
    } catch (err: any) {
      setStatus('error')
      setError(err.message || t('coach.accept.generic_error'))
    } finally {
      setIsLoading(false)
    }
  }

  if (role !== 'aluno') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
          <h1 className="text-xl font-bold">{t('coach.accept.only_student_title')}</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('coach.accept.only_student_desc')}</p>
          <Button onClick={() => navigate('/')} className="w-full">{t('common.ok')}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 space-y-4">
        <h1 className="text-xl font-bold">{t('coach.accept.title')}</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('coach.accept.subtitle')}</p>

        {!token && (
          <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">
            {t('coach.accept.invalid_token')}
          </div>
        )}

        {status === 'success' && (
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 text-sm flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {t('coach.accept.success')}
          </div>
        )}

        {status === 'error' && error && (
          <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Button className="w-full" onClick={handleAccept} disabled={isLoading || !token || status === 'success'}>
            {isLoading ? t('common.loading') : t('coach.accept.submit')}
          </Button>
          <Button variant="outline" className="w-full" onClick={() => navigate('/')}>
            {t('coach.accept.go_home')}
          </Button>
        </div>
      </div>
    </div>
  )
}
