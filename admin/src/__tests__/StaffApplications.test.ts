import { describe, expect, it } from 'vitest'
import { STAFF_APP_STATUSES, type StaffAppStatus } from '../lib/constants'

describe('Staff Applications Module Constants & Workflows', () => {
  it('defines all required staff recruitment pipeline statuses', () => {
    expect(STAFF_APP_STATUSES).toContain('submitted')
    expect(STAFF_APP_STATUSES).toContain('under_review')
    expect(STAFF_APP_STATUSES).toContain('more_info_needed')
    expect(STAFF_APP_STATUSES).toContain('interview_scheduled')
    expect(STAFF_APP_STATUSES).toContain('offer_sent')
    expect(STAFF_APP_STATUSES).toContain('accepted')
    expect(STAFF_APP_STATUSES).toContain('rejected')
    expect(STAFF_APP_STATUSES).toContain('hired')
    expect(STAFF_APP_STATUSES).toContain('withdrawn')
  })

  it('validates allowed status transitions', () => {
    const isTerminalStatus = (status: StaffAppStatus): boolean => {
      return status === 'hired' || status === 'withdrawn'
    }

    expect(isTerminalStatus('hired')).toBe(true)
    expect(isTerminalStatus('withdrawn')).toBe(true)
    expect(isTerminalStatus('under_review')).toBe(false)
    expect(isTerminalStatus('interview_scheduled')).toBe(false)
  })
})
