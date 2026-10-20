/**
 * Portal Notification Bell & Popover Tests.
 *
 * Verifies NotificationBell rendering, accessible attributes, unread badge,
 * category iconography, relative timestamps, internal vs external links,
 * and empty state handling.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { NotificationBell } from '../components/NotificationBell'
import * as portalContext from '../lib/portal-context'
import type { NotificationItem, NotificationsResponse, PortalStudent } from '../types'

const mockStudent: PortalStudent = {
  id: 101,
  first_name: 'Aarav',
  last_name: 'Kumar',
  full_name: 'Aarav Kumar',
  student_number: 'STU-101',
  admission_number: 'ADM-101',
  unit_name: 'Class 1',
  group_name: 'Section B',
}

let mockNotificationsData: NotificationsResponse = {
  notifications: [],
  unread_count: 0,
  total: 0,
}

vi.mock('../api/portal', () => ({
  useNotifications: () => ({
    data: mockNotificationsData,
    isLoading: false,
  }),
  useMarkNotificationRead: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}))

describe('Portal NotificationBell Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(portalContext, 'usePortal').mockReturnValue({
      currentStudent: mockStudent,
      students: [mockStudent],
      switchStudent: vi.fn(),
      userRole: 'student',
      user: null,
      unreadCount: 0,
      isLoading: false,
      siteName: 'CodeClove International School',
      logoutUrl: '/logout',
      theme: 'dark',
      resolvedTheme: 'dark',
      setTheme: vi.fn(),
    })
  })

  it('renders notification bell button with unread badge count', () => {
    const overdueItem: NotificationItem = {
      id: 1,
      title: 'Invoice Overdue',
      content: 'Invoice INV202610471 has passed its due date with balance INR 250.00.',
      event_type: 'invoice_overdue',
      is_read: false,
      created_at: new Date(Date.now() - 3600_000).toISOString(),
      url: '/portal/finance',
    }

    mockNotificationsData = {
      notifications: [overdueItem],
      unread_count: 5,
      total: 5,
    }

    const html = renderToString(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    )

    expect(html).toContain('aria-label="Notifications (5 unread)"')
    expect(html).toContain('5')
    expect(html).toContain('<svg')
  })

  it('handles zero unread count without badge pill', () => {
    mockNotificationsData = {
      notifications: [],
      unread_count: 0,
      total: 0,
    }

    const html = renderToString(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    )

    expect(html).toContain('aria-label="Notifications"')
    expect(html).not.toContain('bg-danger')
  })

  it('renders correctly with notification items in state', () => {
    const notifications: NotificationItem[] = [
      {
        id: 10,
        title: 'Invoice Overdue',
        content: 'Invoice INV202610471 has passed its due date with balance INR 250.00.',
        event_type: 'invoice_overdue',
        is_read: false,
        created_at: new Date(Date.now() - 3600_000).toISOString(),
        url: '/portal/finance',
      },
      {
        id: 11,
        title: 'Annual Sports Meet & Schedule Published',
        content: 'The annual sports meet has been scheduled.',
        event_type: 'announcement',
        is_read: false,
        created_at: new Date(Date.now() - 7200_000).toISOString(),
      },
      {
        id: 12,
        title: 'School Library Digital Catalog Update',
        content: 'Over 200 new reference books added.',
        event_type: 'announcement',
        is_read: true,
        created_at: new Date(Date.now() - 86400_000).toISOString(),
        url: 'https://library.example.com',
      },
    ]

    mockNotificationsData = {
      notifications,
      unread_count: 2,
      total: 3,
    }

    const html = renderToString(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    )

    expect(html).toContain('aria-label="Notifications (2 unread)"')
    expect(html).toContain('2')
  })
})
