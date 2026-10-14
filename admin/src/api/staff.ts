/**
 * TanStack Query hooks for the Staff Members API.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/api/query-keys'
import type { StaffFormData } from '../schemas/staff'
import type { PaginatedResponse } from '@/api/academics'
import type { StaffAppStatus } from '@/lib/constants'

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



// ─── Staff Applications ───────────────────────────────────────────────────────

export interface StaffApplication {
  id: number
  reference_number: string
  status: StaffAppStatus | string
  source: string
  desired_role: string
  department: string
  first_name: string
  middle_name?: string | null
  last_name: string
  preferred_name?: string | null
  date_of_birth?: string | null
  gender?: string | null
  email: string
  phone?: string | null
  address_json?: string | null
  experience_json?: string | null
  custom_fields_json?: string | null
  photo_id?: number | null
  submitted_at: string
  reviewed_at?: string | null
  decision_at?: string | null
  converted_staff_member_id?: number | null
  converted_user_id?: number | null
  status_history?: Array<{
    id: number
    staff_application_id: number
    from_status: string | null
    to_status: string
    reason: string
    message: string
    visibility?: string
    changed_by?: number | null
    actor_name?: string | null
    changed_at: string
  }>
  created_at: string
  updated_at: string
}

export interface StaffApplicationFilters {
  page?: number
  per_page?: number
  search?: string
  status?: string
  desired_role?: string
  department?: string
  date_from?: string
  date_to?: string
  orderby?: string
  order?: 'asc' | 'desc' | ''
}

export function useStaffApplications(filters: StaffApplicationFilters = {}) {
  const params: Record<string, any> = {
    page: filters.page ?? 1,
    per_page: filters.per_page ?? 10,
    search: filters.search,
    status: filters.status,
    desired_role: filters.desired_role,
    department: filters.department,
    date_from: filters.date_from,
    date_to: filters.date_to,
    orderby: filters.orderby || undefined,
    order: filters.order || undefined,
  }

  return useQuery<PaginatedResponse<StaffApplication>>({
    queryKey: queryKeys.staff.applications.list(filters),
    queryFn: async () => {
      const res = await api.list<StaffApplication[]>(`staff-applications${toQueryString(params)}`)
      return {
        data: res.data,
        total: res.pagination.total,
        page: res.pagination.current_page,
        per_page: res.pagination.per_page,
        total_pages: res.pagination.total_pages,
      }
    },
  })
}

export function useStaffApplicationDetails(id: number) {
  return useQuery<StaffApplication>({
    queryKey: queryKeys.staff.applications.detail(id),
    queryFn: async () => {
      const res = await api.get<StaffApplication>(`staff-applications/${id}`)
      return res.data
    },
    enabled: !!id,
  })
}

export function useUpdateStaffApplicationStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, reason, message }: { id: number; status: string; reason?: string; message?: string }) => {
      const res = await api.post<StaffApplication>(`staff-applications/${id}/status`, { status, reason, message })
      return res.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.applications.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.applications.detail(variables.id) })
    },
  })
}

export interface UpdateStaffApplicationPayload {
  id: number
  first_name: string
  middle_name?: string
  last_name?: string
  desired_role?: string
  department?: string
  gender?: string
  email: string
  phone?: string
  date_of_birth?: string
  address?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
  qualification?: string
  specialization?: string
  experience_years?: string
  experience_details?: string
  cover_letter?: string
  remarks?: string
}

export function useUpdateStaffApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateStaffApplicationPayload) => {
      const res = await api.patch<StaffApplication>(`staff-applications/${id}`, payload)
      return res.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.applications.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.applications.detail(variables.id) })
    },
  })
}

export function useConvertStaffApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload?: { role_id?: number | null; designation?: string; department?: string; user_id?: number | null } }) => {
      const res = await api.post<{ application_id: number; staff_id: number; staff_number: string }>(`staff-applications/${id}/convert`, payload || {})
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.applications.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.all })
    },
  })
}

export function useBulkStaffApplicationsAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { action: 'delete' | 'status'; ids: number[]; status?: string }) => {
      const res = await api.post<{ action: string; deleted_count?: number; updated_count?: number; errors?: string[] }>('staff-applications/bulk-action', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.applications.all })
    },
  })
}
