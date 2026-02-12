import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import type { UserRole } from '../types/auth'

interface ProtectedRouteProps {
  allowedRoles?: UserRole[]
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { session, isLoading, role } = useAuthStore()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white transition-colors">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
