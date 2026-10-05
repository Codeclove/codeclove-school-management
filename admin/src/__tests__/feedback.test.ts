import { describe, it, expect } from 'vitest'

describe('Feedback & Bug Reporting Logic', () => {
  const AREA_OPTIONS = [
    { value: 'General', label: 'General / Platform' },
    { value: 'Academics', label: 'Academics & Classes' },
    { value: 'Admissions', label: 'Admissions' },
    { value: 'Attendance', label: 'Attendance' },
    { value: 'Finance', label: 'Finance & Invoices' },
    { value: 'Staff', label: 'Staff & HR' },
    { value: 'Students', label: 'Students' },
    { value: 'Timetable', label: 'Timetable' },
    { value: 'Settings', label: 'Settings & Localization' },
  ]

  const VECTOR_OPTIONS = [
    { value: 'ux', label: 'UX Friction (Confusing, slow, or too many clicks)' },
    { value: 'capability', label: 'Capability Gap (Missing feature for your school)' },
    { value: 'compliance', label: 'Regional Compliance (Board or legal requirement)' },
    { value: 'integration', label: 'Integration (Payment, SMS, LMS, or API)' },
    { value: 'general', label: 'General Refinement' },
  ]

  it('maps feedback refinement categories correctly', () => {
    const uxVector = VECTOR_OPTIONS.find((v) => v.value === 'ux')
    expect(uxVector?.label).toContain('UX Friction')

    const capVector = VECTOR_OPTIONS.find((v) => v.value === 'capability')
    expect(capVector?.label).toContain('Capability Gap')
  })

  it('validates area options covers all key school modules', () => {
    const areas = AREA_OPTIONS.map((a) => a.value)
    expect(areas).toContain('General')
    expect(areas).toContain('Academics')
    expect(areas).toContain('Admissions')
    expect(areas).toContain('Attendance')
    expect(areas).toContain('Finance')
    expect(areas).toContain('Staff')
    expect(areas).toContain('Students')
    expect(areas).toContain('Timetable')
    expect(areas).toContain('Settings')
  })

  it('formats feedback payload with refinement category prefix', () => {
    const vector = 'capability'
    const description = 'Teachers need a way to batch-assign substitute teachers.'
    const vectorLabel = VECTOR_OPTIONS.find((v) => v.value === vector)?.label || vector

    const formatted = `**Refinement Category:** ${vectorLabel}\n\n${description}`
    expect(formatted).toContain('**Refinement Category:** Capability Gap')
    expect(formatted).toContain(description)
  })
})
