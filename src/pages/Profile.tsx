import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { useThemeStore } from '../stores/useThemeStore'
import { useWorkoutStore } from '../stores/useWorkoutStore'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui/button'
import { AlertModal } from '../components/ui/alert-modal'
import { cn } from '../lib/utils'
import { 
  Mail, 
  ShieldCheck, 
  ShieldAlert, 
  Moon, 
  Sun, 
  LogOut, 
  KeyRound, 
  ArrowLeft,
  Archive,
  Globe
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useState, useEffect } from 'react'

export default function Profile() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, signOut, role } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const { archivedCount, fetchWorkouts } = useWorkoutStore()
  const [resetSent, setResetSent] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  useEffect(() => {
    fetchWorkouts()
  }, [fetchWorkouts])

  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    variant: 'info' | 'success' | 'warning' | 'danger';
  }>({ isOpen: false, title: '', description: '', variant: 'info' })


  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const handleResetPassword = async () => {
    if (!user?.email) return
    setIsResetting(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/#/login`,
      })
      if (error) throw error
      setAlertConfig({
        isOpen: true,
        variant: 'success',
        title: t('profile.reset_email_sent_title'),
        description: t('profile.reset_email_sent_desc')
      })
      setResetSent(true)
    } catch (error: any) {
      setAlertConfig({
        isOpen: true,
        variant: 'danger',
        title: t('profile.reset_error_title'),
        description: error.message
      })
    } finally {
      setIsResetting(false)
    }
  }

  const isVerified = !!user?.email_confirmed_at

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white pb-20">
      {/* Header */}
      <header className="p-4 flex items-center gap-4 sticky top-0 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md z-10 border-b border-neutral-200 dark:border-neutral-800">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">{t('profile.title')}</h1>
      </header>

      <main className="p-4 space-y-8 max-w-lg mx-auto">
        {/* User Info Card */}
        <section className="flex flex-col items-center py-6 space-y-4">
          <div className="h-24 w-24 bg-emerald-500 rounded-full flex items-center justify-center text-4xl font-bold text-white shadow-xl shadow-emerald-500/20">
            {(user?.user_metadata?.full_name?.[0] || user?.email?.[0]).toUpperCase()}
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold">{user?.user_metadata?.full_name || user?.email?.split('@')[0]}</h2>
            <p className="text-neutral-500 dark:text-neutral-400 flex items-center justify-center gap-1.5 mt-1">
              <Mail className="h-4 w-4" />
              {user?.email}
            </p>
          </div>
        </section>

        {/* Account Details */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-1">{t('profile.account')}</h3>
          <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{t('profile.verification_status')}</p>
                  <p className="text-xs text-neutral-500">{t('profile.verification_desc')}</p>
                </div>
              </div>
              {isVerified ? (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                  <ShieldCheck className="h-3 w-3" />
                  {t('profile.verified')}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full">
                  <ShieldAlert className="h-3 w-3" />
                  {t('profile.not_verified')}
                </span>
              )}
            </div>

            <div className="p-4 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800">
              <p className="font-semibold">{t('profile.account_type')}</p>
              <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                {role === 'instrutor' ? t('auth.register.role_instructor') : t('auth.register.role_student')}
              </span>
            </div>
            
            <button 
              onClick={() => navigate('/archive')}
              className="w-full p-4 flex items-center justify-between hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors border-t border-neutral-200 dark:border-neutral-800 group"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Archive className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="font-semibold">{t('workouts.archived', 'Archived Workouts')}</p>
                  <p className="text-xs text-neutral-500">
                    {t('workouts.count', { count: archivedCount })}
                  </p>
                </div>
              </div>
            </button>
          </div>
        </section>

        {/* Security Section */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-1">{t('profile.security')}</h3>
          <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{t('profile.password_label')}</p>
                  <p className="text-xs text-neutral-500">{t('profile.password_desc')}</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleResetPassword}
                disabled={isResetting || resetSent}
                className="text-xs"
              >
                {resetSent ? t('profile.reset_password_sent') : isResetting ? t('common.loading') : t('profile.reset_password')}
              </Button>
            </div>
          </div>
        </section>

        {/* System Settings */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-1">{t('profile.system')}</h3>
          <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
            <button 
              onClick={() => toggleTheme()}
              type="button"
              className="w-full p-4 flex items-center justify-between hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-purple-500/10 text-purple-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  {theme === 'dark' ? <Moon className="h-5 w-5 fill-current" /> : <Sun className="h-5 w-5" />}
                </div>
                <div className="text-left">
                  <p className="font-semibold text-neutral-900 dark:text-white">{t('profile.theme')}</p>
                </div>
              </div>
              <div className={`h-6 w-11 rounded-full relative p-1 transition-colors ${theme === 'dark' ? 'bg-emerald-600' : 'bg-neutral-300'}`}>
                <div className={`h-4 w-4 bg-white rounded-full shadow-sm transform transition-transform duration-200 ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
            </button>

            <div className="p-4 flex items-center justify-between border-t border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center">
                      <Globe className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold">{t('profile.language')}</p>
                    </div>
                </div>
                <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <button 
                        onClick={() => i18n.changeLanguage('en')}
                        className={cn(
                            "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                            i18n.language.startsWith('en') ? "bg-white dark:bg-neutral-700 text-emerald-600 shadow-sm" : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                        )}
                    >
                        EN
                    </button>
                    <button 
                        onClick={() => i18n.changeLanguage('pt')}
                        className={cn(
                            "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                            i18n.language.startsWith('pt') ? "bg-white dark:bg-neutral-700 text-emerald-600 shadow-sm" : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                        )}
                    >
                        PT
                    </button>
                </div>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="pt-4">
          <Button 
            variant="ghost" 
            className="w-full py-6 text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-2xl flex items-center justify-center gap-2 font-bold"
            onClick={handleSignOut}
          >
            <LogOut className="h-5 w-5" />
            {t('common.logout')}
          </Button>
        </section>
      </main>

      <AlertModal
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
        title={alertConfig.title}
        description={alertConfig.description}
        variant={alertConfig.variant}
      />
    </div>
  )
}
