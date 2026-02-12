export const USER_ROLES = ['aluno', 'instrutor'] as const

export type UserRole = (typeof USER_ROLES)[number]

export function parseUserRole(value: unknown): UserRole {
  return value === 'instrutor' ? 'instrutor' : 'aluno'
}
