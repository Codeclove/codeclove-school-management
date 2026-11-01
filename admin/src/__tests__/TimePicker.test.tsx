import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  TimePicker,
  formatTimeDisplay,
  parseTimeInput,
} from '../components/ui/TimePicker'

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

describe('TimePicker Component & Utilities', () => {
  describe('formatTimeDisplay', () => {
    it('formats 24-hour time to 12-hour display with AM/PM', () => {
      expect(formatTimeDisplay('09:00', true)).toBe('09:00 AM')
      expect(formatTimeDisplay('11:30', true)).toBe('11:30 AM')
      expect(formatTimeDisplay('12:00', true)).toBe('12:00 PM')
      expect(formatTimeDisplay('13:30', true)).toBe('01:30 PM')
      expect(formatTimeDisplay('00:00', true)).toBe('12:00 AM')
    })

    it('formats 24-hour time to 24-hour display without AM/PM', () => {
      expect(formatTimeDisplay('09:00', false)).toBe('09:00')
      expect(formatTimeDisplay('13:30', false)).toBe('13:30')
      expect(formatTimeDisplay('23:45', false)).toBe('23:45')
    })

    it('handles empty and null values gracefully', () => {
      expect(formatTimeDisplay('', true)).toBe('')
      expect(formatTimeDisplay(null, true)).toBe('')
      expect(formatTimeDisplay(undefined, true)).toBe('')
    })
  })

  describe('parseTimeInput', () => {
    it('parses standard colon times', () => {
      expect(parseTimeInput('09:00')).toBe('09:00')
      expect(parseTimeInput('9:30')).toBe('09:30')
      expect(parseTimeInput('14:45')).toBe('14:45')
    })

    it('parses explicit AM/PM strings', () => {
      expect(parseTimeInput('9am')).toBe('09:00')
      expect(parseTimeInput('9:00 AM')).toBe('09:00')
      expect(parseTimeInput('9pm')).toBe('21:00')
      expect(parseTimeInput('1:30 pm')).toBe('13:30')
      expect(parseTimeInput('12:00 am')).toBe('00:00')
      expect(parseTimeInput('12:00 pm')).toBe('12:00')
    })

    it('parses shorthand numbers (9, 930, 1130)', () => {
      expect(parseTimeInput('9')).toBe('09:00')
      expect(parseTimeInput('10')).toBe('10:00')
      expect(parseTimeInput('930')).toBe('09:30')
      expect(parseTimeInput('1130')).toBe('11:30')
    })

    it('heuristically treats early hours (1-6) as afternoon in school mode', () => {
      expect(parseTimeInput('1:30', true)).toBe('13:30')
      expect(parseTimeInput('2', true)).toBe('14:00')
      expect(parseTimeInput('4:15', true)).toBe('16:15')
    })

    it('returns null for invalid strings', () => {
      expect(parseTimeInput('')).toBeNull()
      expect(parseTimeInput('hello')).toBeNull()
      expect(parseTimeInput('25:00')).toBeNull()
      expect(parseTimeInput('10:65')).toBeNull()
    })
  })

  describe('TimePicker Rendering', () => {
    it('renders accessible input and trigger clock button', () => {
      const html = renderWithQuery(
        <TimePicker
          value="09:00"
          aria-label="Mathematics start time"
          use12Hours={true}
        />
      )

      expect(html).toContain('aria-label="Mathematics start time"')
      expect(html).toContain('value="09:00 AM"')
      expect(html).toContain('title="Open Time Picker"')
      expect(html).toContain('title="Clear time"')
    })

    it('renders empty placeholder when value is empty', () => {
      const html = renderWithQuery(
        <TimePicker
          value=""
          placeholder="Select time"
          aria-label="Start time"
        />
      )

      expect(html).toContain('placeholder="Select time"')
      expect(html).not.toContain('title="Clear time"')
    })
  })
})
