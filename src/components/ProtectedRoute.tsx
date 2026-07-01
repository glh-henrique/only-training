import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { UserRole } from '../constants/auth'
import { Loading } from './ui/loading'

import type { Role } from '../types/auth'

interface ProtectedRouteProps {
  allowedRoles?: Role[]
  requireWorkoutManage?: boolean
}

export default function ProtectedRoute({ allowedRoles, requireWorkoutManage }: ProtectedRouteProps) {
  const { session, isLoading, role, hasActiveCoach } = useAuthStore()

  if (isLoading) {
    return <Loading fullPage />
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />
  }

  if (requireWorkoutManage) {
    const canManageWorkouts = role === UserRole.Instructor || (role === UserRole.Student && !hasActiveCoach)
    if (!canManageWorkouts) {
      return <Navigate to="/" replace />
    }
  }

  return <Outlet />
}
