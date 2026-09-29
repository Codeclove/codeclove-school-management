/**
 * Portal REST API hooks and calls.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { portalApi } from '../lib/api-client'
import type {
  AcademicData,
  AttendanceData,
  DashboardData,
  FinanceData,
  NotificationsResponse,
  PortalMeResponse,
  ProfileData,
  TimetableData,
} from '../types'

export const portalKeys = {
  me: ['portal', 'me'] as const,
  dashboard: (studentId?: number) => ['portal', 'dashboard', studentId] as const,
  attendance: (studentId?: number, month?: string) => ['portal', 'attendance', studentId, month] as const,
  finance: (studentId?: number) => ['portal', 'finance', studentId] as const,
  timetable: (studentId?: number) => ['portal', 'timetable', studentId] as const,
  academics: (studentId?: number) => ['portal', 'academics', studentId] as const,
  notifications: {
    all: ['portal', 'notifications'] as const,
    list: (studentId?: number, page?: number) => ['portal', 'notifications', studentId, page] as const,
  },
  profile: (studentId?: number) => ['portal', 'profile', studentId] as const,
}

export function usePortalMe(initialData?: PortalMeResponse) {
  return useQuery({
    queryKey: portalKeys.me,
    queryFn: () => portalApi.get<PortalMeResponse>('me'),
    initialData,
    staleTime: 5 * 60 * 1000,
  })
}

export function useDashboard(studentId?: number) {
  return useQuery({
    queryKey: portalKeys.dashboard(studentId),
    queryFn: () => portalApi.get<DashboardData>('dashboard', { student_id: studentId }),
    enabled: Boolean(studentId),
  })
}

export function useAttendance(studentId?: number, month?: string) {
  return useQuery({
    queryKey: portalKeys.attendance(studentId, month),
    queryFn: () => portalApi.get<AttendanceData>('attendance', { student_id: studentId, month }),
    enabled: Boolean(studentId),
  })
}

export function useFinance(studentId?: number) {
  return useQuery({
    queryKey: portalKeys.finance(studentId),
    queryFn: () => portalApi.get<FinanceData>('finance', { student_id: studentId }),
    enabled: Boolean(studentId),
  })
}

export function useTimetable(studentId?: number) {
  return useQuery({
    queryKey: portalKeys.timetable(studentId),
    queryFn: () => portalApi.get<TimetableData>('timetable', { student_id: studentId }),
    enabled: Boolean(studentId),
  })
}

export function useAcademics(studentId?: number) {
  return useQuery({
    queryKey: portalKeys.academics(studentId),
    queryFn: () => portalApi.get<AcademicData>('academics', { student_id: studentId }),
    enabled: Boolean(studentId),
  })
}

export function useNotifications(studentId?: number, page = 1, perPage = 20) {
  return useQuery({
    queryKey: portalKeys.notifications.list(studentId, page),
    queryFn: () =>
      portalApi.get<NotificationsResponse>('notifications', {
        student_id: studentId,
        page,
        per_page: perPage,
      }),
    enabled: Boolean(studentId),
  })
}

export function useMarkNotificationRead(studentId?: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id?: number) =>
      portalApi.post<{ success: boolean }>('notifications/read', { id, student_id: studentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.notifications.all })
      queryClient.invalidateQueries({ queryKey: portalKeys.dashboard(studentId) })
      queryClient.invalidateQueries({ queryKey: portalKeys.me })
    },
  })
}


export function useProfile(studentId?: number) {
  return useQuery({
    queryKey: portalKeys.profile(studentId),
    queryFn: () => portalApi.get<ProfileData>('profile', { student_id: studentId }),
    enabled: Boolean(studentId),
  })
}


export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ studentId, payload }: { studentId?: number; payload: Record<string, unknown> }) =>
      portalApi.post<ProfileData>(studentId ? `profile?student_id=${studentId}` : 'profile', payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: portalKeys.profile(variables.studentId) })
      queryClient.invalidateQueries({ queryKey: portalKeys.me })
    },
  })
}
