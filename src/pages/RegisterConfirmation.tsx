import { useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mail } from 'lucide-react'

export default function RegisterConfirmation() {
  const { t } = useTranslation()
  const location = useLocation()
  const email = (location.state as { email?: string } | null)?.email ?? ''

  return (
    <div className="min-h-screen bg-ot-paper font-ui flex flex-col items-center justify-center px-6 pb-10 pt-12">
      {/* Brand mark */}
      <div className="flex items-center gap-2.5 mb-12">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ot-blue">
          <div className="h-3.5 w-3.5 rounded-full border-[3px] border-white" />
        </div>
        <span className="font-ot-mono text-xs tracking-[0.3em] text-ot-ink">ONLY TRAINING</span>
      </div>

      {/* Icon */}
      <div className="relative mb-8">
        <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-ot-blue">
          <Mail className="h-11 w-11 text-white" strokeWidth={1.5} />
        </div>
        {/* Animated dot ring */}
        <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-ot-success">
          <svg viewBox="0 0 12 12" className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <polyline points="1.5,6 4.5,9 10.5,3" />
          </svg>
        </div>
      </div>

      {/* Headline */}
      <h1 className="font-display text-[44px] font-extrabold uppercase leading-[0.95] tracking-tight text-ot-ink text-center">
        {t('auth.confirm.headline')}
      </h1>

      {/* Subtext */}
      <p className="mt-4 max-w-[280px] text-center font-ui text-sm leading-relaxed text-ot-muted">
        {t('auth.confirm.desc')}
      </p>

      {/* Email pill */}
      {email && (
        <div className="mt-5 rounded-full border border-ot-border bg-white px-5 py-2.5">
          <span className="font-ot-mono text-sm font-bold tracking-wide text-ot-ink">{email}</span>
        </div>
      )}

      {/* Steps */}
      <div className="mt-10 w-full max-w-sm space-y-3">
        {[
          t('auth.confirm.step1'),
          t('auth.confirm.step2'),
          t('auth.confirm.step3'),
        ].map((step, i) => (
          <div key={i} className="flex items-start gap-3 rounded-2xl border border-ot-border bg-white p-4">
            <div className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-ot-blue text-white font-ot-mono text-[11px] font-bold">
              {i + 1}
            </div>
            <span className="text-sm leading-snug text-ot-ink">{step}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-8 w-full max-w-sm">
        <Link
          to="/login"
          className="block w-full rounded-[15px] bg-ot-blue py-[17px] text-center font-display text-2xl font-extrabold uppercase text-white transition-opacity hover:opacity-90"
        >
          {t('auth.confirm.back_to_login')}
        </Link>
      </div>

      {/* Hint */}
      <p className="mt-5 text-center font-ui text-xs text-ot-faint">
        {t('auth.confirm.no_email')}{' '}
        <button className="font-bold text-ot-blue underline-offset-2 hover:underline">
          {t('auth.confirm.resend')}
        </button>
      </p>
    </div>
  )
}
