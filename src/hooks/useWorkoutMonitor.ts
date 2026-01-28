import { useEffect, useRef } from 'react'
import { useSessionStore } from '../stores/useSessionStore'
import { useTranslation } from 'react-i18next'

export function useWorkoutMonitor() {
  const { t } = useTranslation()
  const { duration, currentSession, hasNotifiedLongWorkout, setHasNotifiedLongWorkout } = useSessionStore()
  const permissionRequested = useRef(false)

  // Request notification permission on mount
  useEffect(() => {
    if (!permissionRequested.current && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission()
      }
      permissionRequested.current = true
    }
  }, [])

  useEffect(() => {
    // Check if workout >= 1 hour (3600 seconds)
    if (currentSession && duration >= 3600 && !hasNotifiedLongWorkout) {
      
      // If document is hidden (background), send browser notification
      if (document.visibilityState === 'hidden') {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('OnlyTraining', {
            body: t('session.long_workout_notification', 'Seu treino já dura mais de 1 hora!'),
            icon: '/favicon.png'
          })
          setHasNotifiedLongWorkout(true)
        }
      } else {
        // If visible, we don't setHasNotifiedLongWorkout(true) here
        // The Home component will handle the pop-up and set the flag once acknowledged or seen
      }
    }
  }, [duration, currentSession, hasNotifiedLongWorkout, setHasNotifiedLongWorkout, t])
}
