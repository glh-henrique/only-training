import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/button'
import type { Database } from '../types/database.types'

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
      const { data: authData } = await supabase.auth.getUser()
      const coachId = authData.user?.id
      if (!coachId) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('coach_student_invites')
        .select('*')
        .eq('coach_id', coachId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setInvites(data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadInvites()
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white pb-20">
      <header className="p-4 flex items-center gap-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate('/coach-panel')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">{t('coach.panel.invites_title')}</h1>
      </header>

      <main className="p-4 max-w-3xl mx-auto space-y-3">
        {loading && <p className="text-sm text-neutral-500">{t('common.loading')}</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && invites.length === 0 && (
          <p className="text-sm text-neutral-500">{t('coach.panel.no_invites')}</p>
        )}
        {invites.map((invite) => (
          <div key={invite.id} className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
            <p className="text-sm font-semibold">{invite.student_email}</p>
            <p className="text-xs text-neutral-500">{t(`coach.common.status.${invite.status}`)}</p>
          </div>
        ))}
      </main>
    </div>
  )
}
