import { queryKeys } from '../api/query-keys'
/**
 * Application-wide constants.
 *
 * Centralises all magic values, route IDs, status lists, and permission keys.
 * Import from this file instead of repeating strings anywhere in the app.
 */

// ─── Route IDs ────────────────────────────────────────────────────────────────
// Match the internal route IDs defined in docs/NAVIGATION.md

export const ROUTES = {
  DASHBOARD:          '/dashboard',

  // Academics
  ACADEMICS:          '/academics',
  SESSIONS:           '/academics/sessions',
  UNITS:              '/academics/units',
  GROUPS:             '/academics/groups',
  SUBJECTS:           '/academics/subjects',
  TIMETABLE:          '/academics/timetable',

  // Students
  STUDENT_DIRECTORY:  '/students',
  STUDENT_NEW:        '/students/new',
  ADMISSIONS:         '/students/admissions',
  ATTENDANCE:         '/students/attendance',
  PROMOTION_ROLLOVER: '/students/promotion',


  // Staff & HR
  STAFF_DIRECTORY:    '/staff',
  STAFF_NEW:          '/staff/new',
  STAFF_APPLICATIONS: '/staff/applications',
  ROLES_PERMISSIONS:  '/staff/roles',

  // Finance
  FINANCE_DASHBOARD:  '/finance',
  FEE_TYPES:          '/finance/fee-types',
  INVOICES:           '/finance/invoices',
  INVOICE_NEW:        '/finance/invoices/new',
  PAYMENTS:           '/finance/payments',
  DEFAULTERS_REPORT:  '/finance/reports/defaulters',

  // Communication & Noticeboard
  ANNOUNCEMENTS:      '/announcements',

  // Settings
  SETTINGS:           '/settings',
  ACTIVITY_LOG:       '/settings?tab=activity_log',
  MY_ACCOUNT:         '/me',
} as const

// ─── Permission Keys ──────────────────────────────────────────────────────────
// Match docs/PERMISSIONS.md dot-notation format

export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW:                 'dashboard.view',

  // Academics
  SESSIONS_VIEW:                  'academic_sessions.view',
  SESSIONS_ADD:                   'academic_sessions.add',
  SESSIONS_EDIT:                  'academic_sessions.edit',
  SESSIONS_DELETE:                'academic_sessions.delete',
  UNITS_VIEW:                     'academic_units.view',
  GROUPS_VIEW:                    'academic_groups.view',
  SUBJECTS_VIEW:                  'subjects.view',
  TIMETABLE_VIEW:                 'timetable.view',

  // Admissions
  ADMISSIONS_VIEW:                'admissions.view',
  ADMISSIONS_ADD:                 'admissions.add',
  ADMISSIONS_EDIT:                'admissions.edit',
  ADMISSIONS_APPROVE:             'admissions.approve',
  ADMISSIONS_CONVERT:             'admissions.convert',

  // Students
  STUDENTS_VIEW:                  'students.view',
  STUDENTS_ADD:                   'students.add',
  STUDENTS_EDIT:                  'students.edit',
  STUDENTS_DELETE:                'students.delete',
  STUDENTS_PROMOTE:               'students.promote',

  // Guardians
  GUARDIANS_VIEW:                 'guardians.view',
  GUARDIANS_ADD:                  'guardians.add',
  GUARDIANS_EDIT:                 'guardians.edit',

  // Attendance
  ATTENDANCE_VIEW:                'attendance.view',
  ATTENDANCE_ADD:                 'attendance.add',
  ATTENDANCE_EDIT:                'attendance.edit',

  // Staff
  STAFF_VIEW:                     'staff.view',
  STAFF_ADD:                      'staff.add',
  STAFF_EDIT:                     'staff.edit',
  STAFF_ATTENDANCE_VIEW:          'staff_attendance.view',
  STAFF_APPS_VIEW:                'staff_applications.view',
  STAFF_APPS_APPROVE:             'staff_applications.approve',
  STAFF_APPS_CONVERT:             'staff_applications.convert',
  ROLES_MANAGE:                   'roles_permissions.manage',

  // Finance
  FINANCE_VIEW:                   'finance.view',
  FEE_TYPES_VIEW:                 'fee_types.view',
  FEE_TYPES_ADD:                  'fee_types.add',
  INVOICES_VIEW:                  'invoices.view',
  INVOICES_ADD:                   'invoices.add',
  PAYMENTS_VIEW:                  'payments.view',
  PAYMENTS_ADD:                   'payments.add',

  // Settings & System
  SETTINGS_MANAGE:                'settings.manage',
  NOTIFICATIONS_MANAGE:           'notifications.manage',
} as const

// ─── Admission Statuses ───────────────────────────────────────────────────────

export const ADMISSION_STATUSES = [
  'inquiry',
  'submitted',
  'under_review',
  'more_info_needed',
  'interview_scheduled',
  'accepted',
  'waitlisted',
  'rejected',
  'admitted',
  'withdrawn',
] as const

export type AdmissionStatus = typeof ADMISSION_STATUSES[number]

// ─── Staff Application Statuses ───────────────────────────────────────────────

export const STAFF_APP_STATUSES = [
  'submitted',
  'under_review',
  'more_info_needed',
  'interview_scheduled',
  'offer_sent',
  'accepted',
  'rejected',
  'hired',
  'withdrawn',
] as const

export type StaffAppStatus = typeof STAFF_APP_STATUSES[number]

// ─── Academic Session Statuses ────────────────────────────────────────────────

export const SESSION_STATUSES = ['draft', 'active', 'archived'] as const
export type SessionStatus = typeof SESSION_STATUSES[number]

// ─── Attendance Statuses ──────────────────────────────────────────────────────

export const ATTENDANCE_STATUSES = [
  'present',
  'absent',
  'late',
  'half_day',
  'excused',
  'holiday',
] as const

export type AttendanceStatus = typeof ATTENDANCE_STATUSES[number]

// ─── Pagination ───────────────────────────────────────────────────────────────

export const DEFAULT_PAGE_SIZE = 25
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

// ─── Query Keys ───────────────────────────────────────────────────────────────
// Centralised TanStack Query cache keys

export const QUERY_KEYS = queryKeys

// ─── Gender Options ───────────────────────────────────────────────────────────

export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const

export type GenderOption = typeof GENDER_OPTIONS[number]['value']

export const GENDER_LABELS: Record<string, string> = {
  ...Object.fromEntries(GENDER_OPTIONS.map((o) => [o.value, o.label])),
  other: 'Other',
}

export function formatGender(gender?: string | null): string {
  if (!gender) return '—'
  const key = gender.toLowerCase().trim().replace(/[-\s]+/g, '_')
  return GENDER_LABELS[key] || gender.replace(/_/g, ' ')
}
