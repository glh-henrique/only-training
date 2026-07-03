import { useMemo, useState } from 'react'
import { getErrorMessage } from "../lib/utils"
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { supabaseCoachGateway } from '../gateways/supabaseCoachGateway'
import { useAuthStore } from '../stores/useAuthStore'
import { Button } from '../components/ui/button'
import { AppRoutes } from '../constants/routes'

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
      await supabaseCoachGateway.acceptInvite(token)
      await refreshProfileContext()
      setStatus('success')
    } catch (err: unknown) {
      setStatus('error')
      setError(getErrorMessage(err, t('coach.accept.generic_error')))
    } finally {
      setIsLoading(false)
    }
  }

  if (role !== 'aluno') {
    return (
      <div className="min-h-screen bg-ot-paper text-ot-ink font-ui flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-ot-card border border-ot-border rounded-2xl p-6 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-ot-warning-text mx-auto" />
          <h1 className="font-display text-2xl font-extrabold uppercase leading-none">{t('coach.accept.only_student_title')}</h1>
          <p className="text-sm text-ot-muted">{t('coach.accept.only_student_desc')}</p>
          <Button onClick={() => navigate(AppRoutes.Home)} className="w-full">{t('common.ok')}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ot-paper text-ot-ink font-ui flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-ot-card border border-ot-border rounded-2xl p-6 space-y-4">
        <h1 className="font-display text-2xl font-extrabold uppercase leading-none">{t('coach.accept.title')}</h1>
        <p className="text-sm text-ot-muted">{t('coach.accept.subtitle')}</p>

        {!token && (
          <div className="p-3 rounded-lg bg-ot-danger-bg border border-ot-danger-border text-ot-danger-text text-sm">
            {t('coach.accept.invalid_token')}
          </div>
        )}

        {status === 'success' && (
          <div className="p-3 rounded-lg bg-ot-success-bg border border-ot-success-border text-ot-success-text text-sm flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {t('coach.accept.success')}
          </div>
        )}

        {status === 'error' && error && (
          <div className="p-3 rounded-lg bg-ot-danger-bg border border-ot-danger-border text-ot-danger-text text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Button className="w-full bg-ot-blue text-white hover:bg-ot-blue/90" onClick={handleAccept} disabled={isLoading || !token || status === 'success'}>
            {isLoading ? t('common.loading') : t('coach.accept.submit')}
          </Button>
          <Button variant="outline" className="w-full" onClick={() => navigate(AppRoutes.Home)}>
            {t('coach.accept.go_home')}
          </Button>
        </div>
      </div>
    </div>
  )
}
