/**
 * Hook: useFormatter — React hook wrapping formatting helpers with dynamic localization settings.
 */
import { useSettings, type LocalizationSettings } from '@/api/settings'
import { format } from 'date-fns'
import { getCurrencySymbol } from './currencies'
export { formatGender } from './constants'
const PHP_TO_DATE_FNS: Record<string, string> = {
  d: 'dd', j: 'd', m: 'MM', n: 'M', F: 'MMMM', M: 'MMM',
  Y: 'yyyy', y: 'yy', D: 'EEE', l: 'EEEE',
  H: 'HH', h: 'hh', G: 'H', g: 'h', i: 'mm', s: 'ss', A: 'a', a: 'a',
}

export function formatPHPDateTime(d: Date, phpFormat: string): string {
  const pattern = phpFormat.replace(/[a-zA-Z]/g, (tok) => PHP_TO_DATE_FNS[tok] || `'${tok}'`)
  const formatted = format(d, pattern)
  return phpFormat.includes('a') && !phpFormat.includes('A') ? formatted.toLowerCase() : formatted
}

const regionNames = typeof Intl !== 'undefined' && Intl.DisplayNames ? new Intl.DisplayNames(['en'], { type: 'region' }) : null

export function formatCountry(codeOrName: unknown): string | undefined {
  if (typeof codeOrName !== 'string' || !codeOrName.trim()) return undefined
  const c = codeOrName.trim()
  if (c.length === 2 && regionNames) {
    try {
      return regionNames.of(c.toUpperCase()) || c
    } catch {
      return c
    }
  }
  return c
}

export function calculateAge(
  dateOfBirth: string | Date | null | undefined,
  ref: Date = new Date()
): number | null {
  if (!dateOfBirth) return null
  const dob = typeof dateOfBirth === 'string'
    ? new Date(dateOfBirth.length === 10 ? `${dateOfBirth}T00:00:00` : dateOfBirth)
    : dateOfBirth
  if (isNaN(dob.getTime())) return null

  const m = ref.getMonth() - dob.getMonth()
  const age = ref.getFullYear() - dob.getFullYear() - (m < 0 || (m === 0 && ref.getDate() < dob.getDate()) ? 1 : 0)
  return age >= 0 ? age : null
}
export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return ''
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
export function useFormatter() {
  const { data: settings } = useSettings()
  const localization = settings?.localization ?? (globalThis.window?.CodeCloveConfig?.localization as LocalizationSettings | undefined)
  const locale = localization?.number_format === 'indian' ? 'en-IN' : localization?.number_format === 'european' ? 'de-DE' : 'en-US'

  // 1. Dynamic Date Formatter
  const formatDate = (date: string | Date | null | undefined): string => {
    if (!date) return '—'
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return '—'

    const dateFormat = localization?.date_format || 'd/m/Y'
    try {
      return formatPHPDateTime(d, dateFormat)
    } catch {
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }
  }

  // 2. Dynamic Time / DateTime Formatter
  const formatDateTime = (date: string | Date | null | undefined): string => {
    if (!date) return '—'
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return '—'

    const dateFormat = localization?.date_format || 'd/m/Y'
    const timeFormat = localization?.time_format || 'H:i'
    const combinedFormat = `${dateFormat} ${timeFormat}`

    try {
      return formatPHPDateTime(d, combinedFormat)
    } catch {
      return d.toLocaleString('en-GB')
    }
  }

  // 3. Dynamic Time Formatter
  const formatTime = (date: string | Date | null | undefined): string => {
    if (!date) return '—'
    const d = typeof date === 'string' && /^\d{1,2}:\d{2}/.test(date)
      ? new Date(`1970-01-01T${date.length === 5 ? `${date}:00` : date.slice(0, 8)}`)
      : (typeof date === 'string' ? new Date(date) : date)
    if (!d || isNaN(d.getTime())) return '—'

    const timeFormat = localization?.time_format || 'H:i'
    try {
      return formatPHPDateTime(d, timeFormat)
    } catch {
      return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    }
  }

  // 4. Dynamic Number Formatter (Indian or standard grouping)
  const formatNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '0'
    return new Intl.NumberFormat(locale).format(value)
  }

  // 5. Dynamic Currency / Money Formatter
  const formatCurrency = (amountMinor: number): string => {
    const currency = localization?.currency || 'USD'
    const precision = localization?.decimal_precision ?? 2
    const position = localization?.currency_position || 'left'

    const amount = amountMinor / 100

    // Resolve the currency symbol dynamically using formatToParts or lookup
    let symbol = '$'
    try {
      const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(1)
      const found = parts.find((p) => p.type === 'currency')?.value
      if (found && found !== currency) {
        symbol = found
      } else {
        symbol = getCurrencySymbol(currency) || found || currency
      }
    } catch {
      symbol = getCurrencySymbol(currency) || currency
    }

    // Format the number value itself
    const formattedNumber = new Intl.NumberFormat(locale, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    }).format(amount)

    const isCompound = symbol.length > 1 || /[a-zA-Z]/.test(symbol)
    const sep = position.includes('space') || (isCompound && !symbol.endsWith(' ')) ? ' ' : ''

    // Apply the configured currency position layout
    switch (position) {
      case 'right':
        return isCompound ? `${formattedNumber} ${symbol}` : `${formattedNumber}${symbol}`
      case 'right_space':
        return `${formattedNumber} ${symbol}`
      case 'left_space':
        return `${symbol} ${formattedNumber}`
      case 'left':
      default:
        return `${symbol}${sep}${formattedNumber}`
    }
  }
  return {
    formatDate,
    formatDateTime,
    formatTime,
    formatNumber,
    formatCurrency,
    formatBytes,
    localization,
  }
}

export type Formatter = ReturnType<typeof useFormatter>
