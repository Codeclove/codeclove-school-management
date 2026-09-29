import { describe, it, expect } from 'vitest'
import { PERMISSIONS } from '../lib/constants'
import {
  formatRelativeTime,
  getSignOutUrl,
  QUICK_CREATE_ACTIONS,
  getSearchShortcut,
  getNotificationButtonAriaLabel,
} from '../layouts/Header'

describe('Header & Layout Architectural Requirements', () => {
  describe('Relative Time Formatting Helper', () => {
    it('returns "just now" for dates within 60 seconds', () => {
      const now = new Date('2026-09-14T12:00:00Z')
      const justNow = new Date('2026-09-14T11:59:30Z').toISOString()
      expect(formatRelativeTime(justNow, now)).toBe('just now')
    })

    it('returns "just now" for future timestamps caused by slight clock skew', () => {
      const now = new Date('2026-09-14T12:00:00Z')
      const future = new Date('2026-09-14T12:00:10Z').toISOString()
      expect(formatRelativeTime(future, now)).toBe('just now')
    })

    it('returns "just now" for invalid date strings', () => {
      expect(formatRelativeTime('invalid-date')).toBe('just now')
    })

    it('returns minutes ago for dates under an hour', () => {
      const now = new Date('2026-09-14T12:00:00Z')
      const fiveMinAgo = new Date('2026-09-14T11:55:00Z').toISOString()
      expect(formatRelativeTime(fiveMinAgo, now)).toBe('5m ago')
    })

    it('returns hours ago for dates under 24 hours', () => {
      const now = new Date('2026-09-14T12:00:00Z')
      const twoHoursAgo = new Date('2026-09-14T10:00:00Z').toISOString()
      expect(formatRelativeTime(twoHoursAgo, now)).toBe('2h ago')
    })

    it('returns days ago for dates under 7 days', () => {
      const now = new Date('2026-09-14T12:00:00Z')
      const threeDaysAgo = new Date('2026-09-11T12:00:00Z').toISOString()
      expect(formatRelativeTime(threeDaysAgo, now)).toBe('3d ago')
    })

    it('formats date and includes year when date is from a prior year', () => {
      const now = new Date('2026-09-14T12:00:00Z')
      const lastYear = new Date('2025-03-01T12:00:00Z').toISOString()
      const formatted = formatRelativeTime(lastYear, now)
      expect(formatted).toContain('2025')
    })
  })

  describe('Sign Out Fallback URL Handling', () => {
    it('prefers config.logoutUrl when provided by WordPress', () => {
      expect(getSignOutUrl({
        logoutUrl: 'https://school.test/wp-login.php?action=logout&_wpnonce=abc123',
        adminUrl: 'https://school.test/wp-admin/',
      })).toBe('https://school.test/wp-login.php?action=logout&_wpnonce=abc123')
    })

    it('correctly resolves fallback to site root wp-login.php instead of /wp-admin/wp-login.php', () => {
      const url = getSignOutUrl({ adminUrl: 'https://school.test/wp-admin/' })
      expect(url).toBe('https://school.test/wp-login.php?action=logout')
      expect(url).not.toContain('/wp-admin/wp-login.php')
    })

    it('handles subdirectory WordPress installations', () => {
      const url = getSignOutUrl({ adminUrl: 'https://school.test/subsite/wp-admin/' })
      expect(url).toBe('https://school.test/subsite/wp-login.php?action=logout')
    })

    it('falls back to /wp-login.php?action=logout when config is undefined', () => {
      expect(getSignOutUrl(undefined)).toBe('/wp-login.php?action=logout')
    })
  })

  describe('Quick Create RBAC Permissions Filtering', () => {
    function filterActions(userPermissions: string[], isAdmin = false) {
      const can = (perm: string) => isAdmin || userPermissions.includes('*') || userPermissions.includes(perm)
      return QUICK_CREATE_ACTIONS.filter((action) => {
        if (Array.isArray(action.permission)) {
          return action.permission.some((p) => can(p))
        }
        return can(action.permission)
      })
    }

    it('allows all actions for WordPress administrator or wildcard role', () => {
      expect(filterActions([], true)).toHaveLength(4)
      expect(filterActions(['*'], false)).toHaveLength(4)
    })

    it('returns empty list if user has no matching create permissions', () => {
      const permitted = filterActions([PERMISSIONS.STUDENTS_VIEW, PERMISSIONS.ADMISSIONS_VIEW])
      expect(permitted).toHaveLength(0)
    })

    it('filters accurately for an admissions clerk role', () => {
      const permitted = filterActions([PERMISSIONS.ADMISSIONS_ADD])
      expect(permitted).toHaveLength(1)
      expect(permitted[0]?.label).toBe('Admit Student')
    })

    it('filters accurately for a registrar with students.add', () => {
      const permitted = filterActions([PERMISSIONS.STUDENTS_ADD])
      expect(permitted).toHaveLength(1)
      expect(permitted[0]?.label).toBe('Admit Student')
    })

    it('filters accurately for an accountant role', () => {
      const permitted = filterActions([PERMISSIONS.INVOICES_ADD])
      expect(permitted).toHaveLength(1)
      expect(permitted[0]?.label).toBe('Create Invoice')
    })
  })

  describe('OS-Aware Keyboard Shortcut Detection', () => {
    it('detects macOS and returns ⌘K', () => {
      expect(getSearchShortcut('MacIntel')).toBe('⌘K')
      expect(getSearchShortcut('macOS')).toBe('⌘K')
      expect(getSearchShortcut('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('⌘K')
    })

    it('detects Windows and returns Ctrl+K', () => {
      expect(getSearchShortcut('Win32')).toBe('Ctrl+K')
      expect(getSearchShortcut('Windows')).toBe('Ctrl+K')
    })

    it('detects Linux and returns Ctrl+K', () => {
      expect(getSearchShortcut('Linux x86_64')).toBe('Ctrl+K')
    })
  })

  describe('Notification Accessible Labeling', () => {
    it('provides clear count to screen readers when unread items exist', () => {
      expect(getNotificationButtonAriaLabel(0)).toBe('Notifications')
      expect(getNotificationButtonAriaLabel(1)).toBe('Notifications (1 unread)')
      expect(getNotificationButtonAriaLabel(5)).toBe('Notifications (5 unread)')
    })
  })
})
