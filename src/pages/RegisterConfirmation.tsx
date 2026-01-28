import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui/button'
import { CheckCircle } from 'lucide-react'

export default function RegisterConfirmation() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-emerald-500/10 p-4">
            <CheckCircle className="h-12 w-12 text-emerald-500" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h2 className="text-3xl font-bold">{t('auth.register.confirm_title', 'Check your email')}</h2>
          <p className="text-neutral-400">
            {t('auth.register.confirm_desc', 'We\'ve sent a confirmation link to your email address. Please click the link to verify your account.')}
          </p>
        </div>

        <div className="pt-4">
          <Button asChild className="w-full">
            <Link to="/login">{t('auth.register.back_to_login', 'Back to Sign In')}</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
