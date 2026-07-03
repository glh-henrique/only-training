import { useEffect, useState } from 'react'
import { getErrorMessage } from "../lib/utils"
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Copy, Mail, Users, ShieldAlert, ChevronRight } from 'lucide-react'
import { supabaseCoachGateway } from '../gateways/supabaseCoachGateway'
import { supabaseProfileGateway } from '../gateways/supabaseProfileGateway'
import { useAuthStore } from '../stores/useAuthStore'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import type { Database } from '../types/database.types'
import { AppRoutes } from '../constants/routes'


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
      const [linksData, invitesData, requestsData] = await Promise.all([
        supabaseCoachGateway.fetchLinksByCoach(user.id),
        supabaseCoachGateway.fetchInvitesByCoach(user.id),
        supabaseCoachGateway.fetchAllUnlinkRequests()
      ])

      setLinks(linksData)
      setInvitesCount(invitesData.length)
      setPendingRequestsCount(requestsData.filter((r) => r.status === 'pending').length)

      const studentIds = Array.from(new Set(linksData.map(l => l.student_id)))
      const profilesData = await supabaseProfileGateway.fetchProfilesByIds(studentIds)
      setProfilesById(Object.fromEntries(profilesData.map((p) => [p.user_id, p])))
    } catch (err: unknown) {
      setError(getErrorMessage(err))
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
      const data = await supabaseCoachGateway.sendInvite(inviteEmail.trim())

      if (data?.success && data?.sent) {
        setInviteInfo(t('coach.panel.invite_sent_success'))
      } else if (data?.inviteLink) {
        setGeneratedInviteLink(data.inviteLink)
        setInviteInfo(t('coach.panel.invite_sent_fallback'))
      }
      setInviteEmail('')
      await loadData()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  const handleToggleStudentCanUnlink = async (link: LinkRow, value: boolean) => {
    setError(null)
    try {
      await supabaseCoachGateway.setStudentCanUnlink(link.id, value)
      await loadData()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <div className="min-h-screen bg-ot-paper text-ot-ink font-ui pb-20">
      <header className="p-4 flex items-center gap-3 border-b border-ot-border bg-ot-header-bg backdrop-blur sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate('/profile')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl font-extrabold uppercase leading-none">{t('coach.panel.title')}</h1>
      </header>

      <main className="p-4 max-w-3xl mx-auto space-y-6">
        <section className="bg-ot-card border border-ot-border rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-ot-blue" />
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
            <Button type="submit" className="bg-ot-blue text-white hover:bg-ot-blue/90">{t('coach.panel.invite_submit')}</Button>
          </form>

          {generatedInviteLink && (
            <div className="p-3 rounded-lg bg-ot-success-bg border border-ot-success-border text-sm space-y-2">
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
            <div className="p-3 rounded-lg bg-ot-accent-bg text-ot-accent-text text-sm">
              {inviteInfo}
            </div>
          )}
        </section>

        <section className="bg-ot-card border border-ot-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-ot-blue" />
            <h2 className="font-semibold">{t('coach.panel.students_title')}</h2>
          </div>
          {links.length === 0 ? (
            <p className="text-sm text-ot-muted">{t('coach.panel.no_students')}</p>
          ) : (
            <div className="space-y-2">
              {links.map((link) => {
                const student = profilesById[link.student_id]
                return (
                  <div key={link.id} className="p-3 rounded-xl border border-ot-border bg-ot-paper flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <button
                        className="font-semibold text-left hover:text-ot-blue transition-colors"
                        onClick={() => navigate(`${AppRoutes.CoachStudentWorkouts}?student=${link.student_id}`)}
                      >
                        {student?.full_name || t('coach.workouts.unnamed_student')}
                      </button>
                      <p className="text-xs text-ot-muted">{t(`coach.common.status.${link.status}`)}</p>
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

        <section className="bg-ot-card border border-ot-border rounded-2xl overflow-hidden">
          <button
            className="w-full p-4 flex items-center justify-between hover:bg-ot-subtle transition-colors"
            onClick={() => navigate(AppRoutes.CoachInvites)}
          >
            <div className="text-left">
              <p className="font-semibold">{t('coach.panel.invites_title')}</p>
              <p className="text-xs text-ot-muted">{t('coach.panel.invites_count', { count: invitesCount })}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-ot-muted" />
          </button>
          <button
            className="w-full p-4 flex items-center justify-between border-t border-ot-border hover:bg-ot-subtle transition-colors"
            onClick={() => navigate(AppRoutes.CoachUnlinkRequests)}
          >
            <div className="text-left flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-ot-warning-text" />
              <div>
                <p className="font-semibold">{t('coach.panel.unlink_requests_title')}</p>
                <p className="text-xs text-ot-muted">{t('coach.panel.unlink_requests_count', { count: pendingRequestsCount })}</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-ot-muted" />
          </button>
        </section>

        {isLoading && <p className="text-sm text-ot-muted">{t('common.loading')}</p>}
        {error && <p className="text-sm text-ot-danger-text">{error}</p>}
      </main>
    </div>
  )
}
