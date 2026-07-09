import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { useAuthStore } from '../stores/useAuthStore'
import { supabaseProfileGateway } from '../gateways/supabaseProfileGateway'
import { ageFromBirthDate, basalMetabolicRate, bodyFatNavy } from '../lib/calories'
import { AppRoutes } from '../constants/routes'
import { BottomNav } from '../components/BottomNav'
import { Loading } from '../components/ui/loading'
import type { Database } from '../types/database.types'

type ProfileRow = Database['public']['Tables']['profiles']['Row']

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-ot-border py-3.5 last:border-b-0">
      <span className="font-display text-[18px] font-semibold leading-none">{label}</span>
      <span className="font-ot-mono text-[13px]" style={{ color: value === '—' ? '#9a9aa2' : undefined }}>{value}</span>
    </div>
  )
}

export default function BodyStats() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabaseProfileGateway.fetchProfile(user.id)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setIsLoading(false))
  }, [user])

  const weightKg = profile?.body_weight_kg ?? null
  const heightCm = profile?.height_cm ?? null
  const sex = profile?.sex === 'male' || profile?.sex === 'female' ? profile.sex : null
  const age = profile?.birth_date ? ageFromBirthDate(profile.birth_date) : null

  const bodyFat = weightKg && heightCm && sex && profile?.neck_cm && profile?.waist_cm
    ? bodyFatNavy({ sex, heightCm, neckCm: profile.neck_cm, waistCm: profile.waist_cm, hipCm: profile.hip_cm })
    : null
  const leanMassKg = bodyFat != null && weightKg ? weightKg * (1 - bodyFat / 100) : null
  const bmr = weightKg
    ? basalMetabolicRate({ weightKg, heightCm, age, sex, bodyFatPercent: bodyFat })
    : null

  const fmt = (value: number | null | undefined, unit: string, digits = 0) =>
    value != null ? `${value.toFixed(digits)} ${unit}` : '—'

  return (
    <div className="min-h-screen pb-28 font-ui" style={{ background: 'var(--color-ot-paper)', color: 'var(--color-ot-ink)' }}>
      <div className="flex items-center gap-3 px-6 pt-14">
        <button type="button" onClick={() => navigate(AppRoutes.Profile)} className="font-display text-lg font-bold">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-[30px] font-extrabold uppercase leading-none">{t('body_stats.title')}</h1>
      </div>

      {isLoading ? (
        <Loading fullPage />
      ) : (
        <div className="mt-6 px-6">
          <div className="rounded-2xl border border-ot-border bg-white dark:bg-ot-dark-card px-4">
            <StatRow label={t('body_stats.weight')} value={fmt(weightKg, 'kg', 1)} />
            <StatRow label={t('body_stats.height')} value={fmt(heightCm, 'cm')} />
            <StatRow label={t('body_stats.neck')} value={fmt(profile?.neck_cm, 'cm')} />
            <StatRow label={t('body_stats.waist')} value={fmt(profile?.waist_cm, 'cm')} />
            <StatRow label={t('body_stats.hip')} value={fmt(profile?.hip_cm, 'cm')} />
            <StatRow label={t('body_stats.body_fat')} value={bodyFat != null ? `${bodyFat.toFixed(1)} %` : '—'} />
            <StatRow label={t('body_stats.lean_mass')} value={fmt(leanMassKg, 'kg', 1)} />
            <StatRow label={t('body_stats.bmr')} value={bmr != null ? `${Math.round(bmr)} ${t('body_stats.bmr_unit')}` : '—'} />
          </div>

          <p className="mt-4 font-ot-mono text-[10px] leading-relaxed tracking-[0.04em]" style={{ color: '#9a9aa2' }}>
            {t('body_stats.hint')}
          </p>

          <button
            type="button"
            onClick={() => navigate(AppRoutes.Onboarding)}
            className="mt-5 w-full rounded-[15px] border border-ot-border bg-white dark:bg-ot-dark-card py-3.5 font-display text-lg font-bold uppercase"
          >
            {t('body_stats.edit')}
          </button>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
