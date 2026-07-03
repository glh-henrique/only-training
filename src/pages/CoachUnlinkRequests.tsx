import { useEffect, useState } from 'react'
import { getErrorMessage } from "../lib/utils"
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { supabaseCoachGateway } from '../gateways/supabaseCoachGateway'
import { Button } from '../components/ui/button'
import type { Database } from '../types/database.types'
import { AppRoutes } from '../constants/routes'


type RequestRow = Database['public']['Tables']['coach_student_unlink_requests']['Row']

export default function CoachUnlinkRequests() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadRequests = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await supabaseCoachGateway.fetchAllUnlinkRequests()
      setRequests(data)
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRequests()
  }, [])

  const handleResolveRequest = async (requestId: string, approve: boolean) => {
    setError(null)
    try {
      await supabaseCoachGateway.resolveUnlinkRequest(requestId, approve)
      await loadRequests()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  const pendingRequests = requests.filter((r) => r.status === 'pending')

  return (
    <div className="min-h-screen bg-ot-paper text-ot-ink font-ui pb-20">
      <header className="p-4 flex items-center gap-3 border-b border-ot-border bg-ot-header-bg backdrop-blur sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate(AppRoutes.CoachPanel)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl font-extrabold uppercase leading-none">{t('coach.panel.unlink_requests_title')}</h1>
      </header>

      <main className="p-4 max-w-3xl mx-auto space-y-3">
        {loading && <p className="text-sm text-ot-muted">{t('common.loading')}</p>}
        {error && <p className="text-sm text-ot-danger-text">{error}</p>}
        {!loading && pendingRequests.length === 0 && (
          <p className="text-sm text-ot-muted">{t('coach.panel.no_unlink_requests')}</p>
        )}
        {pendingRequests.map((req) => (
          <div key={req.id} className="p-3 rounded-xl border border-ot-border bg-ot-card space-y-2">
            <div className="flex items-center gap-2 text-ot-warning-text">
              <ShieldAlert className="h-4 w-4" />
              <span className="text-xs font-semibold">{t('coach.common.status.pending')}</span>
            </div>
            <p className="text-sm">{req.message || t('coach.panel.unlink_no_message')}</p>
            <div className="flex gap-2">
              <Button size="sm" className="bg-ot-blue text-white hover:bg-ot-blue/90" onClick={() => handleResolveRequest(req.id, true)}>
                {t('coach.panel.approve')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleResolveRequest(req.id, false)}>
                {t('coach.panel.deny')}
              </Button>
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
