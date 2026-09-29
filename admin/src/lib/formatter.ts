/**
 * Hook: useFormatter — React hook wrapping formatting helpers with dynamic localization settings.
 */
import { useSettings } from '@/api/settings'
import { format } from 'date-fns'

export { formatGender } from './constants'
// Helper to translate PHP datetime format tokens to date-fns format tokens
function formatPHPDateTime(d: Date, phpFormat: string): string {
  let result = ''
  for (let i = 0; i < phpFormat.length; i++) {
    const char = phpFormat[i] || ''
    switch (char) {
      case 'd': result += 'dd'; break
      case 'j': result += 'd'; break
      case 'm': result += 'MM'; break
      case 'F': result += 'MMMM'; break
      case 'M': result += 'MMM'; break
      case 'Y': result += 'yyyy'; break
      case 'D': result += 'EEE'; break
      case 'H': result += 'HH'; break
      case 'h': result += 'hh'; break
      case 'g': result += 'h'; break
      case 'i': result += 'mm'; break
      case 's': result += 'ss'; break
      case 'A': result += 'a'; break
      case 'a': result += 'a'; break
      default:
        if (/[a-zA-Z]/.test(char)) {
          result += `'${char}'`
        } else {
          result += char
        }
    }
  }

  const formatted = format(d, result)
  if (phpFormat.includes('a') && !phpFormat.includes('A')) {
    return formatted.toLowerCase()
  }
  return formatted
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
