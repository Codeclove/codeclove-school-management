import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/api/query-keys'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface TimetablePeriod {
  id: number
  academic_session_id: number
  academic_unit_id: number
  name: string
  short_name: string
  type: 'lesson' | 'break' | 'assembly'
  start_time: string
  end_time: string
  sort_order: number
  created_at?: string
  updated_at?: string
}

export interface TimetableSlot {
  id: number
  academic_session_id: number
  academic_term_id: number
  academic_unit_id: number
  academic_group_id: number
  period_id: number
  day_of_week: number
  subject_id: number | null
  staff_member_id: number | null
  notes: string | null
  unit_name?: string
  group_name?: string
  subject_name?: string
  subject_code?: string
  subject_type?: string
  staff_first_name?: string
  staff_last_name?: string
}

export interface TimetableConflict {
  staff_member_id: number
  staff_first_name: string
  staff_last_name: string
  academic_term_id: number
  day_of_week: number
  period_id: number
  period_name: string
  start_time: string
  end_time: string
  slot_id_1: number
  unit_name_1: string
  group_name_1: string
  slot_id_2: number
  unit_name_2: string
  group_name_2: string
}

export interface TimetableSubstitute {
  id: number
  slot_id: number
  date: string
  substitute_staff_id: number | null
  reason: string | null
  academic_session_id?: number
  academic_term_id?: number
  academic_unit_id?: number
  academic_group_id?: number
  period_id?: number
  day_of_week?: number
  subject_id?: number | null
  original_staff_member_id?: number
  period_name?: string
  start_time?: string
  end_time?: string
  unit_name?: string
  group_name?: string
  subject_name?: string
  original_staff_first_name?: string
  original_staff_last_name?: string
  substitute_staff_first_name?: string
  substitute_staff_last_name?: string
}

// ─── Periods Hooks ────────────────────────────────────────────────────────────

export function usePeriods(filters: { academic_session_id: number; academic_unit_id: number }) {
  return useQuery<TimetablePeriod[]>({
    queryKey: queryKeys.timetable.periods.list(filters),
    queryFn: async () => {
      const res = await api.get<TimetablePeriod[]>(
        `timetable/periods?academic_session_id=${filters.academic_session_id}&academic_unit_id=${filters.academic_unit_id}`
      )
      return res.data
    },
    enabled: !!filters.academic_session_id && !!filters.academic_unit_id,
  })
}

export function useCreatePeriod() {
  const queryClient = useQueryClient()
  return useMutation<TimetablePeriod, Error, Omit<TimetablePeriod, 'id' | 'sort_order'>>({
    mutationFn: async (payload) => {
      const res = await api.post<TimetablePeriod>('timetable/periods', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timetable.periods.all })
    },
  })
}

export function useUpdatePeriod() {
  const queryClient = useQueryClient()
  return useMutation<TimetablePeriod, Error, { id: number; data: Partial<Omit<TimetablePeriod, 'id'>> }>({
    mutationFn: async ({ id, data }) => {
      const res = await api.patch<TimetablePeriod>(`timetable/periods/${id}`, data)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timetable.periods.all })
    },
  })
}

export function useDeletePeriod() {
  const queryClient = useQueryClient()
  return useMutation<boolean, Error, number>({
    mutationFn: async (id) => {
      const res = await api.delete<{ success: boolean }>(`timetable/periods/${id}`)
      return res.data.success
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timetable.all })
    },
  })
}

export function useReorderPeriods() {
  const queryClient = useQueryClient()
  return useMutation<boolean, Error, number[]>({
    mutationFn: async (ids) => {
      const res = await api.post<{ success: boolean }>('timetable/periods/reorder', { ids })
      return res.data.success
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timetable.periods.all })
    },
  })
}

// ─── Slots Hooks ──────────────────────────────────────────────────────────────

export function useTimetableSlots(filters: {
  academic_session_id?: number
  academic_term_id?: number
  academic_unit_id?: number
  academic_group_id?: number
  staff_member_id?: number
}) {
  return useQuery<TimetableSlot[]>({
    queryKey: queryKeys.timetable.slots.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.academic_session_id) params.append('academic_session_id', filters.academic_session_id.toString())
      if (filters.academic_term_id) params.append('academic_term_id', filters.academic_term_id.toString())
      if (filters.academic_unit_id) params.append('academic_unit_id', filters.academic_unit_id.toString())
      if (filters.academic_group_id) params.append('academic_group_id', filters.academic_group_id.toString())
      if (filters.staff_member_id) params.append('staff_member_id', filters.staff_member_id.toString())

      const res = await api.get<TimetableSlot[]>(`timetable/slots?${params.toString()}`)
      return res.data
    },
    enabled: !!filters.academic_session_id,
  })
}

export function useUpsertSlot() {
  const queryClient = useQueryClient()
  return useMutation<TimetableSlot, Error, Omit<TimetableSlot, 'id'>>({
    mutationFn: async (payload) => {
      const res = await api.post<TimetableSlot>('timetable/slots', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timetable.slots.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.timetable.conflicts() })
    },
  })
}

export function useDeleteSlot() {
  const queryClient = useQueryClient()
  return useMutation<boolean, Error, number>({
    mutationFn: async (id) => {
      const res = await api.delete<{ success: boolean }>(`timetable/slots/${id}`)
      return res.data.success
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timetable.slots.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.timetable.conflicts() })
    },
  })
}

export function useConflicts(session_id: number) {
  return useQuery<TimetableConflict[]>({
    queryKey: queryKeys.timetable.conflicts(session_id),
    queryFn: async () => {
      const res = await api.get<TimetableConflict[]>(`timetable/conflicts?academic_session_id=${session_id}`)
      return res.data
    },
    enabled: !!session_id,
  })
}

// ─── Substitutes Hooks ────────────────────────────────────────────────────────

export function useSubstitutes(filters: {
  date?: string
  academic_group_id?: number
  staff_member_id?: number
}) {
  return useQuery<TimetableSubstitute[]>({
    queryKey: queryKeys.timetable.substitutes.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.date) params.append('date', filters.date)
      if (filters.academic_group_id) params.append('academic_group_id', filters.academic_group_id.toString())
      if (filters.staff_member_id) params.append('staff_member_id', filters.staff_member_id.toString())

      const res = await api.get<TimetableSubstitute[]>(`timetable/substitutes?${params.toString()}`)
      return res.data
    },
    enabled: !!filters.date,
  })
}

export function useUpsertSubstitute() {
  const queryClient = useQueryClient()
  return useMutation<TimetableSubstitute, Error, { slot_id: number; date: string; substitute_staff_id: number | null; reason?: string }>({
    mutationFn: async (payload) => {
      const res = await api.post<TimetableSubstitute>('timetable/substitutes', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timetable.substitutes.all })
    },
  })
}

export function useDeleteSubstitute() {
  const queryClient = useQueryClient()
  return useMutation<boolean, Error, number>({
    mutationFn: async (id) => {
      const res = await api.delete<{ success: boolean }>(`timetable/substitutes/${id}`)
      return res.data.success
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timetable.substitutes.all })
    },
  })
}
