import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
export { getSafeExternalUrl } from "../core"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
