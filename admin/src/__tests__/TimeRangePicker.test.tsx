import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  TimeRangePicker,
  calculateDurationText,
  DEFAULT_EXAM_PRESETS,
} from '../components/ui/TimeRangePicker'

function renderWithQuery(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return renderToString(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

describe('TimeRangePicker Component & Utilities', () => {
  describe('calculateDurationText', () => {
    it('calculates duration for hours and minutes', () => {
      expect(calculateDurationText('09:00', '11:30')).toBe('2h 30m')
      expect(calculateDurationText('13:30', '16:00')).toBe('2h 30m')
      expect(calculateDurationText('09:00', '10:45')).toBe('1h 45m')
    })

    it('calculates duration for exact hours', () => {
      expect(calculateDurationText('09:00', '12:00')).toBe('3h')
      expect(calculateDurationText('09:00', '10:00')).toBe('1h')
      expect(calculateDurationText('14:00', '17:00')).toBe('3h')
    })

    it('calculates duration for sub-hour minutes', () => {
      expect(calculateDurationText('09:00', '09:45')).toBe('45m')
      expect(calculateDurationText('09:00', '09:30')).toBe('30m')
    })

    it('returns null for empty, invalid, or backwards time ranges', () => {
      expect(calculateDurationText('', '')).toBeNull()
      expect(calculateDurationText('09:00', '')).toBeNull()
      expect(calculateDurationText('', '11:30')).toBeNull()
      expect(calculateDurationText('11:30', '09:00')).toBeNull()
      expect(calculateDurationText('10:00', '10:00')).toBeNull()
    })
  })

  describe('DEFAULT_EXAM_PRESETS', () => {
    it('defines standard morning and afternoon exam presets', () => {
      expect(DEFAULT_EXAM_PRESETS.length).toBeGreaterThanOrEqual(5)
      expect(DEFAULT_EXAM_PRESETS.some((p) => p.startTime === '09:00' && p.endTime === '11:30')).toBe(true)
      expect(DEFAULT_EXAM_PRESETS.some((p) => p.startTime === '09:00' && p.endTime === '12:00')).toBe(true)
      expect(DEFAULT_EXAM_PRESETS.some((p) => p.startTime === '13:30' && p.endTime === '16:00')).toBe(true)
    })
  })

  describe('TimeRangePicker Rendering', () => {
    it('renders combined time slot trigger with duration chip and clear button', () => {
      const html = renderWithQuery(
        <TimeRangePicker
          startTime="09:00"
          endTime="11:30"
          aria-label="Mathematics time slot"
          use12Hours={true}
        />
      )

      expect(html).toContain('aria-label="Mathematics time slot"')
      expect(html).toContain('09:00 AM – 11:30 AM')
      expect(html).toContain('2h 30m')
      expect(html).toContain('title="Clear time slot"')
    })

    it('renders placeholder when slot is empty', () => {
      const html = renderWithQuery(
        <TimeRangePicker
          startTime=""
          endTime=""
          placeholder="Choose session..."
          aria-label="General Science time slot"
        />
      )

      expect(html).toContain('Choose session...')
      expect(html).not.toContain('title="Clear time slot"')
    })

    it('supports 24-hour display mode', () => {
      const html = renderWithQuery(
        <TimeRangePicker
          startTime="14:00"
          endTime="17:00"
          use12Hours={false}
        />
      )

      expect(html).toContain('14:00 – 17:00')
      expect(html).toContain('3h')
    })
  })
})
