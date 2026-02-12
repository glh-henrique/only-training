import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { Button } from '../components/ui/button'

export default function About() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const appVersion = __APP_VERSION__

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white pb-20">
      <header className="p-4 flex items-center gap-4 sticky top-0 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md z-10 border-b border-neutral-200 dark:border-neutral-800">
        <Button variant="ghost" size="icon" onClick={() => navigate('/profile')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{t('about.title')}</h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('about.version', { version: appVersion })}</p>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        <section className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-3">
          <h2 className="text-lg font-semibold">{t('about.headline')}</h2>
          <p className="text-sm leading-6 text-neutral-600 dark:text-neutral-300">{t('about.description')}</p>
        </section>
      </main>
    </div>
  )
}
