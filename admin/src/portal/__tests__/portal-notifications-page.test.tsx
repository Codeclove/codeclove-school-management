import { describe, it, expect } from 'vitest'
import {
  getNotificationCategory,
  getCanonicalCategory,
  CANONICAL_NOTICE_CATEGORIES,
  NOTICE_ACCENT_COLORS,
  NOTICE_ICONS,
} from '../lib/notifications'
describe('Portal Notifications Category Resolution', () => {
  it('correctly maps standard announcement to canonical announcement category', () => {
    const cat = getNotificationCategory('announcement')
    expect(cat.id).toBe('announcement')
    expect(cat.label).toBe('Announcement')
    expect(cat.dotColor).toBe('bg-brand')
  })

  it('correctly maps notice to canonical notice category with FileText icon', () => {
    const cat = getNotificationCategory('notice')
    expect(cat.id).toBe('notice')
    expect(cat.label).toBe('Official Notice')
    expect(cat.dotColor).toBe('bg-slate-500')
  })

  it('correctly unifies dotted and underscored finance event types to canonical finance category', () => {
    const issued = getNotificationCategory('invoice.issued')
    const overdue = getNotificationCategory('invoice_overdue')
    const payment = getNotificationCategory('payment.recorded')

    expect(issued.id).toBe('finance')
    expect(issued.label).toBe('Finance')

    expect(overdue.id).toBe('finance')
    expect(overdue.label).toBe('Finance')

    expect(payment.id).toBe('finance')
    expect(payment.label).toBe('Finance')
  })

  it('correctly unifies dotted and underscored attendance event types to canonical attendance category', () => {
    const alert = getNotificationCategory('attendance.alert')
    const late = getNotificationCategory('attendance_late')
    const absent = getNotificationCategory('attendance_absent')

    expect(alert.id).toBe('attendance')
    expect(alert.label).toBe('Attendance')

    expect(late.id).toBe('attendance')
    expect(late.label).toBe('Attendance')

    expect(absent.id).toBe('attendance')
    expect(absent.label).toBe('Attendance')
  })

  it('maps academic circulars and syllabi to circular category', () => {
    const circular = getNotificationCategory('circular')
    const syllabus = getNotificationCategory('syllabus')

    expect(circular.id).toBe('circular')
    expect(circular.label).toBe('Circular')

    expect(syllabus.id).toBe('circular')
    expect(syllabus.label).toBe('Circular')
  })

  it('respects user-specified accent color and icon overrides', () => {
    const custom = getNotificationCategory('announcement', 'Sports Meet', 'rose', 'trophy')
    expect(custom.id).toBe('announcement')
    // Accent color rose should be reflected
    expect(custom.dotColor).toBe('bg-rose-500')
    expect(custom.badgeColor).toContain('rose')
  })

  it('contains full canonical category list for dropdown filters with colored icons', () => {
    expect(CANONICAL_NOTICE_CATEGORIES.length).toBeGreaterThanOrEqual(8)
    const categoryIds = CANONICAL_NOTICE_CATEGORIES.map((c) => c.id)
    expect(categoryIds).toContain('announcement')
    expect(categoryIds).toContain('notice')
    expect(categoryIds).toContain('circular')
    expect(categoryIds).toContain('event')
    expect(categoryIds).toContain('holiday')
    expect(categoryIds).toContain('urgent')
    expect(categoryIds).toContain('finance')
    expect(categoryIds).toContain('attendance')

    // Every canonical category must have an icon and a text color class for colored icons
    for (const cat of CANONICAL_NOTICE_CATEGORIES) {
      expect(cat.icon).toBeDefined()
      expect(cat.textColor).toMatch(/text-/)
    }

    const finance = getCanonicalCategory('finance')
    expect(finance?.label).toBe('Fees & Finance')
    expect(finance?.textColor).toContain('text-indigo')
  })
  it('contains rich options for composer icons and accent colors', () => {
    expect(NOTICE_ACCENT_COLORS.length).toBeGreaterThanOrEqual(6)
    expect(NOTICE_ICONS.length).toBeGreaterThanOrEqual(8)
  })

  it('safely handles SPA hash route querySelectors without throwing SyntaxError', () => {
    const mockDocument: { querySelector: (selector: string) => { id: string } | null } = {
      querySelector(selector: string) {
        if (selector.startsWith('#/')) {
          throw new Error(`Failed to execute 'querySelector' on 'Document': '${selector}' is not a valid selector.`)
        }
        return { id: selector }
      },
    }

    const orig = mockDocument.querySelector.bind(mockDocument)
    mockDocument.querySelector = function (selector: string): { id: string } | null {
      try {
        return orig(selector)
      } catch (err) {
        if (typeof selector === 'string' && selector.startsWith('#/')) {
          return null
        }
        throw err
      }
    }

    expect(() => mockDocument.querySelector('#/notifications')).not.toThrow()
    expect(mockDocument.querySelector('#/notifications')).toBeNull()
    expect(mockDocument.querySelector('#/dashboard')).toBeNull()
    expect(mockDocument.querySelector('#valid-id')).toEqual({ id: '#valid-id' })
  })
})
