import { useEffect, useState } from 'react'
import { getErrorMessage } from "../lib/utils"
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { supabaseCoachGateway } from '../gateways/supabaseCoachGateway'
import { useAuthStore } from '../stores/useAuthStore'
import { Button } from '../components/ui/button'
import type { Database } from '../types/database.types'
import { AppRoutes } from '../constants/routes'


type InviteRow = Database['public']['Tables']['coach_student_invites']['Row']

export default function CoachInvites() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadInvites = async () => {
    setLoading(true)
    setError(null)
    try {
      const coachId = useAuthStore.getState().user?.id
      if (!coachId) throw new Error('User not authenticated')

      const data = await supabaseCoachGateway.fetchInvitesByCoach(coachId)
      setInvites(data)
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadInvites()
  }, [])

  return (
    <div className="min-h-screen bg-ot-paper text-ot-ink font-ui pb-20">
      <header className="p-4 flex items-center gap-3 border-b border-ot-border bg-ot-header-bg backdrop-blur sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate(AppRoutes.CoachPanel)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl font-extrabold uppercase leading-none">{t('coach.panel.invites_title')}</h1>
      </header>

      <main className="p-4 max-w-3xl mx-auto space-y-3">
        {loading && <p className="text-sm text-ot-muted">{t('common.loading')}</p>}
        {error && <p className="text-sm text-ot-danger-text">{error}</p>}
        {!loading && invites.length === 0 && (
          <p className="text-sm text-ot-muted">{t('coach.panel.no_invites')}</p>
        )}
        {invites.map((invite) => (
          <div key={invite.id} className="p-3 rounded-xl border border-ot-border bg-ot-card">
            <p className="text-sm font-semibold">{invite.student_email}</p>
            <p className="text-xs text-ot-muted">{t(`coach.common.status.${invite.status}`)}</p>
          </div>
        ))}
      </main>
    </div>
  )
}
