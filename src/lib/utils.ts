import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
export { getSafeExternalUrl } from "../core"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely extracts a human-readable message from an unknown error value.
 * Use in `catch (err: unknown)` blocks instead of `catch (err: any)`.
 */
// ── Data em formato brasileiro (DD/MM/AAAA) ↔ ISO (YYYY-MM-DD) ──

/** Máscara progressiva de digitação: "25121990" → "25/12/1990" */
export function maskDateBR(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

/** "25/12/1990" → "1990-12-25"; inválida/incompleta → null */
export function brDateToIso(value: string): string | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  const [, dd, mm, yyyy] = match
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  const isReal = date.getFullYear() === Number(yyyy) && date.getMonth() === Number(mm) - 1 && date.getDate() === Number(dd)
  return isReal ? `${yyyy}-${mm}-${dd}` : null
}

/** "1990-12-25" → "25/12/1990" */
export function isoDateToBr(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return ''
  const [, yyyy, mm, dd] = match
  return `${dd}/${mm}/${yyyy}`
}

export function getErrorMessage(error: unknown, fallback = 'Unexpected error'): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return fallback
}
