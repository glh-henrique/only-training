import { UserRole } from '../constants/auth'

export const USER_ROLES = [UserRole.Student, UserRole.Instructor] as const

export type Role = typeof USER_ROLES[number]

export function validateRole(value: string | null): Role {
  return value === UserRole.Instructor ? UserRole.Instructor : UserRole.Student
}
