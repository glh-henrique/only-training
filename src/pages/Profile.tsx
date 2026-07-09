import { useNavigate } from 'react-router-dom'
import { brDateToIso, getErrorMessage, isoDateToBr, maskDateBR } from "../lib/utils"
import { useAuthStore } from '../stores/useAuthStore'
import { useThemeStore } from '../stores/useThemeStore'
import { useWorkoutStore } from '../stores/useWorkoutStore'
import { useHistoryStore } from '../stores/useHistoryStore'
import { useTranslation } from 'react-i18next'
import { Input } from '../components/ui/input'
import { AlertModal } from '../components/ui/alert-modal'
import { Modal } from '../components/ui/modal'
import { BottomNav } from '../components/BottomNav'
import { UserRole } from '../constants/auth'
import { AppRoutes } from '../constants/routes'
import { supabase } from '../lib/supabase'
import { computeStreak } from '../lib/stats'
import { supabaseCoachGateway } from '../gateways/supabaseCoachGateway'
import { supabaseProfileGateway } from '../gateways/supabaseProfileGateway'
import { useState, useEffect, useMemo } from 'react'
import type { ChangeEvent } from 'react'
import type { Database } from '../types/database.types'

type LinkRow = Database['public']['Tables']['coach_student_links']['Row']
type ProfileRow = Database['public']['Tables']['profiles']['Row']
type UnlinkRequestRow = Database['public']['Tables']['coach_student_unlink_requests']['Row']

function RowItem({ label, right, onClick }: { label: string; right?: React.ReactNode; onClick?: () => void }) {
  const inner = (
    <div className="flex items-center justify-between border-b border-ot-border py-3.5 px-0">
      <span className="font-display text-[18px] font-semibold leading-none">{label}</span>
      <div className="flex items-center gap-2">
        {right}
        {onClick && <span style={{ color: '#c3c3cb', fontSize: 18 }}>›</span>}
      </div>
    </div>
  )
  if (onClick) return <button type="button" onClick={onClick} className="w-full text-left">{inner}</button>
  return inner
}

export default function Profile() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, signOut, role, refreshProfileContext } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const { archivedCount, fetchWorkouts } = useWorkoutStore()
  const { sessions: historySessions, fetchHistory } = useHistoryStore()

  const [resetSent, setResetSent] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [activeLink, setActiveLink] = useState<LinkRow | null>(null)
  const [coachProfile, setCoachProfile] = useState<ProfileRow | null>(null)
  const [pendingUnlinkRequest, setPendingUnlinkRequest] = useState<UnlinkRequestRow | null>(null)
  const [isRelationshipLoading, setIsRelationshipLoading] = useState(false)
  const [isRequestingUnlink, setIsRequestingUnlink] = useState(false)
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [isProfileSaving, setIsProfileSaving] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [gymName, setGymName] = useState('')
  const [bodyWeight, setBodyWeight] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [sex, setSex] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [initialFirstName, setInitialFirstName] = useState('')
  const [initialLastName, setInitialLastName] = useState('')
  const [initialGymName, setInitialGymName] = useState('')
  const [initialBodyWeight, setInitialBodyWeight] = useState('')
  const [initialBirthDate, setInitialBirthDate] = useState('')
  const [initialSex, setInitialSex] = useState('')
  const [initialAvatarUrl, setInitialAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    fetchWorkouts()
    fetchHistory()
  }, [fetchWorkouts, fetchHistory])

  useEffect(() => {
    const loadRelationship = async () => {
      if (!user || role !== UserRole.Student) return
      setIsRelationshipLoading(true)
      try {
        const linkData = await supabaseCoachGateway.fetchActiveLinkForStudent(user.id)
        setActiveLink(linkData)
        if (!linkData) { setCoachProfile(null); setPendingUnlinkRequest(null); return }
        const [coachData, requestData] = await Promise.all([
          supabaseProfileGateway.fetchProfile(linkData.coach_id),
          supabaseCoachGateway.fetchPendingUnlinkRequest(linkData.id)
        ])
        setCoachProfile(coachData)
        setPendingUnlinkRequest(requestData)
      } finally {
        setIsRelationshipLoading(false)
      }
    }
    void loadRelationship()
  }, [user, role])

  useEffect(() => {
    const loadOwnProfile = async () => {
      if (!user) return
      setIsProfileLoading(true)
      try {
        const data = await supabaseProfileGateway.fetchProfile(user.id)
        const fn = data?.first_name ?? ''
        const ln = data?.last_name ?? ''
        const gn = data?.gym_name ?? ''
        const au = data?.avatar_url ?? null
        const bw = data?.body_weight_kg != null ? String(data.body_weight_kg) : ''
        const bd = data?.birth_date ? isoDateToBr(data.birth_date) : ''
        const sx = data?.sex ?? ''
        setFirstName(fn); setLastName(ln); setGymName(gn); setAvatarUrl(au)
        setBodyWeight(bw); setBirthDate(bd); setSex(sx)
        setInitialFirstName(fn); setInitialLastName(ln); setInitialGymName(gn); setInitialAvatarUrl(au)
        setInitialBodyWeight(bw); setInitialBirthDate(bd); setInitialSex(sx)
      } finally {
        setIsProfileLoading(false)
      }
    }
    void loadOwnProfile()
  }, [user])

  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean; title: string; description: string; variant: 'info' | 'success' | 'warning' | 'danger'
  }>({ isOpen: false, title: '', description: '', variant: 'info' })

  const handleSignOut = async () => { await signOut(); navigate(AppRoutes.Login) }

  const handleResetPassword = async () => {
    if (!user?.email) return
    setIsResetting(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/#/login`,
      })
      if (error) throw error
      setAlertConfig({ isOpen: true, variant: 'success', title: t('profile.reset_email_sent_title'), description: t('profile.reset_email_sent_desc') })
      setResetSent(true)
    } catch (error: unknown) {
      setAlertConfig({ isOpen: true, variant: 'danger', title: t('profile.reset_error_title'), description: getErrorMessage(error) })
    } finally {
      setIsResetting(false)
    }
  }

  const isVerified = !!user?.email_confirmed_at
  const profileName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').trim()
  const displayName = profileName || (user?.user_metadata?.full_name as string | undefined) || user?.email?.split('@')[0] || ''
  const avatarInitial = (displayName[0] || user?.email?.[0] || '?').toUpperCase()

  const handleRequestUnlink = async () => {
    if (!activeLink) return
    setIsRequestingUnlink(true)
    try {
      const data = await supabaseCoachGateway.requestStudentUnlink(activeLink.id)
      if (data === 'ended') {
        await refreshProfileContext()
        setAlertConfig({ isOpen: true, variant: 'success', title: t('coach.student.unlinked_title'), description: t('coach.student.unlinked_desc') })
      } else {
        setAlertConfig({ isOpen: true, variant: 'info', title: t('coach.student.unlink_requested_title'), description: t('coach.student.unlink_requested_desc') })
      }
      setActiveLink(await supabaseCoachGateway.fetchLinkById(activeLink.id))
      setPendingUnlinkRequest(await supabaseCoachGateway.fetchPendingUnlinkRequest(activeLink.id))
    } catch (error: unknown) {
      setAlertConfig({ isOpen: true, variant: 'danger', title: t('coach.student.unlink_error_title'), description: getErrorMessage(error) })
    } finally {
      setIsRequestingUnlink(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!user) return
    const cleanFirstName = firstName.trim() || null
    const cleanLastName = lastName.trim() || null
    const cleanGymName = gymName.trim() || null
    const parsedWeight = parseFloat(bodyWeight.replace(',', '.'))
    const cleanBodyWeight = parsedWeight > 0 && parsedWeight < 500 ? parsedWeight : null
    const cleanBirthDate = brDateToIso(birthDate)
    const cleanSex = sex === 'male' || sex === 'female' ? sex : null
    const fullName = [cleanFirstName, cleanLastName].filter(Boolean).join(' ').trim() || null
    setIsProfileSaving(true)
    try {
      let nextAvatarUrl = avatarUrl
      if (photoFile) {
        nextAvatarUrl = await supabaseProfileGateway.uploadProfilePhoto(user.id, photoFile)
      }
      await supabaseProfileGateway.upsertProfile({ user_id: user.id, role, first_name: cleanFirstName, last_name: cleanLastName, gym_name: cleanGymName, full_name: fullName, avatar_url: nextAvatarUrl, body_weight_kg: cleanBodyWeight, birth_date: cleanBirthDate, sex: cleanSex })
      await supabase.auth.updateUser({ data: { full_name: fullName } })
      setAlertConfig({ isOpen: true, variant: 'success', title: t('profile.profile_saved_title'), description: t('profile.profile_saved_desc') })
      setInitialFirstName(cleanFirstName ?? ''); setInitialLastName(cleanLastName ?? ''); setInitialGymName(cleanGymName ?? '')
      setInitialBodyWeight(cleanBodyWeight != null ? String(cleanBodyWeight) : ''); setInitialBirthDate(cleanBirthDate ? isoDateToBr(cleanBirthDate) : ''); setInitialSex(cleanSex ?? '')
      setBodyWeight(cleanBodyWeight != null ? String(cleanBodyWeight) : ''); setBirthDate(cleanBirthDate ? isoDateToBr(cleanBirthDate) : ''); setSex(cleanSex ?? '')
      setAvatarUrl(nextAvatarUrl); setInitialAvatarUrl(nextAvatarUrl); setPhotoFile(null); setIsEditingProfile(false)
    } catch (error: unknown) {
      setAlertConfig({ isOpen: true, variant: 'danger', title: t('profile.profile_error_title'), description: getErrorMessage(error) })
    } finally {
      setIsProfileSaving(false)
    }
  }

  const handleCancelProfileEdit = () => {
    setFirstName(initialFirstName); setLastName(initialLastName); setGymName(initialGymName)
    setBodyWeight(initialBodyWeight); setBirthDate(initialBirthDate); setSex(initialSex)
    setAvatarUrl(initialAvatarUrl); setPhotoFile(null); setIsEditingProfile(false)
  }

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAlertConfig({ isOpen: true, variant: 'warning', title: t('profile.photo_invalid_title'), description: t('profile.photo_invalid_desc') })
      return
    }
    setPhotoFile(file)
    setAvatarUrl(URL.createObjectURL(file))
  }

  // Stats
  const today = useMemo(() => new Date(), [])
  const totalSessions = historySessions.length
  const streak = useMemo(() => computeStreak(historySessions, today), [historySessions, today])

  const sinceLabel = useMemo(() => {
    if (!user?.created_at) return ''
    const d = new Date(user.created_at)
    const lang = i18n.language
    const month = d.toLocaleDateString(lang.startsWith('pt') ? 'pt-BR' : 'en-US', { month: 'short' }).toUpperCase().replace('.', '')
    return `${t('profile.since')} ${month} ${d.getFullYear()}`
  }, [user?.created_at, i18n.language, t])

  const roleLabel = role === UserRole.Instructor
    ? (t('profile.role_instructor'))
    : (t('profile.role_student'))

  return (
    <div className="min-h-screen pb-28 font-ui" style={{ background: 'var(--color-ot-paper)', color: 'var(--color-ot-ink)' }}>

      {/* ── Profile header ── */}
      <div className="flex items-center gap-3.5 px-6 pt-14">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="h-16 w-16 flex-none rounded-[20px] object-cover"
          />
        ) : (
          <div
            className="flex h-16 w-16 flex-none items-center justify-center rounded-[20px] bg-ot-blue font-display text-[30px] font-extrabold text-white"
          >
            {avatarInitial}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-[30px] font-extrabold uppercase leading-none truncate">{displayName}</h1>
          <p className="mt-1 font-ot-mono text-[10px] tracking-[0.06em]" style={{ color: '#9a9aa2' }}>
            {sinceLabel}{sinceLabel ? ' · ' : ''}{roleLabel}
          </p>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="mt-5 grid grid-cols-3 gap-2.5 px-6">
        <div className="rounded-[14px] border border-ot-border bg-white dark:bg-ot-dark-card p-3 text-center">
          <div className="font-display text-[28px] font-extrabold leading-none">{totalSessions}</div>
          <div className="mt-1 font-ot-mono text-[8.5px] tracking-[0.06em]" style={{ color: '#9a9aa2' }}>
            {t('profile.stat_workouts')}
          </div>
        </div>
        <div className="rounded-[14px] p-3 text-center" style={{ background: '#0e0e10' }}>
          <div className="font-display text-[28px] font-extrabold leading-none" style={{ color: '#d8ff36' }}>{streak}</div>
          <div className="mt-1 font-ot-mono text-[8.5px] tracking-[0.06em]" style={{ color: '#8a8a92' }}>
            {t('profile.stat_streak')}
          </div>
        </div>
        <div className="rounded-[14px] border border-ot-border bg-white dark:bg-ot-dark-card p-3 text-center">
          <div className="font-display text-[28px] font-extrabold leading-none">{archivedCount}</div>
          <div className="mt-1 font-ot-mono text-[8.5px] tracking-[0.06em]" style={{ color: '#9a9aa2' }}>
            {t('profile.stat_archived')}
          </div>
        </div>
      </div>

      {/* ── Settings list ── */}
      <div className="mt-5 px-6">
        <div className="rounded-2xl border border-ot-border bg-white dark:bg-ot-dark-card px-4">

          {/* Edit profile */}
          <RowItem
            label={t('profile.edit_profile')}
            onClick={() => setIsEditingProfile(true)}
            right={
              isVerified ? (
                <span className="font-ot-mono text-[9px] rounded-md px-2 py-1" style={{ background: 'var(--color-ot-success-bg)', color: 'var(--color-ot-success-text)' }}>
                  {t('profile.verified')}
                </span>
              ) : (
                <span className="font-ot-mono text-[9px] rounded-md px-2 py-1" style={{ background: 'var(--color-ot-warning-bg)', color: 'var(--color-ot-warning-text)' }}>
                  {t('profile.not_verified')}
                </span>
              )
            }
          />

          {/* Wizard de perfil (papel travado em revisitas) */}
          <RowItem label={t('profile.open_onboarding')} onClick={() => navigate(AppRoutes.Onboarding)} />

          {/* Dados corporais (peso, medidas, gordura, TMB) */}
          <RowItem label={t('body_stats.title')} onClick={() => navigate(AppRoutes.BodyStats)} />

          {/* Coach section (student) */}
          {role === UserRole.Student && (
            <RowItem
              label={t('coach.student.section_title')}
              right={
                isRelationshipLoading ? (
                  <span className="font-ot-mono text-[10px]" style={{ color: '#9a9aa2' }}>{t('common.loading')}</span>
                ) : activeLink ? (
                  <div className="flex items-center gap-2">
                    <span className="font-ot-mono text-[10px]" style={{ color: '#9a9aa2' }}>
                      {coachProfile?.full_name || t('coach.student.coach_unknown')}
                    </span>
                    {pendingUnlinkRequest ? (
                      <span className="font-ot-mono text-[9px]" style={{ color: '#f5a623' }}>
                        {t('profile.unlink_pending')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRequestUnlink}
                        disabled={isRequestingUnlink}
                        className="font-ot-mono text-[9px] rounded-md px-2 py-1 border"
                        style={{ borderColor: 'var(--color-ot-border)', color: 'var(--color-ot-muted)' }}
                      >
                        {isRequestingUnlink ? '…' : t('coach.student.request_unlink')}
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="font-ot-mono text-[10px]" style={{ color: '#9a9aa2' }}>
                    {t('coach.student.no_coach')}
                  </span>
                )
              }
            />
          )}

          {/* Coach panel (instructor) */}
          {role === UserRole.Instructor && (
            <RowItem label={t('coach.panel.title')} onClick={() => navigate(AppRoutes.CoachPanel)} />
          )}

          {/* Language */}
          <RowItem
            label={t('profile.language')}
            right={
              <div className="flex gap-1 rounded-lg p-0.5" style={{ background: 'var(--color-ot-border)' }}>
                {(['en', 'pt'] as const).map(lang => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => i18n.changeLanguage(lang)}
                    className="rounded-md px-2.5 py-1 font-ot-mono text-[10px] font-bold transition-all"
                    style={i18n.language.startsWith(lang)
                      ? { background: 'var(--color-ot-ink)', color: 'var(--color-ot-paper)' }
                      : { color: 'var(--color-ot-muted)' }
                    }
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
            }
          />

          {/* Theme */}
          <RowItem
            label={t('profile.theme')}
            right={
              <button
                type="button"
                onClick={toggleTheme}
                className="relative h-6 w-11 rounded-full p-1 transition-colors"
                style={{ background: theme === 'dark' ? '#2a5fff' : '#dfdfe2' }}
              >
                <div
                  className="h-4 w-4 rounded-full bg-white dark:bg-ot-dark-card shadow-sm transition-transform duration-200"
                  style={{ transform: theme === 'dark' ? 'translateX(20px)' : 'translateX(0)' }}
                />
              </button>
            }
          />

          {/* Archived workouts */}
          <RowItem
            label={t('workouts.archived')}
            onClick={() => navigate(AppRoutes.Archive)}
            right={
              archivedCount > 0 ? (
                <span className="font-ot-mono text-[10px]" style={{ color: '#9a9aa2' }}>{archivedCount}</span>
              ) : undefined
            }
          />

          {/* AI Coach */}
          <RowItem label={t('coach_ai.title')} onClick={() => navigate(AppRoutes.AICoach)} />

          {/* About */}
          <RowItem label={t('about.title')} onClick={() => navigate(AppRoutes.About)} />

          {/* Reset password */}
          <RowItem
            label={t('profile.reset_password')}
            right={
              resetSent ? (
                <span className="font-ot-mono text-[9px]" style={{ color: '#16b85c' }}>
                  {t('profile.reset_sent_badge')}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={isResetting}
                  className="font-ot-mono text-[9px] rounded-md px-2 py-1 border"
                  style={{ borderColor: 'var(--color-ot-border)', color: 'var(--color-ot-muted)' }}
                >
                  {isResetting ? t('common.loading') : t('profile.reset_send_link')}
                </button>
              )
            }
          />

          {/* Sign out — last row, no border-b */}
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center justify-between py-3.5"
          >
            <span className="font-display text-[18px] font-semibold leading-none" style={{ color: '#e5484d' }}>
              {t('common.logout')}
            </span>
          </button>
        </div>
      </div>

      <BottomNav />

      <AlertModal
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
        title={alertConfig.title}
        description={alertConfig.description}
        variant={alertConfig.variant}
      />

      {/* Edit Profile Modal */}
      <Modal isOpen={isEditingProfile} onClose={handleCancelProfileEdit} title={t('profile.edit_profile')}>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="font-ot-mono text-[9px] tracking-[0.16em] text-ot-faint uppercase block mb-1">
              {t('profile.first_name')}
            </label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t('profile.first_name')} disabled={isProfileLoading || isProfileSaving} />
          </div>
          <div className="space-y-1">
            <label className="font-ot-mono text-[9px] tracking-[0.16em] text-ot-faint uppercase block mb-1">
              {t('profile.last_name')}
            </label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t('profile.last_name')} disabled={isProfileLoading || isProfileSaving} />
          </div>
          <div className="space-y-1">
            <label className="font-ot-mono text-[9px] tracking-[0.16em] text-ot-faint uppercase block mb-1">
              {t('profile.gym_name')}
            </label>
            <Input value={gymName} onChange={(e) => setGymName(e.target.value)} placeholder={t('profile.gym_placeholder')} disabled={isProfileLoading || isProfileSaving} />
          </div>
          <div className="space-y-1">
            <label className="font-ot-mono text-[9px] tracking-[0.16em] text-ot-faint uppercase block mb-1">
              {t('profile.body_weight')}
            </label>
            <Input type="number" inputMode="decimal" min={1} max={499} step="0.1" value={bodyWeight} onChange={(e) => setBodyWeight(e.target.value)} placeholder={t('profile.body_weight_placeholder')} disabled={isProfileLoading || isProfileSaving} />
          </div>
          <div className="space-y-1">
            <label className="font-ot-mono text-[9px] tracking-[0.16em] text-ot-faint uppercase block mb-1">
              {t('profile.birth_date')}
            </label>
            <Input type="text" inputMode="numeric" placeholder="DD/MM/AAAA" maxLength={10} value={birthDate} onChange={(e) => setBirthDate(maskDateBR(e.target.value))} disabled={isProfileLoading || isProfileSaving} />
          </div>
          <div className="space-y-1">
            <label className="font-ot-mono text-[9px] tracking-[0.16em] text-ot-faint uppercase block mb-1">
              {t('profile.sex')}
            </label>
            <div className="flex gap-2">
              {(['male', 'female'] as const).map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSex(sex === option ? '' : option)}
                  disabled={isProfileLoading || isProfileSaving}
                  className="flex-1 rounded-[13px] border py-2.5 font-display text-sm font-bold uppercase transition-colors"
                  style={sex === option
                    ? { background: 'var(--color-ot-ink)', color: 'var(--color-ot-paper)', borderColor: 'var(--color-ot-ink)' }
                    : { borderColor: 'var(--color-ot-border)', color: 'var(--color-ot-muted)' }
                  }
                >
                  {t(`profile.sex_${option}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="font-ot-mono text-[9px] tracking-[0.16em] text-ot-faint uppercase block mb-1">
              {t('profile.photo_label')}
            </label>
            <Input type="file" accept="image/*" onChange={handlePhotoChange} disabled={isProfileLoading || isProfileSaving} />
            <p className="text-xs text-ot-muted">{t('profile.photo_help')}</p>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleCancelProfileEdit}
              disabled={isProfileLoading || isProfileSaving}
              className="flex-1 rounded-[13px] border border-ot-border py-3 font-display text-base font-bold uppercase text-ot-ink transition-opacity disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={isProfileLoading || isProfileSaving}
              className="flex-1 rounded-[13px] bg-ot-blue py-3 font-display text-base font-bold uppercase text-white transition-opacity disabled:opacity-50"
            >
              {isProfileSaving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
