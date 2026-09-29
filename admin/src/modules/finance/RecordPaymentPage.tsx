import { useState, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AlertTriangle, CreditCard, Calendar, DollarSign, Printer, CheckCircle2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { __, sprintf } from '@/lib/i18n'
import { paymentSchema, type PaymentFormValues } from '@/schemas/finance'
import {
  useInvoice,
  useRecordPayment,
  type Payment,
} from '@/api/finance'
import { useSettings } from '@/api/settings'
import { useToast } from '@/lib/toast'
import { useLabels } from '@/lib/labels'
import { useFormatter } from '@/lib/formatter'
import { printElement } from '@/lib/print'
import PrintPaymentReceipt from './PrintPaymentReceipt'
import {
  Button,
  PageHeader,
  Card,
  CardContent,
  Badge,
  FormField,
  Input,
  Select,
  Textarea,
  DatePicker,
  EmptyState,
  Skeleton,
} from '@/components/ui'

const STATUS_VARIANT: Record<string, string> = {
  draft: 'draft', issued: 'issued', partially_paid: 'partially_paid',
  paid: 'paid', overdue: 'overdue', cancelled: 'cancelled', void: 'void',
}

export default function RecordPaymentPage() {
  const { id } = useParams<{ id: string }>()
  const invoiceId = Number(id)
  const navigate = useNavigate()
  const toast = useToast()
  const { getLabel } = useLabels()
  const { formatCurrency, formatDate } = useFormatter()
  const { data: settingsData } = useSettings()
  const school = settingsData?.school

  const invoiceLabel = getLabel('invoice', false, __('Invoice', 'codeclove-school-management'))

  const paymentMethods = useMemo(() => [
    { value: 'cash',          label: __('Cash', 'codeclove-school-management') },
    { value: 'bank_transfer', label: __('Bank Transfer', 'codeclove-school-management') },
    { value: 'cheque',        label: __('Cheque', 'codeclove-school-management') },
    { value: 'upi',           label: __('UPI / QR Scan', 'codeclove-school-management') },
    { value: 'card',          label: __('Card Swipe', 'codeclove-school-management') },
    { value: 'other',         label: __('Other', 'codeclove-school-management') },
  ], [])

  const { data: invoice, isLoading, isError } = useInvoice(invoiceId)
  const recordPaymentMutation = useRecordPayment()

  // After success — hold the recorded payment for print
  const [recordedPayment, setRecordedPayment] = useState<Payment | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: '',
      paidOn: new Date().toISOString().split('T')[0] ?? '',
      method: 'cash',
      reference: '',
      note: '',
    },
  })

  const methodValue = watch('method')
  const paidOnValue = watch('paidOn')

  const onSubmit = (values: PaymentFormValues) => {
    if (!invoice) return

    const amtMinor = Math.round(parseFloat(values.amount || '0') * 100)
    if (amtMinor > invoice.balance_minor) {
      setError('amount', {
        type: 'manual',
        message: sprintf(__('Amount cannot exceed the outstanding balance (%s).', 'codeclove-school-management'), formatCurrency(invoice.balance_minor)),
      })
      return
    }

    recordPaymentMutation.mutate({
      invoice_id:   invoiceId,
      amount_minor: amtMinor,
      method:    values.method,
      paid_on:   values.paidOn,
      reference: values.reference?.trim() || null,
      note:      values.note?.trim() || null,
    } as unknown as Parameters<typeof recordPaymentMutation.mutate>[0], {
      onSuccess: (data: unknown) => {
        toast.success(__('Payment recorded successfully.', 'codeclove-school-management'))
        setRecordedPayment(data as Payment)
      },
      onError: (err: unknown) => {
        const message = err instanceof Error ? err.message : ''
        toast.error(message || __('Failed to record payment.', 'codeclove-school-management'))
      },
    })
  }

  const handlePrint = () => {
    if (printRef.current) printElement(printRef.current)
  }

  if (isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48 rounded-lg" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
        <div>
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
  if (isError || !invoice) return (
    <EmptyState
      title={__('Invoice not found', 'codeclove-school-management')}
      description={__('The invoice record you are trying to pay does not exist or has been deleted.', 'codeclove-school-management')}
      icon={AlertTriangle}
      action={
        <Button size="sm" onClick={() => navigate('/finance/invoices')}>
          {__('Back to Invoices', 'codeclove-school-management')}
        </Button>
      }
    />
  )

  // ── Success state — show print + navigate options ─────────────────────────
  if (recordedPayment) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={__('Payment Recorded', 'codeclove-school-management')}
          description={sprintf(__('Receipt %s has been saved.', 'codeclove-school-management'), recordedPayment.payment_number)}
          onBack={() => navigate(`/finance/invoices/${invoiceId}`)}
          breadcrumbs={[
            { label: __('Finance', 'codeclove-school-management') },
            { label: __('Invoices', 'codeclove-school-management'), href: '/finance/invoices' },
            { label: invoice.invoice_number, href: `/finance/invoices/${invoiceId}` },
            { label: __('Payment Recorded', 'codeclove-school-management') },
          ]}
          actions={
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={handlePrint} className="flex items-center gap-1.5">
                <Printer className="h-4 w-4" />
                {__('Print Receipt', 'codeclove-school-management')}
              </Button>
              <Button size="sm" onClick={() => navigate(`/finance/invoices/${invoiceId}`)}>
                {__('Back to Invoice', 'codeclove-school-management')}
              </Button>
            </div>
          }
        />

        <div className="max-w-lg mx-auto">
          <Card>
            <CardContent className="py-8 flex flex-col items-center gap-4 text-center">
              <div className="h-14 w-14 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-success" />
              </div>
              <div>
                <p className="font-semibold text-text text-lg">{sprintf(__('%s received', 'codeclove-school-management'), formatCurrency(recordedPayment.amount_minor))}</p>
                <p className="text-sm text-text-muted mt-1">
                  {__('Receipt', 'codeclove-school-management')} <span className="font-mono font-semibold">{recordedPayment.payment_number}</span> · {formatDate(recordedPayment.paid_on)}
                </p>
                <p className="text-xs text-text-muted mt-0.5">{paymentMethods.find(m => m.value === recordedPayment.method)?.label ?? recordedPayment.method}</p>
              </div>
              <div className="w-full border-t border-border pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-left text-sm">
                <div>
                  <span className="text-xs text-text-muted block">{__('Invoice', 'codeclove-school-management')}</span>
                  <span className="font-mono font-semibold">{invoice.invoice_number}</span>
                </div>
                <div>
                  <span className="text-xs text-text-muted block">{__('Balance Remaining', 'codeclove-school-management')}</span>
                  <span className={`font-bold ${invoice.balance_minor - recordedPayment.amount_minor <= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatCurrency(Math.max(0, invoice.balance_minor - recordedPayment.amount_minor))}
                  </span>
                </div>
              </div>
              <Button className="w-full mt-2" variant="secondary" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                {__('Print Receipt', 'codeclove-school-management')}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Hidden print container */}
        <div style={{ visibility: 'hidden', position: 'fixed', top: 0, left: 0, pointerEvents: 'none' }}>
          <div ref={printRef}>
            <PrintPaymentReceipt
              payment={recordedPayment}
              invoice={invoice}
              school={school}
            />
          </div>
        </div>
      </div>
    )
  }

  // Block if already paid or cancelled
  if (['paid', 'cancelled', 'void'].includes(invoice.status)) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-text-muted">
        <CreditCard className="h-8 w-8" />
        <p className="text-sm">{sprintf(__('This invoice cannot accept new payments (status: %s).', 'codeclove-school-management'), invoice.status)}</p>
        <Button size="sm" onClick={() => navigate(`/finance/invoices/${invoiceId}`)}>{__('Back to Invoice', 'codeclove-school-management')}</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={__('Record Fee Receipt', 'codeclove-school-management')}
        description={sprintf(__('Recording payment for %1$s %2$s', 'codeclove-school-management'), invoiceLabel, invoice.invoice_number)}
        onBack={() => navigate(`/finance/invoices/${invoiceId}`)}
        breadcrumbs={[
          { label: __('Finance', 'codeclove-school-management') },
          { label: __('Invoices', 'codeclove-school-management'), href: '/finance/invoices' },
          { label: invoice.invoice_number, href: `/finance/invoices/${invoiceId}` },
          { label: __('Record Payment', 'codeclove-school-management') },
        ]}
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/finance/invoices/${invoiceId}`)}
              disabled={recordPaymentMutation.isPending}
            >
              {__('Cancel', 'codeclove-school-management')}
            </Button>
            <Button size="sm" onClick={handleSubmit(onSubmit)} disabled={recordPaymentMutation.isPending}>
              {recordPaymentMutation.isPending ? __('Saving…', 'codeclove-school-management') : __('Record Payment', 'codeclove-school-management')}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Payment Form ──────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="py-6">
              <p className="text-xs font-semibold text-text uppercase tracking-wider pb-3 border-b border-border mb-5">
                {__('Payment Details', 'codeclove-school-management')}
              </p>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    label={sprintf(__('Amount Received (%s)', 'codeclove-school-management'), invoice.currency)}
                    required
                    error={errors.amount?.message}
                    hint={sprintf(__('Balance due: %s', 'codeclove-school-management'), formatCurrency(invoice.balance_minor))}
                  >
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={(invoice.balance_minor / 100).toString()}
                        placeholder="0.00"
                        {...register('amount')}
                        autoFocus
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setValue('amount', (invoice.balance_minor / 100).toString(), { shouldDirty: true, shouldValidate: true })}
                        className="shrink-0"
                      >
                        {__('Pay Full Balance', 'codeclove-school-management')}
                      </Button>
                    </div>
                  </FormField>

                  <FormField label={__('Payment Date', 'codeclove-school-management')} required error={errors.paidOn?.message}>
                    <DatePicker
                      value={paidOnValue}
                      onChange={(val) => setValue('paidOn', val || '', { shouldDirty: true, shouldValidate: true })}
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label={__('Payment Method', 'codeclove-school-management')} error={errors.method?.message}>
                    <Select
                      value={methodValue}
                      onValueChange={(val) => setValue('method', val as PaymentFormValues['method'], { shouldDirty: true })}
                      options={paymentMethods}
                    />
                  </FormField>

                  <FormField
                    label={__('Reference No.', 'codeclove-school-management')}
                    error={errors.reference?.message}
                    hint={__('Cheque no. / UTR / Transaction ID', 'codeclove-school-management')}
                  >
                    <Input
                      type="text"
                      placeholder={__('e.g. CHQ-55092 or UTR-XXXXX', 'codeclove-school-management')}
                      {...register('reference')}
                    />
                  </FormField>
                </div>

                <FormField label={__('Notes', 'codeclove-school-management')} error={errors.note?.message}>
                  <Textarea
                    rows={3}
                    placeholder={__('Any additional payment notes or verification details…', 'codeclove-school-management')}
                    {...register('note')}
                  />
                </FormField>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* ── Invoice Summary Sidebar ───────────────────────────── */}
        <div className="space-y-5">
          <Card>
            <CardContent className="py-6 space-y-4">
              <p className="text-xs font-semibold text-text uppercase tracking-wider pb-2 border-b border-border">
                {__('Invoice Summary', 'codeclove-school-management')}
              </p>

              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-text-muted">{__('Invoice #', 'codeclove-school-management')}</span>
                  <span className="text-xs font-mono font-semibold text-text">{invoice.invoice_number}</span>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-text-muted">{__('Student', 'codeclove-school-management')}</span>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-text">
                      {invoice.student_first_name} {invoice.student_last_name}
                    </p>
                    <p className="text-2xs font-mono text-text-muted">{invoice.student_number}</p>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-text-muted flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {__('Issue Date', 'codeclove-school-management')}
                  </span>
                  <span className="text-xs text-text">{formatDate(invoice.issue_date)}</span>
                </div>

                {invoice.due_date && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-text-muted flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {__('Due Date', 'codeclove-school-management')}
                    </span>
                    <span className="text-xs text-text">{formatDate(invoice.due_date)}</span>
                  </div>
                )}

                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-text-muted">{__('Status', 'codeclove-school-management')}</span>
                  <Badge variant={(STATUS_VARIANT[invoice.status] || 'default') as any}>
                    {invoice.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              <div className="border-t border-border pt-3 space-y-2 text-xs">
                <div className="flex justify-between text-text-muted">
                  <span>{__('Total Fees', 'codeclove-school-management')}</span>
                  <span className="text-text font-medium">{formatCurrency(invoice.total_minor)}</span>
                </div>
                <div className="flex justify-between text-success">
                  <span>{__('Already Paid', 'codeclove-school-management')}</span>
                  <span className="font-medium">{formatCurrency(invoice.paid_minor)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-text border-t border-border pt-2">
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5 text-danger" /> {__('Balance Due', 'codeclove-school-management')}
                  </span>
                  <span className="text-danger">{formatCurrency(invoice.balance_minor)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
