/**
 * TanStack Query hooks for the Finance API.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/api/query-keys'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FeeType {
  id: number
  name: string
  code: string | null
  description: string | null
  default_amount_minor: number
  currency: string
  frequency: 'one_time' | 'monthly' | 'quarterly' | 'term_wise' | 'annual' | 'custom'
  status: 'active' | 'inactive' | 'archived'
  overrides_count?: number
}

export interface InvoiceLineItem {
  id?: number
  invoice_id?: number
  fee_type_id?: number | null
  description: string
  quantity: number
  unit_amount_minor: number
  discount_minor: number
  total_minor?: number
  sort_order?: number
}

export interface Payment {
  id: number
  payment_number: string
  invoice_id: number
  invoice_number?: string
  student_id: number
  student_first_name?: string
  student_last_name?: string
  student_number?: string
  academic_session_id: number
  amount_minor: number
  currency: string
  method: 'cash' | 'bank_transfer' | 'cheque' | 'upi' | 'card' | 'other'
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled'
  paid_on: string
  reference: string | null
  note: string | null
}

export interface Invoice {
  id: number
  invoice_number: string
  student_id: number
  student_first_name?: string
  student_last_name?: string
  student_number?: string
  academic_session_id: number
  academic_term_id?: number | null
  academic_term_name?: string | null
  academic_session_name?: string | null
  first_item_description?: string | null
  academic_unit_id: number | null
  academic_group_id: number | null
  academic_unit_name?: string | null
  academic_group_name?: string | null
  guardian_name: string
  guardian_email: string
  currency: string
  issue_date: string
  due_date: string | null
  subtotal_minor: number
  discount_minor: number
  tax_minor: number
  total_minor: number
  paid_minor: number
  balance_minor: number
  discount_note: string | null
  status: 'draft' | 'issued' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' | 'void'
  line_items?: InvoiceLineItem[]
  payments?: Payment[]
}

export interface ChartTrendPoint {
  label: string
  date: string
  startDate?: string
  endDate?: string
  fullLabel: string
  billed: number
  collected: number
}

export interface FinanceSummary {
  total_billed: number
  total_collected: number
  total_outstanding: number
  today_collected: number
  month_collected: number
  overdue_count: number
  period_billed: number
  period_collected: number
  period_outstanding: number
  period_label: string
  chart_data: ChartTrendPoint[]
  sparkline_billed: number[]
  sparkline_collected: number[]
  recent_invoices: Invoice[]
  recent_payments: Payment[]
}

export interface FeeTypeFilters {
  status?: string
  search?: string
  scope?: string
  frequency?: string
  has_overrides?: 'yes' | 'no' | ''
  page?: number
  per_page?: number
}

export interface InvoiceFilters {
  student_id?: number
  academic_session_id?: number
  academic_unit_id?: number
  academic_term_id?: number
  start_date?: string
  end_date?: string
  date_type?: 'issue_date' | 'due_date'
  status?: string
  search?: string
  order_by?: string
  order?: 'asc' | 'desc'
  page?: number
  per_page?: number
}

export interface PaymentFilters {
  student_id?: number
  invoice_id?: number
  academic_session_id?: number
  method?: string
  status?: string
  start_date?: string
  end_date?: string
  search?: string
  page?: number
  per_page?: number
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

// ─── Summary Hooks ────────────────────────────────────────────────────────────

/**
 * Hook to retrieve the finance summary metrics.
 */
export function useFinanceSummary(sessionId?: number, range: 'week' | 'month' | 'term' | 'year' = 'month') {
  return useQuery<FinanceSummary>({
    queryKey: queryKeys.finance.summary(sessionId, range),
    queryFn: async () => {
      const qs = `?academic_session_id=${sessionId}&range=${range}`
      const response = await api.get<FinanceSummary>(`finance/summary${qs}`)
      return response.data
    },
    enabled: sessionId !== undefined,
  })
}

// ─── Fee Type Hooks ───────────────────────────────────────────────────────────

/**
 * Hook to retrieve fee types list.
 */
export function useFeeTypes(filters?: FeeTypeFilters) {
  return useQuery<{ data: FeeType[]; pagination: any }>({
    queryKey: queryKeys.finance.feeTypes.list(filters),
    queryFn: async () => api.list<FeeType[]>(`fee-types${toQueryString(filters)}`),
  })
}

/**
 * Hook to retrieve a single fee type by ID.
 * Replaces the per_page:999 pattern used in FeeTypePage edit mode.
 */
export function useFeeType(id: number) {
  return useQuery<FeeType>({
    queryKey: queryKeys.finance.feeTypes.detail(id),
    queryFn: async () => {
      const response = await api.get<FeeType>(`fee-types/${id}`)
      return response.data
    },
    enabled: !!id,
  })
}

/**
 * Hook to create a fee type.
 */
export function useCreateFeeType() {
  const queryClient = useQueryClient()
  return useMutation<FeeType, Error, Partial<FeeType>>({
    mutationFn: async (payload) => {
      const response = await api.post<FeeType>('fee-types', payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.feeTypes.all })
    },
  })
}

/**
 * Hook to update a fee type.
 */
export function useUpdateFeeType() {
  const queryClient = useQueryClient()
  return useMutation<FeeType, Error, { id: number; payload: Partial<FeeType> }>({
    mutationFn: async ({ id, payload }) => {
      const response = await api.patch<FeeType>(`fee-types/${id}`, payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.feeTypes.all })
    },
  })
}

/**
 * Hook to delete (archive) a fee type.
 */
export function useDeleteFeeType() {
  const queryClient = useQueryClient()
  return useMutation<{ deleted: boolean }, Error, number>({
    mutationFn: async (id) => {
      const response = await api.delete<{ deleted: boolean }>(`fee-types/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.feeTypes.all })
    },
  })
}

// ─── Invoice Hooks ────────────────────────────────────────────────────────────

/**
 * Hook to retrieve paginated student invoices.
 */
export function useInvoices(filters?: InvoiceFilters) {
  return useQuery<{ data: Invoice[]; pagination: any }>({
    queryKey: queryKeys.finance.invoices.list(filters),
    queryFn: async () => api.list<Invoice[]>(`invoices${toQueryString(filters)}`),
  })
}

/**
 * Hook to retrieve a single student invoice detail.
 */
export function useInvoice(id: number) {
  return useQuery<Invoice>({
    queryKey: queryKeys.finance.invoices.detail(id),
    queryFn: async () => {
      const response = await api.get<Invoice>(`invoices/${id}`)
      return response.data
    },
    enabled: !!id,
  })
}

/**
 * Hook to create a student invoice.
 */
export function useCreateInvoice() {
  const queryClient = useQueryClient()
  return useMutation<Invoice, Error, Partial<Invoice>>({
    mutationFn: async (payload) => {
      const response = await api.post<Invoice>('invoices', payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.summary() })
    },
  })
}

/**
 * Hook to update student invoice details.
 */
export function useUpdateInvoice() {
  const queryClient = useQueryClient()
  return useMutation<Invoice, Error, { id: number; payload: Partial<Invoice> }>({
    mutationFn: async ({ id, payload }) => {
      const response = await api.patch<Invoice>(`invoices/${id}`, payload)
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.invoices.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.summary() })
    },
  })
}

/**
 * Hook to void a student invoice.
 * Calls POST /invoices/:id/void (not DELETE — backend uses explicit named-action routes).
 */
export function useDeleteInvoice() {
  const queryClient = useQueryClient()
  return useMutation<{ voided: boolean }, Error, number>({
    mutationFn: async (id) => {
      const response = await api.post<{ voided: boolean }>(`invoices/${id}/void`, {})
      return response.data
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.invoices.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.summary() })
    },
  })
}

// ─── Payment Hooks ────────────────────────────────────────────────────────────

/**
 * Hook to retrieve payment journal entries.
 */
export function usePayments(filters?: PaymentFilters) {
  return useQuery<{ data: Payment[]; pagination: any }>({
    queryKey: queryKeys.finance.payments.list(filters),
    queryFn: async () => api.list<Payment[]>(`payments${toQueryString(filters)}`),
  })
}

/**
 * Hook to record a manual payment.
 */
export function useRecordPayment() {
  const queryClient = useQueryClient()
  return useMutation<Payment, Error, Partial<Payment>>({
    mutationFn: async (payload) => {
      const response = await api.post<Payment>('payments', payload)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.payments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.invoices.detail(data.invoice_id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.summary() })
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.defaulters() })
    },
  })
}

/**
 * Hook to reverse/cancel a manual payment receipt.
 * Calls POST /payments/:id/cancel (not DELETE — backend uses explicit named-action routes).
 */
export function useDeletePayment() {
  const queryClient = useQueryClient()
  return useMutation<{ cancelled: boolean }, Error, { id: number; invoiceId: number }>({
    mutationFn: async ({ id }) => {
      const response = await api.post<{ cancelled: boolean }>(`payments/${id}/cancel`, {})
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.payments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.invoices.detail(variables.invoiceId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.summary() })
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.defaulters() })
    },
  })
}

// ─── Class Rates ──────────────────────────────────────────────────────────────

export interface ClassRate {
  fee_type_id: number
  academic_unit_id: number
  unit_name: string
  amount_minor: number
}

export function useClassRates(feeTypeId: number) {
  return useQuery<ClassRate[]>({
    queryKey: queryKeys.finance.feeTypes.classRates(feeTypeId),
    queryFn: async () => {
      const res = await api.get<ClassRate[]>(`fee-types/${feeTypeId}/class-rates`)
      return res.data
    },
    enabled: !!feeTypeId,
  })
}

export function useUpsertClassRate(feeTypeId: number) {
  const qc = useQueryClient()
  return useMutation<ClassRate, Error, { academic_unit_id: number; amount: number }>({
    mutationFn: async (body) => {
      const res = await api.post<ClassRate>(`fee-types/${feeTypeId}/class-rates`, body)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.finance.feeTypes.classRates(feeTypeId) }),
  })
}

export function useDeleteClassRate(feeTypeId: number) {
  const qc = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: async (unitId) => {
      await api.delete(`fee-types/${feeTypeId}/class-rates/${unitId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.finance.feeTypes.classRates(feeTypeId) }),
  })
}

/** Resolves the best fee amount for a student given fee type + session (class rate or default). */
export function useResolveFeeAmount(params: {
  fee_type_id: number
  student_id: number
  session_id: number
}) {
  return useQuery<{ amount_minor: number }>({
    queryKey: queryKeys.finance.resolveFeeAmount(params),
    queryFn: async () => {
      const qs = new URLSearchParams({
        fee_type_id: String(params.fee_type_id),
        student_id: String(params.student_id),
        session_id: String(params.session_id),
      })
      const res = await api.get<{ amount_minor: number }>(`invoices/resolve-fee-amount?${qs}`)
      return res.data
    },
    enabled: !!(params.fee_type_id && params.student_id && params.session_id),
  })
}

export interface DefaulterRow {
  invoice_id: number
  invoice_number: string
  due_date: string
  balance_minor: number
  total_minor: number
  student_id: number
  student_first_name: string
  student_last_name: string
  student_number: string
  academic_unit_id: number | null
  academic_group_id: number | null
  academic_unit_name?: string | null
  days_overdue: number
}

export interface DefaulterFilters {
  academic_session_id?: number
  academic_unit_id?: number
  days_overdue_min?: number
  search?: string
  page?: number
  per_page?: number
}

/** Hook to retrieve fee defaulters report. */
export function useDefaultersReport(filters?: DefaulterFilters, options?: { enabled?: boolean }) {
  return useQuery<{ data: DefaulterRow[]; total: number }>({
    queryKey: queryKeys.finance.defaulters(filters),
    queryFn: async () => {
      const response = await api.get<{ data: DefaulterRow[]; total: number }>(`finance/reports/defaulters${toQueryString(filters)}`)
      return response.data
    },
    ...options,
  })
}

/** Hook to send a fee reminder email. */
export function useSendInvoiceReminder() {
  return useMutation<boolean, Error, { id: number }>({
    mutationFn: async ({ id }) => {
      const response = await api.post<{ sent: boolean }>(`finance/invoices/${id}/remind`)
      return response.data.sent
    },
  })
}

/** Hook for bulk actions on invoices. */
export function useBulkInvoicesAction() {
  const qc = useQueryClient()
  return useMutation<any, Error, { action: string; ids: number[]; discount_minor?: number; discount_note?: string }>({
    mutationFn: async (payload) => {
      const res = await api.post<any>('finance/invoices/bulk-action', payload)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.finance.invoices.all })
      qc.invalidateQueries({ queryKey: queryKeys.finance.summary() })
      qc.invalidateQueries({ queryKey: queryKeys.finance.defaulters() })
    },
  })
}


