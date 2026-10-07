import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Calendar,
  CreditCard,
  Mail,
  Phone,
  User,
  Plus,
  Printer,
  Trash2,
  FileText,
  Check,
} from 'lucide-react'
import { __, sprintf } from '@/lib/i18n'
import { getStatusVariant } from './finance-utils'
import {
  useInvoice,
  useDeletePayment,
  useDeleteInvoice,
  useUpdateInvoice,
  type Payment,
} from '@/api/finance'
import { useStudentDetails } from '@/api/students'
import { useUnits, useGroups } from '@/api/academics'
import { useSettings } from '@/api/settings'
import { useToast } from '@/lib/toast'
import { useConfirm } from '@/lib/confirm'
import { useLabels } from '@/lib/labels'
import { useFormatter } from '@/lib/formatter'
import { printElement } from '@/lib/print'
import PrintInvoiceSheet from './PrintInvoiceSheet'
import { UnifiedCheckoutModal } from './components/UnifiedCheckoutModal'
import { useGatewaysConfig } from '@/api/gateways'
import {
  Button,
  PageHeader,
  Skeleton,
  EmptyState,
  TableRoot,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Card,
  CardContent,
  Badge,
  Input,
  DatePicker,
} from '@/components/ui'

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const invoiceId = Number(id)
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  
  const { getLabel } = useLabels()
  const { formatCurrency, formatDate } = useFormatter()

  const invoiceLabel = getLabel('invoice', false, __('Invoice', 'codeclove-school-management'))

  // Modals state
  const [isEditing, setIsEditing] = useState(false)
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false)
  const handleOpenPayment = () => navigate(`/finance/invoices/${invoiceId}/record-payment`)

  // Edit Form State
  const [editData, setEditData] = useState({
    due_date: '',
    guardian_name: '',
    guardian_email: '',
    discount_note: '',
  })

  // Queries / Mutations
  const { data: invoice, isLoading, isError, refetch } = useInvoice(invoiceId)
  const { data: student }     = useStudentDetails(invoice?.student_id ?? 0)
  const { data: settingsData } = useSettings()
  const school = settingsData?.school
  const printRef = useRef<HTMLDivElement>(null)
  const isPro = typeof window === 'undefined' || window.CodeCloveConfig?.isPro !== false
  const { data: gatewaysConfig } = useGatewaysConfig({ enabled: isPro })
  const hasActiveGateways = Boolean(
    isPro &&
    gatewaysConfig?.gateways &&
    Object.values(gatewaysConfig.gateways).some((g) => g.enabled)
  )
  // Resolve unit + group names for the student panel
  const { data: unitsData }  = useUnits({ per_page: 100 })
  const { data: groupsData } = useGroups(
    student?.enrollment?.academic_unit_id
      ? { unit_id: student.enrollment.academic_unit_id, per_page: 100 }
      : undefined
  )
  const unitName  = unitsData?.data?.find(u => u.id === student?.enrollment?.academic_unit_id)?.name
  const groupName = groupsData?.data?.find(g => g.id === student?.enrollment?.academic_group_id)?.name
  const deletePaymentMutation = useDeletePayment()
  const updateInvoiceMutation = useUpdateInvoice()
  const voidInvoiceMutation   = useDeleteInvoice()

  const handleOpenEdit = () => {
    if (!invoice) return
    setEditData({
      due_date: invoice.due_date || '',
      guardian_name: invoice.guardian_name || '',
      guardian_email: invoice.guardian_email || '',
      discount_note: invoice.discount_note || '',
    })
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
  }

  const handleEditSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!invoice) return

    updateInvoiceMutation.mutate(
      {
        id: invoiceId,
        payload: {
          due_date: editData.due_date || null,
          guardian_name: editData.guardian_name,
          guardian_email: editData.guardian_email,
          discount_note: editData.discount_note || null,
        },
      },
      {
        onSuccess: () => {
          toast.success(sprintf(__('%s updated successfully!', 'codeclove-school-management'), invoiceLabel))
          setIsEditing(false)
        },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : ''
          toast.error(message || __('Failed to update details', 'codeclove-school-management'))
        },
      }
    )
  }

  const handleVoidInvoice = () => {
    const reason = window.prompt(
      sprintf(__('Enter a reason for voiding this %s (required):', 'codeclove-school-management'), invoiceLabel.toLowerCase())
    )
    if (reason === null) return // user cancelled
    if (!reason.trim()) {
      toast.error(__('A reason is required to void an invoice.', 'codeclove-school-management'))
      return
    }
    voidInvoiceMutation.mutate(invoiceId, {
      onSuccess: () => {
        toast.success(sprintf(__('%1$s voided. Reason: %2$s', 'codeclove-school-management'), invoiceLabel, reason))
      },
      onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : ''
        toast.error(message || __('Failed to void invoice', 'codeclove-school-management'))
      },
    })
  }

  const handleReversePayment = async (paymentId: number) => {
    const isConfirmed = await confirm({
      title: __('Reverse Payment Receipt', 'codeclove-school-management'),
      message: __('Are you sure you want to cancel/reverse this payment receipt? This will restore the outstanding balance of this invoice.', 'codeclove-school-management'),
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64 rounded-lg" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (isError || !invoice) {
    return (
      <EmptyState
        title={sprintf(__('%s not found', 'codeclove-school-management'), invoiceLabel)}
        description={__('The billing invoice you are trying to view does not exist or has been deleted.', 'codeclove-school-management')}
        icon={AlertTriangle}
        action={
          <Button size="sm" onClick={() => navigate('/finance/invoices')}>
            {__('Back to Invoices', 'codeclove-school-management')}
          </Button>
        }
      />
    )
  }

  const isClosed = invoice.status === 'cancelled' || invoice.status === 'void'
  const isPaid = invoice.status === 'paid'

  return (
    <div className="space-y-6">
      <PageHeader
        title={sprintf(__('Invoice %s', 'codeclove-school-management'), invoice.invoice_number)}
        description={sprintf(__('Billed to %1$s %2$s (%3$s)', 'codeclove-school-management'), invoice.student_first_name, invoice.student_last_name, invoice.student_number)}
        onBack={() => navigate('/finance/invoices')}
        breadcrumbs={[
          { label: __('Finance', 'codeclove-school-management') },
          { label: __('Invoices', 'codeclove-school-management'), href: '/finance/invoices' },
          { label: invoice.invoice_number },
        ]}
        actions={
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button size="sm" variant="secondary" onClick={handleCancelEdit}>
                  {__('Cancel', 'codeclove-school-management')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleEditSubmit()}
                  disabled={updateInvoiceMutation.isPending}
                >
                  {updateInvoiceMutation.isPending ? __('Saving...', 'codeclove-school-management') : __('Save Details', 'codeclove-school-management')}
                </Button>
              </>
            ) : (
              <>
                {!isClosed && (
                  <Button size="sm" variant="secondary" onClick={handleOpenEdit}>
                    {__('Edit Details', 'codeclove-school-management')}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    if (printRef.current) {
                      printElement(printRef.current)
                    }
                  }}
                  className="flex items-center gap-1.5"
                >
                  <Printer className="h-4 w-4" />
                  {__('Print Invoice', 'codeclove-school-management')}
                </Button>
                {!isClosed && !isPaid && (
                  <>
                    {hasActiveGateways && (
                      <Button size="sm" variant="secondary" onClick={() => setIsCheckoutModalOpen(true)} className="flex items-center gap-1.5">
                        <CreditCard className="h-4 w-4 text-primary" />
                        {__('Pay Online', 'codeclove-school-management')}
                      </Button>
                    )}
                    <Button size="sm" onClick={handleOpenPayment} className="flex items-center gap-1.5">
                      <Plus className="h-4 w-4" />
                      {__('Record Payment', 'codeclove-school-management')}
                    </Button>
                  </>
                )}
                {!isClosed && (
                  <Button size="sm" variant="danger" onClick={handleVoidInvoice}>
                    {__('Void Invoice', 'codeclove-school-management')}
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />

      {/* Invoice Lifecycle Stepper */}
      <Card className="p-5 border-border/70 shadow-2xs">
        <div className="flex items-center justify-between gap-2 overflow-x-auto py-1.5">
          {[
            { id: 'draft', label: __('Draft Created', 'codeclove-school-management') },
            { id: 'issued', label: __('Issued to Student', 'codeclove-school-management') },
            { id: 'partially_paid', label: __('Partially Paid', 'codeclove-school-management') },
            { id: 'paid', label: __('Fully Settled', 'codeclove-school-management') },
          ].map((step, idx) => {
            const statusOrder: Record<string, number> = {
              draft: 0,
              issued: 1,
              overdue: 1,
              partially_paid: 2,
              paid: 3,
            }
            const currentStepIdx = statusOrder[invoice.status] ?? (invoice.status === 'paid' ? 3 : 1)
            const isCompleted = currentStepIdx > idx || invoice.status === 'paid'
            const isCurrent = currentStepIdx === idx && invoice.status !== 'paid' && !isClosed

            return (
              <div key={step.id} className="flex items-center gap-3 flex-1 min-w-[130px]">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isClosed
                        ? 'bg-bg-subtle text-text-subtle border border-border'
                        : isCompleted
                        ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                        : isCurrent
                        ? 'bg-brand-dim text-brand border border-brand/40 ring-4 ring-brand/10 font-bold'
                        : 'bg-bg-subtle text-text-subtle border border-border/60'
                    }`}
                  >
                    {isCompleted ? <Check size={14} /> : idx + 1}
                  </div>
                  <div>
                    <span className={`text-xs block leading-tight ${isCurrent ? 'text-brand font-bold' : isCompleted ? 'text-text font-semibold' : 'text-text-subtle font-medium'}`}>
                      {step.label}
                    </span>
                    {isCurrent && invoice.status === 'overdue' && (
                      <span className="text-3xs text-amber-600 font-bold block mt-0.5">{__('Payment Overdue', 'codeclove-school-management')}</span>
                    )}
                  </div>
                </div>
                {idx < 3 && (
                  <div className={`flex-1 h-0.5 rounded-full ${isCompleted ? 'bg-emerald-500/40' : 'bg-border/60'}`} />
                )}
              </div>
            )
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details & Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metadata Card */}
          <Card>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6">
              <div>
                <span className="text-2xs uppercase tracking-wider text-text-muted font-semibold block mb-1">{__('Status', 'codeclove-school-management')}</span>
                <Badge variant={getStatusVariant(invoice.status)}>
                  {invoice.status.replace('_', ' ')}
                </Badge>
              </div>

              <div>
                <span className="text-2xs uppercase tracking-wider text-text-muted font-semibold block mb-1">{__('Issue Date', 'codeclove-school-management')}</span>
                <span className="font-semibold text-text flex items-center gap-1.5 text-xs">
                  <Calendar className="h-3.5 w-3.5 text-text-muted" />
                  {formatDate(invoice.issue_date)}
                </span>
              </div>

              <div>
                <span className="text-2xs uppercase tracking-wider text-text-muted font-semibold block mb-1">{__('Due Date', 'codeclove-school-management')}</span>
                {isEditing ? (
                  <DatePicker
                    className="h-8 text-xs"
                    value={editData.due_date}
                    onChange={(val) => setEditData({ ...editData, due_date: val })}
                  />
                ) : (
                  <span className={`font-semibold flex items-center gap-1.5 text-xs ${invoice.status === 'overdue' ? 'text-danger' : 'text-text'}`}>
                    <Calendar className="h-3.5 w-3.5 text-text-muted" />
                    {invoice.due_date ? formatDate(invoice.due_date) : '—'}
                  </span>
                )}
              </div>

              <div>
                <span className="text-2xs uppercase tracking-wider text-text-muted font-semibold block mb-1">{__('Outstanding Balance', 'codeclove-school-management')}</span>
                <span className="font-bold text-danger text-sm tabular-nums">
                  {formatCurrency(invoice.balance_minor)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Line Items Card */}
          <Card>
            <CardContent className="p-0">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                  <FileText className="h-4 w-4 text-text-muted" />
                  {__('Fee Schedule', 'codeclove-school-management')}
                </h3>
              </div>
              <TableRoot>
                <Thead>
                  <Tr>
                    <Th>{__('Fee Description', 'codeclove-school-management')}</Th>
                    <Th className="text-right">{__('Concession', 'codeclove-school-management')}</Th>
                    <Th className="text-right">{__('Amount', 'codeclove-school-management')}</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {invoice.line_items?.map((li) => (
                    <Tr key={li.id}>
                      <Td className="font-medium text-text">{li.description}</Td>
                      <Td className="text-right text-text-muted tabular-nums">
                        {li.discount_minor > 0 ? `-${formatCurrency(li.discount_minor)}` : '—'}
                      </Td>
                      <Td className="text-right font-semibold text-text tabular-nums">{formatCurrency(li.total_minor || 0)}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </TableRoot>

              {/* Totals Summary */}
              <div className="flex justify-end p-6 bg-bg-base/10 border-t border-border">
                <div className="w-72 space-y-2.5 text-right text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-muted">{__('Total Fees:', 'codeclove-school-management')}</span>
                    <span className="font-semibold text-text tabular-nums">{formatCurrency(invoice.subtotal_minor)}</span>
                  </div>
                  {invoice.discount_minor > 0 && (
                    <div className="flex justify-between items-center text-success">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <span>{__('Concession (', 'codeclove-school-management')}</span>
                          <input
                            type="text"
                            className="h-6 w-28 px-1.5 py-0.5 text-xs text-text border border-border rounded bg-bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
                            placeholder={__('e.g. Waiver', 'codeclove-school-management')}
                            value={editData.discount_note}
                            onChange={(e) => setEditData({ ...editData, discount_note: e.target.value })}
                          />
                          <span>):</span>
                        </div>
                      ) : (
                        <span>{sprintf(__('Concession (%s):', 'codeclove-school-management'), invoice.discount_note || __('Waiver', 'codeclove-school-management'))}</span>
                      )}
                      <span className="font-semibold tabular-nums">-{formatCurrency(invoice.discount_minor)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold border-t border-border/80 pt-2 text-text">
                    <span>{__('Net Payable:', 'codeclove-school-management')}</span>
                    <span className="tabular-nums">{formatCurrency(invoice.total_minor)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold text-success">
                    <span>{__('Amount Received:', 'codeclove-school-management')}</span>
                    <span className="tabular-nums">{formatCurrency(invoice.paid_minor)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t border-border/80 pt-2 text-danger">
                    <span>{__('Balance Outstanding:', 'codeclove-school-management')}</span>
                    <span className="tabular-nums">{formatCurrency(invoice.balance_minor)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Billing Info & Payments Log */}
        <div className="space-y-6">
          {/* Student + Guardian Panel */}
          <Card>
            <CardContent className="py-5 space-y-4">
              {/* Live student context */}
              <h3 className="text-sm font-semibold text-text flex items-center gap-2 border-b border-border pb-3">
                <User className="h-4 w-4 text-text-muted" />
                {__('Student', 'codeclove-school-management')}
              </h3>
              <div className="space-y-1 text-xs">
                <div className="font-semibold text-text text-sm">
                  {invoice.student_first_name} {invoice.student_last_name}
                </div>
                <div className="text-text-muted font-mono">{invoice.student_number}</div>
                {student?.enrollment && (
                  <div className="flex items-center gap-1 text-text-muted mt-1">
                    <span className="text-brand">◦</span>
                    {[unitName, groupName, student.enrollment.roll_number && sprintf(__('Roll %s', 'codeclove-school-management'), student.enrollment.roll_number)]
                      .filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>

              {/* Live guardian contact (for bursar use) */}
              {(student?.guardian || student?.father || student?.mother) && (
                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-2xs uppercase font-semibold text-text-muted tracking-wider">{__('Guardian Contact', 'codeclove-school-management')}</p>
                  {[student.guardian, student.father, student.mother]
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((g, i) => (
                      <div key={i} className="text-xs space-y-0.5">
                        <div className="font-medium text-text">
                          {g!.first_name} {g!.last_name}
                        </div>
                        {g!.phone && (
                          <div className="flex items-center gap-1.5 text-text-muted">
                            <Phone className="h-3 w-3" />
                            <a href={`tel:${g!.phone}`} className="hover:text-brand transition-colors">
                              {g!.phone}
                            </a>
                          </div>
                        )}
                        {g!.email && (
                          <div className="flex items-center gap-1.5 text-text-muted">
                            <Mail className="h-3 w-3" />
                            <a href={`mailto:${g!.email}`} className="hover:text-brand transition-colors truncate max-w-[160px]">
                              {g!.email}
                            </a>
                          </div>
                        )}
                      </div>
                    ))
                  }
                </div>
              )}

              {/* Invoice snapshot (what's legally printed on the invoice) */}
              <div className="border-t border-border pt-3 space-y-2">
                <p className="text-2xs uppercase font-semibold text-text-muted tracking-wider">{__('Invoice Snapshot', 'codeclove-school-management')}</p>
                <div className="space-y-1 text-xs">
                  <div>
                    <span className="text-2xs uppercase text-text-muted block mb-0.5">{__('Billed To', 'codeclove-school-management')}</span>
                    {isEditing ? (
                      <>
                        <Input
                          type="text"
                          className="h-8 py-1 text-xs"
                          value={editData.guardian_name}
                          disabled={invoice.paid_minor > 0}
                          onChange={(e) => setEditData({ ...editData, guardian_name: e.target.value })}
                        />
                        {invoice.paid_minor > 0 && (
                          <span className="text-2xs text-text-muted mt-1 block">{__('Locked after payment recorded.', 'codeclove-school-management')}</span>
                        )}
                      </>
                    ) : (
                      <span className="font-medium text-text block">{invoice.guardian_name || '—'}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-2xs uppercase text-text-muted block mb-0.5">{__('Email', 'codeclove-school-management')}</span>
                    {isEditing ? (
                      <>
                        <div className="relative">
                          <Input
                            type="email"
                            className="h-8 py-1 text-xs pl-8"
                            value={editData.guardian_email}
                            disabled={invoice.paid_minor > 0}
                            onChange={(e) => setEditData({ ...editData, guardian_email: e.target.value })}
                          />
                          <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
                        </div>
                        {invoice.paid_minor > 0 && (
                          <span className="text-2xs text-text-muted mt-1 block">{__('Locked after payment recorded.', 'codeclove-school-management')}</span>
                        )}
                      </>
                    ) : (
                      <span className="font-medium text-text flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-text-muted" />
                        {invoice.guardian_email || '—'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Receipt History */}
          <Card>
            <CardContent className="py-5 space-y-4">
              <h3 className="text-sm font-semibold text-text flex items-center gap-2 border-b border-border pb-3">
                <CreditCard className="h-4 w-4 text-text-muted" />
                {__('Receipt History', 'codeclove-school-management')}
              </h3>
              
              {(!invoice.payments || invoice.payments.length === 0) ? (
                <div className="text-center py-6 text-xs text-text-muted italic">
                  {__('No payments recorded yet.', 'codeclove-school-management')}
                </div>
              ) : (
                <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                  {invoice.payments.map((p: Payment) => (
                    <div key={p.id} className="border border-border/50 p-3 rounded-lg bg-bg-surface flex justify-between items-start gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-text text-xs">{p.payment_number}</span>
                          <Badge variant={p.status}>
                            {p.status}
                          </Badge>
                        </div>
                        <div className="text-2xs text-text-muted font-medium">
                          {formatDate(p.paid_on)} • {p.method.replace('_', ' ').toUpperCase()}
                        </div>
                        {p.reference && (
                          <div className="text-2xs text-text-muted">{sprintf(__('Ref: %s', 'codeclove-school-management'), p.reference)}</div>
                        )}
                        {p.note && (
                          <div className="text-2xs italic text-text-muted mt-1 max-w-[180px] truncate">{p.note}</div>
                        )}
                      </div>
                      <div className="text-right space-y-2">
                        <div className="font-bold text-text text-xs tabular-nums">{formatCurrency(p.amount_minor)}</div>
                        {p.status === 'completed' && (
                          <Button
                            variant="danger"
                            size="icon"
                            onClick={() => handleReversePayment(p.id)}
                            title={__('Reverse Payment', 'codeclove-school-management')}
                            className="p-1 h-6 w-6"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Off-screen Printable Invoice Container */}
      <div style={{ visibility: 'hidden', position: 'fixed', top: 0, left: 0, pointerEvents: 'none' }}>
        <div ref={printRef}>
          {invoice && (
            <PrintInvoiceSheet invoice={invoice} school={school} />
          )}
        </div>
      </div>

      {hasActiveGateways && invoice && (
        <UnifiedCheckoutModal
          open={isCheckoutModalOpen}
          onClose={() => setIsCheckoutModalOpen(false)}
          onPaymentSuccess={() => {
            refetch()
            setIsCheckoutModalOpen(false)
          }}
          invoice={{
            id: invoice.id,
            invoice_number: invoice.invoice_number,
            currency: invoice.currency,
            balance_minor: invoice.balance_minor,
            total_minor: invoice.total_minor,
            student_name: student ? `${student.first_name} ${student.last_name}`.trim() : undefined,
            guardian_email: invoice.guardian_email,
          }}
        />
      )}

    </div>
  )
}
