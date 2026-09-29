/**
 * TanStack Query hooks for the Students & Admissions module.
 *
 * Persists data client-side in localStorage to simulate REST endpoints while
 * integrating directly with the WordPress Settings API for generating identifiers.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type ApiPaginatedResponse } from '@/lib/api-client'
import { queryKeys } from '@/api/query-keys'
import type { StudentFormData } from '../schemas/students'


export interface PortalAccount {
  user_id: number
  username: string
  email: string
  password?: string
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface AdmissionStatusEvent {
  id: number
  application_id: number
  from_status: string | null
  to_status: string
  reason?: string
  message?: string
  actor_name?: string
  changed_by?: number
  changed_at: string
}

export interface AdmissionApplication {
  id: number
  reference_number: string
  status: 'inquiry' | 'submitted' | 'under_review' | 'more_info_needed' | 'interview_scheduled' | 'accepted' | 'waitlisted' | 'rejected' | 'admitted' | 'withdrawn'
  source: 'public_form' | 'admin_entry' | 'import' | 'referral' | 'other'
  academic_session_id: number
  academic_unit_id: number
  academic_group_id: number | null
  student_first_name: string
  student_middle_name?: string
  student_last_name: string
  student_preferred_name?: string
  student_date_of_birth?: string
  student_gender?: string
  guardian_name: string
  guardian_email: string
  guardian_phone?: string
  address_json?: string
  custom_fields_json?: string
  submitted_at: string
  reviewed_at?: string
  decision_at?: string
  converted_student_id?: number
  converted_guardian_id?: number
  converted_enrollment_id?: number
  status_history?: AdmissionStatusEvent[]
  created_at: string
  updated_at: string
  deleted_at?: string
  student_photo_id?: number | null
  student_photo_url?: string
}

export interface Student {
  id: number
  user_id?: number | null
  portal_account?: PortalAccount | null
  student_number: string
  admission_number: string
  first_name: string
  middle_name?: string
  last_name: string
  preferred_name?: string
  date_of_birth?: string
  gender?: string
  status: 'active' | 'inactive' | 'graduated' | 'withdrawn'
  created_at: string
  updated_at: string
  photo_id?: number | null
  photo_url?: string
  admission_date?: string
  graduation_year?: number | null
  subject_ids?: number[]
  address?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
  email?: string
  phone?: string
}

export interface StudentEnrollment {
  id: number
  student_id: number
  academic_session_id: number
  academic_unit_id: number
  academic_group_id: number | null
  roll_number?: string
  starts_on: string
  ends_on?: string
  status: 'active' | 'transferred' | 'completed' | 'withdrawn' | 'promoted' | 'retained'
  session_name?: string
  unit_name?: string
  group_name?: string
}

export interface Guardian {
  id: number
  user_id?: number | null
  portal_account?: PortalAccount | null
  relationship?: string
  first_name: string
  middle_name?: string
  last_name: string
  email?: string
  phone?: string
  alternate_phone?: string
  occupation?: string
  address_json?: string
  status: 'active' | 'inactive' | 'archived'
}

export interface StudentGuardian {
  id: number
  student_id: number
  guardian_id: number
  relationship: string
  is_primary: boolean
  is_billing_contact: boolean
  is_emergency_contact: boolean
}

export interface FullStudent extends Student {
  enrollment?: StudentEnrollment
  enrollments?: StudentEnrollment[]
  guardian?: Guardian
  relationship?: string
  father?: Guardian | null
  mother?: Guardian | null
  guardians?: Guardian[]
  primary_guardian?: Guardian | null
}



// ─── TanStack Query Hooks ──────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

interface ListParams {
  page?: number
  per_page?: number
  search?: string
  status?: string
  academic_session_id?: number
  academic_unit_id?: number
  [key: string]: string | number | undefined
}

function toQueryString(params?: ListParams): string {
  if (!params) return ''
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined)
  ) as Record<string, string>
  const qs = new URLSearchParams(filtered as Record<string, string>).toString()
  return qs ? `?${qs}` : ''
}

function toPaginatedResponse<T>(res: ApiPaginatedResponse<T[]>): PaginatedResponse<T> {
  return {
    data:        res.data,
    total:       res.pagination.total,
    page:        res.pagination.current_page,
    per_page:    res.pagination.per_page,
    total_pages: res.pagination.total_pages,
  }
}

export interface ApplicationFilters {
  academic_session_id?: number
  academic_unit_id?: number
  status?: string
  search?: string
  date_from?: string
  date_to?: string
  page?: number
  per_page?: number
  orderby?: string
  order?: 'asc' | 'desc' | ''
}

export function useAdmissions(filters: ApplicationFilters = {}) {
  const params: ListParams = {
    page: filters.page ?? 1,
    per_page: filters.per_page ?? 10,
    search: filters.search,
    status: filters.status,
    academic_session_id: filters.academic_session_id,
    academic_unit_id: filters.academic_unit_id,
    date_from: filters.date_from,
    date_to: filters.date_to,
    orderby: filters.orderby || undefined,
    order: filters.order || undefined,
  }
  return useQuery<PaginatedResponse<AdmissionApplication>>({
    queryKey: queryKeys.admissions.list(filters),
    queryFn: async () => toPaginatedResponse(await api.list<AdmissionApplication[]>(`admissions${toQueryString(params)}`)),
  })
}

export function useAdmissionDetails(id: number) {
  return useQuery<AdmissionApplication>({
    queryKey: queryKeys.admissions.detail(id),
    queryFn: async () => {
      const res = await api.get<AdmissionApplication>(`admissions/${id}`)
      return res.data
    },
    enabled: !!id,
  })
}

export function useUpdateAdmissionStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: AdmissionApplication['status'] }) => {
      const res = await api.post<AdmissionApplication>(`admissions/${id}/status`, { status })
      return res.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admissions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.admissions.detail(variables.id) })
    },
  })
}

export function useConvertAdmission() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      session_id,
      unit_id,
      group_id,
      guardian_id,
    }: {
      id: number
      session_id: number
      unit_id: number
      group_id: number | null
      guardian_id?: number | null
    }) => {
      const res = await api.post<AdmissionApplication>(`admissions/${id}/convert`, {
        session_id,
        unit_id,
        group_id,
        guardian_id,
      })
      return res.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admissions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.admissions.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.guardians.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.students.enrollmentCounts() })
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.units.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.all })
    },
  })
}

export interface StudentFilters {
  academic_session_id?: number
  academic_unit_id?: number
  academic_group_id?: number
  status?: string
  search?: string
  page?: number
  per_page?: number
  orderby?: string
  order?: 'asc' | 'desc' | ''
}

export function useStudents(filters: StudentFilters = {}) {
  const params: ListParams = {
    page: filters.page ?? 1,
    per_page: filters.per_page ?? 10,
    search: filters.search,
    status: filters.status,
    academic_session_id: filters.academic_session_id,
    academic_unit_id: filters.academic_unit_id,
    academic_group_id: filters.academic_group_id,
    orderby: filters.orderby || undefined,
    order: filters.order || undefined,
  }
  return useQuery<PaginatedResponse<FullStudent>>({
    queryKey: queryKeys.students.list(filters),
    queryFn: async () => toPaginatedResponse(await api.list<FullStudent[]>(`students${toQueryString(params)}`)),
  })
}

export function useStudentDetails(id: number) {
  return useQuery<FullStudent>({
    queryKey: queryKeys.students.detail(id),
    queryFn: async () => {
      const res = await api.get<FullStudent>(`students/${id}`)
      return res.data
    },
    enabled: !!id,
  })
}

export function useCreateStudent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: StudentFormData | (Partial<StudentFormData> & Record<string, unknown>)) => {
      const res = await api.post<FullStudent>('students', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.guardians.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.students.enrollmentCounts() })
      queryClient.invalidateQueries({ queryKey: queryKeys.units.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.all })
    },
  })
}
export function useGuardians() {
  return useQuery<Guardian[]>({
    queryKey: queryKeys.guardians.lists(),
    queryFn: async () => {
      const res = await api.get<Guardian[]>('students/guardians')
      return res.data
    }
  })
}

export function useGroupEnrollmentCounts() {
  return useQuery<Record<number, number>>({
    queryKey: queryKeys.students.enrollmentCounts(),
    queryFn: async () => {
      const res = await api.get<Record<number, number>>('students/enrollment-counts')
      return res.data
    }
  })
}

export function useUpdateStudent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: Partial<StudentFormData> & { id: number; [key: string]: unknown }) => {
      const { id, ...data } = payload
      const res = await api.patch<FullStudent>(`students/${id}`, data)
      return res.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.students.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.guardians.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.students.enrollmentCounts() })
    }
  })}

export function useUpdateAdmission() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      id: number
      student_first_name: string
      student_middle_name?: string
      student_last_name: string
      student_date_of_birth?: string
      student_gender?: string
      academic_session_id: number
      academic_unit_id: number
      guardian_name: string
      guardian_email: string
      guardian_phone?: string
      student_photo_id?: number | null
      address_json?: string | null
      custom_fields_json?: string | null
    }) => {
      const res = await api.patch<AdmissionApplication>(`admissions/${payload.id}`, payload)
      return res.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admissions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.admissions.detail(variables.id) })
    }
  })
}

export function useBulkStudentsAction() {
  const queryClient = useQueryClient()
  return useMutation<any, Error, { action: string; ids: number[]; status?: string; unit_id?: number; group_id?: number }>({
    mutationFn: async (payload) => {
      const res = await api.post<any>('students/bulk-action', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all })
    },
  })
}

export function useBulkAdmissionsAction() {
  const queryClient = useQueryClient()
  return useMutation<any, Error, { action: string; ids: number[]; status?: string; session_id?: number; unit_id?: number; group_id?: number }>({
    mutationFn: async (payload) => {
      const res = await api.post<any>('admissions/bulk-action', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admissions.all })
    },
  })
}

export function useTransferStudent() {
  const queryClient = useQueryClient()
  return useMutation<FullStudent, Error, { id: number; target_unit_id: number; target_group_id?: number | null; roll_number?: string }>({
    mutationFn: async ({ id, ...body }) => {
      const res = await api.patch<FullStudent>(`students/${id}/transfer`, body)
      return res.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.students.enrollmentCounts() })
      queryClient.invalidateQueries({ queryKey: queryKeys.units.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.all })
    },
  })
}

export interface BulkImportResult {
  imported_count: number
  failed_count: number
  details: Array<{
    row: number
    student_id?: number
    student_number?: string
    name: string
    status: 'success' | 'error'
    message?: string
  }>
}

export function useImportStudentsBulk() {
  const queryClient = useQueryClient()
  return useMutation<BulkImportResult, Error, { academic_session_id: number; academic_unit_id: number; academic_group_id?: number | null; rows: Record<string, any>[] }>({
    mutationFn: async (payload) => {
      const res = await api.post<BulkImportResult>('students/bulk-import', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.guardians.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.students.enrollmentCounts() })
    },
  })
}

export async function getImportTemplate(): Promise<{ headers: string[]; samples: string[][] }> {
  const res = await api.get<{ headers: string[]; samples: string[][] }>('students/import-template')
  return res.data
}

export interface CreatePortalAccountPayload {
  type: 'student' | 'guardian'
  guardian_id?: number
  email?: string
  username?: string
  password?: string
  send_email?: boolean
}

export interface UnlinkPortalAccountPayload {
  type: 'student' | 'guardian'
  guardian_id?: number
}

export async function createPortalAccount(
  studentId: number,
  data: CreatePortalAccountPayload
): Promise<PortalAccount> {
  const res = await api.post<PortalAccount>(`students/${studentId}/portal-account`, data)
  return res.data
}

export async function unlinkPortalAccount(
  studentId: number,
  data: UnlinkPortalAccountPayload
): Promise<{ unlinked: boolean }> {
  const query = new URLSearchParams()
  query.set('type', data.type)
  if (data.guardian_id) {
    query.set('guardian_id', data.guardian_id.toString())
  }
  const res = await api.delete<{ unlinked: boolean }>(`students/${studentId}/portal-account?${query.toString()}`)
  return res.data
}

export function useCreatePortalAccount() {
  const queryClient = useQueryClient()
  return useMutation<PortalAccount, Error, { studentId: number; data: CreatePortalAccountPayload }>({
    mutationFn: async ({ studentId, data }) => {
      return createPortalAccount(studentId, data)
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.detail(variables.studentId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all })
    },
  })
}

export function useUnlinkPortalAccount() {
  const queryClient = useQueryClient()
  return useMutation<{ unlinked: boolean }, Error, { studentId: number; data: UnlinkPortalAccountPayload }>({
    mutationFn: async ({ studentId, data }) => {
      return unlinkPortalAccount(studentId, data)
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.students.detail(variables.studentId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all })
    },
  })
}

