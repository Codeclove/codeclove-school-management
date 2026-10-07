/**
 * Receipt Slip View Component.
 *
 * Dedicated in-page official school fee payment receipt slip with 1-click print,
 * student & academic enrollment metadata, transaction verification seal,
 * associated invoice context, and responsive breadcrumb navigation.
 *
 * Designed to eliminate cramped modal-on-modal anti-patterns in the Student Portal.
 */

import React, { useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  Copy,
  CreditCard,
  FileText,
  Hash,
  HelpCircle,
  Printer,
  Receipt,
  School,
  User,
} from 'lucide-react'
import type { Invoice, InvoicePayment } from '../../types'
import type { Invoice as FinanceInvoice, Payment as FinancePayment } from '@/api/finance'
import { type SchoolSettings } from '@/components/ui/PrintLetterhead'
import { formatCurrency, formatDate } from '../../lib/formatter'
import { usePortal } from '../../lib/portal-context'
import { usePortalLabels } from '../../lib/labels'
import { Badge, Button, Card } from '@/components/ui'
import { PrintPaymentReceipt, printElement } from '@/components/print'
import { cn } from '@/lib/utils'
import { __, sprintf } from '@/lib/i18n'

export interface ReceiptSlipViewProps {
  payment: InvoicePayment & {
    invoice_number?: string
    invoice?: Invoice
    notes?: string
    transaction_id?: string
  }
  invoice?: Invoice | null
  currency?: string
  onBack?: () => void
  onBackToInvoice?: () => void
  onBackToLedger?: () => void
  onViewInvoice?: (invoice: Invoice) => void
  className?: string
}

const getMethodConfig = (method: string): { label: string; icon: React.FC<{ className?: string }> } => {
  const normalized = method.toLowerCase()
  switch (normalized) {
    case 'stripe':
      return {
        label: __( 'Stripe (Card / Online)', 'codeclove-school-management' ),
        icon: CreditCard,
      }
    case 'paypal':
      return {
        label: __( 'PayPal', 'codeclove-school-management' ),
        icon: CreditCard,
      }
    case 'card':
      return {
        label: __( 'Credit / Debit Card', 'codeclove-school-management' ),
        icon: CreditCard,
      }
    case 'bank_transfer':
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
    case 'upi':
      return {
        label: __( 'UPI / Instant QR', 'codeclove-school-management' ),
        icon: CreditCard,
      }
    default:
      return {
        label: method.charAt(0).toUpperCase() + method.slice(1).replace(/_/g, ' '),
        icon: HelpCircle,
      }
  }
}

export const ReceiptSlipView: React.FC<ReceiptSlipViewProps> = ({
  payment,
  invoice: parentInvoice,
  currency: currencyProp,
  onBack,
  onBackToInvoice,
  onBackToLedger,
  onViewInvoice,
  className,
}) => {
  const { currentStudent, siteName, logoUrl, school, localization } = usePortal()
  const { getLabel } = usePortalLabels()
  const printRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  const currency = currencyProp || localization?.currency || 'USD'
  const targetInvoice = parentInvoice || payment.invoice
  const receiptNum = payment.payment_number || `PAY-${payment.id ?? 'REC'}`
  const paidDate = payment.paid_on
  const methodConfig = getMethodConfig(payment.method)
  const MethodIcon = methodConfig.icon
  const invoiceNum = payment.invoice_number || targetInvoice?.invoice_number || 'INV'

  const studentName = currentStudent?.full_name || __( 'Enrolled Student', 'codeclove-school-management' )
  const studentId = currentStudent?.student_number || currentStudent?.admission_number || '—'
  const classLabel = getLabel('academic_unit', false, __( 'Class', 'codeclove-school-management' ))
  const classNameStr =
    [currentStudent?.unit_name, currentStudent?.group_name].filter(Boolean).join(' • ') ||
    __( 'Enrolled Student', 'codeclove-school-management' )
  const sessionName = currentStudent?.session_name || currentStudent?.enrollment?.session_name

  const handlePrint = () => {
    if (printRef.current) {
      printElement(printRef.current)
    }
  }

  const handleCopyReceipt = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(receiptNum)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleBack = () => {
    if (onBackToInvoice && targetInvoice) {
      onBackToInvoice()
    } else if (onBackToLedger) {
      onBackToLedger()
    } else if (onBack) {
      onBack()
    }
  }

  const handleViewInvoice = () => {
    if (targetInvoice && onViewInvoice) {
      onViewInvoice(targetInvoice)
    } else if (onBackToInvoice) {
      onBackToInvoice()
    }
  }

  // Printable data objects for the standard letterhead print template
  const printablePayment = {
    ...payment,
    student_name: studentName,
    student_number: studentId !== '—' ? studentId : '',
    invoice_number: invoiceNum,
    amount_minor: payment.amount_minor ?? Math.round(payment.amount * 100),
  } as unknown as FinancePayment

  const printableInvoice = {
    ...targetInvoice,
    invoice_number: invoiceNum,
    student_first_name: currentStudent?.first_name || '',
    student_last_name: currentStudent?.last_name || '',
    student_number: currentStudent?.student_number || '',
    academic_unit_name: currentStudent?.unit_name || '',
    academic_group_name: currentStudent?.group_name || '',
    total_minor: targetInvoice?.total_minor ?? Math.round((targetInvoice?.total ?? 0) * 100),
    paid_minor: targetInvoice?.paid_minor ?? Math.round((targetInvoice?.paid ?? 0) * 100),
    balance_minor: targetInvoice?.balance_minor ?? Math.round((targetInvoice?.balance ?? 0) * 100),
  } as unknown as FinanceInvoice

  return (
    <div className={cn('space-y-6 max-w-4xl mx-auto pb-12', className)}>
      {/* ─── 1. Breadcrumb & Navigation Bar ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="h-8 px-2 text-xs font-semibold text-text hover:text-brand gap-1.5 -ml-2"
            title={__( 'Go back', 'codeclove-school-management' )}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>
              {targetInvoice && onBackToInvoice
                ? sprintf( __( 'Back to Invoice #%s', 'codeclove-school-management' ), invoiceNum )
                : __( 'Back to Fee Records', 'codeclove-school-management' )}
            </span>
          </Button>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyReceipt}
            className="h-8 px-2.5 text-xs font-medium text-text hover:text-brand gap-1.5 border-border/80 shadow-2xs"
            title={__( 'Copy Receipt ID', 'codeclove-school-management' )}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-success" />
                <span className="text-success font-semibold">{__( 'Copied!', 'codeclove-school-management' )}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-text-subtle" />
                <span className="hidden sm:inline">{__( 'Copy Receipt ID', 'codeclove-school-management' )}</span>
                <span className="sm:hidden">{__( 'Copy #', 'codeclove-school-management' )}</span>
              </>
            )}
          </Button>

          {targetInvoice && (onViewInvoice || onBackToInvoice) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleViewInvoice}
              className="h-8 px-2.5 text-xs font-medium gap-1.5 border-border/80 text-text hover:bg-bg-base/70 shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-brand" />
              <span className="hidden sm:inline">{__( 'View Invoice', 'codeclove-school-management' )}</span>
              <span className="sm:hidden">{__( 'Invoice', 'codeclove-school-management' )}</span>
            </Button>
          )}

          {/* 1-Click Print Receipt */}
          <Button
            variant="default"
            size="sm"
            onClick={handlePrint}
            className="h-8 px-3 text-xs font-semibold gap-1.5 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{__( 'Print Receipt', 'codeclove-school-management' )}</span>
          </Button>
        </div>
      </div>

      {/* ─── 2. Official Receipt Presentation Card ────────────────────────── */}
      <Card className="rounded-2xl border border-border/80 bg-bg-surface shadow-card overflow-hidden">
        <div className="p-6 sm:p-8 space-y-7">
          {/* Header & Letterhead Section */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-border/70">
            <div className="flex items-start gap-4">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={siteName}
                  className="h-14 w-auto max-w-[140px] object-contain shrink-0 rounded-lg p-1 bg-white border border-border/50"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-xs">
                  <School className="w-7 h-7" />
                </div>
              )}
              <div>
                <span className="text-3xs uppercase tracking-widest font-extrabold text-brand block mb-1">
                  {__( 'Official Fee Collection Slip', 'codeclove-school-management' )}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black text-text tracking-tight leading-tight">
                    {school?.name || siteName}
                  </h2>
                  {school?.code && (
                    <span className="text-2xs font-mono font-semibold px-2 py-0.5 rounded bg-bg-subtle text-text-muted border border-border">
                      {school.code}
                    </span>
                  )}
                </div>
                {(school?.address || school?.email || school?.phone) && (
                  <p className="text-xs text-text-subtle mt-1.5 leading-relaxed max-w-md">
                    {[school?.address, school?.phone, school?.email].filter(Boolean).join(' • ')}
                  </p>
                )}
              </div>
            </div>

            {/* Receipt Identification Stamp */}
            <div className="border border-border/80 bg-bg-base/40 rounded-xl p-3.5 sm:text-right shrink-0 min-w-[200px] flex flex-col justify-between">
              <div>
                <span className="text-3xs uppercase font-bold text-text-subtle tracking-wider block">
                  {__( 'Receipt Number', 'codeclove-school-management' )}
                </span>
                <span className="font-mono text-base font-bold text-text block mt-0.5 tracking-tight">
                  #{receiptNum}
                </span>
              </div>

              <div className="mt-2.5 pt-2 border-t border-border/60 text-xs">
                <span className="text-3xs uppercase font-semibold text-text-subtle tracking-wider block">
                  {__( 'Settlement Date', 'codeclove-school-management' )}
                </span>
                <div className="flex items-center gap-1 sm:justify-end font-medium text-text mt-0.5">
                  <Calendar className="w-3 h-3 text-text-subtle" />
                  <span>{paidDate ? formatDate(paidDate) : __( 'Cleared', 'codeclove-school-management' )}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── 3. Student & Enrollment Information ───────────────────────── */}
          <div>
            <h3 className="text-xs font-bold text-text-subtle uppercase tracking-wider mb-3">
              {__( 'Student & Enrollment Metadata', 'codeclove-school-management' )}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl border border-border/70 bg-bg-base/40 text-xs">
              <div>
                <span className="text-3xs uppercase font-bold text-text-subtle tracking-wider block">
                  {__( 'Student Name', 'codeclove-school-management' )}
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <User className="w-3.5 h-3.5 text-text-subtle shrink-0" />
                  <span className="font-bold text-text text-sm">{studentName}</span>
                </div>
              </div>

              <div>
                <span className="text-3xs uppercase font-bold text-text-subtle tracking-wider block">
                  {__( 'Student / Admission ID', 'codeclove-school-management' )}
                </span>
                <div className="flex items-center gap-1.5 mt-1 font-mono">
                  <Hash className="w-3.5 h-3.5 text-text-subtle shrink-0" />
                  <span className="font-bold text-text text-sm">{studentId}</span>
                </div>
              </div>

              <div>
                <span className="text-3xs uppercase font-bold text-text-subtle tracking-wider block">
                  {classLabel}
                </span>
                <span className="font-semibold text-text mt-1 block">
                  {classNameStr}
                </span>
              </div>

              <div>
                <span className="text-3xs uppercase font-bold text-text-subtle tracking-wider block">
                  {__( 'Academic Session / Term', 'codeclove-school-management' )}
                </span>
                <span className="font-semibold text-text mt-1 block">
                  {sessionName || __( 'Current Session', 'codeclove-school-management' )}
                </span>
              </div>
            </div>
          </div>

          {/* ─── 4. Payment Amount Hero Section ────────────────────────────── */}
          <div className="rounded-xl border border-border/80 bg-bg-base/30 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="space-y-1">
              <span className="text-3xs uppercase font-bold text-text-subtle tracking-wider block">
                {__( 'Total Amount Received & Cleared', 'codeclove-school-management' )}
              </span>
              <div className="text-3xl sm:text-4xl font-mono font-bold text-text tabular-nums tracking-tight">
                {formatCurrency(payment.amount, currency)}
              </div>
              <p className="text-xs text-text-muted pt-0.5">
                {sprintf(
                  __( 'Verified payment credited towards %s account on %s', 'codeclove-school-management' ),
                  studentName,
                  paidDate ? formatDate(paidDate) : __( 'record date', 'codeclove-school-management' )
                )}
              </p>
            </div>

            <div className="flex flex-col sm:items-end gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-subtle font-medium">
                  {__( 'Payment Method:', 'codeclove-school-management' )}
                </span>
                <Badge variant="default" size="default" className="gap-1.5 px-2.5 py-1 font-medium bg-bg-surface border-border text-text">
                  <MethodIcon className="w-3.5 h-3.5 text-text-subtle" />
                  <span>{methodConfig.label}</span>
                </Badge>
              </div>

              {payment.transaction_id && (
                <div className="text-3xs text-text-subtle font-mono">
                  {__( 'Transaction ID:', 'codeclove-school-management' )}{' '}
                  <span className="font-semibold text-text">{payment.transaction_id}</span>
                </div>
              )}
            </div>
          </div>

          {/* ─── 5. Associated Invoice Context & Balance Breakdown ────────── */}
          {targetInvoice && (
            <div className="rounded-xl border border-border/80 overflow-hidden bg-bg-surface">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-bg-base/50 border-b border-border/70">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand" />
                  <span className="text-xs font-bold uppercase tracking-wider text-text-subtle">
                    {__( 'Applied to Invoice Statement', 'codeclove-school-management' )}
                  </span>
                  <span className="font-mono text-sm font-bold text-brand">
                    #{invoiceNum}
                  </span>
                </div>

                {onViewInvoice && (
                  <button
                    type="button"
                    onClick={handleViewInvoice}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                  >
                    <span>{__( 'View Full Invoice Statement', 'codeclove-school-management' )}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/60 p-4 text-center">
                <div className="p-3">
                  <span className="text-3xs uppercase font-bold text-text-subtle tracking-wider block">
                    {__( 'Invoice Total Billed', 'codeclove-school-management' )}
                  </span>
                  <span className="text-base font-bold text-text tabular-nums mt-1 block">
                    {formatCurrency(targetInvoice.total, currency)}
                  </span>
                </div>

                <div className="p-3">
                  <span className="text-3xs uppercase font-bold text-text-subtle tracking-wider block">
                    {__( 'Total Paid to Date', 'codeclove-school-management' )}
                  </span>
                  <span className="text-base font-bold text-success tabular-nums mt-1 block">
                    {formatCurrency(targetInvoice.paid, currency)}
                  </span>
                </div>

                <div className="p-3">
                  <span className="text-3xs uppercase font-bold text-text-subtle tracking-wider block">
                    {__( 'Remaining Balance Due', 'codeclove-school-management' )}
                  </span>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <span className="text-base font-black text-text tabular-nums">
                      {formatCurrency(targetInvoice.balance, currency)}
                    </span>
                    {targetInvoice.balance <= 0 ? (
                      <Badge variant="paid" size="sm">
                        {__( 'Fully Settled', 'codeclove-school-management' )}
                      </Badge>
                    ) : (
                      <Badge variant="partially_paid" size="sm">
                        {__( 'Balance Due', 'codeclove-school-management' )}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Optional Itemized Fee Categories Covered */}
              {targetInvoice.line_items && targetInvoice.line_items.length > 0 && (
                <div className="border-t border-border/60 p-4 bg-bg-base/30 text-xs">
                  <span className="text-3xs font-bold text-text-subtle uppercase tracking-wider block mb-2">
                    {__( 'Fee Categories Covered in this Billing Cycle', 'codeclove-school-management' )}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {targetInvoice.line_items.map((item, idx) => (
                      <span
                        key={item.id ?? idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-bg-surface border border-border/60 text-xs text-text-muted"
                      >
                        <span className="font-medium text-text">{item.description}</span>
                        <span className="text-text-subtle">({formatCurrency(item.amount, currency)})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* ─── 7. Slip Action Dock (Footer) ──────────────────────────────── */}
        <div className="bg-bg-base/40 border-t border-border/70 p-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-subtle">
          <div className="text-center sm:text-left">
            {sprintf( __( 'Receipt #%s • Issued for %s', 'codeclove-school-management' ), receiptNum, studentName )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleBack}
              className="h-8 px-3 text-xs font-medium border-border/80 text-text"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              <span>
                {targetInvoice && onBackToInvoice
                  ? __( 'Back to Invoice', 'codeclove-school-management' )
                  : __( 'Back to Records', 'codeclove-school-management' )}
              </span>
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handlePrint}
              className="h-8 px-3.5 text-xs font-semibold gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{__( 'Print Official Receipt', 'codeclove-school-management' )}</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* ─── 8. Hidden Printable Container for 1-Click Print ─────────────── */}
      <div className="hidden">
        <div ref={printRef}>
          <PrintPaymentReceipt
            payment={printablePayment}
            invoice={printableInvoice}
            school={school as unknown as SchoolSettings}
          />
        </div>
      </div>
    </div>
  )
}

export default ReceiptSlipView
