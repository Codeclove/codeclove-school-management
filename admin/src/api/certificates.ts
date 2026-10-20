/**
 * TanStack Query hooks and types for the Certificates module.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/api/query-keys'

export interface CertificateElement {
  id: string
  type: 'token' | 'static' | 'image' | 'line'
  token?: string
  text?: string
  imageUrl?: string
  imageWidth?: number // in px (e.g. 40 - 300)
  label: string
  prefix?: string
  suffix?: string
  x: number // percentage 0 - 100
  y: number // percentage 0 - 100
  fontSize?: number // px (10 - 48)
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold'
  fontStyle?: 'normal' | 'italic'
  fontFamily?: 'sans' | 'serif' | 'mono' | 'script'
  color?: string
  textAlign?: 'left' | 'center' | 'right'
  textTransform?: 'none' | 'uppercase' | 'capitalize'
  letterSpacing?: number // in px (0 - 8)
  opacity?: number // 0.1 - 1.0 (default 1)
  isVisible: boolean
  groupId?: string // Optional identifier linking elements together (e.g. label + value pairs)
  // Line / Rule styling
  lineWidth?: number // in px or relative width, default ~120px
  lineHeight?: number // stroke thickness in px, default 1
  lineStyle?: 'solid' | 'dashed' | 'dotted'
}

export interface CertificateTemplate {
  id: number
  title: string
  type: 'transfer' | 'character' | 'merit' | 'completion' | 'general'
  orientation: 'portrait' | 'landscape'
  background_url?: string | null
  layout_data: CertificateElement[]
  is_default: boolean
  issued_count?: number
  created_at: string
  updated_at: string
}

export interface IssuedCertificate {
  id: number
  certificate_no: string
  template_id?: number | null
  student_id: number
  academic_session_id?: number | null
  issue_date: string
  reason?: string
  conduct?: string
  dues_status?: string
  verification_token: string
  metadata: {
    student?: {
      id?: number
      student_number?: string
      admission_number?: string
      first_name?: string
      middle_name?: string
      last_name?: string
      full_name?: string
      gender?: string
      date_of_birth?: string
      blood_group?: string
      nationality?: string
      religion?: string
      admission_date?: string
      address?: string
      photo_url?: string
    }
    guardian?: {
      father_name?: string
      mother_name?: string
      primary_name?: string
      phone?: string
    }
    academic?: {
      unit_name?: string
      group_name?: string
      roll_number?: string
      session_name?: string
      academic_session_id?: number
    }
    school?: {
      name?: string
      code?: string
      logo?: string
      signature?: string
      signature_title?: string
      address?: string
      phone?: string
      email?: string
      website?: string
    }
    issuance?: {
      certificate_no?: string
      issue_date?: string
      reason?: string
      conduct?: string
      dues_status?: string
    }
  }
  template?: {
    id: number
    title: string
    type: string
    orientation: 'portrait' | 'landscape'
    background_url?: string | null
    layout_data?: CertificateElement[]
  } | null
  issued_by_user_id?: number | null
  created_at: string
}

export interface CertificateFeeSummary {
  has_outstanding: boolean
  outstanding_minor: number
  outstanding_formatted: string
  unpaid_invoices_count: number
}

export type CertificateStudentStatusUpdate = 'withdrawn' | 'graduated' | 'inactive' | 'archived' | ''

export interface IssueCertificatePayload {
  student_id: number
  template_id?: number
  certificate_no?: string
  issue_date?: string
  reason?: string
  conduct?: string
  dues_status?: string
  update_student_status?: CertificateStudentStatusUpdate
}
/**
 * Resolves a normalized key-value dictionary from an issued certificate metadata snapshot.
 * Used across admin certificates register, portal student downloads, and batch printing.
 */
export function resolveCertificatePrintData(cert: IssuedCertificate): Record<string, string> {
  const meta = cert.metadata || {}
  const st = meta.student || {}
  const g = meta.guardian || {}
  const ac = meta.academic || {}
  const is = meta.issuance || {}
  const sc = meta.school || {}

  return {
    student_name: st.full_name || '',
    first_name: st.first_name || '',
    last_name: st.last_name || '',
    admission_no: st.admission_number || '',
    student_no: st.student_number || '',
    dob: st.date_of_birth || '',
    gender: st.gender || '',
    father_name: g.father_name || '',
    mother_name: g.mother_name || '',
    guardian_name: g.primary_name || g.father_name || '',
    class_name: ac.unit_name || '',
    section_name: ac.group_name || '',
    roll_no: ac.roll_number || '',
    session_name: ac.session_name || '',
    certificate_no: is.certificate_no || cert.certificate_no || '',
    issue_date: is.issue_date || cert.issue_date || '',
    reason: is.reason || cert.reason || '',
    conduct: is.conduct || cert.conduct || '',
    dues_status: is.dues_status || cert.dues_status || '',
    school_name: sc.name || (typeof window !== 'undefined' ? (window.CodeClovePortalConfig?.siteName || (window as unknown as { CodeCloveConfig?: { siteName?: string } }).CodeCloveConfig?.siteName) : '') || 'CodeClove Academy',
    school_code: sc.code || '',
    school_logo: sc.logo || '',
    principal_signature: sc.signature_title || 'Principal & Head of School',
    principal_signature_image: sc.signature || '',
    verification_token: cert.verification_token || '',
  }
}

// ─── Query Hooks ─────────────────────────────────────────────────────────────

export function useCertificateTemplates(params?: {
  type?: string
  orientation?: string
  search?: string
  page?: number
  per_page?: number
  order_by?: string
  order?: 'asc' | 'desc' | ''
}) {
  const qs = new URLSearchParams()
  if (params?.type) qs.set('type', params.type)
  if (params?.orientation) qs.set('orientation', params.orientation)
  if (params?.search) qs.set('search', params.search)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.per_page) qs.set('per_page', String(params.per_page))
  if (params?.order_by) qs.set('order_by', params.order_by)
  if (params?.order) qs.set('order', params.order)
  const queryStr = qs.toString() ? `?${qs.toString()}` : ''
  return useQuery({
    queryKey: [...queryKeys.certificates.templates(), params],
    queryFn: async () => {
      const res = await api.get<{ templates: CertificateTemplate[]; total: number }>(
        `/academics/certificates/templates${queryStr}`
      )
      return res.data
    },
  })
}

export function useCertificateTemplate(id?: number) {
  return useQuery({
    queryKey: queryKeys.certificates.template(id ?? 0),
    queryFn: async () => {
      const res = await api.get<CertificateTemplate>(`/academics/certificates/templates/${id}`)
      return res.data
    },
    enabled: Boolean(id && id > 0),
  })
}

export function useCreateCertificateTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<CertificateTemplate>) => {
      const res = await api.post<CertificateTemplate>('/academics/certificates/templates', data)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.certificates.templates() })
    },
  })
}

export function useUpdateCertificateTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CertificateTemplate> }) => {
      const res = await api.put<CertificateTemplate>(`/academics/certificates/templates/${id}`, data)
      return res.data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.certificates.templates() })
      queryClient.invalidateQueries({ queryKey: queryKeys.certificates.template(id) })
    },
  })
}

export function useDeleteCertificateTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await api.delete<{ deleted: boolean; id: number }>(`/academics/certificates/templates/${id}`)
      return res.data
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.certificates.templates() })
      queryClient.removeQueries({ queryKey: queryKeys.certificates.template(id) })
    },
  })
}

export function useIssuedCertificates(params?: {
  student_id?: number
  template_id?: number
  session_id?: number
  academic_unit_id?: number
  academic_group_id?: number
  conduct?: string
  search?: string
  page?: number
  per_page?: number
}) {
  const qs = new URLSearchParams()
  if (params?.student_id) qs.set('student_id', String(params.student_id))
  if (params?.template_id) qs.set('template_id', String(params.template_id))
  if (params?.session_id) qs.set('session_id', String(params.session_id))
  if (params?.academic_unit_id) qs.set('academic_unit_id', String(params.academic_unit_id))
  if (params?.academic_group_id) qs.set('academic_group_id', String(params.academic_group_id))
  if (params?.conduct) qs.set('conduct', params.conduct)
  if (params?.search) qs.set('search', params.search)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.per_page) qs.set('per_page', String(params.per_page))
  const queryStr = qs.toString() ? `?${qs.toString()}` : ''
  return useQuery({
    queryKey: [...queryKeys.certificates.issued(), params],
    queryFn: async () => {
      const res = await api.get<{ certificates: IssuedCertificate[]; total: number }>(
        `/academics/certificates/issued${queryStr}`
      )
      return res.data
    },
  })
}

export function useIssuedCertificate(id?: number) {
  return useQuery({
    queryKey: queryKeys.certificates.issuedSingle(id ?? 0),
    queryFn: async () => {
      const res = await api.get<IssuedCertificate>(`/academics/certificates/issued/${id}`)
      return res.data
    },
    enabled: Boolean(id && id > 0),
  })
}
export function useDeleteIssuedCertificate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, revertStudentStatus = true }: { id: number; revertStudentStatus?: boolean }) => {
      const queryStr = revertStudentStatus ? '?revert_student_status=1' : ''
      const res = await api.delete<{ deleted: boolean; id: number; student_reverted?: boolean }>(
        `/academics/certificates/issued/${id}${queryStr}`
      )
      return res.data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.certificates.issued() })
      queryClient.invalidateQueries({ queryKey: queryKeys.certificates.templates() })
      queryClient.removeQueries({ queryKey: queryKeys.certificates.issuedSingle(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all })
    },
  })
}

export function useBulkDeleteIssuedCertificates() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ ids, revertStudentStatus = true }: { ids: number[]; revertStudentStatus?: boolean }) => {
      const res = await api.post<{ deleted_count: number; ids: number[] }>(
        '/academics/certificates/issued/bulk-delete',
        { ids, revert_student_status: revertStudentStatus }
      )
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.certificates.issued() })
      queryClient.invalidateQueries({ queryKey: queryKeys.certificates.templates() })
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all })
    },
  })
}

export function useStudentFeeSummary(studentId?: number) {
  return useQuery({
    queryKey: queryKeys.certificates.feeSummary(studentId ?? 0),
    queryFn: async () => {
      const res = await api.get<CertificateFeeSummary>(`/academics/certificates/fee-summary/${studentId}`)
      return res.data
    },
    enabled: Boolean(studentId && studentId > 0),
  })
}

export function useIssueCertificate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: IssueCertificatePayload) => {
      const res = await api.post<IssuedCertificate>('/academics/certificates/issue', payload)
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.certificates.issued() })
      queryClient.invalidateQueries({ queryKey: queryKeys.certificates.templates() })
      if (data.student_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.students.detail(data.student_id) })
        queryClient.invalidateQueries({ queryKey: queryKeys.students.all })
      }
    },
  })
}
export interface BulkIssueCertificatePayload {
  template_id: number
  student_ids: number[]
  issue_date?: string
  reason?: string
  conduct?: string
  dues_status?: string
  number_scheme?: 'sequential' | 'admission_no' | 'roll_no' | 'custom'
  number_prefix?: string
  start_number?: number
  number_pattern?: string
  update_student_status?: CertificateStudentStatusUpdate
}

export interface BulkIssueResult {
  total_requested: number
  issued_count: number
  certificates: IssuedCertificate[]
  errors: { student_id: number; message: string }[]
}

export function useBulkIssueCertificates() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: BulkIssueCertificatePayload) => {
      const res = await api.post<BulkIssueResult>('/academics/certificates/issue-bulk', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.certificates.issued() })
      queryClient.invalidateQueries({ queryKey: queryKeys.certificates.templates() })
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all })
    },
  })
}
