/**
 * TanStack Query hooks for the Attendance API.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/api/query-keys'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StudentAttendance {
  student_id: number
  first_name: string
  last_name: string
  student_number: string
  roll_number: string | null
  academic_group_id?: number | null
  group_name?: string | null
  attendance_id: number | null
  status: 'present' | 'absent' | 'late' | 'half_day' | 'excused' | 'holiday' | 'on_leave' | null
  note: string | null
  taken_by: number | null
}

export interface StaffAttendance {
  staff_member_id: number
  first_name: string
  last_name: string
  staff_number: string
  department: string | null
  designation: string | null
  attendance_id: number | null
  status: 'present' | 'absent' | 'late' | 'half_day' | 'excused' | 'holiday' | 'on_leave' | null
  note: string | null
  taken_by: number | null
}

export interface StudentAttendanceFilters {
  academic_session_id?: number
  academic_unit_id?: number
  academic_group_id?: number
  attendance_date?: string
}

export interface StudentAttendanceHistory {
  id: number
  student_id: number
  academic_session_id: number
  academic_unit_id: number
  academic_group_id: number | null
  attendance_date: string
  status: 'present' | 'absent' | 'late' | 'half_day' | 'excused' | 'holiday'
  note: string | null
  taken_by: number | null
  unit_name?: string
  group_name?: string
  session_name?: string
}

export interface StaffAttendanceHistory {
  id: number
  staff_member_id: number
  attendance_date: string
  status: 'present' | 'absent' | 'late' | 'half_day' | 'excused' | 'holiday' | 'on_leave'
  note: string | null
  taken_by: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toQueryString(params?: Record<string, any>): string {
  if (!params) return ''
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
  )
  const qs = new URLSearchParams(clean).toString()
  return qs ? `?${qs}` : ''
}

// ─── Student Hooks ────────────────────────────────────────────────────────────

/**
 * Hook to retrieve the student daily attendance register.
 */
export function useAttendanceRegister(filters: StudentAttendanceFilters) {
  const enabled = !!filters.academic_session_id && !!filters.academic_unit_id && !!filters.attendance_date
  return useQuery<StudentAttendance[]>({
    queryKey: queryKeys.attendance.register(filters),
    queryFn: async () => {
      const response = await api.get<StudentAttendance[]>(`attendance${toQueryString(filters)}`)
      return response.data
    },
    enabled,
  })
}

/**
 * Hook to retrieve the attendance history of a single student.
 */
export function useStudentAttendanceHistory(studentId: number) {
  return useQuery<StudentAttendanceHistory[]>({
    queryKey: queryKeys.attendance.studentHistory(studentId),
    queryFn: async () => {
      const response = await api.get<StudentAttendanceHistory[]>(`attendance?student_id=${studentId}`)
      return response.data
    },
    enabled: studentId > 0,
  })
}

/**
 * Hook to save or update student daily attendance.
 */
export function useSaveAttendance() {
  const queryClient = useQueryClient()

  return useMutation<
    { saved: boolean },
    Error,
    {
      academic_session_id: number
      academic_unit_id: number
      academic_group_id?: number
      attendance_date: string
      records: { student_id: number; status: string; note?: string }[]
    }
  >({
    mutationFn: async (payload) => {
      const response = await api.post<{ saved: boolean }>('attendance', payload)
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.registers(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.monthlyStudent(),
      })
      // Also invalidate histories for the affected students
      variables.records.forEach((rec) => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.attendance.studentHistory(rec.student_id),
        })
      })
    },
  })
}

// ─── Staff Hooks ──────────────────────────────────────────────────────────────

/**
 * Hook to retrieve the staff daily attendance register.
 */
export function useStaffAttendanceRegister(attendanceDate: string) {
  const enabled = !!attendanceDate
  return useQuery<StaffAttendance[]>({
    queryKey: queryKeys.attendance.staffRegister(attendanceDate),
    queryFn: async () => {
      const response = await api.get<StaffAttendance[]>(`staff/attendance?attendance_date=${attendanceDate}`)
      return response.data
    },
    enabled,
  })
}

/**
 * Hook to retrieve the attendance history of a single staff member.
 */
export function useStaffAttendanceHistory(staffMemberId: number) {
  return useQuery<StaffAttendanceHistory[]>({
    queryKey: queryKeys.attendance.staffHistory(staffMemberId),
    queryFn: async () => {
      const response = await api.get<StaffAttendanceHistory[]>(`staff/attendance?staff_member_id=${staffMemberId}`)
      return response.data
    },
    enabled: staffMemberId > 0,
  })
}

/**
 * Hook to save or update staff daily attendance.
 */
export function useSaveStaffAttendance() {
  const queryClient = useQueryClient()

  return useMutation<
    { saved: boolean },
    Error,
    {
      attendance_date: string
      records: { staff_member_id: number; status: string; note?: string }[]
    }
  >({
    mutationFn: async (payload) => {
      const response = await api.post<{ saved: boolean }>('staff/attendance', payload)
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.staffRegisters(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.monthlyStaff(),
      })
      variables.records.forEach((rec) => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.attendance.staffHistory(rec.staff_member_id),
        })
      })
    },
  })
}

export interface MonthlyStudentAttendanceFilters {
  academic_session_id: number
  academic_unit_id: number
  academic_group_id?: number
  year: number
  month: number
}

export interface MonthlyStudentAttendanceResponse {
  days_in_month: number
  students: {
    student_id: number
    first_name: string
    last_name: string
    student_number: string
    roll_number: string | null
    class_name?: string
    section_name?: string | null
  }[]
  attendance: Record<number, Record<string, { status: string; note: string }>>
}

export interface MonthlyStaffAttendanceResponse {
  days_in_month: number
  staff: {
    staff_member_id: number
    first_name: string
    last_name: string
    staff_number: string
    department: string | null
    designation: string | null
  }[]
  attendance: Record<number, Record<string, { status: string; note: string }>>
}

export function useMonthlyAttendance(filters: MonthlyStudentAttendanceFilters) {
  const enabled = !!filters.academic_session_id && !!filters.academic_unit_id && !!filters.year && !!filters.month
  return useQuery<MonthlyStudentAttendanceResponse>({
    queryKey: queryKeys.attendance.monthlyStudent(filters),
    queryFn: async () => {
      const response = await api.get<MonthlyStudentAttendanceResponse>(`attendance/monthly${toQueryString(filters)}`)
      return response.data
    },
    enabled,
  })
}

export function useMonthlyStaffAttendance(year: number, month: number) {
  const enabled = !!year && !!month
  return useQuery<MonthlyStaffAttendanceResponse>({
    queryKey: queryKeys.attendance.monthlyStaff(year, month),
    queryFn: async () => {
      const response = await api.get<MonthlyStaffAttendanceResponse>(`staff/attendance/monthly?year=${year}&month=${month}`)
      return response.data
    },
    enabled,
  })
}
