import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Copy, Mail, Users, ShieldAlert, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import type { Database } from '../types/database.types'

type LinkRow = Database['public']['Tables']['coach_student_links']['Row']
type ProfileRow = Database['public']['Tables']['profiles']['Row']

export default function CoachPanel() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [links, setLinks] = useState<LinkRow[]>([])
  const [invitesCount, setInvitesCount] = useState(0)
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0)
  const [profilesById, setProfilesById] = useState<Record<string, ProfileRow>>({})
  const [inviteEmail, setInviteEmail] = useState('')
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null)
  const [inviteInfo, setInviteInfo] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    if (!user) return
    setIsLoading(true)
    setError(null)
    try {
      const [{ data: linksData, error: linksError }, { data: invitesData, error: invitesError }, { data: requestsData, error: requestsError }] = await Promise.all([
        supabase.from('coach_student_links').select('*').eq('coach_id', user.id).order('created_at', { ascending: false }),
        supabase.from('coach_student_invites').select('*').eq('coach_id', user.id).order('created_at', { ascending: false }),
        supabase.from('coach_student_unlink_requests').select('*').order('created_at', { ascending: false })
      ])

      if (linksError) throw linksError
      if (invitesError) throw invitesError
      if (requestsError) throw requestsError

      setLinks(linksData || [])
      setInvitesCount((invitesData || []).length)
      setPendingRequestsCount((requestsData || []).filter((r) => r.status === 'pending').length)

      const studentIds = Array.from(new Set((linksData || []).map(l => l.student_id)))
      if (studentIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', studentIds)
        if (profilesError) throw profilesError
        const byId = Object.fromEntries((profilesData || []).map((p) => [p.user_id, p]))
        setProfilesById(byId)
      } else {
        setProfilesById({})
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [user])

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setError(null)
    setGeneratedInviteLink(null)
    setInviteInfo(null)
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        throw new Error(t('coach.panel.auth_required'))
      }

      const { data, error } = await supabase.functions.invoke('send-coach-invite', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: {
          studentEmail: inviteEmail.trim()
        }
      })
      if (error) throw error

      if (data?.success && data?.sent) {
        setInviteInfo(t('coach.panel.invite_sent_success'))
      } else if (data?.inviteLink) {
        setGeneratedInviteLink(data.inviteLink)
        setInviteInfo(t('coach.panel.invite_sent_fallback'))
      }
      setInviteEmail('')
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleToggleStudentCanUnlink = async (link: LinkRow, value: boolean) => {
    setError(null)
    try {
      const { error } = await supabase
        .from('coach_student_links')
        .update({ student_can_unlink: value })
        .eq('id', link.id)
      if (error) throw error
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white pb-20">
      <header className="p-4 flex items-center gap-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate('/profile')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">{t('coach.panel.title')}</h1>
      </header>

      <main className="p-4 max-w-3xl mx-auto space-y-6">
        <section className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-emerald-500" />
            <h2 className="font-semibold">{t('coach.panel.invite_title')}</h2>
          </div>
          <form onSubmit={handleCreateInvite} className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder={t('coach.panel.invite_email_placeholder')}
              required
            />
            <Button type="submit">{t('coach.panel.invite_submit')}</Button>
          </form>

          {generatedInviteLink && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm space-y-2">
              <p>{t('coach.panel.invite_link_ready')}</p>
              <div className="flex gap-2">
                <Input value={generatedInviteLink} readOnly />
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(generatedInviteLink)
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {inviteInfo && (
            <div className="p-3 rounded-lg bg-blue-500/10 text-blue-600 text-sm">
              {inviteInfo}
            </div>
          )}
        </section>

        <section className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-500" />
            <h2 className="font-semibold">{t('coach.panel.students_title')}</h2>
          </div>
          {links.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('coach.panel.no_students')}</p>
          ) : (
            <div className="space-y-2">
              {links.map((link) => {
                const student = profilesById[link.student_id]
                return (
                  <div key={link.id} className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <button
                        className="font-semibold text-left hover:text-emerald-500 transition-colors"
                        onClick={() => navigate(`/coach-student-workouts?student=${link.student_id}`)}
                      >
                        {student?.full_name || t('coach.workouts.unnamed_student')}
                      </button>
                      <p className="text-xs text-neutral-500">{t(`coach.common.status.${link.status}`)}</p>
                    </div>
                    {link.status === 'active' && (
                      <label className="text-xs flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={link.student_can_unlink}
                          onChange={(e) => handleToggleStudentCanUnlink(link, e.target.checked)}
                        />
                        {t('coach.panel.student_can_unlink')}
                      </label>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
          <button
            className="w-full p-4 flex items-center justify-between hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            onClick={() => navigate('/coach-invites')}
          >
            <div className="text-left">
              <p className="font-semibold">{t('coach.panel.invites_title')}</p>
              <p className="text-xs text-neutral-500">{t('coach.panel.invites_count', { count: invitesCount })}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-500" />
          </button>
          <button
            className="w-full p-4 flex items-center justify-between border-t border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            onClick={() => navigate('/coach-unlink-requests')}
          >
            <div className="text-left flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <div>
                <p className="font-semibold">{t('coach.panel.unlink_requests_title')}</p>
                <p className="text-xs text-neutral-500">{t('coach.panel.unlink_requests_count', { count: pendingRequestsCount })}</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-500" />
          </button>
        </section>

        {isLoading && <p className="text-sm text-neutral-500">{t('common.loading')}</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </main>
    </div>
  )
}
