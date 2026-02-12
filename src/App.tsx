import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense, useState, useEffect } from 'react'
import { useWorkoutStore } from './stores/useWorkoutStore'
import { WifiOff } from 'lucide-react'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuthStore } from './stores/useAuthStore'
import { useThemeStore } from './stores/useThemeStore'
import { useSessionStore } from './stores/useSessionStore'
import { useTranslation } from 'react-i18next'
import { useWorkoutMonitor } from './hooks/useWorkoutMonitor'
import { Loading } from './components/ui/loading'

const Home = lazy(() => import('./pages/Home'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const RegisterConfirmation = lazy(() => import('./pages/RegisterConfirmation'))
const WorkoutSession = lazy(() => import('./pages/WorkoutSession'))
const WorkoutEditor = lazy(() => import('./pages/WorkoutEditor'))
const History = lazy(() => import('./pages/History'))
const ArchivedWorkouts = lazy(() => import('./pages/ArchivedWorkouts'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Profile = lazy(() => import('./pages/Profile'))

function App() {
  const { t } = useTranslation()
  useWorkoutMonitor()
  const { initialize, session } = useAuthStore()
  const { theme } = useThemeStore()
  const { processSyncQueue } = useWorkoutStore()
  const { finishSession, processSyncQueue: processSessionSyncQueue } = useSessionStore()

  useEffect(() => {
    // Listen for messages from service worker
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'FINISH_WORKOUT') {
        finishSession()
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [finishSession])
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false)
      processSyncQueue()
      processSessionSyncQueue()
    }
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [processSyncQueue])

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
    root.style.setProperty('color-scheme', theme)
  }, [theme])

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white font-sans antialiased transition-colors duration-300">
      <Suspense fallback={<Loading fullPage />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
          <Route path="/register" element={!session ? <Register /> : <Navigate to="/" />} />
          <Route path="/register-confirmation" element={<RegisterConfirmation />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Home />} />
            <Route path="/workout/:workoutId" element={<WorkoutSession />} />
            <Route path="/history" element={<History />} />
            <Route path="/archive" element={<ArchivedWorkouts />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['instrutor']} />}>
            <Route path="/workout/:workoutId/edit" element={<WorkoutEditor />} />
          </Route>
        </Routes>
      </Suspense>

      {isOffline && (
        <div className="fixed bottom-4 left-4 right-4 bg-amber-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center justify-between z-50 animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3">
            <WifiOff className="h-5 w-5" />
            <div className="text-sm">
              <p className="font-bold">{t('common.status.offline')}</p>
              <p className="opacity-90">{t('home.ready')} (Offline Mode)</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
