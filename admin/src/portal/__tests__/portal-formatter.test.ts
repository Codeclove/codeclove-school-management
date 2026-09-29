import { describe, expect, it } from 'vitest'
import { formatCurrency, formatDate, formatNumber, formatTime, getInitials } from '../lib/formatter'

describe('Portal Formatter Utilities', () => {
  describe('formatDate', () => {
    it('formats valid ISO date string correctly', () => {
      const result = formatDate('2026-09-07')
      expect(result).toContain('2026')
      expect(result).toContain('Sep')
      expect(result).toContain('7')
    })

    it('handles null, undefined, and empty string safely', () => {
      expect(formatDate(null)).toBe('—')
      expect(formatDate(undefined)).toBe('—')
      expect(formatDate('')).toBe('—')
    })

    it('returns fallback for invalid date strings', () => {
      expect(formatDate('invalid-date')).toBe('—')
    })

    it('formats date using custom PHP format string', () => {
      expect(formatDate('2026-09-07', 'd/m/Y')).toBe('07/09/2026')
      expect(formatDate('2026-09-07', 'Y-m-d')).toBe('2026-09-07')
      expect(formatDate('2026-09-07', 'm/d/Y')).toBe('09/07/2026')
    })
  })

  describe('formatTime', () => {
    it('formats HH:MM 24-hour time to 12-hour AM/PM format', () => {
      expect(formatTime('08:30')).toBe('8:30 AM')
      expect(formatTime('13:45')).toBe('1:45 PM')
      expect(formatTime('00:00')).toBe('12:00 AM')
      expect(formatTime('12:00')).toBe('12:00 PM')
    })

    it('handles null or undefined safely', () => {
      expect(formatTime(null)).toBe('—')
      expect(formatTime(undefined)).toBe('—')
    })

    it('formats time in 24-hour format when H:i is specified', () => {
      expect(formatTime('08:30', 'H:i')).toBe('08:30')
      expect(formatTime('13:45', 'H:i')).toBe('13:45')
      expect(formatTime('00:00', 'H:i')).toBe('00:00')
    })
  })

  describe('formatCurrency', () => {
    it('formats monetary amounts with standard currency symbol and 2 decimals', () => {
      const formatted = formatCurrency(1250.5, 'USD')
      expect(formatted).toContain('1,250.50')
      expect(formatted).toContain('$')
    })

    it('handles null, undefined, and NaN safely', () => {
      expect(formatCurrency(null)).toBe('—')
      expect(formatCurrency(undefined)).toBe('—')
      expect(formatCurrency(NaN)).toBe('—')
    })

    it('formats currency with custom localization options (Indian lakh/crore, position, precision)', () => {
      const formattedIndian = formatCurrency(125000, 'INR', {
        currency: 'INR',
        number_format: 'indian',
        currency_position: 'left',
        decimal_precision: 2,
      })
      expect(formattedIndian).toContain('1,25,000.00')
      expect(formattedIndian).toContain('₹')

      const formattedRight = formatCurrency(500, 'EUR', {
        currency: 'EUR',
        currency_position: 'right_space',
        decimal_precision: 0,
      })
      expect(formattedRight).toBe('500 €')
    })
  })

  describe('formatNumber', () => {
    it('formats numeric values with locale formatting', () => {
      expect(formatNumber(12500)).toBe('12,500')
      expect(formatNumber(0)).toBe('0')
    })

    it('handles null and undefined', () => {
      expect(formatNumber(null)).toBe('0')
      expect(formatNumber(undefined)).toBe('0')
    })

    it('formats numbers with Indian grouping when configured', () => {
      expect(formatNumber(1250000, { number_format: 'indian' })).toBe('12,50,000')
    })
  })
  describe('getInitials', () => {
    it('extracts two initials from single and multi-word names', () => {
      expect(getInitials('John Doe')).toBe('JD')
      expect(getInitials('Alice')).toBe('A')
      expect(getInitials('Mary Jane Watson')).toBe('MJ')
    })

    it('handles empty or null name safely', () => {
      expect(getInitials('')).toBe('?')
      expect(getInitials(null)).toBe('?')
      expect(getInitials(undefined)).toBe('?')
    })
  })
})
