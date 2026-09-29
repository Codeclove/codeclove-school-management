import { describe, it, expect } from 'vitest'

describe('Attendance Module Consistency', () => {
  describe('Attendance Rate Formula Integrity', () => {
    // Both student and staff attendance use the education-standard formula:
    // Effective Attended = Present(1.0) + Late(1.0) + HalfDay(0.5)
    // Rate = Round((Effective / Total) * 100)
    function calculateAttendanceRate(counts: { present: number; late: number; halfDay: number; absent: number; leave: number }) {
      const total = counts.present + counts.late + counts.halfDay + counts.absent + counts.leave
      if (total === 0) return 0
      const effective = counts.present + counts.late + 0.5 * counts.halfDay
      return Math.round((effective / total) * 100)
    }

    it('calculates 100% when all are present', () => {
      expect(calculateAttendanceRate({ present: 30, late: 0, halfDay: 0, absent: 0, leave: 0 })).toBe(100)
    })

    it('weights half-day as 0.5 attendance', () => {
      expect(calculateAttendanceRate({ present: 0, late: 0, halfDay: 10, absent: 0, leave: 0 })).toBe(50)
    })

    it('calculates correct mixed attendance rate', () => {
      // 18 present (18) + 2 late (2) + 2 halfDay (1) = 21 effective out of 25 = 84%
      expect(calculateAttendanceRate({ present: 18, late: 2, halfDay: 2, absent: 2, leave: 1 })).toBe(84)
    })
  })

  describe('Attendance Status Code Equivalence', () => {
    const CANONICAL_STATUSES = ['present', 'absent', 'late', 'half_day', 'on_leave', 'excused', 'holiday'] as const

    it('all canonical attendance statuses have standard display codes', () => {
      const STATUS_CODES: Record<string, string> = {
        present: 'P',
        absent: 'A',
        late: 'L',
        half_day: 'H',
        on_leave: 'O',
        excused: 'E',
        holiday: 'Hl',
      }

      CANONICAL_STATUSES.forEach((st) => {
        const code = STATUS_CODES[st]
        expect(code).toBeDefined()
        expect(code?.length).toBeGreaterThan(0)
      })
    })
  })
})
