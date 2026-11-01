import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { useFormatter, type Formatter } from '../lib/formatter'

let mockSettingsData: Record<string, unknown> | undefined

vi.mock('@/api/settings', () => ({
  useSettings: () => ({
    data: mockSettingsData,
    isLoading: false,
    isError: false,
  }),
}))

function getFormatter(): Formatter {
  let captured!: Formatter
  renderToString(React.createElement(() => {
    captured = useFormatter()
    return null
  }))
  return captured
}

describe('Formatter & Localization Hook', () => {
  beforeEach(() => {
    mockSettingsData = {
      localization: {
        currency: 'USD',
        currency_position: 'left',
        decimal_precision: 2,
        number_format: 'standard',
        date_format: 'd/m/Y',
        time_format: 'H:i',
      },
    }

    globalThis.window = {
      CodeCloveConfig: {
        locale: 'en-US',
        localization: {
          currency: 'USD',
          number_format: 'standard',
          date_format: 'd/m/Y',
          time_format: 'H:i',
        },
      },
    } as unknown as Window & typeof globalThis
  })

  it('formats dates according to dynamic date_format', () => {
    const testDate = new Date(2026, 9, 27) // 2026-10-27

    // Default d/m/Y
    expect(getFormatter().formatDate(testDate)).toBe('27/10/2026')

    // m/d/Y
    mockSettingsData = { localization: { date_format: 'm/d/Y' } }
    expect(getFormatter().formatDate(testDate)).toBe('10/27/2026')

    // Y-m-d
    mockSettingsData = { localization: { date_format: 'Y-m-d' } }
    expect(getFormatter().formatDate(testDate)).toBe('2026-10-27')
  })

  it('formats times according to dynamic time_format', () => {
    const testTime = new Date(2026, 9, 27, 14, 30, 0)

    // 24h
    mockSettingsData = { localization: { time_format: 'H:i' } }
    expect(getFormatter().formatTime(testTime)).toBe('14:30')

    // 12h uppercase
    mockSettingsData = { localization: { time_format: 'h:i A' } }
    expect(getFormatter().formatTime(testTime)).toBe('02:30 PM')

    // 12h lowercase
    mockSettingsData = { localization: { time_format: 'h:i a' } }
    expect(getFormatter().formatTime(testTime)).toBe('02:30 pm')
    expect(getFormatter().formatTime('14:30:00')).toBe('02:30 pm')
  })

  it('formats currency with symbol, position, precision, and number format', () => {
    // Standard USD left
    mockSettingsData = {
      localization: {
        currency: 'USD',
        currency_position: 'left',
        decimal_precision: 2,
        number_format: 'standard',
      },
    }
    expect(getFormatter().formatCurrency(125050)).toBe('$1,250.50')

    // European EUR right_space with comma decimal
    mockSettingsData = {
      localization: {
        currency: 'EUR',
        currency_position: 'right_space',
        decimal_precision: 2,
        number_format: 'european',
      },
    }
    const eurResult = getFormatter().formatCurrency(125050)
    expect(eurResult).toContain('1.250,50')
    expect(eurResult).toContain('€')

    // Indian INR left with Lakhs grouping
    mockSettingsData = {
      localization: {
        currency: 'INR',
        currency_position: 'left',
        decimal_precision: 2,
        number_format: 'indian',
      },
    }
    const inrResult = getFormatter().formatCurrency(12500000)
    expect(inrResult).toContain('1,25,000.00')
    expect(inrResult).toContain('₹')

    // Precision 0
    mockSettingsData = {
      localization: {
        currency: 'USD',
        currency_position: 'left',
        decimal_precision: 0,
        number_format: 'standard',
      },
    }
    expect(getFormatter().formatCurrency(50000)).toBe('$500')
  })

  it('uses bootstrapped localization when settings query is not yet loaded', () => {
    mockSettingsData = undefined // Not loaded yet
    globalThis.window = {
      CodeCloveConfig: {
        locale: 'en-US',
        localization: {
          currency: 'GBP',
          currency_position: 'left',
          decimal_precision: 2,
          number_format: 'standard',
          date_format: 'd/m/Y',
        },
      },
    } as unknown as Window & typeof globalThis

    const formatted = getFormatter().formatCurrency(10000)
    expect(formatted).toContain('100.00')
    expect(formatted).toContain('£')
  })
})
