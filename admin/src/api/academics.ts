/**
 * TanStack Query hooks for the Academics module.
 *
 * Covers: Sessions, Terms, Academic Units, Academic Groups, Subjects.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/api/query-keys'

// ─── Shared ────────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface ListParams {
  page?: number
  per_page?: number
  search?: string
  status?: string
  session_id?: number
  unit_id?: number
  [key: string]: string | number | undefined
}

/** Serialize list params into a query string. */
function toQueryString(params?: ListParams): string {
  if (!params) return ''
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined)
  ) as Record<string, string>
  const qs = new URLSearchParams(filtered as Record<string, string>).toString()
  return qs ? `?${qs}` : ''
}

/**
 * Maps the raw ApiPaginatedResponse envelope to the internal PaginatedResponse shape.
 * Centralises the pagination field renaming so individual hooks stay DRY.
 */
function toPaginatedResponse<T>(res: {
  data: T[]
  pagination: { total: number; per_page: number; current_page: number; total_pages: number }
}): PaginatedResponse<T> {
  return {
    data:        res.data,
    total:       res.pagination.total,
    page:        res.pagination.current_page,
    per_page:    res.pagination.per_page,
    total_pages: res.pagination.total_pages,
  }
}

// ─── Academic Sessions ────────────────────────────────────────────────────────

export interface AcademicSession {
  id: number
  name: string
  slug: string
  start_date: string
  end_date: string
  status: 'draft' | 'active' | 'archived'
  is_current: boolean
  terms_count: number
  created_at: string
  updated_at: string
}

export type CreateSessionPayload = Pick<
  AcademicSession,
  'name' | 'start_date' | 'end_date' | 'status'
>
export type UpdateSessionPayload = Partial<CreateSessionPayload>

export function useSessions(
  params?: ListParams,
  options?: Partial<UseQueryOptions<PaginatedResponse<AcademicSession>>>
) {
  return useQuery<PaginatedResponse<AcademicSession>>({
    queryKey: queryKeys.sessions.list(params),
    queryFn: async () => toPaginatedResponse(await api.list<AcademicSession[]>(`academic-sessions${toQueryString(params)}`)),
    ...options,
  })
}

export function useAcademicSession(id: number) {
  return useQuery<AcademicSession>({
    queryKey: queryKeys.sessions.detail(id),
    queryFn: async () => {
      const res = await api.get<AcademicSession>(`academic-sessions/${id}`)
      return res.data
    },
    enabled: !!id,
  })
}

export function useCreateSession() {
  const qc = useQueryClient()
  return useMutation<AcademicSession, Error, CreateSessionPayload>({
    mutationFn: async (payload) => {
      const res = await api.post<AcademicSession>('academic-sessions', payload)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.sessions.all }),
  })
}

export function useUpdateSession() {
  const qc = useQueryClient()
  return useMutation<AcademicSession, Error, { id: number; data: UpdateSessionPayload }>({
    mutationFn: async ({ id, data }) => {
      const res = await api.patch<AcademicSession>(`academic-sessions/${id}`, data)
      return res.data
    },
    onSuccess: (session) => {
      qc.invalidateQueries({ queryKey: queryKeys.sessions.all })
      qc.setQueryData(queryKeys.sessions.detail(session.id), session)
    },
  })
}

export function useDeleteSession() {
  const qc = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: async (id) => {
      await api.delete(`academic-sessions/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.sessions.all }),
  })
}

// ─── Academic Units ────────────────────────────────────────────────────────────

export interface AcademicUnit {
  id: number
  session_id: number
  name: string
  code: string | null
  order: number
  status: 'active' | 'inactive' | 'archived'
  groups_count: number
  students_count: number
  created_at: string
}

export type CreateUnitPayload = {
  session_id: number
  name: string
  code?: string
  order?: number
}

export function useUnits(params?: ListParams) {
  return useQuery<PaginatedResponse<AcademicUnit>>({
    queryKey: queryKeys.units.list(params),
    queryFn: async () => toPaginatedResponse(await api.list<AcademicUnit[]>(`academic-units${toQueryString(params)}`)),
  })
}

export function useCreateUnit() {
  const qc = useQueryClient()
  return useMutation<AcademicUnit, Error, CreateUnitPayload>({
    mutationFn: async (payload) => {
      const res = await api.post<AcademicUnit>('academic-units', payload)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.units.all }),
  })
}

export function useUpdateUnit() {
  const qc = useQueryClient()
  return useMutation<AcademicUnit, Error, { id: number; data: Partial<CreateUnitPayload> }>({
    mutationFn: async ({ id, data }) => {
      const res = await api.patch<AcademicUnit>(`academic-units/${id}`, data)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.units.all }),
  })
}

export function useDeleteUnit() {
  const qc = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: async (id) => { await api.delete(`academic-units/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.units.all }),
  })
}



// ─── Academic Groups ────────────────────────────────────────────────────────────

export interface AcademicGroup {
  id: number
  unit_id: number
  session_id: number
  name: string
  code: string | null
  capacity: number | null
  status: 'active' | 'inactive' | 'archived'
  order: number
  students_count: number
  created_at: string
}

export type CreateGroupPayload = {
  unit_id: number
  session_id: number
  name: string
  code?: string
  capacity?: number | null
  status?: 'active' | 'inactive' | 'archived'
  order?: number
}

export type UpdateGroupPayload = Partial<CreateGroupPayload>

export function useGroups(params?: ListParams) {
  return useQuery<PaginatedResponse<AcademicGroup>>({
    queryKey: queryKeys.groups.list(params),
    queryFn: async () => toPaginatedResponse(await api.list<AcademicGroup[]>(`academic-groups${toQueryString(params)}`)),
  })
}

export function useCreateGroup() {
  const qc = useQueryClient()
  return useMutation<AcademicGroup, Error, CreateGroupPayload>({
    mutationFn: async (payload) => {
      const res = await api.post<AcademicGroup>('academic-groups', payload)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.groups.all }),
  })
}

export function useUpdateGroup() {
  const qc = useQueryClient()
  return useMutation<AcademicGroup, Error, { id: number; data: UpdateGroupPayload }>({
    mutationFn: async ({ id, data }) => {
      const res = await api.patch<AcademicGroup>(`academic-groups/${id}`, data)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.groups.all }),
  })
}

export function useDeleteGroup() {
  const qc = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: async (id) => { await api.delete(`academic-groups/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.groups.all }),
  })
}



// ─── Subjects ────────────────────────────────────────────────────────────────

export interface Subject {
  id: number
  session_id: number
  name: string
  code: string | null
  type: 'core' | 'elective' | 'activity' | 'other'
  status: 'active' | 'inactive' | 'archived'
  color: string | null
  units_count: number
  unit_ids?: number[]
  created_at: string
}

export type CreateSubjectPayload = {
  session_id: number
  name: string
  code?: string
  type?: 'core' | 'elective' | 'activity' | 'other'
  status?: 'active' | 'inactive' | 'archived'
  color?: string
  unit_ids?: number[]
}

export type UpdateSubjectPayload = Partial<CreateSubjectPayload>

export function useSubjects(params?: ListParams) {
  return useQuery<PaginatedResponse<Subject>>({
    queryKey: queryKeys.subjects.list(params),
    queryFn: async () => toPaginatedResponse(await api.list<Subject[]>(`subjects${toQueryString(params)}`)),
  })
}

export function useCreateSubject() {
  const qc = useQueryClient()
  return useMutation<Subject, Error, CreateSubjectPayload>({
    mutationFn: async (payload) => {
      const res = await api.post<Subject>('subjects', payload)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.subjects.all }),
  })
}

export function useUpdateSubject() {
  const qc = useQueryClient()
  return useMutation<Subject, Error, { id: number; data: UpdateSubjectPayload }>({
    mutationFn: async ({ id, data }) => {
      const res = await api.patch<Subject>(`subjects/${id}`, data)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.subjects.all }),
  })
}

export function useDeleteSubject() {
  const qc = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: async (id) => { await api.delete(`subjects/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.subjects.all }),
  })
}



// ─── Academic Terms ──────────────────────────────────────────────────────────

export interface AcademicTerm {
  id: number
  session_id: number
  name: string
  code: string | null
  start_date: string
  end_date: string
  sort_order: number
  status: 'active' | 'inactive' | 'archived'
  created_at: string
}

export type CreateTermPayload = Pick<
  AcademicTerm,
  'session_id' | 'name' | 'code' | 'start_date' | 'end_date' | 'status'
>
export type UpdateTermPayload = Partial<CreateTermPayload>

export function useTerms(
  session_id: number,
  options?: Partial<UseQueryOptions<AcademicTerm[]>>
) {
  return useQuery<AcademicTerm[]>({
    queryKey: queryKeys.terms.bySession(session_id),
    queryFn: async () => {
      const res = await api.get<AcademicTerm[]>(`academic-sessions/${session_id}/terms`)
      return res.data
    },
    enabled: !!session_id,
    ...options,
  })
}

export function useCreateTerm() {
  const qc = useQueryClient()
  return useMutation<AcademicTerm, Error, { session_id: number; data: Omit<CreateTermPayload, 'session_id'> }>({
    mutationFn: async ({ session_id, data }) => {
      const res = await api.post<AcademicTerm>(`academic-sessions/${session_id}/terms`, data)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.terms.all })
      qc.invalidateQueries({ queryKey: queryKeys.sessions.all })
    },
  })
}

export function useUpdateTerm() {
  const qc = useQueryClient()
  return useMutation<AcademicTerm, Error, { id: number; data: UpdateTermPayload }>({
    mutationFn: async ({ id, data }) => {
      const res = await api.patch<AcademicTerm>(`academic-terms/${id}`, data)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.terms.all })
      qc.invalidateQueries({ queryKey: queryKeys.sessions.all })
    },
  })
}

export function useDeleteTerm() {
  const qc = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: async (id) => {
      await api.delete(`academic-terms/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.terms.all })
      qc.invalidateQueries({ queryKey: queryKeys.sessions.all })
    },
  })
}

// ─── Academic Unit Subjects ──────────────────────────────────────────────────

export interface AcademicUnitSubject {
  id: number
  unit_id: number
  subject_id: number
  subject_name: string
  subject_code: string | null
  subject_type: 'core' | 'elective' | 'activity' | 'other'
  is_required: boolean
  sort_order: number
  created_at: string
}

export type AssignSubjectPayload = {
  subject_id: number
  is_required: boolean
  sort_order?: number
}

export function useUnitSubjects(
  unit_id: number,
  options?: Partial<UseQueryOptions<AcademicUnitSubject[]>>
) {
  return useQuery<AcademicUnitSubject[]>({
    queryKey: queryKeys.unitSubjects.byUnit(unit_id),
    queryFn: async () => {
      const res = await api.get<AcademicUnitSubject[]>(`academic-units/${unit_id}/subjects`)
      return res.data
    },
    enabled: !!unit_id,
    ...options,
  })
}

export function useAssignSubject() {
  const qc = useQueryClient()
  return useMutation<AcademicUnitSubject, Error, { unit_id: number; data: AssignSubjectPayload }>({
    mutationFn: async ({ unit_id, data }) => {
      const res = await api.post<AcademicUnitSubject>(`academic-units/${unit_id}/subjects`, data)
      return res.data
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.unitSubjects.byUnit(variables.unit_id) })
      qc.invalidateQueries({ queryKey: queryKeys.units.all })
    },
  })
}

export function useUnassignSubject() {
  const qc = useQueryClient()
  return useMutation<void, Error, { unit_id: number; subject_id: number }>({
    mutationFn: async ({ unit_id, subject_id }) => {
      await api.delete(`academic-units/${unit_id}/subjects/${subject_id}`)
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.unitSubjects.byUnit(variables.unit_id) })
      qc.invalidateQueries({ queryKey: queryKeys.units.all })
    },
  })
}
