/**
 * Hook: useFormatter — React hook wrapping formatting helpers with dynamic localization settings.
 */
import { useSettings } from '@/api/settings'
import { format } from 'date-fns'

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

export function useFormatter() {
  const { data: settings } = useSettings()
  const localization = settings?.localization

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
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return '—'

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
    const locale = localization?.number_format === 'indian' ? 'en-IN' : 'en-US'
    return new Intl.NumberFormat(locale).format(value)
  }

  // 3. Dynamic Currency / Money Formatter
  const formatCurrency = (amountMinor: number): string => {
    const currency = localization?.currency || 'USD'
    const locale = localization?.number_format === 'indian' ? 'en-IN' : 'en-US'
    const precision = localization?.decimal_precision ?? 2
    const position = localization?.currency_position || 'left'

    const amount = amountMinor / 100

    // Resolve the currency symbol dynamically using formatToParts
    let symbol = '$'
    try {
      const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(1)
      symbol = parts.find((p) => p.type === 'currency')?.value || symbol
    } catch {
      // fallback
    }

    // Format the number value itself
    const formattedNumber = new Intl.NumberFormat(locale, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    }).format(amount)

    // Apply the configured currency position layout
    switch (position) {
      case 'left_space':
        return `${symbol} ${formattedNumber}`
      case 'right':
        return `${formattedNumber}${symbol}`
      case 'right_space':
        return `${formattedNumber} ${symbol}`
      case 'left':
      default:
        return `${symbol}${formattedNumber}`
    }
  }

  return {
    formatDate,
    formatDateTime,
    formatTime,
    formatNumber,
    formatCurrency,
    localization,
  }
}
