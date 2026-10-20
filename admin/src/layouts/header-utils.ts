import type { LucideIcon } from 'lucide-react'
import {
  Receipt,
  UserPlus,
  Briefcase,
  Megaphone,
} from 'lucide-react'
import { ROUTES, PERMISSIONS } from '@/lib/constants'
import type { PermissionKey } from '@/lib/permissions'
import { __ } from '@/lib/i18n'

// ─── Search Button Helpers ───────────────────────────────────────────────────

export function getSearchShortcut(platformStr: string): string {
  return /mac|iphone|ipad|ipod/i.test(platformStr) ? '⌘K' : 'Ctrl+K'
}

export const IS_MAC = typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(
  (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || navigator.userAgent || ''
)

// ─── Relative Time Helper ─────────────────────────────────────────────────────

export function formatRelativeTime(dateString: string, now: Date = new Date()): string {
  const date = new Date(dateString)
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (Number.isNaN(diffSec) || diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`

  const sameYear = date.getFullYear() === now.getFullYear()
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

export function getNotificationButtonAriaLabel(unreadCount: number): string {
  return unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'
}

// ─── Quick Create Actions ─────────────────────────────────────────────────────

export const QUICK_CREATE_ACTIONS: Array<{
  label: string
  to: string
  icon: LucideIcon
  permission: PermissionKey | PermissionKey[]
}> = [
  { label: __( 'Create Invoice', 'codeclove-school-management' ),   to: ROUTES.INVOICE_NEW,       icon: Receipt,       permission: PERMISSIONS.INVOICES_ADD },
  { label: __( 'Admit Student', 'codeclove-school-management' ),    to: ROUTES.STUDENT_NEW,       icon: UserPlus,      permission: [PERMISSIONS.STUDENTS_ADD, PERMISSIONS.ADMISSIONS_ADD] },
  { label: __( 'New Staff Record', 'codeclove-school-management' ), to: ROUTES.STAFF_NEW,         icon: Briefcase,     permission: PERMISSIONS.STAFF_ADD },
  { label: __( 'New Announcement', 'codeclove-school-management' ), to: ROUTES.ANNOUNCEMENT_NEW, icon: Megaphone, permission: PERMISSIONS.NOTIFICATIONS_MANAGE },
]

// ─── User Menu Helpers ────────────────────────────────────────────────────────

export function getSignOutUrl(config?: { adminUrl?: string; logoutUrl?: string }): string {
  return config?.logoutUrl || (config?.adminUrl
    ? `${config.adminUrl.replace(/wp-admin\/.*$/, '')}wp-login.php?action=logout`
    : '/wp-login.php?action=logout')
}
