import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, RotateCcw, Printer, X, SlidersHorizontal, QrCode, Sparkles } from 'lucide-react'
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
import { useTableState } from '@/lib/useTableState'
import { useDebounce } from '@/lib/useDebounce'
import {
  Button,
  PageHeader,
  Spinner,
  DataTable,
  type DataTableColumn,
  Card,
  Badge,
  FormField,
  Input,
  Select,
  DatePicker,
} from '@/components/ui'

export default function PaymentsPage() {
  const isPro = window.CodeCloveConfig?.isPro ?? false
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

  const columns: DataTableColumn<Payment>[] = useMemo(
    () => [
      {
        key: 'payment_number',
        header: __('Receipt #', 'codeclove-school-management'),
        type: 'code',
        render: (row) => row.payment_number,
      },
      {
        key: 'student',
        header: studentLabel,
        type: 'primary',
        render: (row) => (
          <div>
            <div>
              {row.student_first_name} {row.student_last_name}
            </div>
            <div className="text-2xs text-text-muted font-mono">{row.student_number}</div>
          </div>
        ),
      },
      {
        key: 'invoice_number',
        header: __('Invoice #', 'codeclove-school-management'),
        type: 'code',
        render: (row) => row.invoice_number || '—',
      },
      {
        key: 'paid_on',
        header: __('Payment Date', 'codeclove-school-management'),
        type: 'date',
        render: (row) => formatDate(row.paid_on),
      },
      {
        key: 'method',
        header: __('Method', 'codeclove-school-management'),
        type: 'badge',
        render: (row) => (
          <span className="text-xs text-text-muted font-medium bg-bg-surface border border-border px-2 py-1 rounded inline-block">
            {getMethodLabel(row.method)}
          </span>
        ),
      },
      {
        key: 'amount',
        header: __('Amount', 'codeclove-school-management'),
        type: 'number',
        render: (row) => (
          <div className={`tabular-nums font-semibold ${row.status === 'completed' ? 'text-success' : 'text-danger line-through'}`}>
            {formatCurrency(row.amount_minor)}
            {row.status !== 'completed' && (
              <Badge
                variant={
                  row.status === 'refunded' || row.status === 'failed' || row.status === 'cancelled'
                    ? 'danger'
                    : 'warning'
                }
                size="sm"
                className="ml-1.5 align-middle"
              >
                {row.status}
              </Badge>
            )}
          </div>
        ),
      },
      {
        key: 'actions',
        header: __('Actions', 'codeclove-school-management'),
        type: 'actions',
        render: (row) => (
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
        ),
      },
    ],
    [studentLabel, formatDate, formatCurrency, isPrintLoading]
  )

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
            <div className="flex items-center gap-2 flex-shrink-0 h-9">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`text-xs gap-1.5 h-9 ${showAdvanced ? 'bg-bg-surface text-brand border border-border' : 'text-text-muted hover:text-text'}`}
              >
                <SlidersHorizontal size={12} />
                {showAdvanced ? __('Hide Dates', 'codeclove-school-management') : __('Date Range', 'codeclove-school-management')}
              </Button>
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

          {/* Date Range Filters */}
          {showAdvanced && (
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3 border-t border-border pt-3 animate-in fade-in duration-200">
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

            </div>
          )}
        </div>
      </Card>

      {/* Contextual Pro Gateway Callout for Free Users */}
      {!isPro && (
        <div className="rounded-xl border border-brand/20 bg-gradient-to-r from-brand-dim/50 via-bg-elevated to-brand-dim/20 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-brand/10 border border-brand/20 text-brand shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                <span>{__('Automate UPI & Card Collections', 'codeclove-school-management')}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-500 border border-amber-500/25">
                  PRO
                </span>
              </h3>
              <p className="text-xs text-text-muted leading-relaxed max-w-2xl">
                {__(
                  'Connect Razorpay for instant UPI, QR Code, and NetBanking payments, or Stripe for cards and digital wallets. Payments settle directly into your account and balance invoices automatically.',
                  'codeclove-school-management'
                )}
              </p>
            </div>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={() => navigate('/pro-upgrade?feature=payment_gateways')}
            className="shrink-0 gap-1.5 whitespace-nowrap"
          >
            <Sparkles size={13} />
            <span>{__('Unlock Online Payments (Pro)', 'codeclove-school-management')}</span>
          </Button>
        </div>
      )}

      {/* Main List */}
      <DataTable<Payment>
        data={list}
        columns={columns}
        table={table}
        total={total}
        isLoading={isLoading}
        isError={isError}
        errorMessage={__('Error Loading Payments', 'codeclove-school-management')}
        onRetry={() => refetch()}
        keyExtractor={(row) => row.id}
        emptyState={{
          message: sprintf(__('No %s found', 'codeclove-school-management'), paymentLabelPlural),
          description: __('Payments will appear here once recorded against outstanding student invoices.', 'codeclove-school-management'),
          icon: entity.icon,
          action: (
            <Button size="sm" onClick={() => navigate('/finance/payments/record')}>
              {__('Record Payment', 'codeclove-school-management')}
            </Button>
          ),
        }}
      />

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
