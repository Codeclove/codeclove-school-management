/**
 * Invoice Statement View Component.
 *
 * Dedicated in-page official school fee statement and payment workspace.
 * Replaces the cramped modal-on-modal anti-pattern in the Student & Parent Portal
 * with a full-page, mobile-first experience featuring itemized fee breakdown,
 * executive summary cards, official letterhead styling, verifiable receipt history,
 * an interactive payment dock, and 1-click official statement printing.
 */

import React, { useRef, useMemo } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  GraduationCap,
  Printer,
  Receipt,
  Wallet,
  XCircle,
} from 'lucide-react'
import type { Invoice, InvoicePayment, InvoiceLineItem } from '../../types'
import type { Invoice as FinanceInvoice } from '@/api/finance'
import { type SchoolSettings } from '@/components/ui/PrintLetterhead'
import { formatCurrency, formatDate } from '../../lib/formatter'
import { usePortal } from '../../lib/portal-context'
import { usePortalLabels } from '../../lib/labels'
import { Badge, Button, Card, CardContent, TableRoot, Thead, Tbody, Tr, Th, Td } from '@/components/ui'
import { PrintInvoiceSheet, printElement } from '@/components/print'
import { PortalPaymentMethodSelector, type PortalPaymentSuccessResult } from './PortalPaymentMethodSelector'
import { useGatewaysConfig } from '@/api/gateways'
import { cn } from '@/lib/utils'
import { __, sprintf } from '@/lib/i18n'

export interface InvoiceStatementViewProps {
  invoice: Invoice
  currency?: string
  onBack?: () => void
  onBackToLedger?: () => void
  onViewReceipt?: (payment: InvoicePayment & { invoice_number?: string; invoice?: Invoice }) => void
  onPaymentSuccess?: (result: PortalPaymentSuccessResult) => void
  className?: string
}

/**
 * Returns human-readable label and styling badge for invoice status.
 */
export function getInvoiceStatusMeta(status: string, isUS = false) {
  const norm = status.toLowerCase()
  switch (norm) {
    case 'paid':
      return {
        label: __( 'Paid in Full', 'codeclove-school-management' ),
        variant: 'success' as const,
        icon: CheckCircle2,
        desc: __( 'This statement has been paid in full. No balance remaining.', 'codeclove-school-management' ),
        badgeClass: 'bg-success-dim text-success border-success/30',
      }
    case 'partially_paid':
      return {
        label: __( 'Partially Paid', 'codeclove-school-management' ),
        variant: 'warning' as const,
        icon: Clock,
        desc: __( 'A partial payment has been applied. Remaining balance is due.', 'codeclove-school-management' ),
        badgeClass: 'bg-warning-dim text-warning border-warning/30',
      }
    case 'overdue':
      return {
        label: isUS
          ? __( 'Past Due', 'codeclove-school-management' )
          : __( 'Overdue', 'codeclove-school-management' ),
        variant: 'danger' as const,
        icon: AlertTriangle,
        desc: isUS
          ? __( 'Payment for this fee statement is past due. Please settle immediately.', 'codeclove-school-management' )
          : __( 'Payment for this fee statement is overdue. Please settle immediately.', 'codeclove-school-management' ),
        badgeClass: 'bg-danger-dim text-danger border-danger/30',
      }
    case 'cancelled':
      return {
        label: __( 'Cancelled', 'codeclove-school-management' ),
        variant: 'default' as const,
        icon: XCircle,
        desc: __( 'This invoice has been cancelled by school administration.', 'codeclove-school-management' ),
        badgeClass: 'bg-bg-base text-text-muted border-border',
      }
    case 'void':
      return {
        label: __( 'Void', 'codeclove-school-management' ),
        variant: 'default' as const,
        icon: XCircle,
        desc: __( 'This invoice has been voided by school administration.', 'codeclove-school-management' ),
        badgeClass: 'bg-bg-base text-text-muted border-border',
      }
    case 'pending':
    case 'issued':
    default:
      return {
        label: __( 'Pending Payment', 'codeclove-school-management' ),
        variant: 'brand' as const,
        icon: Clock,
        desc: __( 'Statement issued and awaiting settlement.', 'codeclove-school-management' ),
        badgeClass: 'bg-brand-dim text-brand border-brand/30',
      }
  }
}

/**
 * Normalizes payment method name and returns friendly icon.
 */
function getPaymentMethodInfo(method: string): { label: string; icon: React.FC<{ className?: string }> } {
  const norm = (method || '').toLowerCase()
  switch (norm) {
    case 'stripe':
    case 'card':
      return {
        label: __( 'Credit / Debit Card (Stripe)', 'codeclove-school-management' ),
        icon: CreditCard,
      }
    case 'paypal':
      return {
        label: __( 'PayPal', 'codeclove-school-management' ),
        icon: Wallet,
      }
    case 'bank_transfer':
    case 'bank':
      return {
        label: __( 'Bank Transfer / Wire', 'codeclove-school-management' ),
        icon: Building2,
      }
    case 'cash':
      return {
        label: __( 'Cash Desk', 'codeclove-school-management' ),
        icon: Receipt,
      }
    case 'cheque':
      return {
        label: __( 'Cheque / Draft', 'codeclove-school-management' ),
        icon: FileText,
      }
    default:
      return {
        label: norm.charAt(0).toUpperCase() + norm.slice(1).replace(/_/g, ' '),
        icon: CreditCard,
      }
  }
}

export const InvoiceStatementView: React.FC<InvoiceStatementViewProps> = ({
  invoice,
  currency: currencyProp,
  onBack,
  onBackToLedger,
  onViewReceipt,
  onPaymentSuccess,
  className,
}) => {
  const { currentStudent, siteName, logoUrl, school, localization, user } = usePortal()
  const { getLabel } = usePortalLabels()
  const printRef = useRef<HTMLDivElement>(null)
  const paymentDockRef = useRef<HTMLDivElement>(null)

  const currency = currencyProp || localization?.currency || 'USD'
  const isPro = typeof window === 'undefined' || window.CodeClovePortalConfig?.isPro !== false
  const { data: gatewaysConfig } = useGatewaysConfig({ enabled: isPro })
  const activeGateways = useMemo(() => {
    if (!isPro || !gatewaysConfig?.gateways) return []
    return Object.values(gatewaysConfig.gateways).filter((g) => g.enabled)
  }, [isPro, gatewaysConfig])

  const isOnlinePaymentAvailable = isPro && activeGateways.length > 0
  const isPayable =
    invoice.status !== 'paid' &&
    invoice.status !== 'cancelled' &&
    invoice.status !== 'void' &&
    invoice.balance > 0

  const isUS = localization?.currency === 'USD' && localization?.number_format === 'standard'
  const statusMeta = getInvoiceStatusMeta(invoice.status, isUS)
  const StatusIcon = statusMeta.icon
  // Student & Academic Labels
  const studentName =
    currentStudent?.full_name ||
    [currentStudent?.first_name, currentStudent?.last_name].filter(Boolean).join(' ') ||
    __( 'Enrolled Student', 'codeclove-school-management' )
  const studentNumber = currentStudent?.student_number || currentStudent?.admission_number || '—'
  const classUnitName =
    [currentStudent?.unit_name, currentStudent?.group_name].filter(Boolean).join(' • ') ||
    getLabel('academic_unit', false, __( 'Academic Program', 'codeclove-school-management' ))
  const invoiceWithGuardian = invoice as Invoice & { guardian_name?: string; guardian_email?: string }
  const guardianName = invoiceWithGuardian.guardian_name || user?.name || ''
  const guardianEmail = invoiceWithGuardian.guardian_email || user?.email || ''

  // Effective line items (falls back to single tuition entry if empty)
  const lineItems: InvoiceLineItem[] =
    invoice.line_items && invoice.line_items.length > 0
      ? invoice.line_items
      : [
          {
            description: __( 'Academic Tuition & School Term Fees', 'codeclove-school-management' ),
            quantity: 1,
            amount: invoice.total,
          },
        ]

  const payments = invoice.payments ?? []

  // Print handler
  const handlePrint = () => {
    if (printRef.current) {
      printElement(printRef.current)
    }
  }


  const handleBack = () => {
    if (onBackToLedger) {
      onBackToLedger()
    } else if (onBack) {
      onBack()
    }
  }

  // Printable data objects for the standard letterhead print template
  const schoolSettings: SchoolSettings | undefined = school
    ? {
        name: school.name || siteName,
        code: school.code,
        address: school.address,
        phone: school.phone,
        email: school.email,
        website: school.website,
        logo: school.logo || logoUrl,
      }
    : undefined

  const totalMinor = invoice.total_minor ?? Math.round(invoice.total * 100)

  const printableInvoice = {
    ...invoice,
    student_first_name: currentStudent?.first_name || '',
    student_last_name: currentStudent?.last_name || '',
    student_number: studentNumber !== '—' ? studentNumber : '',
    academic_unit_name: currentStudent?.unit_name || '',
    academic_group_name: currentStudent?.group_name || '',
    subtotal_minor: totalMinor,
    discount_minor: 0,
    total_minor: totalMinor,
    paid_minor: invoice.paid_minor ?? Math.round(invoice.paid * 100),
    balance_minor: invoice.balance_minor ?? Math.round(invoice.balance * 100),
    payments: (invoice.payments || []).map((p) => ({
      ...p,
      amount_minor: p.amount_minor ?? Math.round(p.amount * 100),
    })),
  } as unknown as FinanceInvoice

  return (
    <div className={cn('space-y-6', className)}>
      {/* ─── 1. TOP BREADCRUMB & ACTION BAR ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="h-8 px-2.5 text-xs font-medium text-text-muted hover:text-text hover:bg-bg-base rounded-lg gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{__( 'Fee Records', 'codeclove-school-management' )}</span>
          </Button>

          <span className="text-text-subtle text-xs" aria-hidden="true">
            /
          </span>
          <span className="text-xs text-text-muted font-medium">
            {__( 'Invoices', 'codeclove-school-management' )}
          </span>
          <span className="text-text-subtle text-xs" aria-hidden="true">
            /
          </span>
          <span className="text-xs font-bold text-text font-mono">
            {invoice.invoice_number}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePrint}
            className="h-8 px-3 text-xs font-semibold rounded-lg gap-1.5 border border-border/80 hover:border-border hover:bg-bg-base shadow-sm"
          >
            <Printer className="w-3.5 h-3.5 text-text-subtle" />
            <span>{__( 'Print Statement', 'codeclove-school-management' )}</span>
          </Button>
        </div>
      </div>

      {/* ─── 2. OFFICIAL STATEMENT LETTERHEAD CARD ─────────────────────────────── */}
      <Card className="rounded-xl">
        {/* Institutional Letterhead Top Banner */}
        <div className="p-6 border-b border-border bg-gradient-to-b from-bg-surface to-transparent">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
            {/* School Identity (Left) */}
            <div className="flex items-start gap-4 min-w-0">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={school?.name || siteName}
                  className="w-14 h-14 rounded-lg object-contain bg-white dark:bg-bg-elevated p-1 border border-border shadow-2xs shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
                  <GraduationCap className="w-7 h-7" />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-text tracking-tight leading-tight">
                  {school?.name || siteName}
                </h2>
                {school?.address && (
                  <p className="text-xs text-text-muted mt-1 leading-relaxed max-w-lg">
                    {school.address}
                  </p>
                )}
                {(school?.phone || school?.email) && (
                  <div className="flex items-center gap-2 text-2xs sm:text-xs text-text-subtle mt-1 flex-wrap">
                    {school?.phone && <span>{school.phone}</span>}
                    {school?.phone && school?.email && <span className="text-border" aria-hidden="true">•</span>}
                    {school?.email && <span>{school.email}</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Invoice Identification */}
            <div className="text-left sm:text-right shrink-0 flex flex-col justify-between sm:items-end">
              <div>
                <span className="text-3xs uppercase font-bold text-text-subtle tracking-wider block">
                  {__( 'Official Fee Statement & Tax Invoice', 'codeclove-school-management' )}
                </span>
                <span className="font-mono text-lg sm:text-xl font-bold text-text block mt-0.5 tracking-tight">
                  #{invoice.invoice_number}
                </span>
              </div>

              <div className="mt-2 flex items-center sm:justify-end gap-2 text-2xs text-text-muted flex-wrap">
                <span className="tabular-nums">
                  <span className="text-text-subtle font-medium">{__( 'Issued:', 'codeclove-school-management' )}</span>{' '}
                  <span className="font-semibold text-text">{formatDate(invoice.issue_date)}</span>
                </span>
                {invoice.due_date && (
                  <>
                    <span className="text-border" aria-hidden="true">•</span>
                    <span className={cn('tabular-nums', invoice.status === 'overdue' && 'text-danger font-semibold')}>
                      <span className={cn('font-medium', invoice.status === 'overdue' ? 'text-danger/80' : 'text-text-subtle')}>
                        {__( 'Due:', 'codeclove-school-management' )}
                      </span>{' '}
                      <span className={cn('font-semibold', invoice.status === 'overdue' ? 'text-danger' : 'text-text')}>
                        {formatDate(invoice.due_date)}
                      </span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Compact Student, Payer & Billing Status Bar */}
          <div className="mt-5 pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap text-text-muted">
              <span>{__( 'Student:', 'codeclove-school-management' )}</span>
              <span className="font-semibold text-text">{studentName}</span>
              <span className="text-text-subtle">•</span>
              <span className="font-mono text-text-muted">{studentNumber}</span>
              <span className="text-text-subtle">•</span>
              <span>{classUnitName}</span>
              {guardianName && (
                <>
                  <span className="text-text-subtle hidden sm:inline">|</span>
                  <span>{__( 'Payer:', 'codeclove-school-management' )}</span>
                  <span className="font-medium text-text">{guardianName}</span>
                  {guardianEmail && <span className="font-mono text-text-subtle">({guardianEmail})</span>}
                </>
              )}
            </div>

            <div className="flex items-center gap-2 sm:justify-end shrink-0">
              <span className="text-2xs font-bold uppercase tracking-wider text-text-muted">
                {__( 'Billing Status:', 'codeclove-school-management' )}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider border',
                  statusMeta.badgeClass
                )}
              >
                <StatusIcon className="w-3 h-3" />
                {statusMeta.label}
              </span>
            </div>
          </div>
        </div>

        {/* ─── 3. FINANCIAL SUMMARY 3-GRID (Clean, non-redundant) ─────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border bg-bg-surface">
          {/* Total Billed */}
          <div className="p-4 sm:p-5 space-y-0.5">
            <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
              {__( 'Total Billed', 'codeclove-school-management' )}
            </span>
            <p className="text-xl sm:text-2xl font-bold tracking-tight text-text tabular-nums">
              {formatCurrency(invoice.total, currency)}
            </p>
          </div>

          {/* Amount Paid */}
          <div className="p-4 sm:p-5 space-y-0.5">
            <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
              {__( 'Amount Cleared', 'codeclove-school-management' )}
            </span>
            <p className="text-xl sm:text-2xl font-bold tracking-tight text-success tabular-nums">
              {formatCurrency(invoice.paid, currency)}
            </p>
          </div>

          {/* Outstanding Balance */}
          <div className="p-4 sm:p-5 space-y-0.5">
            <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
              {__( 'Balance Outstanding', 'codeclove-school-management' )}
            </span>
            <p
              className={cn(
                'text-xl sm:text-2xl font-bold tracking-tight tabular-nums',
                invoice.balance > 0 ? (invoice.status === 'overdue' ? 'text-danger' : 'text-warning') : 'text-text'
              )}
            >
              {formatCurrency(invoice.balance, currency)}
            </p>
          </div>
        </div>
      </Card>

      {/* ─── 4. ITEMIZED FEE BREAKDOWN TABLE ─────────────────────────────────── */}
      <Card className="rounded-xl">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-text tracking-tight">
              {__( 'Itemized Fee Breakdown', 'codeclove-school-management' )}
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              {__( 'Detailed fee structure and tuition components for this billing cycle.', 'codeclove-school-management' )}
            </p>
          </div>
          <Badge variant="default" className="text-2xs font-semibold text-text-muted">
            {sprintf( __( '%d Item(s)', 'codeclove-school-management' ), lineItems.length )}
          </Badge>
        </div>

        {/* Responsive Table for Desktop & Tablet */}
        <div className="overflow-x-auto">
          <TableRoot responsiveMode="scroll" className="w-full">
            <Thead>
              <Tr className="border-b border-border bg-bg-surface text-left">
                <Th className="w-12 text-center text-2xs uppercase tracking-wider font-semibold text-text-muted py-3">
                  #
                </Th>
                <Th className="text-2xs uppercase tracking-wider font-semibold text-text-muted py-3">
                  {__( 'Fee Particulars & Description', 'codeclove-school-management' )}
                </Th>
                <Th className="w-24 text-center text-2xs uppercase tracking-wider font-semibold text-text-muted py-3">
                  {__( 'Qty', 'codeclove-school-management' )}
                </Th>
                <Th className="w-32 text-right text-2xs uppercase tracking-wider font-semibold text-text-muted py-3">
                  {__( 'Unit Rate', 'codeclove-school-management' )}
                </Th>
                <Th className="w-36 text-right text-2xs uppercase tracking-wider font-semibold text-text-muted py-3 pr-6">
                  {__( 'Amount', 'codeclove-school-management' )}
                </Th>
              </Tr>
            </Thead>
            <Tbody className="divide-y divide-border text-xs">
              {lineItems.map((item, idx) => {
                const qty = item.quantity ?? 1
                const unitRate = item.unit_amount_minor
                  ? item.unit_amount_minor / 100
                  : qty > 0
                  ? item.amount / qty
                  : item.amount

                return (
                  <Tr key={item.id ?? idx} className="hover:bg-hover-bg transition-colors">
                    <Td className="text-center font-mono text-2xs text-text-subtle py-3.5">
                      {idx + 1}
                    </Td>
                    <Td className="py-3.5 font-medium text-text">
                      <span>{item.description}</span>
                    </Td>
                    <Td className="text-center font-medium text-text-muted py-3.5">
                      {qty}
                    </Td>
                    <Td className="text-right font-medium text-text-muted tabular-nums py-3.5">
                      {formatCurrency(unitRate, currency)}
                    </Td>
                    <Td className="text-right font-bold text-text tabular-nums py-3.5 pr-6">
                      {formatCurrency(item.amount, currency)}
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </TableRoot>
        </div>

        {/* Table Summary Footer */}
        <div className="p-6 bg-bg-surface border-t border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="text-xs text-text-subtle">
            <p>{__( 'All fees are billed in accordance with the official school fee policy.', 'codeclove-school-management' )}</p>
          </div>

          <div className="w-full sm:w-72 space-y-2 text-xs">
            <div className="flex justify-between items-center text-text-muted">
              <span>{__( 'Subtotal Billed', 'codeclove-school-management' )}</span>
              <span className="font-semibold text-text tabular-nums">
                {formatCurrency(invoice.total, currency)}
              </span>
            </div>
            <div className="flex justify-between items-center text-text-muted">
              <span>{__( 'Less Payments Cleared', 'codeclove-school-management' )}</span>
              <span className="font-semibold text-success tabular-nums">
                -{formatCurrency(invoice.paid, currency)}
              </span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between items-baseline">
              <span className="font-bold text-text text-sm">{__( 'Balance Outstanding', 'codeclove-school-management' )}</span>
              <span
                className={cn(
                  'font-bold text-base sm:text-lg tabular-nums',
                  invoice.balance > 0 ? (invoice.status === 'overdue' ? 'text-danger' : 'text-warning') : 'text-text'
                )}
              >
                {formatCurrency(invoice.balance, currency)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* ─── 5. PAYMENT RECEIPTS & AUDIT HISTORY (Only shown if receipts exist) ─── */}
      {payments.length > 0 && (
        <Card className="rounded-xl">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-lg bg-brand-dim text-brand">
                <Receipt className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-text tracking-tight">
                  {__( 'Payment Receipts & Settlement History', 'codeclove-school-management' )}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {__( 'Verifiable official payment vouchers linked to this invoice.', 'codeclove-school-management' )}
                </p>
              </div>
            </div>
            <Badge variant="default" size="sm" className="font-medium text-text-subtle">
              {payments.length === 1
                ? __( '1 Receipt', 'codeclove-school-management' )
                : sprintf( __( '%d Receipts', 'codeclove-school-management' ), payments.length )}
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <TableRoot responsiveMode="scroll" className="w-full">
              <Thead>
                <Tr className="border-b border-border bg-bg-surface text-left">
                  <Th className="text-2xs uppercase tracking-wider font-semibold text-text-muted py-3 whitespace-nowrap">
                    {__( 'Receipt #', 'codeclove-school-management' )}
                  </Th>
                  <Th className="text-2xs uppercase tracking-wider font-semibold text-text-muted py-3 whitespace-nowrap">
                    {__( 'Settlement Date', 'codeclove-school-management' )}
                  </Th>
                  <Th className="text-2xs uppercase tracking-wider font-semibold text-text-muted py-3">
                    {__( 'Payment Method', 'codeclove-school-management' )}
                  </Th>
                  <Th className="text-2xs uppercase tracking-wider font-semibold text-text-muted py-3 text-center">
                    {__( 'Status', 'codeclove-school-management' )}
                  </Th>
                  <Th className="text-2xs uppercase tracking-wider font-semibold text-text-muted py-3 text-right">
                    {__( 'Amount Paid', 'codeclove-school-management' )}
                  </Th>
                  <Th className="w-28 text-right text-2xs uppercase tracking-wider font-semibold text-text-muted py-3 pr-6 whitespace-nowrap">
                    {__( 'Action', 'codeclove-school-management' )}
                  </Th>
                </Tr>
              </Thead>
              <Tbody className="divide-y divide-border/60 text-xs">
                {payments.map((pmt, idx) => {
                  const methodInfo = getPaymentMethodInfo(pmt.method)
                  const MethodIconComponent = methodInfo.icon
                  const receiptNumber = pmt.payment_number || `PAY-${pmt.id ?? idx + 1}`

                  return (
                    <Tr key={pmt.id ?? idx} className="hover:bg-bg-base/30 transition-colors">
                      <Td className="py-3.5 font-mono font-semibold text-text whitespace-nowrap">
                        {receiptNumber}
                      </Td>
                      <Td className="py-3.5 text-text-muted whitespace-nowrap">
                        {formatDate(pmt.paid_on)}
                      </Td>
                      <Td className="py-3.5">
                        <div className="inline-flex items-center gap-1.5 font-medium text-text whitespace-nowrap">
                          <MethodIconComponent className="w-3.5 h-3.5 text-text-subtle shrink-0" />
                          <span>{methodInfo.label}</span>
                        </div>
                      </Td>
                      <Td className="py-3.5 text-center">
                        <Badge variant="paid" size="sm">
                          {__( 'Completed', 'codeclove-school-management' )}
                        </Badge>
                      </Td>
                      <Td className="py-3.5 text-right font-mono font-bold text-success tabular-nums whitespace-nowrap">
                        +{formatCurrency(pmt.amount, currency)}
                      </Td>
                      <Td className="py-3.5 text-right pr-6 whitespace-nowrap">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            if (onViewReceipt) {
                              onViewReceipt({
                                ...pmt,
                                 invoice,
                                 invoice_number: invoice.invoice_number,
                               })
                             }
                           }}
                          className="h-8 px-3 text-xs font-medium gap-1.5 border-border/80 text-text hover:bg-bg-base/70 shadow-2xs"
                        >
                          <Receipt className="w-3.5 h-3.5 text-brand" />
                          <span>{__( 'View Slip', 'codeclove-school-management' )}</span>
                        </Button>
                      </Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </TableRoot>
          </div>
        </Card>
      )}

      {/* ─── 6. INTERACTIVE PAYMENT DOCK ─────────────────────────────────────── */}
      {isOnlinePaymentAvailable && isPayable && (
        <div id="payment-dock" ref={paymentDockRef} tabIndex={-1} className="outline-hidden scroll-mt-6">
          <Card className="rounded-xl border border-border/80 shadow-card bg-bg-surface">
            <div className="p-5 border-b border-border/70 bg-gradient-to-r from-brand/5 via-transparent to-transparent">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-lg bg-brand text-white shadow-xs">
                  <CreditCard className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-text tracking-tight">
                    {__( 'Pay Invoice Online', 'codeclove-school-management' )}
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    {__( 'Select your preferred payment method and checkout securely.', 'codeclove-school-management' )}
                  </p>
                </div>
              </div>
            </div>

            <CardContent className="p-6">
              <PortalPaymentMethodSelector
                invoice={{
                  id: invoice.id,
                  invoice_number: invoice.invoice_number,
                  currency,
                  balance: invoice.balance,
                  balance_minor: invoice.balance_minor ?? Math.round(invoice.balance * 100),
                  total: invoice.total,
                  total_minor: invoice.total_minor ?? Math.round(invoice.total * 100),
                  paid: invoice.paid,
                  paid_minor: invoice.paid_minor ?? Math.round(invoice.paid * 100),
                  student_name: studentName,
                  guardian_email: guardianEmail,
                }}
                showInvoiceSummary={false}
                onSuccess={onPaymentSuccess}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── 7. HIDDEN PRINT CONTAINER (STANDALONE OFFICIAL STATEMENT) ────────── */}
      <div className="hidden" aria-hidden="true">
        <div ref={printRef}>
          <PrintInvoiceSheet invoice={printableInvoice} school={schoolSettings} />
        </div>
      </div>
    </div>
  )
}
