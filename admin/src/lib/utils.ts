import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges class names, resolving Tailwind CSS conflicts.
 * Drop-in replacement for clsx() with Tailwind-aware deduplication.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}



/**
 * Generates a display name from first + last name parts.
 */
export function fullName(
  first: string | null | undefined,
  last: string | null | undefined,
  preferred?: string | null
): string {
  if (preferred) return preferred
  const parts = [first, last].filter(Boolean)
  return parts.join(' ') || '—'
}

/**
 * Returns initials from a display name (up to 2 characters).
 */
export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}




/**
 * Truncates text to a maximum character count with an ellipsis.
 */
export function truncate(text: string, max = 60): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

/**
 * Returns custom container or falls back to #codeclove-portal-root for dialogs/popovers in portal.
 */
export function getPortalContainer(container?: HTMLElement | null): HTMLElement | undefined {
  return container ?? (typeof document !== 'undefined' ? document.getElementById('codeclove-portal-root') || undefined : undefined)
}
