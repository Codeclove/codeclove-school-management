/**
 * CodeClove Portal — Core TypeScript Types & Interfaces.
 */

export type UserRole = 'guardian' | 'student' | 'admin'

export interface PortalUser {
  id: number
  name: string
  email: string
}

export interface PortalStudent {
  id: number
  student_number?: string
  admission_number?: string
  first_name: string
  middle_name?: string
  last_name: string
  full_name: string
  gender?: string
  photo_url?: string
  unit_name?: string
  group_name?: string
  roll_number?: string
  date_of_birth?: string
  blood_group?: string
  address?: string | Record<string, string>
  phone?: string
  email?: string
  admission_date?: string
  status?: string
  session_name?: string
  enrollment?: {
    session_name?: string
    unit_name?: string
    group_name?: string
    roll_number?: string
  }
}

export interface PortalGuardian {
  id: number
  first_name: string
  last_name: string
  full_name?: string
  relationship?: string
  phone?: string
  email?: string
  is_emergency_contact?: boolean
  is_primary?: boolean
}

export interface PortalAppearance {
  theme_color?: string
  ui_scale?: string
  mode?: string
  theme_mode?: string
}

export interface PortalLocalization {
  date_format?: string
  time_format?: string
  timezone?: string
  week_start_day?: number
  currency?: string
  currency_position?: 'left' | 'left_space' | 'right' | 'right_space'
  decimal_precision?: number
  number_format?: 'standard' | 'indian'
}

export interface PortalSchool {
  name?: string
  code?: string
  logo?: string
  signature?: string
  email?: string
  phone?: string
  website?: string
  address?: string
}

export type PortalLabels = Record<string, { singular?: string; plural?: string }>

export interface PortalFinanceSettings {
  allow_partial_payments?: boolean
  min_partial_amount?: number
}

export interface PortalSettings {
  appearance?: PortalAppearance
  localization?: PortalLocalization
  school?: PortalSchool
  labels?: PortalLabels
  finance?: PortalFinanceSettings
}
export interface PortalMeResponse {
  role: UserRole
  user: PortalUser
  guardian?: PortalGuardian
  student?: PortalStudent
  students: PortalStudent[]
  default_student_id?: number
  settings?: PortalSettings
}

export interface AttendanceSummary {
  percentage: number
  present_days?: number
  absent_days?: number
  late_days?: number
  half_days?: number
  total_days?: number
  total?: number
  present?: number
  absent?: number
  late?: number
  half_day?: number
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'excused'

export interface AttendanceRecord {
  attendance_date: string
  status: AttendanceStatus
  note?: string
}

export interface AttendanceData {
  month: string
  summary: AttendanceSummary
  records: AttendanceRecord[]
}

export interface FinanceSummary {
  total_invoiced: number
  total_paid: number
  balance: number
  overdue: number
  overdue_amount?: number
  next_due_date?: string | null
  next_due_amount?: number | null
  currency: string
}

export interface InvoiceLineItem {
  id?: number
  description: string
  quantity?: number
  amount: number
  total_minor?: number
  unit_amount_minor?: number
}

export interface InvoicePayment {
  id?: number
  invoice_id?: number
  invoice_number?: string
  payment_number: string
  amount: number
  amount_minor?: number
  paid_on: string
  method: string
  status?: string
}

export type InvoiceStatus = 'paid' | 'partially_paid' | 'overdue' | 'issued' | 'pending' | 'draft' | 'cancelled' | 'void'

export interface Invoice {
  id: number
  invoice_number: string
  issue_date: string
  due_date: string
  total: number
  paid: number
  balance: number
  total_minor?: number
  paid_minor?: number
  balance_minor?: number
  status: InvoiceStatus
  line_items?: InvoiceLineItem[]
  payments?: InvoicePayment[]
}

export interface FinanceData {
  summary: FinanceSummary
  invoices: Invoice[]
}

export interface TimetableSlot {
  period_name: string
  start_time: string
  end_time: string
  subject_name: string
  teacher_name?: string
  staff_name?: string
  room?: string
}

export interface TimetableData {
  enrollment?: {
    unit_name?: string
    group_name?: string
  }
  days: Record<number | string, TimetableSlot[]>
}

export interface AcademicSubject {
  id?: number
  name: string
  code?: string
  type?: 'core' | 'elective' | string
}

export interface AcademicData {
  enrollment?: {
    session_name?: string
    unit_name?: string
    group_name?: string
    roll_number?: string
    starts_on?: string
  }
  subjects: AcademicSubject[]
}

export interface NotificationItem {
  id: number
  title: string
  content?: string
  event_type?: string
  is_read: boolean | number
  url?: string
  created_at: string
  read_at?: string
}

export interface NotificationsResponse {
  notifications: NotificationItem[]
  unread_count: number
  total: number
}


export interface ProfileData {
  student: PortalStudent
  guardians: PortalGuardian[]
}

export interface CalendarEvent {
  id: string | number
  title: string
  date: string
  time?: string
  type: 'deadline' | 'exam' | 'holiday' | 'event' | 'schedule' | string
  category: 'finance' | 'academic' | 'attendance' | 'general'
  url?: string
  location?: string
  description?: string
  amount?: number
  currency?: string
}

export interface DashboardData {
  attendance: AttendanceSummary
  finance: FinanceSummary
  today_timetable: TimetableSlot[]
  recent_notifications: NotificationItem[]
  academic?: AcademicData
  calendar_events?: CalendarEvent[]
}

export interface CodeClovePortalConfig {
  restUrl: string
  nonce: string
  isPro?: boolean
  locale?: string
  rtl?: boolean
  i18n?: { locale_data: Record<string, Record<string, unknown>> } | null
  currentUser?: {
    id: number
    name: string
    email: string
  }
  context?: PortalMeResponse
  logoutUrl?: string
  siteName?: string
  logoUrl?: string
  settings?: PortalSettings
}

declare global {
  interface Window {
    CodeClovePortalConfig?: CodeClovePortalConfig
  }
}
