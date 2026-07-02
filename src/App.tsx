import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
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
import { AppRoutes } from './constants/routes'
import { UserRole } from './constants/auth'

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
const CoachPanel = lazy(() => import('./pages/CoachPanel'))
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'))
const CoachStudentWorkouts = lazy(() => import('./pages/CoachStudentWorkouts'))
const CoachInvites = lazy(() => import('./pages/CoachInvites'))
const CoachUnlinkRequests = lazy(() => import('./pages/CoachUnlinkRequests'))
const About = lazy(() => import('./pages/About'))
const WorkoutCoach = lazy(() => import('./pages/WorkoutCoach'))
const Workouts = lazy(() => import('./pages/Workouts'))

function App() {
  const { t } = useTranslation()
  const location = useLocation()
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
  }, [processSessionSyncQueue, processSyncQueue])

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
    root.style.setProperty('color-scheme', theme)
  }, [theme])

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white font-sans antialiased transition-colors duration-300">
      <Suspense fallback={<Loading fullPage />}>
        {/* key remonta o wrapper a cada rota, reiniciando a animação de entrada */}
        <div key={location.pathname} className="ot-page-enter">
        <Routes>
          {/* Public routes */}
          <Route path={AppRoutes.Login} element={!session ? <Login /> : <Navigate to="/" />} />
          <Route path={AppRoutes.Register} element={!session ? <Register /> : <Navigate to="/" />} />
          <Route path={AppRoutes.RegisterConfirmation} element={<RegisterConfirmation />} />
          <Route path={AppRoutes.ForgotPassword} element={<ForgotPassword />} />
          <Route path={AppRoutes.ResetPassword} element={<ResetPassword />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path={AppRoutes.Home} element={<Home />} />
            <Route path={AppRoutes.Workouts} element={<Workouts />} />
            <Route path="/workout/:workoutId" element={<WorkoutSession />} />
            <Route path={AppRoutes.History} element={<History />} />
            <Route path={AppRoutes.Archive} element={<ArchivedWorkouts />} />
            <Route path={AppRoutes.AICoach} element={<WorkoutCoach />} />
            <Route path={AppRoutes.Profile} element={<Profile />} />
            <Route path={AppRoutes.About} element={<About />} />
            <Route path={AppRoutes.AcceptInvite} element={<AcceptInvite />} />
          </Route>

          <Route element={<ProtectedRoute requireWorkoutManage />}>
            <Route path="/workout/:workoutId/edit" element={<WorkoutEditor />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={[UserRole.Instructor]} />}>
            <Route path={AppRoutes.CoachPanel} element={<CoachPanel />} />
            <Route path={AppRoutes.CoachStudentWorkouts} element={<CoachStudentWorkouts />} />
            <Route path={AppRoutes.CoachInvites} element={<CoachInvites />} />
            <Route path={AppRoutes.CoachUnlinkRequests} element={<CoachUnlinkRequests />} />
          </Route>
        </Routes>
        </div>
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
