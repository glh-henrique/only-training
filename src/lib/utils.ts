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
export function getErrorMessage(error: unknown, fallback = 'Unexpected error'): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return fallback
}
