/**
 * TanStack Query hooks for the Staff Members API.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/api/query-keys'
import type { StaffFormData } from '../schemas/staff'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Staff {
  id: number
  user_id?: number | null
  role_id?: number | null
  role_name?: string
  staff_number: string
  title?: string | null
  first_name: string
  middle_name?: string | null
  last_name: string
  preferred_name?: string | null
  date_of_birth?: string | null
  gender?: string | null
  email: string
  phone?: string | null
  department?: string | null
  designation?: string | null
  staff_category?: string | null
  employment_type?: string | null
  joined_on?: string | null
  photo_id?: number | null
  photo_url?: string
  emergency_contact_name?: string | null
  emergency_contact_relationship?: string | null
  emergency_contact_phone?: string | null
  highest_qualification?: string | null
  specialization?: string | null
  metadata?: Record<string, unknown> | null
  documents?: { label: string; attachment_id: number; url: string }[]
  status: 'active' | 'inactive' | 'suspended'
  created_at?: string
  updated_at?: string
  address?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
  username?: string
  notification_preferences?: Record<string, boolean>
}

export type CreateStaffPayload = Omit<StaffFormData, 'role_id'> & {
  role_id?: number | string | null
  role?: string
  documents?: { label: string; attachment_id: number; url: string }[]
}

export type UpdateStaffPayload = Omit<Partial<StaffFormData>, 'role_id'> & {
  role_id?: number | string | null
  role?: string
  documents?: { label: string; attachment_id: number; url: string }[]
}

export interface StaffFilters {
  page?: number
  per_page?: number
  search?: string
  status?: string
  role_id?: string
  orderby?: string
  order?: 'asc' | 'desc' | ''
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toQueryString(params?: StaffFilters): string {
  if (!params) return ''
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
  ) as Record<string, string>
  const qs = new URLSearchParams(clean).toString()
  return qs ? `?${qs}` : ''
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Hook to retrieve staff members with pagination, search, and status filters.
 */
export function useStaff(filters: StaffFilters = {}) {
  return useQuery<{ data: Staff[]; total: number }>({
    queryKey: queryKeys.staff.list(filters),
    queryFn: async () => {
      const res = await api.list<Staff[]>(`staff${toQueryString(filters)}`)
      return { data: res.data, total: res.pagination.total }
    },
  })
}

/**
 * Hook to retrieve a single staff member details by ID.
 */
export function useStaffMember(id: number) {
  return useQuery<Staff>({
    queryKey: queryKeys.staff.detail(id),
    queryFn: async () => {
      const response = await api.get<Staff>(`staff/${id}`)
      return response.data
    },
    enabled: id > 0,
  })
}

/**
 * Hook to create a new staff member.
 */
export function useCreateStaff() {
  const queryClient = useQueryClient()

  return useMutation<Staff, Error, CreateStaffPayload>({
    mutationFn: async (payload) => {
      const response = await api.post<Staff>('staff', payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.all })
    },
  })
}

/**
 * Hook to update an existing staff member.
 */
export function useUpdateStaff(id: number) {
  const queryClient = useQueryClient()

  return useMutation<Staff, Error, UpdateStaffPayload>({
    mutationFn: async (payload) => {
      const response = await api.put<Staff>(`staff/${id}`, payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.detail(id) })
    },
  })
}

/**
 * Hook to delete a staff member.
 */
export function useDeleteStaff() {
  const queryClient = useQueryClient()

  return useMutation<{ deleted: boolean }, Error, number>({
    mutationFn: async (id) => {
      const response = await api.delete<{ deleted: boolean }>(`staff/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.all })
    },
  })
}

export function useBulkStaffAction() {
  const queryClient = useQueryClient()
  return useMutation<any, Error, { action: string; ids: number[]; status?: string }>({
    mutationFn: async (payload) => {
      const res = await api.post<any>('staff/bulk-action', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.all })
    },
  })
}

export interface BulkStaffImportResult {
  imported_count: number
  failed_count: number
  details: Array<{
    row: number
    staff_id?: number
    staff_number?: string
    name: string
    status: 'success' | 'error'
    message?: string
  }>
}

export function useImportStaffBulk() {
  const queryClient = useQueryClient()
  return useMutation<BulkStaffImportResult, Error, { role_id?: number | null; rows: Record<string, any>[] }>({
    mutationFn: async (payload) => {
      const res = await api.post<BulkStaffImportResult>('staff/bulk-import', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.all })
    },
  })
}

export async function getStaffImportTemplate(): Promise<{ headers: string[]; samples: string[][] }> {
  const res = await api.get<{ headers: string[]; samples: string[][] }>('staff/import-template')
  return res.data
}

