import { describe, expect, it } from 'vitest'
import { shouldShowStudentSwitcher } from '../components/StudentSwitcher'
import {
  formatRoomName,
  getBreakBetweenSlots,
  getGreeting,
  getSlotStatus,
  parseTimeToMinutes,
} from '../lib/schedule'

describe('Portal Dashboard Logic & Utilities', () => {
  describe('StudentSwitcher Visibility Rule', () => {
    it('hides switcher when student count is 0', () => {
      expect(shouldShowStudentSwitcher(0)).toBe(false)
    })

    it('hides switcher when exactly 1 student exists (omits duplicate identity pill)', () => {
      expect(shouldShowStudentSwitcher(1)).toBe(false)
    })

    it('shows switcher only when guardian has multiple students (count > 1)', () => {
      expect(shouldShowStudentSwitcher(2)).toBe(true)
      expect(shouldShowStudentSwitcher(5)).toBe(true)
    })
  })

  describe('parseTimeToMinutes', () => {
    it('correctly converts HH:MM strings to total minutes', () => {
      expect(parseTimeToMinutes('08:30')).toBe(510) // 8 * 60 + 30
      expect(parseTimeToMinutes('13:45')).toBe(825) // 13 * 60 + 45
      expect(parseTimeToMinutes('00:00')).toBe(0)
      expect(parseTimeToMinutes('23:59')).toBe(1439)
    })

    it('handles null, undefined, empty, and malformed strings safely', () => {
      expect(parseTimeToMinutes(null)).toBeNull()
      expect(parseTimeToMinutes(undefined)).toBeNull()
      expect(parseTimeToMinutes('')).toBeNull()
      expect(parseTimeToMinutes('invalid')).toBeNull()
      expect(parseTimeToMinutes('12')).toBeNull()
      expect(parseTimeToMinutes(':30')).toBeNull()
    })
  })

  describe('getSlotStatus (Time-Aware Timetable)', () => {
    // Helper to create a specific Date with given hour and minute
    const makeTime = (hours: number, minutes: number): Date => {
      const d = new Date(2026, 8, 7, hours, minutes, 0)
      return d
    }

    it('returns "upcoming" when current time is before the slot start', () => {
      // Slot 09:00 - 10:00, current time 08:45
      const now = makeTime(8, 45)
      expect(getSlotStatus('09:00', '10:00', now)).toBe('upcoming')
    })

    it('returns "current" when current time is during the slot', () => {
      // Slot 09:00 - 10:00
      const startOfClass = makeTime(9, 0)
      const midClass = makeTime(9, 30)
      const nearEnd = makeTime(9, 59)

      expect(getSlotStatus('09:00', '10:00', startOfClass)).toBe('current')
      expect(getSlotStatus('09:00', '10:00', midClass)).toBe('current')
      expect(getSlotStatus('09:00', '10:00', nearEnd)).toBe('current')
    })

    it('returns "past" when current time is at or after slot end', () => {
      // Slot 09:00 - 10:00
      const classEnd = makeTime(10, 0)
      const afterClass = makeTime(10, 15)

      expect(getSlotStatus('09:00', '10:00', classEnd)).toBe('past')
      expect(getSlotStatus('09:00', '10:00', afterClass)).toBe('past')
    })

    it('safely defaults to "upcoming" on invalid or null time inputs', () => {
      const now = makeTime(10, 0)
      expect(getSlotStatus(null, '10:00', now)).toBe('upcoming')
      expect(getSlotStatus('09:00', null, now)).toBe('upcoming')
      expect(getSlotStatus('invalid', '10:00', now)).toBe('upcoming')
    })
  })

  describe('getGreeting', () => {
    const makeTime = (hour: number): Date => {
      const d = new Date(2026, 8, 7, hour, 0, 0)
      return d
    }

    it('returns "Good morning" before 12:00 PM', () => {
      expect(getGreeting(makeTime(6))).toBe('Good morning')
      expect(getGreeting(makeTime(11))).toBe('Good morning')
    })

    it('returns "Good afternoon" between 12:00 PM and 4:59 PM', () => {
      expect(getGreeting(makeTime(12))).toBe('Good afternoon')
      expect(getGreeting(makeTime(14))).toBe('Good afternoon')
      expect(getGreeting(makeTime(16))).toBe('Good afternoon')
    })

    it('returns "Good evening" from 5:00 PM onwards', () => {
      expect(getGreeting(makeTime(17))).toBe('Good evening')
      expect(getGreeting(makeTime(20))).toBe('Good evening')
      expect(getGreeting(makeTime(23))).toBe('Good evening')
    })
  })

  describe('getBreakBetweenSlots (Recess & Lunch Gap Detection)', () => {
    it('detects a 15-minute morning recess break between slots', () => {
      const gap = getBreakBetweenSlots('10:00', '10:15')
      expect(gap).not.toBeNull()
      expect(gap?.label).toBe('Recess / Break')
      expect(gap?.durationMinutes).toBe(15)
      expect(gap?.startTime).toBe('10:00')
      expect(gap?.endTime).toBe('10:15')
    })

    it('detects a 45-minute lunch break during midday hours', () => {
      const gap = getBreakBetweenSlots('11:45', '12:30')
      expect(gap).not.toBeNull()
      expect(gap?.label).toBe('Lunch Break')
      expect(gap?.durationMinutes).toBe(45)
    })

    it('ignores gaps smaller than 10 minutes (standard class transition)', () => {
      expect(getBreakBetweenSlots('09:15', '09:20')).toBeNull()
      expect(getBreakBetweenSlots('10:00', '10:05')).toBeNull()
    })

    it('returns null for missing, empty, or invalid times', () => {
      expect(getBreakBetweenSlots(null, '10:15')).toBeNull()
      expect(getBreakBetweenSlots('10:00', undefined)).toBeNull()
      expect(getBreakBetweenSlots('invalid', '10:15')).toBeNull()
    })
  })

  describe('formatRoomName', () => {
    it('returns null for null, undefined, or empty room', () => {
      expect(formatRoomName(null)).toBeNull()
      expect(formatRoomName(undefined)).toBeNull()
      expect(formatRoomName('')).toBeNull()
    })

    it('filters out dummy seed text', () => {
      expect(formatRoomName('Seeded class schedule slot.')).toBeNull()
      expect(formatRoomName('seeded slot')).toBeNull()
    })

    it('preserves room names already prefixed with Room or Lab', () => {
      expect(formatRoomName('Room 101')).toBe('Room 101')
      expect(formatRoomName('Lab 2')).toBe('Lab 2')
      expect(formatRoomName('Auditorium A')).toBe('Auditorium A')
    })

    it('prefixes plain alphanumeric room numbers with Room', () => {
      expect(formatRoomName('101')).toBe('Room 101')
      expect(formatRoomName('B-204')).toBe('Room B-204')
    })
  })
})
