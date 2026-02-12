import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/button'
import type { Database } from '../types/database.types'

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
      const { data, error } = await supabase
        .from('coach_student_unlink_requests')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setRequests(data || [])
    } catch (err: any) {
      setError(err.message)
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
      const { error } = await supabase.rpc('resolve_unlink_request', {
        request_id_input: requestId,
        approve_input: approve
      })
      if (error) throw error
      await loadRequests()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const pendingRequests = requests.filter((r) => r.status === 'pending')

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white pb-20">
      <header className="p-4 flex items-center gap-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate('/coach-panel')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">{t('coach.panel.unlink_requests_title')}</h1>
      </header>

      <main className="p-4 max-w-3xl mx-auto space-y-3">
        {loading && <p className="text-sm text-neutral-500">{t('common.loading')}</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && pendingRequests.length === 0 && (
          <p className="text-sm text-neutral-500">{t('coach.panel.no_unlink_requests')}</p>
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
