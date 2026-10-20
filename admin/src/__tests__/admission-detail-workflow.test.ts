import { describe, expect, it } from 'vitest'
import { getTimelineEvents } from '../modules/students/AdmissionDetailPage'
import type { AdmissionApplication } from '@/api/students'

describe('Admission Application Workflow & Timeline Attribution', () => {
  it('correctly attributes walk-in and online initial submissions in timeline', () => {
    const walkInApp = {
      id: 1,
      status: 'submitted',
      source: 'walk_in',
      status_history: [],
      created_at: '2026-03-01 10:00:00',
    } as unknown as AdmissionApplication

    const onlineApp = {
      id: 2,
      status: 'submitted',
      source: 'public_form',
      status_history: [],
      created_at: '2026-03-01 10:00:00',
    } as unknown as AdmissionApplication

    const walkInEvents = getTimelineEvents(walkInApp)
    expect(walkInEvents[0]?.actor).toContain('Admissions Staff')
    expect(walkInEvents[0]?.title).toContain('Walk-In')

    const onlineEvents = getTimelineEvents(onlineApp)
    expect(onlineEvents[0]?.actor).toContain('Applicant')
  })

  it('attributes subsequent administrative status transitions to admissions staff', () => {
    const appWithHistory = {
      id: 3,
      status: 'under_review',
      source: 'public_form',
      status_history: [
        {
          id: 1,
          application_id: 3,
          from_status: null,
          to_status: 'submitted',
          changed_at: '2026-03-01 10:00:00',
        },
        {
          id: 2,
          application_id: 3,
          from_status: 'submitted',
          to_status: 'under_review',
          reason: 'Document Verification',
          actor_name: null,
          changed_at: '2026-03-02 12:00:00',
        },
      ],
    } as unknown as AdmissionApplication

    const events = getTimelineEvents(appWithHistory)
    expect(events).toHaveLength(2)
    expect(events[0]?.actor).toContain('Applicant')
    expect(events[1]?.actor).toBe('Admissions Staff')
    expect(events[1]?.title).toBe('Document Verification')
  })
})
