/**
 * Dashboard stats API hook.
 *
 * Fetches aggregated dashboard statistics from GET /codeclove/v1/dashboard/stats.
 * The backend only returns buckets the current user is permitted to see.
 */
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/api/query-keys'
import { api } from '@/lib/api-client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AttendanceStat {
  total: number
  present: number
  percentage: number | null
}

export interface PendingApprovals {
  admissions: number
  staff_apps: number
  total: number
}

export interface TrendPoint {
  label: string   // YYYY-MM or YYYY-MM-DD
  count?: number  // admissions trend
  billed?: number    // finance trend (minor units)
  collected?: number // finance trend (minor units)
  present?: number   // attendance trend
  total?: number     // attendance trend
}

export interface SetupChecklist {
  preset: boolean
  session: boolean
  units: boolean
  roles: boolean
  admission: boolean
}

export interface RecentEvent {
  id: number
  event_type: string
  actor_type: string
  actor_id: number
  actor_name: string | null
  created_at: string
  label: string | null
  prefix?: string
  detail?: string
  url: string | null
}

export interface TodaySummary {
  date: string                // ISO date string
  attendance_pct: number | null
  present: number
  absent: number
  total: number
  pending_approvals: number
}

export interface StaffAttendanceSummary {
  total: number
  present: number
  absent: number
  pct: number | null
}

export interface CurrentTerm {
  id: number
  name: string
  starts_on: string
  ends_on: string
}

export interface DashboardStats {
  // KPIs — present only when permitted
  total_students?: number
  open_admissions?: number
  total_staff?: number
  outstanding_fees_minor?: number
  overdue_invoices?: number
  attendance_today?: AttendanceStat
  pending_approvals?: PendingApprovals
  // Metric deltas and labels
  student_delta?: string
  student_delta_positive?: boolean
  student_delta_label?: string
  admissions_delta?: string
  admissions_delta_positive?: boolean
  admissions_delta_label?: string
  staff_delta?: string
  staff_delta_positive?: boolean
  staff_delta_label?: string
  fees_delta_minor?: number
  fees_delta_positive?: boolean
  fees_delta_label?: string
  overdue_delta?: string
  overdue_delta_positive?: boolean
  overdue_delta_label?: string

  // Charts — present only when permitted
  admissions_trend?: TrendPoint[]
  finance_trend?: TrendPoint[]
  attendance_trend?: TrendPoint[]

  // Today at a glance (combined card)
  today_summary?: TodaySummary
  staff_attendance_today?: StaffAttendanceSummary

  // Current term context (for range label)
  current_term?: CurrentTerm | null

  // Activity
  recent_events?: RecentEvent[]

  // Admin-only
  setup_checklist?: SetupChecklist

  // Role context
  user_role?: string | null
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export type DashboardRange = 'today' | 'term' | 'session' | '30days'

export function useDashboardStats(
  sessionId?: number,
  range: DashboardRange = 'term'
) {
  return useQuery<DashboardStats>({
    queryKey: queryKeys.dashboard.stats(sessionId, range),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (sessionId) params.set('session_id', String(sessionId))
      params.set('range', range)
      const res = await api.get<DashboardStats>(`dashboard/stats?${params}`)
      return res.data
    },
    staleTime: 60 * 1000,
  })
}
