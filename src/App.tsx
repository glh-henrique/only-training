import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import RegisterConfirmation from './pages/RegisterConfirmation'
import WorkoutSession from './pages/WorkoutSession'
import WorkoutEditor from './pages/WorkoutEditor'
import History from './pages/History'
import ArchivedWorkouts from './pages/ArchivedWorkouts'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import { useWorkoutStore } from './stores/useWorkoutStore'
import { WifiOff } from 'lucide-react'
import { useState, useEffect } from 'react'
import Profile from './pages/Profile'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuthStore } from './stores/useAuthStore'
import { useThemeStore } from './stores/useThemeStore'
import { useSessionStore } from './stores/useSessionStore'
import { useTranslation } from 'react-i18next'
import { useWorkoutMonitor } from './hooks/useWorkoutMonitor'

function App() {
  const { t } = useTranslation()
  useWorkoutMonitor()
  const { initialize, session } = useAuthStore()
  const { theme } = useThemeStore()
  const { processSyncQueue } = useWorkoutStore()
  const { finishSession } = useSessionStore()

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
          <Route path="/workout/:workoutId/edit" element={<WorkoutEditor />} />
          <Route path="/history" element={<History />} />
          <Route path="/archive" element={<ArchivedWorkouts />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>

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
