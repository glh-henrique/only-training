import { useEffect, useState } from 'react'
import { getErrorMessage } from "../lib/utils"
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { supabaseCoachGateway } from '../gateways/supabaseCoachGateway'
import { Button } from '../components/ui/button'
import type { Database } from '../types/database.types'import { AppRoutes } from '../constants/routes'


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
    <div className="min-h-screen bg-white dark:bg-ot-dark-card dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 dark:text-white pb-20">
      <header className="p-4 flex items-center gap-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-ot-dark-card dark:bg-neutral-950 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate(AppRoutes.CoachPanel)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">{t('coach.panel.unlink_requests_title')}</h1>
      </header>

      <main className="p-4 max-w-3xl mx-auto space-y-3">
        {loading && <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('common.loading')}</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && pendingRequests.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('coach.panel.no_unlink_requests')}</p>
        )}
        {pendingRequests.map((req) => (
          <div key={req.id} className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 space-y-2">
            <div className="flex items-center gap-2 text-amber-500">
              <ShieldAlert className="h-4 w-4" />
              <span className="text-xs font-semibold">{t('coach.common.status.pending')}</span>
            </div>
            <p className="text-sm">{req.message || t('coach.panel.unlink_no_message')}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleResolveRequest(req.id, true)}>
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
