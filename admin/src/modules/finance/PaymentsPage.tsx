import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, RotateCcw, AlertTriangle, Printer, X, SlidersHorizontal } from 'lucide-react'
import { __, sprintf } from '@/lib/i18n'
import { getMethodLabel } from './finance-utils'
import {
  usePayments,
  useDeletePayment,
  type Payment,
  type Invoice,
} from '@/api/finance'
import { api } from '@/lib/api-client'
import { useSettings } from '@/api/settings'
import { printElement } from '@/lib/print'
import PrintPaymentReceipt from './PrintPaymentReceipt'
import { useToast } from '@/lib/toast'
import { useConfirm } from '@/lib/confirm'
import { useLabels } from '@/lib/labels'
import { useFormatter } from '@/lib/formatter'
import { useSession } from '@/lib/session-context'
import { useEntity } from '@/lib/useEntity'
import { TablePagination } from '@/components/ui/TablePagination'
import { useTableState } from '@/lib/useTableState'
import { useDebounce } from '@/lib/useDebounce'
import {
  Button,
  PageHeader,
  Spinner,
  TableRoot,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableSkeleton,
  TableEmpty,
  Card,
  CardContent,
  Badge,
  FormField,
  Input,
  Select,
  DatePicker,
} from '@/components/ui'

export default function PaymentsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const entity = useEntity('payment')
  const { getLabel } = useLabels()
  const { formatCurrency, formatDate } = useFormatter()
  const { session } = useSession()
  const { data: settingsData } = useSettings()

  const [printingPayment, setPrintingPayment] = useState<Payment | null>(null)
  const [printingInvoice, setPrintingInvoice] = useState<Invoice | null>(null)
  const [isPrintLoading, setIsPrintLoading] = useState<number | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (printingPayment && printingInvoice && printRef.current) {
      printElement(printRef.current)
      setPrintingPayment(null)
      setPrintingInvoice(null)
    }
  }, [printingPayment, printingInvoice])

  const handlePrintReceipt = async (payment: Payment) => {
    setIsPrintLoading(payment.id)
    try {
      const res = await api.get<Invoice>(`invoices/${payment.invoice_id}`)
      setPrintingInvoice(res.data)
      setPrintingPayment(payment)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : ''
      toast.error(message || __('Failed to fetch invoice details for printing.', 'codeclove-school-management'))
    } finally {
      setIsPrintLoading(null)
    }
  }

  const paymentLabelPlural = entity.plural
  const studentLabel = getLabel('student', false, __('Student', 'codeclove-school-management'))

  // Search/Filters State
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const [method, setMethod] = useState('')
  const [status, setStatus] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const table = useTableState({ defaultPerPage: 25 })
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Reset filters on session change
  useEffect(() => {
    setMethod('')
    setStatus('')
    setStartDate('')
    setEndDate('')
    table.resetPage()
  }, [session?.id, table.resetPage])

  // Show advanced if start or end date is set initially
  useEffect(() => {
    if (startDate || endDate) {
      setShowAdvanced(true)
    }
  }, [])

  // Queries / Mutations
  const { data, isLoading, isError, refetch } = usePayments({
    academic_session_id: session?.id,
    method: method || undefined,
    status: status || undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    search: debouncedSearch,
    ...table.params,
  })

  const deletePaymentMutation = useDeletePayment()

  const list = data?.data || []
  const total = data?.pagination?.total || 0

  const handleReversePayment = async (paymentId: number, invoiceId: number) => {
    const isConfirmed = await confirm({
      title: __('Reverse Payment Receipt', 'codeclove-school-management'),
      message: __('Are you sure you want to cancel/reverse this payment receipt? This will restore the outstanding balance of the invoice.', 'codeclove-school-management'),
      confirmText: __('Reverse', 'codeclove-school-management')
    })
    if (!isConfirmed) return

    deletePaymentMutation.mutate(
      { id: paymentId, invoiceId },
      {
        onSuccess: () => {
          toast.success(__('Payment receipt reversed successfully.', 'codeclove-school-management'))
        },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : ''
          toast.error(message || __('Failed to reverse payment', 'codeclove-school-management'))
        },
      }
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={paymentLabelPlural}
        description={__('Journal ledger records of all manual payments and receipts collected for the current session.', 'codeclove-school-management')}
        breadcrumbs={[{ label: __('Finance', 'codeclove-school-management') }, { label: paymentLabelPlural }]}
      />

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          {/* Main Filters */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3">
            <div className="flex-1">
              <FormField label={__('Search Payments', 'codeclove-school-management')}>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <Input
                    type="text"
                    placeholder={__('Search receipts, reference numbers, or students...', 'codeclove-school-management')}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      table.resetPage()
                    }}
                    className="pl-9"
                  />
                </div>
              </FormField>
            </div>
            <div className="w-full sm:w-40 lg:flex-1 lg:max-w-xs min-w-[140px]">
              <FormField label={__('Payment Method', 'codeclove-school-management')}>
                <Select
                  value={method}
                  onValueChange={(val) => {
                    setMethod(val)
                    table.resetPage()
                  }}
                  placeholder={__('All Methods', 'codeclove-school-management')}
                  options={[
                    { value: '', label: __('All Methods', 'codeclove-school-management') },
                    { value: 'cash', label: __('Cash', 'codeclove-school-management') },
                    { value: 'cheque', label: __('Cheque', 'codeclove-school-management') },
                    { value: 'upi', label: __('UPI / QR Code', 'codeclove-school-management') },
                    { value: 'bank_transfer', label: __('Bank Transfer', 'codeclove-school-management') },
                    { value: 'card', label: __('Card', 'codeclove-school-management') },
                    { value: 'other', label: __('Other', 'codeclove-school-management') },
                  ]}
                />
              </FormField>
            </div>
            <div className="w-full sm:w-40 lg:flex-1 lg:max-w-xs min-w-[140px]">
              <FormField label={__('Status', 'codeclove-school-management')}>
                <Select
                  value={status}
                  onValueChange={(val) => {
                    setStatus(val)
                    table.resetPage()
                  }}
                  placeholder={__('All Statuses', 'codeclove-school-management')}
                  options={[
                    { value: '', label: __('All Statuses', 'codeclove-school-management') },
                    { value: 'completed', label: __('Completed', 'codeclove-school-management') },
                    { value: 'cancelled', label: __('Cancelled / Reversed', 'codeclove-school-management') },
                  ]}
                />
              </FormField>
            </div>
            <div className="flex items-end h-9">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`text-xs gap-1.5 h-9 ${showAdvanced ? 'bg-bg-base text-brand border-brand/30' : 'text-text-muted hover:text-text'}`}
              >
                <SlidersHorizontal size={12} />
                {showAdvanced ? __('Hide Dates', 'codeclove-school-management') : __('Date Range', 'codeclove-school-management')}
              </Button>
            </div>
          </div>

          {/* Date Range Filters */}
          {showAdvanced && (
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3 border-t border-border/40 pt-3 animate-in fade-in duration-200">
              <div className="w-full sm:w-40 lg:flex-1 lg:max-w-xs min-w-[140px]">
                <FormField label={__('Start Date', 'codeclove-school-management')}>
                  <DatePicker
                    value={startDate}
                    onChange={(val) => {
                      setStartDate(val)
                      table.resetPage()
                    }}
                  />
                </FormField>
              </div>
              <div className="w-full sm:w-40 lg:flex-1 lg:max-w-xs min-w-[140px]">
                <FormField label={__('End Date', 'codeclove-school-management')}>
                  <DatePicker
                    value={endDate}
                    onChange={(val) => {
                      setEndDate(val)
                      table.resetPage()
                    }}
                  />
                </FormField>
              </div>

              <div className="flex items-center gap-2 ml-auto h-9">
                {(search || method || status || startDate || endDate) && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSearch('')
                      setMethod('')
                      setStatus('')
                      setStartDate('')
                      setEndDate('')
                      table.resetPage()
                    }}
                    className="text-xs text-text-muted hover:text-text gap-1"
                  >
                    <X size={12} />
                    {__('Clear Filters', 'codeclove-school-management')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Main List */}
      <Card>
        <CardContent className="p-0">
          <TableRoot>
            <Thead>
              <Tr>
                <Th type="code">{__('Receipt #', 'codeclove-school-management')}</Th>
                <Th type="primary">{studentLabel}</Th>
                <Th type="code">{__('Invoice #', 'codeclove-school-management')}</Th>
                <Th type="date">{__('Payment Date', 'codeclove-school-management')}</Th>
                <Th type="badge">{__('Method', 'codeclove-school-management')}</Th>
                <Th type="number">{__('Amount', 'codeclove-school-management')}</Th>
                <Th type="actions">{__('Actions', 'codeclove-school-management')}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {isLoading ? (
                <TableSkeleton columns={7} rows={5} />
              ) : isError ? (
                <TableEmpty
                  colSpan={7}
                  message={__('Error Loading Payments', 'codeclove-school-management')}
                  description={__("We couldn't retrieve the payments log. Please check your network or try again.", 'codeclove-school-management')}
                  icon={AlertTriangle}
                  action={<Button size="sm" onClick={() => refetch()}>{__('Retry', 'codeclove-school-management')}</Button>}
                />
              ) : list.length === 0 ? (
                <TableEmpty
                  colSpan={7}
                  message={sprintf(__('No %s found', 'codeclove-school-management'), paymentLabelPlural)}
                  description={__('Payments will appear here once recorded against outstanding student invoices.', 'codeclove-school-management')}
                  icon={entity.icon}
                  action={<Button size="sm" onClick={() => navigate('/finance/payments/record')}>{__('Record Payment', 'codeclove-school-management')}</Button>}
                />
              ) : (
                list.map((row) => (
                  <Tr key={row.id} className="hover:bg-bg-base/20 transition-colors">
                    <Td type="code">{row.payment_number}</Td>
                    <Td type="primary">
                      <div>
                        {row.student_first_name} {row.student_last_name}
                      </div>
                      <div className="text-2xs text-text-muted font-mono">{row.student_number}</div>
                    </Td>
                    <Td type="code">{row.invoice_number || '—'}</Td>
                    <Td type="date">{formatDate(row.paid_on)}</Td>
                    <Td type="badge">
                      <span className="text-xs text-text-muted font-medium bg-bg-base px-2 py-1 rounded inline-block">
                        {getMethodLabel(row.method)}
                      </span>
                    </Td>
                    <Td type="number" className={row.status === 'completed' ? 'text-success' : 'text-danger line-through'}>
                      {formatCurrency(row.amount_minor)}
                      {row.status !== 'completed' && (
                        <Badge variant={row.status === 'refunded' || row.status === 'failed' || row.status === 'cancelled' ? 'danger' : 'warning'} size="sm" className="ml-1.5 align-middle">
                          {row.status}
                        </Badge>
                      )}
                    </Td>
                    <Td type="actions">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePrintReceipt(row)}
                          disabled={isPrintLoading === row.id}
                          className="h-8 w-8 text-text-subtle hover:text-brand"
                          title={__('Print Receipt', 'codeclove-school-management')}
                        >
                          {isPrintLoading === row.id ? (
                            <Spinner size="xs" />
                          ) : (
                            <Printer size={14} />
                          )}
                        </Button>
                        {row.status === 'completed' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleReversePayment(row.id, row.invoice_id)}
                            className="h-8 w-8 text-text-subtle hover:text-danger"
                            title={__('Reverse Payment', 'codeclove-school-management')}
                          >
                            <RotateCcw size={14} />
                          </Button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </TableRoot>
        </CardContent>

        {/* Pagination */}
        {!isLoading && !isError && (
          <TablePagination
            {...table.paginationProps}
            total={total}
          />
        )}
      </Card>

      {/* Hidden print container */}
      {printingPayment && printingInvoice && (
        <div style={{ visibility: 'hidden', position: 'fixed', top: 0, left: 0, pointerEvents: 'none' }}>
          <div ref={printRef}>
            <PrintPaymentReceipt
              payment={printingPayment}
              invoice={printingInvoice}
              school={settingsData?.school}
            />
          </div>
        </div>
      )}
    </div>
  )
}
