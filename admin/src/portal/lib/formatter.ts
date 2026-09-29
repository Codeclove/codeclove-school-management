/**
 * Portal Formatting Utilities.
 *
 * Integrates dynamic localization settings (date_format, time_format, currency,
 * currency_position, number_format) configured in the CodeClove backend.
 */

import { format as dateFnsFormat } from 'date-fns'
import type { PortalLocalization } from '../types'

const PHP_TO_DATE_FNS: Record<string, string> = {
  d: 'dd', j: 'd', m: 'MM', n: 'M', F: 'MMMM', M: 'MMM',
  Y: 'yyyy', y: 'yy', D: 'EEE', l: 'EEEE',
  H: 'HH', h: 'hh', G: 'H', g: 'h', i: 'mm', s: 'ss', A: 'a', a: 'a',
}

// Translate PHP datetime format tokens to date-fns format tokens
export function formatPHPDateTime(d: Date, phpFormat: string): string {
  const pattern = phpFormat.replace(/[a-zA-Z]/g, (tok) => PHP_TO_DATE_FNS[tok] || `'${tok}'`)
  const formatted = dateFnsFormat(d, pattern)
  return phpFormat.includes('a') && !phpFormat.includes('A') ? formatted.toLowerCase() : formatted
}

function getActiveLocalization(): PortalLocalization | undefined {
  return typeof window !== 'undefined' ? window.CodeClovePortalConfig?.settings?.localization : undefined
}

export function getCleanLocale(): string | undefined {
  const raw = window.CodeClovePortalConfig?.locale || window.CodeCloveConfig?.locale
  if (!raw) return undefined
  return raw.replace(/_/g, '-')
}

export function formatDate(
  date: string | Date | null | undefined,
  customFormat?: string
): string {
  if (!date) return '—'
  const d = typeof date === 'string'
    ? (/^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00`) : new Date(date))
    : date
  if (isNaN(d.getTime())) return '—'

  const loc = getActiveLocalization()
  const phpFormat = customFormat ?? loc?.date_format

  if (phpFormat) {
    try {
      return formatPHPDateTime(d, phpFormat)
    } catch {
      // fallback below
    }
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function formatTime(
  timeStr: string | Date | null | undefined,
  customFormat?: string
): string {
  if (!timeStr) return '—'

  const loc = getActiveLocalization()
  const phpFormat = customFormat ?? loc?.time_format
  const is24Hour = phpFormat ? phpFormat.includes('H') || (!phpFormat.includes('h') && !phpFormat.includes('g') && !phpFormat.includes('A') && !phpFormat.includes('a')) : false

  // If timeStr is already in "HH:MM" or "HH:MM:SS" format
  if (typeof timeStr === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(timeStr)) {
    const parts = timeStr.split(':')
    const hours = parseInt(parts[0] ?? '0', 10)
    const minutes = parseInt(parts[1] ?? '0', 10)

    if (is24Hour) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    }

    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    const displayMinutes = String(minutes).padStart(2, '0')
    return `${displayHours}:${displayMinutes} ${period}`
  }

  const d = typeof timeStr === 'string' ? new Date(timeStr) : timeStr
  if (!isNaN(d.getTime())) {
    if (phpFormat) {
      try {
        return formatPHPDateTime(d, phpFormat)
      } catch {
        // fallback below
      }
    }
    return new Intl.DateTimeFormat('en-US', {
      hour: is24Hour ? '2-digit' : 'numeric',
      minute: '2-digit',
      hour12: !is24Hour,
    }).format(d)
  }

  return typeof timeStr === 'string' ? timeStr : '—'
}

export function formatCurrency(
  amount: number | null | undefined,
  customCurrency?: string,
  customLoc?: PortalLocalization
): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '—'

  const loc = customLoc ?? getActiveLocalization()
  const currency = customCurrency ?? loc?.currency ?? 'USD'
  const locale = loc?.number_format === 'indian' ? 'en-IN' : 'en-US'
  const precision = loc?.decimal_precision ?? 2
  const position = loc?.currency_position ?? 'left'

  try {
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    }).format(amount)

    const symbol = new Intl.NumberFormat(locale, { style: 'currency', currency })
      .formatToParts(1)
      .find((p) => p.type === 'currency')?.value || '$'

    const sep = position.includes('space') ? ' ' : ''
    return position.startsWith('right') ? `${formatted}${sep}${symbol}` : `${symbol}${sep}${formatted}`
  } catch {
    return `$${amount.toFixed(2)}`
  }
}

export function formatNumber(
  value: number | null | undefined,
  customLoc?: PortalLocalization
): string {
  if (value === null || value === undefined || isNaN(value)) return '0'
  const loc = customLoc ?? getActiveLocalization()
  const locale = loc?.number_format === 'indian' ? 'en-IN' : 'en-US'
  return new Intl.NumberFormat(locale).format(value)
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function formatAddress(address: unknown): string {
  if (!address) return 'No residential address on file'
  if (typeof address === 'string') return address
  if (typeof address === 'object' && address !== null) {
    const record = address as Record<string, unknown>
    const parts = [
      record.address_line1,
      record.address_line2,
      record.city,
      record.state,
      record.postal_code,
      record.country,
    ].filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    return parts.length > 0 ? parts.join(', ') : 'No residential address on file'
  }
  return 'No residential address on file'
}

export { formatGender } from '@/lib/formatter'
