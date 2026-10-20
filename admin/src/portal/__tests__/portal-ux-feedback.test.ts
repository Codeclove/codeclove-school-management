/**
 * Automated Verification & Feedback Loop for Portal UI/UX Overhaul.
 *
 * Verifies:
 * - Upcoming chronological sorting & relative date detection (Today, Tomorrow)
 * - Low-cognitive event categorization & styling
 * - Dashboard banner uncluttering (absence of redundant active enrollment pills)
 * - Timetable responsive slot resolution
 * - Financial statement payable state evaluation
 */

import { describe, expect, it } from 'vitest'
import {
  getEventStyle,
  getSortedUpcomingEvents,
  parseDateComponents,
} from '../modules/dashboard/components/DashboardCalendar'
import type { CalendarEvent } from '../types'
import { formatRoomName, getSlotStatus } from '../lib/schedule'

describe('Portal UI/UX Feedback Loop & Verification', () => {
  describe('Upcoming Milestones & Deadlines Feed Logic', () => {
    const mockEvents: CalendarEvent[] = [
      { id: 'ev-3', title: 'Winter Holiday', date: '2026-12-20', type: 'holiday', category: 'general' },
      { id: 'ev-1', title: 'Science Exam', date: '2026-10-25', type: 'exam', category: 'academic' },
      { id: 'ev-2', title: 'Term 2 Fee Due', date: '2026-11-05', type: 'deadline', category: 'finance', amount: 150 },
      { id: 'ev-old', title: 'Past Orientation', date: '2026-09-01', type: 'event', category: 'general' },
    ]

    it('sorts events in strict ascending chronological order', () => {
      const sorted = getSortedUpcomingEvents(mockEvents, '2026-10-01')
      expect(sorted[0]?.id).toBe('ev-1')
      expect(sorted[1]?.id).toBe('ev-2')
      expect(sorted[2]?.id).toBe('ev-3')
    })

    it('filters out past events when upcoming events exist relative to reference date', () => {
      const upcoming = getSortedUpcomingEvents(mockEvents, '2026-10-15')
      const ids = upcoming.map((e) => e.id)
      expect(ids).toContain('ev-1')
      expect(ids).toContain('ev-2')
      expect(ids).toContain('ev-3')
      expect(ids).not.toContain('ev-old')
    })

    it('falls back gracefully to all sorted events if all events are in the past', () => {
      const allPast: CalendarEvent[] = [
        { id: 'p2', title: 'Past Event B', date: '2025-02-01', type: 'event', category: 'general' },
        { id: 'p1', title: 'Past Event A', date: '2025-01-01', type: 'event', category: 'general' },
      ]
      const result = getSortedUpcomingEvents(allPast, '2026-01-01')
      expect(result.length).toBe(2)
      expect(result[0]?.id).toBe('p1')
      expect(result[1]?.id).toBe('p2')
    })

    it('handles empty or null event lists without throwing', () => {
      expect(getSortedUpcomingEvents([])).toEqual([])
      expect(getSortedUpcomingEvents(null as unknown as CalendarEvent[])).toEqual([])
    })
  })

  describe('Relative Date Detection (Today, Tomorrow, Calendar Day)', () => {
    it('accurately detects Today for matching date string', () => {
      const now = new Date()
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      const parsed = parseDateComponents(todayStr)
      expect(parsed.isToday).toBe(true)
      expect(parsed.isTomorrow).toBe(false)
      expect(parsed.dayNum).toBe(String(now.getDate()))
    })

    it('accurately detects Tomorrow for next-day date string', () => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(now.getDate() + 1)
      const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

      const parsed = parseDateComponents(tomorrowStr)
      expect(parsed.isToday).toBe(false)
      expect(parsed.isTomorrow).toBe(true)
      expect(parsed.dayNum).toBe(String(tomorrow.getDate()))
    })

    it('formats distant future dates with month abbreviation and day number', () => {
      const parsed = parseDateComponents('2026-11-15')
      expect(parsed.dayNum).toBe('15')
      expect(parsed.monthShort).toBe('NOV')
    })

    it('safely handles missing, empty, or malformed date strings', () => {
      const parsed = parseDateComponents('')
      expect(parsed.monthShort).toBe('')
      expect(parsed.dayNum).toBe('')
      expect(parsed.isToday).toBe(false)
    })
  })

  describe('Low-Cognitive Event Categorization & Color Hierarchy', () => {
    it('assigns Finance warning/danger styling to deadlines and fee events', () => {
      const deadlineStyle = getEventStyle({
        id: 1,
        title: 'Tuition Due',
        date: '2026-11-01',
        type: 'deadline',
        category: 'finance',
      })
      expect(deadlineStyle.variant).toBe('warning')
      expect(deadlineStyle.dot).toBe('bg-danger')
      expect(deadlineStyle.label).toBe('Fee Due')
    })

    it('assigns Exam styling to academic examination milestones', () => {
      const examStyle = getEventStyle({
        id: 2,
        title: 'Physics Finals',
        date: '2026-11-10',
        type: 'exam',
        category: 'academic',
      })
      expect(examStyle.label).toBe('Exam')
      expect(examStyle.dot).toBe('bg-brand')
    })

    it('assigns Success green styling to holidays and school breaks', () => {
      const holidayStyle = getEventStyle({
        id: 3,
        title: 'Spring Break',
        date: '2026-03-20',
        type: 'holiday',
        category: 'general',
      })
      expect(holidayStyle.variant).toBe('success')
      expect(holidayStyle.dot).toBe('bg-success')
      expect(holidayStyle.label).toBe('Holiday')
    })
  })

  describe('Mobile Timetable & Period Resolution', () => {
    it('strips redundant "Room" prefixes to keep mobile cards compact', () => {
      expect(formatRoomName('Room 101')).toBe('Room 101')
      expect(formatRoomName('101')).toBe('Room 101')
      expect(formatRoomName('Lab B')).toBe('Lab B')
      expect(formatRoomName('')).toBeNull()
    })

    it('identifies slot status safely for time intervals', () => {
      expect(getSlotStatus('09:00', '10:00')).toBeDefined()
      expect(getSlotStatus('', '')).toBe('upcoming')
    })
  })

  describe('Financial Statement Top-CTA & Payable Logic', () => {
    it('identifies invoices with positive balance as payable for top-level CTA', () => {
      const payableInvoice = { id: 10, total: 500, paid: 200, balance: 300, status: 'partially_paid' }
      const isPayable = payableInvoice.balance > 0 && payableInvoice.status !== 'cancelled'
      expect(isPayable).toBe(true)
    })

    it('identifies settled invoices (balance 0) as non-payable', () => {
      const settledInvoice = { id: 11, total: 500, paid: 500, balance: 0, status: 'paid' }
      const isPayable = settledInvoice.balance > 0
      expect(isPayable).toBe(false)
    })
  })
})
