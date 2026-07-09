import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Check } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { supabaseProfileGateway } from '../gateways/supabaseProfileGateway'
import { supabase } from '../lib/supabase'
import type { Role } from '../types/auth'
import { UserRole } from '../constants/auth'
import { AppRoutes } from '../constants/routes'
import { brDateToIso, cn, getErrorMessage, isoDateToBr, maskDateBR } from '../lib/utils'

const inputClass = 'mt-1.5 w-full rounded-[13px] border border-ot-border bg-white dark:bg-ot-dark-card px-4 py-3.5 font-ui text-[15px] outline-none focus:border-ot-blue'
const labelClass = 'font-ot-mono text-[9px] tracking-[0.16em] text-ot-faint'
const TOTAL_STEPS = 4

const parseMeasure = (value: string, max: number): number | null => {
  const n = parseFloat(value.replace(',', '.'))
  return n > 0 && n < max ? n : null
}

export default function Onboarding() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, role: currentRole, needsOnboarding, refreshProfileContext } = useAuthStore()

  // Revisita a partir do perfil: campos preenchidos e papel travado
  const editMode = !needsOnboarding

  const metadataName = ((user?.user_metadata?.full_name as string | undefined) ?? '').trim()
  const [nameFromMeta, ...restFromMeta] = metadataName.split(/\s+/)

  const [step, setStep] = useState(1)
  const [role, setRole] = useState<Role | null>(editMode ? currentRole : null)
  const [firstName, setFirstName] = useState(nameFromMeta ?? '')
  const [lastName, setLastName] = useState(restFromMeta.join(' '))
  const [gymName, setGymName] = useState('')
  const [bodyWeight, setBodyWeight] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [sex, setSex] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [neckCm, setNeckCm] = useState('')
  const [waistCm, setWaistCm] = useState('')
  const [hipCm, setHipCm] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!editMode || !user) return
    supabaseProfileGateway.fetchProfile(user.id).then((data) => {
      if (!data) return
      setFirstName(data.first_name ?? '')
      setLastName(data.last_name ?? '')
      setGymName(data.gym_name ?? '')
      setBodyWeight(data.body_weight_kg != null ? String(data.body_weight_kg) : '')
      setBirthDate(data.birth_date ? isoDateToBr(data.birth_date) : '')
      setSex(data.sex ?? '')
      setHeightCm(data.height_cm != null ? String(data.height_cm) : '')
      setNeckCm(data.neck_cm != null ? String(data.neck_cm) : '')
      setWaistCm(data.waist_cm != null ? String(data.waist_cm) : '')
      setHipCm(data.hip_cm != null ? String(data.hip_cm) : '')
      setAvatarPreview(data.avatar_url ?? null)
    }).catch(() => {})
  }, [editMode, user])

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError(t('profile.photo_invalid_desc'))
      return
    }
    setError(null)
    setPhotoFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleFinish = async (includePhoto: boolean) => {
    if (!user || !role) return
    setLoading(true)
    setError(null)
    const cleanFirstName = firstName.trim() || null
    const cleanLastName = lastName.trim() || null
    const fullName = [cleanFirstName, cleanLastName].filter(Boolean).join(' ').trim() || null
    const parsedWeight = parseFloat(bodyWeight.replace(',', '.'))
    try {
      let avatarUrl: string | undefined
      if (includePhoto && photoFile) {
        avatarUrl = await supabaseProfileGateway.uploadProfilePhoto(user.id, photoFile)
      }
      await supabaseProfileGateway.upsertProfile({
        user_id: user.id,
        role,
        first_name: cleanFirstName,
        last_name: cleanLastName,
        full_name: fullName,
        gym_name: gymName.trim() || null,
        body_weight_kg: parsedWeight > 0 && parsedWeight < 500 ? parsedWeight : null,
        birth_date: brDateToIso(birthDate),
        sex: sex === 'male' || sex === 'female' ? sex : null,
        height_cm: parseMeasure(heightCm, 300),
        neck_cm: parseMeasure(neckCm, 100),
        waist_cm: parseMeasure(waistCm, 300),
        hip_cm: parseMeasure(hipCm, 300),
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        // preserva a data original do primeiro acesso em revisitas
        ...(needsOnboarding ? { onboarded_at: new Date().toISOString() } : {})
      })
      await supabase.auth.updateUser({ data: { full_name: fullName, role } })
      await refreshProfileContext()
      navigate(AppRoutes.BodyStats, { replace: true })
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ot-paper text-ot-ink font-ui">
      <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col px-6 pb-10 pt-8">
        <div className="flex items-center gap-3">
          {editMode && (
            <button type="button" onClick={() => navigate(AppRoutes.Profile)} className="font-display text-lg font-bold">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <span className="font-ot-mono text-[10px] tracking-[0.18em] text-ot-faint">
            {t('auth.step', { current: step, total: TOTAL_STEPS })}
          </span>
        </div>
        <div className="mt-3.5 flex gap-1.5">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={cn('h-1 flex-1 rounded-full', step >= s ? 'bg-ot-blue' : 'bg-[#dfdfe2]')} />
          ))}
        </div>

        {step === 1 && (
          <>
            <h1 className="mt-6 font-display text-5xl font-extrabold uppercase leading-[0.9]">
              {t('onboarding.welcome')}
            </h1>
            <p className="mt-2.5 font-ui text-sm font-medium text-ot-muted">
              {t('auth.register.role_question')}
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              {([UserRole.Student, UserRole.Instructor] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => { if (!editMode) setRole(option) }}
                  disabled={editMode}
                  className={cn(
                    'rounded-2xl p-4 text-left transition-colors',
                    role === option ? 'bg-ot-ink text-white' : 'border border-ot-border bg-white dark:bg-ot-dark-card text-ot-ink',
                    editMode && role !== option && 'opacity-40'
                  )}
                >
                  <div className="font-display text-xl font-bold uppercase leading-none">
                    {option === UserRole.Student ? t('auth.register.role_student') : t('auth.register.role_instructor_short')}
                  </div>
                  <div className={cn('mt-1.5 text-[11px] leading-snug', role === option ? 'text-[#b4b4be]' : 'text-[#8a8a92]')}>
                    {option === UserRole.Student ? t('auth.register.role_student_desc') : t('auth.register.role_instructor_desc')}
                  </div>
                  <div
                    className={cn(
                      'mt-3 flex h-5 w-5 items-center justify-center rounded-full',
                      role === option ? 'bg-ot-blue text-white' : 'border-2 border-[#d4d4d9]'
                    )}
                  >
                    {role === option && <Check className="h-3 w-3" strokeWidth={3} />}
                  </div>
                </button>
              ))}
            </div>
            {editMode && (
              <p className="mt-3 font-ot-mono text-[10px] tracking-[0.06em] text-ot-faint">
                {t('onboarding.role_locked')}
              </p>
            )}

            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!role}
              className="mt-auto w-full rounded-[15px] bg-ot-blue py-[17px] font-display text-2xl font-extrabold uppercase text-white transition-opacity disabled:opacity-60"
            >
              {t('onboarding.continue')}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="mt-6 font-display text-5xl font-extrabold uppercase leading-[0.9]">
              {t('onboarding.profile_title')}
            </h1>
            <p className="mt-2.5 font-ui text-sm font-medium text-ot-muted">
              {t('onboarding.profile_tagline')}
            </p>

            <div className="mt-6 flex flex-col gap-3.5">
              <div className="flex gap-2.5">
                <div className="flex-1">
                  <label className={labelClass}>{t('profile.first_name')}</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
                </div>
                <div className="flex-1">
                  <label className={labelClass}>{t('profile.last_name')}</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>{t('profile.gym_name')}</label>
                <input type="text" value={gymName} onChange={(e) => setGymName(e.target.value)} placeholder={t('profile.gym_placeholder')} className={inputClass} />
              </div>
              <div className="flex gap-2.5">
                <div className="flex-1">
                  <label className={labelClass}>{t('profile.body_weight')}</label>
                  <input type="number" inputMode="decimal" min={1} max={499} step="0.1" value={bodyWeight} onChange={(e) => setBodyWeight(e.target.value)} placeholder={t('profile.body_weight_placeholder')} className={inputClass} />
                </div>
                <div className="flex-1">
                  <label className={labelClass}>{t('profile.height')}</label>
                  <input type="number" inputMode="decimal" min={1} max={299} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="175" className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>{t('profile.birth_date')}</label>
                <input type="text" inputMode="numeric" placeholder="DD/MM/AAAA" maxLength={10} value={birthDate} onChange={(e) => setBirthDate(maskDateBR(e.target.value))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('profile.sex')}</label>
                <div className="mt-1.5 flex gap-2.5">
                  {(['male', 'female'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSex(sex === option ? '' : option)}
                      className={cn(
                        'flex-1 rounded-[13px] border py-3 font-display text-base font-bold uppercase transition-colors',
                        sex === option ? 'border-ot-ink bg-ot-ink text-white' : 'border-ot-border bg-white dark:bg-ot-dark-card text-ot-muted'
                      )}
                    >
                      {t(`profile.sex_${option}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-auto flex flex-col gap-2.5 pt-6">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="w-full rounded-[15px] bg-ot-blue py-[17px] font-display text-2xl font-extrabold uppercase text-white transition-opacity"
              >
                {t('onboarding.continue')}
              </button>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full py-2 font-ot-mono text-[11px] tracking-[0.1em] text-ot-muted"
              >
                {t('onboarding.back')}
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="mt-6 font-display text-5xl font-extrabold uppercase leading-[0.9]">
              {t('onboarding.measures_title')}
            </h1>
            <p className="mt-2.5 font-ui text-sm font-medium text-ot-muted">
              {t('onboarding.measures_tagline')}
            </p>

            <div className="mt-6 flex flex-col gap-3.5">
              <div>
                <label className={labelClass}>{t('body_stats.neck')} (cm)</label>
                <input type="number" inputMode="decimal" min={1} max={99} value={neckCm} onChange={(e) => setNeckCm(e.target.value)} placeholder="38" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('body_stats.waist')} (cm)</label>
                <input type="number" inputMode="decimal" min={1} max={299} value={waistCm} onChange={(e) => setWaistCm(e.target.value)} placeholder="85" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('body_stats.hip')} (cm)</label>
                <input type="number" inputMode="decimal" min={1} max={299} value={hipCm} onChange={(e) => setHipCm(e.target.value)} placeholder="95" className={inputClass} />
              </div>
            </div>

            <div className="mt-auto flex flex-col gap-2.5 pt-6">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="w-full rounded-[15px] bg-ot-blue py-[17px] font-display text-2xl font-extrabold uppercase text-white transition-opacity"
              >
                {t('onboarding.continue')}
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full py-2 font-ot-mono text-[11px] tracking-[0.1em] text-ot-muted"
              >
                {t('onboarding.back')}
              </button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="mt-6 font-display text-5xl font-extrabold uppercase leading-[0.9]">
              {t('onboarding.photo_title')}
            </h1>
            <p className="mt-2.5 font-ui text-sm font-medium text-ot-muted">
              {t('profile.photo_help')}
            </p>

            <div className="mt-8 flex flex-col items-center gap-5">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="h-32 w-32 rounded-[28px] object-cover" />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-[28px] bg-ot-blue font-display text-[52px] font-extrabold text-white">
                  {(firstName[0] || user?.email?.[0] || '?').toUpperCase()}
                </div>
              )}
              <label className="cursor-pointer rounded-[13px] border border-ot-border bg-white dark:bg-ot-dark-card px-5 py-3 font-display text-base font-bold uppercase">
                {t('onboarding.choose_photo')}
                <input type="file" accept="image/*" onChange={handlePhotoChange} className="sr-only" />
              </label>
            </div>

            {error && (
              <div className="mt-4 rounded-[13px] border border-red-500/20 bg-red-500/10 p-3 font-ui text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="mt-auto flex flex-col gap-2.5 pt-6">
              <button
                type="button"
                onClick={() => handleFinish(true)}
                disabled={loading}
                className="w-full rounded-[15px] bg-ot-blue py-[17px] font-display text-2xl font-extrabold uppercase text-white transition-opacity disabled:opacity-60"
              >
                {loading ? t('common.loading') : t('onboarding.finish')}
              </button>
              <button
                type="button"
                onClick={() => handleFinish(false)}
                disabled={loading}
                className="w-full py-2 font-ot-mono text-[11px] tracking-[0.1em] text-ot-muted"
              >
                {t('onboarding.skip_photo')}
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={loading}
                className="w-full py-2 font-ot-mono text-[11px] tracking-[0.1em] text-ot-muted"
              >
                {t('onboarding.back')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
