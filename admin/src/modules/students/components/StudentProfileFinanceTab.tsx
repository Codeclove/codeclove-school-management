import { useState, useMemo, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Coins, FileText, Receipt, Plus, Eye, Printer, CheckCircle2
} from 'lucide-react'
import {
  Button, Badge, Spinner, Select,
  TableRoot, Thead, Tbody, Tr, Th, Td, TableEmpty
} from '@/components/ui'
import { TablePagination } from '@/components/ui/TablePagination'
import { cn } from '@/lib/utils'
import { useInvoices, usePayments, type Invoice, type Payment } from '@/api/finance'
import { getStatusVariant, getMethodLabel } from '@/modules/finance/finance-utils'
import { useFormatter } from '@/lib/formatter'
import { api } from '@/lib/api-client'
import { printElement } from '@/lib/print'
import PrintInvoiceSheet from '@/modules/finance/PrintInvoiceSheet'
import PrintPaymentReceipt from '@/modules/finance/PrintPaymentReceipt'
import { useToast } from '@/lib/toast'
import { __, sprintf } from '@/lib/i18n'
import type { FullStudent } from '@/api/students'
import type { AcademicTerm } from '@/api/academics'
import type { SchoolSettings } from '@/components/ui/PrintLetterhead'

const FINANCE_ITEMS_PER_PAGE = 8

export interface StudentProfileFinanceTabProps {
  studentId: number
  student: FullStudent
  terms: AcademicTerm[]
  school?: SchoolSettings
}

export function StudentProfileFinanceTab({
  studentId,
  student,
  terms,
  school,
}: StudentProfileFinanceTabProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const { formatDate, formatCurrency } = useFormatter()

  const [financeTab, setFinanceTab] = useState<'ledger' | 'history'>('ledger')
  const [selectedTermFilter, setSelectedTermFilter] = useState<string>('all')
  const [financePage, setFinancePage] = useState(1)
  const [paymentPage, setPaymentPage] = useState(1)

  // Print states
  const printRef = useRef<HTMLDivElement>(null)
  const [printingInvoice, setPrintingInvoice] = useState<Invoice | null>(null)
  const [printingPayment, setPrintingPayment] = useState<Payment | null>(null)
  const [printType, setPrintType] = useState<'invoice' | 'receipt' | null>(null)
  const [isPrintLoading, setIsPrintLoading] = useState<number | null>(null)

  useEffect(() => {
    if (printType === 'invoice' && printingInvoice && printRef.current) {
      printElement(printRef.current)
      setPrintingInvoice(null)
      setPrintType(null)
    } else if (printType === 'receipt' && printingPayment && printingInvoice && printRef.current) {
      printElement(printRef.current)
      setPrintingPayment(null)
      setPrintingInvoice(null)
      setPrintType(null)
    }
  }, [printingInvoice, printingPayment, printType])

  const handlePrintInvoice = async (inv: Invoice) => {
    setIsPrintLoading(inv.id)
    setPrintType('invoice')
    try {
      const res = await api.get<Invoice>(`invoices/${inv.id}`)
      setPrintingInvoice(res.data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' ? err.message : '')
      toast.error(message || __( 'Failed to fetch invoice details for printing.', 'codeclove-school-management' ))
      setPrintType(null)
    } finally {
      setIsPrintLoading(null)
    }
  }

  const handlePrintReceipt = async (payment: Payment) => {
    setIsPrintLoading(payment.id)
    setPrintType('receipt')
    try {
      const res = await api.get<Invoice>(`invoices/${payment.invoice_id}`)
      setPrintingInvoice(res.data)
      setPrintingPayment(payment)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' ? err.message : '')
      toast.error(message || __( 'Failed to fetch invoice details for printing.', 'codeclove-school-management' ))
      setPrintType(null)
    } finally {
      setIsPrintLoading(null)
    }
  }

  const { data: invoicesData, isLoading: isInvoicesLoading } = useInvoices({
    student_id: studentId,
    per_page: 100,
  })
  const { data: paymentsData, isLoading: isPaymentsLoading } = usePayments({
    student_id: studentId,
    per_page: 100,
  })

  const invoices = useMemo(() => invoicesData?.data ?? [], [invoicesData?.data])
  const payments = useMemo(() => paymentsData?.data ?? [], [paymentsData?.data])

  const activeInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.status !== 'cancelled' && inv.status !== 'void')
  }, [invoices])

  const totalBilled = useMemo(() => {
    return activeInvoices.reduce((sum, inv) => sum + inv.total_minor, 0)
  }, [activeInvoices])

  const totalPaid = useMemo(() => {
    return activeInvoices.reduce((sum, inv) => sum + inv.paid_minor, 0)
  }, [activeInvoices])

  const outstandingBalance = useMemo(() => {
    return activeInvoices.reduce((sum, inv) => sum + inv.balance_minor, 0)
  }, [activeInvoices])

  const collectionPercentage = useMemo(() => {
    return totalBilled > 0 ? Math.min(100, Math.round((totalPaid / totalBilled) * 100)) : 0
  }, [totalBilled, totalPaid])

  const overdueInvoicesCount = useMemo(() => {
    return invoices.filter((i) => i.status === 'overdue').length
  }, [invoices])

  const handleTermFilterChange = (val: string) => {
    setSelectedTermFilter(val)
    setFinancePage(1)
  }

  const filteredInvoices = useMemo(() => {
    if (selectedTermFilter === 'all') {
      return invoices
    }
    const termId = Number(selectedTermFilter)
    return invoices.filter((inv) => inv.academic_term_id === termId)
  }, [invoices, selectedTermFilter])

  const sortedPayments = useMemo(() => {
    return [...payments].sort((a, b) => new Date(b.paid_on).getTime() - new Date(a.paid_on).getTime())
  }, [payments])

  const paginatedInvoices = useMemo(() => {
    const start = (financePage - 1) * FINANCE_ITEMS_PER_PAGE
    return filteredInvoices.slice(start, start + FINANCE_ITEMS_PER_PAGE)
  }, [filteredInvoices, financePage])

  const paginatedPayments = useMemo(() => {
    const start = (paymentPage - 1) * FINANCE_ITEMS_PER_PAGE
    return sortedPayments.slice(start, start + FINANCE_ITEMS_PER_PAGE)
  }, [sortedPayments, paymentPage])

  return (
    <div>
      {isInvoicesLoading || isPaymentsLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size="md" />
        </div>
      ) : invoices.length === 0 && payments.length === 0 ? (
        <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-brand-dim flex items-center justify-center text-brand/80 mb-1">
            <Coins size={22} />
          </div>
          <p className="text-sm font-bold text-text">{__( 'No invoices or billing data found', 'codeclove-school-management' )}</p>
          <p className="text-xs text-text-muted max-w-sm leading-normal">
            {__( 'All tuition structures, invoice history, and fee collections are managed securely in the central Finance module.', 'codeclove-school-management' )}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {/* Financial KPI Metrics Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border bg-bg-surface/20">
            <div className="p-5 sm:p-6 flex flex-col justify-between gap-3">
              <div>
                <span className="text-xs font-medium text-text-muted block">
                  {__( 'Total Billed', 'codeclove-school-management' )}
                </span>
                <div className="text-2xl font-bold text-text tabular-nums tracking-tight mt-1">
                  {formatCurrency(totalBilled)}
                </div>
              </div>
              <div className="text-xs text-text-subtle tabular-nums">
                {sprintf(
                  __( '%1$d %2$s issued', 'codeclove-school-management' ),
                  activeInvoices.length,
                  activeInvoices.length === 1
                    ? __( 'invoice', 'codeclove-school-management' )
                    : __( 'invoices', 'codeclove-school-management' )
                )}
              </div>
            </div>

            <div className="p-5 sm:p-6 flex flex-col justify-between gap-3">
              <div>
                <span className="text-xs font-medium text-text-muted block">
                  {__( 'Total Collected', 'codeclove-school-management' )}
                </span>
                <div className="text-2xl font-bold text-success tabular-nums tracking-tight mt-1">
                  {formatCurrency(totalPaid)}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="text-xs text-text-subtle tabular-nums">
                  {sprintf( __( '%d%% collected', 'codeclove-school-management' ), collectionPercentage )}
                </div>
                <div className="w-full bg-border/50 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-success h-full rounded-full transition-all duration-300"
                    style={{ width: `${collectionPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6 flex flex-col justify-between gap-3">
              <div>
                <span className="text-xs font-medium text-text-muted block">
                  {__( 'Outstanding Balance', 'codeclove-school-management' )}
                </span>
                <div className={cn(
                  'text-2xl font-bold tabular-nums tracking-tight mt-1',
                  outstandingBalance > 0 ? 'text-danger' : 'text-text'
                )}>
                  {formatCurrency(outstandingBalance)}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {overdueInvoicesCount > 0 ? (
                  <Badge variant="danger" size="sm" className="font-semibold">
                    {sprintf( __( '%d Overdue', 'codeclove-school-management' ), overdueInvoicesCount )}
                  </Badge>
                ) : (
                  <Badge variant="success" size="sm" className="font-semibold">
                    {__( 'Settled', 'codeclove-school-management' )}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Sub-tabs & Filter Toolbar */}
          <div className="px-6 py-3 bg-bg-surface/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-h-[52px]">
            <div
              role="tablist"
              aria-label={__( 'Financial ledger sections', 'codeclove-school-management' )}
              className="p-1 rounded-xl bg-bg-base/70 dark:bg-bg-surface border border-border inline-flex items-center gap-1 self-start sm:self-auto text-xs font-medium"
            >
              {([
                { id: 'ledger' as const, label: __( 'Invoice Ledger', 'codeclove-school-management' ), icon: FileText, count: filteredInvoices.length },
                { id: 'history' as const, label: __( 'Payment History', 'codeclove-school-management' ), icon: Receipt, count: payments.length },
              ]).map((tab) => {
                const Icon = tab.icon
                const isActive = financeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`tab-finance-${tab.id}`}
                    aria-selected={isActive}
                    aria-controls={`panel-finance-${tab.id}`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => setFinanceTab(tab.id)}
                    className={cn(
                      'inline-flex items-center justify-center gap-2 text-xs font-semibold rounded-lg transition-colors duration-150 h-8 px-3.5 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1',
                      isActive
                        ? 'bg-bg-elevated text-text shadow-xs border border-border/80 dark:border-white/10'
                        : 'text-text-muted hover:text-text hover:bg-hover-bg/70 border border-transparent'
                    )}
                  >
                    <Icon size={14} className={cn('transition-colors', isActive ? 'text-brand' : 'text-text-subtle')} />
                    <span>{tab.label}</span>
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded-full text-xs font-semibold font-mono tabular-nums min-w-[20px] text-center transition-colors',
                        isActive
                          ? 'bg-brand-dim text-brand'
                          : 'bg-border/60 text-text-subtle'
                      )}
                    >
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Term filter select or Payment count summary */}
            {financeTab === 'ledger' ? (
              <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap sm:flex-nowrap">
                <div className="w-full sm:w-44">
                  <Select
                    value={selectedTermFilter}
                    onValueChange={handleTermFilterChange}
                    options={[
                      { value: 'all', label: __( 'All Terms', 'codeclove-school-management' ) },
                      ...(terms ?? []).map((term) => ({
                        value: String(term.id),
                        label: term.name,
                      })),
                    ]}
                    placeholder={__( 'Filter by Term', 'codeclove-school-management' )}
                  />
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => navigate(`/finance/invoices/new?student_id=${studentId}&unit_id=${student.enrollment?.academic_unit_id ?? ''}`)}
                  className="gap-1.5 text-xs h-8 px-3 font-semibold shadow-xs shrink-0"
                >
                  <Plus size={13} />
                  <span>{__( 'Create Invoice', 'codeclove-school-management' )}</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-text-muted tabular-nums self-end sm:self-auto py-1">
                <CheckCircle2 size={14} className="text-success shrink-0" />
                <span>
                  {sprintf(
                    __( '%1$d %2$s recorded', 'codeclove-school-management' ),
                    payments.length,
                    payments.length === 1
                      ? __( 'receipt', 'codeclove-school-management' )
                      : __( 'receipts', 'codeclove-school-management' )
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Tab Contents: Invoices or Payments Table */}
          {financeTab === 'ledger' ? (
            <div id="panel-finance-ledger" role="tabpanel" aria-labelledby="tab-finance-ledger">
              <TableRoot>
                <Thead>
                  <Tr>
                    <Th type="code" className="ps-6">{__( 'Invoice #', 'codeclove-school-management' )}</Th>
                    <Th type="date">{__( 'Issue Date', 'codeclove-school-management' )}</Th>
                    <Th>{__( 'Fee Description', 'codeclove-school-management' )}</Th>
                    <Th type="number">{__( 'Amount', 'codeclove-school-management' )}</Th>
                    <Th type="badge">{__( 'Status', 'codeclove-school-management' )}</Th>
                    <Th type="actions" className="pe-6">{__( 'Actions', 'codeclove-school-management' )}</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {paginatedInvoices.length === 0 ? (
                    <TableEmpty
                      colSpan={6}
                      icon={Coins}
                      message={__( 'No invoices found.', 'codeclove-school-management' )}
                      description={__( 'No invoices match the selected academic term.', 'codeclove-school-management' )}
                    />
                  ) : (
                    paginatedInvoices.map((inv) => {
                      const badgeVariant = getStatusVariant(inv.status)
                      const isOverdue = inv.status === 'overdue' || (inv.status !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'void' && inv.due_date && new Date(inv.due_date) < new Date())
                      return (
                        <Tr key={inv.id}>
                          <Td type="code" className="ps-6">
                            <Link
                              to={`/finance/invoices/${inv.id}`}
                              className="font-mono font-semibold text-text hover:text-brand hover:underline transition-colors"
                            >
                              {inv.invoice_number}
                            </Link>
                          </Td>
                          <Td type="date">
                            {formatDate(inv.issue_date)}
                          </Td>
                          <Td>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-text">
                                {inv.first_item_description || __( 'Tuition & Fees', 'codeclove-school-management' )}
                              </span>
                              {inv.academic_term_name && (
                                <Badge variant="default" size="sm" className="font-normal text-text-muted">
                                  {inv.academic_term_name}
                                </Badge>
                              )}
                            </div>
                          </Td>
                          <Td type="number">
                            <div className="font-semibold text-text tabular-nums">
                              {formatCurrency(inv.total_minor)}
                            </div>
                            {inv.paid_minor > 0 && inv.balance_minor > 0 && (
                              <div className="text-3xs text-danger font-medium">
                                {sprintf( __( 'Bal: %s', 'codeclove-school-management' ), formatCurrency(inv.balance_minor) )}
                              </div>
                            )}
                          </Td>
                          <Td type="badge">
                            <Badge size="sm" variant={badgeVariant} className="capitalize">
                              {inv.status.replace('_', ' ')}
                            </Badge>
                            {isOverdue && inv.status !== 'overdue' && (
                              <div className="text-3xs text-danger font-semibold mt-0.5">{__( 'Overdue', 'codeclove-school-management' )}</div>
                            )}
                          </Td>
                          <Td type="actions" className="pe-6">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isPrintLoading === inv.id}
                                onClick={() => handlePrintInvoice(inv)}
                                className="h-8 w-8 text-text-subtle hover:text-brand"
                                title={__( 'Print Invoice', 'codeclove-school-management' )}
                              >
                                {isPrintLoading === inv.id && printType === 'invoice' ? (
                                  <Spinner size="xs" />
                                ) : (
                                  <Printer size={13} />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(`/finance/invoices/${inv.id}`)}
                                className="h-8 w-8 text-text-subtle hover:text-brand"
                                title={__( 'View Details', 'codeclove-school-management' )}
                              >
                                <Eye size={13} />
                              </Button>
                            </div>
                          </Td>
                        </Tr>
                      )
                    })
                  )}
                </Tbody>
              </TableRoot>

              <div className="border-t border-border px-6 py-3 bg-bg-surface/20">
                <TablePagination
                  page={financePage}
                  perPage={FINANCE_ITEMS_PER_PAGE}
                  total={filteredInvoices.length}
                  onPageChange={setFinancePage}
                />
              </div>
            </div>
          ) : (
            <div id="panel-finance-history" role="tabpanel" aria-labelledby="tab-finance-history">
              <TableRoot>
                <Thead>
                  <Tr>
                    <Th type="code" className="ps-6">{__( 'Receipt #', 'codeclove-school-management' )}</Th>
                    <Th type="date">{__( 'Date', 'codeclove-school-management' )}</Th>
                    <Th type="code">{__( 'Invoice #', 'codeclove-school-management' )}</Th>
                    <Th>{__( 'Method & Ref', 'codeclove-school-management' )}</Th>
                    <Th type="number">{__( 'Amount', 'codeclove-school-management' )}</Th>
                    <Th type="actions" className="pe-6">{__( 'Actions', 'codeclove-school-management' )}</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {paginatedPayments.length === 0 ? (
                    <TableEmpty
                      colSpan={6}
                      icon={Receipt}
                      message={__( 'No payments recorded yet.', 'codeclove-school-management' )}
                      description={__( 'Completed payments and receipts will appear here.', 'codeclove-school-management' )}
                    />
                  ) : (
                    paginatedPayments.map((p) => {
                      const isReversed = p.status === 'cancelled' || p.status === 'refunded'
                      return (
                        <Tr key={p.id} className="hover:bg-hover-bg transition-colors">
                          <Td type="code" className="ps-6">
                            <span className="font-mono font-semibold text-text">{p.payment_number}</span>
                          </Td>
                          <Td type="date">{formatDate(p.paid_on)}</Td>
                          <Td type="code">
                            {p.invoice_id ? (
                              <Link
                                to={`/finance/invoices/${p.invoice_id}`}
                                className="font-mono text-text-muted hover:text-brand hover:underline font-medium text-xs transition-colors"
                              >
                                {p.invoice_number || `INV #${p.invoice_id}`}
                              </Link>
                            ) : (
                              <span className="text-text-muted">—</span>
                            )}
                          </Td>
                          <Td>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="default" size="sm" className="font-normal text-text-muted">
                                {getMethodLabel(p.method)}
                              </Badge>
                              {p.reference && (
                                <span className="text-xs font-mono text-text-subtle">
                                  {p.reference}
                                </span>
                              )}
                            </div>
                          </Td>
                          <Td type="number">
                            <div className={cn('tabular-nums font-semibold text-text', isReversed && 'text-text-muted line-through')}>
                              {formatCurrency(p.amount_minor)}
                            </div>
                            {isReversed && (
                              <div className="text-3xs text-danger font-medium uppercase">
                                {p.status}
                              </div>
                            )}
                          </Td>
                          <Td type="actions" className="pe-6">
                            <div className="flex items-center justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isPrintLoading === p.id}
                                onClick={() => handlePrintReceipt(p)}
                                className="h-8 w-8 text-text-subtle hover:text-brand"
                                title={__( 'Print Receipt', 'codeclove-school-management' )}
                              >
                                {isPrintLoading === p.id && printType === 'receipt' ? (
                                  <Spinner size="xs" />
                                ) : (
                                  <Printer size={13} />
                                )}
                              </Button>
                            </div>
                          </Td>
                        </Tr>
                      )
                    })
                  )}
                </Tbody>
              </TableRoot>

              <div className="border-t border-border px-6 py-3 bg-bg-surface/20">
                <TablePagination
                  page={paymentPage}
                  perPage={FINANCE_ITEMS_PER_PAGE}
                  total={sortedPayments.length}
                  onPageChange={setPaymentPage}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden printable elements container */}
      <div className="hidden">
        {printType === 'invoice' && printingInvoice && (
          <div ref={printRef}>
            <PrintInvoiceSheet invoice={printingInvoice} school={school} />
          </div>
        )}
        {printType === 'receipt' && printingPayment && printingInvoice && (
          <div ref={printRef}>
            <PrintPaymentReceipt
              payment={printingPayment}
              invoice={printingInvoice}
              school={school}
            />
          </div>
        )}
      </div>
    </div>
  )
}
