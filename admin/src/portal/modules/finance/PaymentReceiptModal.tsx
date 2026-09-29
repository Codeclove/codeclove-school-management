/**
 * Payment Receipt Modal Component.
 *
 * Displays an official, verified school fee payment receipt slip with
 * transaction details, student enrollment metadata, payment method,
 * invoice reference, and a clean print action using shared UI primitives.
 */

import React, { useRef } from 'react'
import {
  CheckCircle2,
  Hash,
  Printer,
  Receipt,
  School,
  User,
} from 'lucide-react'
import type { Invoice, InvoicePayment } from '../../types'
import type { Invoice as FinanceInvoice, Payment as FinancePayment } from '@/api/finance'
import { formatCurrency, formatDate } from '../../lib/formatter'
import { usePortal } from '../../lib/portal-context'
import { usePortalLabels } from '../../lib/labels'
import { Badge, Button, Modal, ModalFooter } from '@/components/ui'
import { PrintPaymentReceipt, printElement } from '@/components/print'
import { __, sprintf } from '@/lib/i18n'

export interface PaymentReceiptModalProps {
  payment: (InvoicePayment & { invoice_number?: string; invoice?: Invoice }) | null
  invoice?: Invoice | null
  currency?: string
  onClose: () => void
}

const getMethodLabel = (method: string): string => {
  const normalized = method.toLowerCase()
  switch (normalized) {
    case 'cash':
      return __( 'Cash Payment', 'codeclove-school-management' )
    case 'bank_transfer':
      return __( 'Bank Transfer', 'codeclove-school-management' )
    case 'cheque':
      return __( 'Cheque Deposit', 'codeclove-school-management' )
    case 'upi':
      return __( 'UPI / Digital Transfer', 'codeclove-school-management' )
    case 'card':
      return __( 'Credit / Debit Card', 'codeclove-school-management' )
    case 'online':
      return __( 'Online Gateway', 'codeclove-school-management' )
    case 'other':
      return __( 'Manual Settlement', 'codeclove-school-management' )
    default:
      return method.replace('_', ' ')
  }
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  payment,
  invoice: parentInvoice,
  currency = 'USD',
  onClose,
}) => {
  const { currentStudent, siteName, logoUrl, school } = usePortal()
  const { getLabel } = usePortalLabels()
  const printRef = useRef<HTMLDivElement>(null)

  if (!payment) return null

  const targetInvoice = parentInvoice || payment.invoice
  const receiptNum = payment.payment_number
  const paidDate = payment.paid_on
  const methodLabel = getMethodLabel(payment.method)
  const invoiceNum = payment.invoice_number || targetInvoice?.invoice_number || 'INV'

  const className =
    [currentStudent?.unit_name, currentStudent?.group_name].filter(Boolean).join(' • ') ||
    __( 'Enrolled Student', 'codeclove-school-management' )
  const studentId = currentStudent?.student_number || currentStudent?.admission_number || '—'

  const handlePrint = () => {
    if (printRef.current) {
      printElement(printRef.current)
    }
  }

  const printablePayment = {
    ...payment,
    student_name: currentStudent?.full_name || '',
    student_number: currentStudent?.student_number || '',
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
    <Modal
      open={Boolean(payment)}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      container={typeof document !== 'undefined' ? document.getElementById('codeclove-portal-root') : undefined}
      title={
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-brand" />
          <span>{__( 'Payment Receipt', 'codeclove-school-management' )}</span>
          <Badge variant="paid" size="sm">
            {__( 'Cleared', 'codeclove-school-management' )}
          </Badge>
        </div>
      }
      description={sprintf( __( 'Official Transaction Slip • Receipt #%s', 'codeclove-school-management' ), receiptNum )}
      size="md"
    >
      <div className="space-y-5 pt-1">
        {/* ─── 1. Official Receipt Header / Letterhead ─────────────────────────── */}
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-bg-base/80 border border-border/70">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={siteName} className="h-9 w-auto object-contain" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white shadow-xs">
                <School className="w-5 h-5" />
              </div>
            )}
            <div>
              <h4 className="text-sm font-bold text-text leading-tight">{siteName}</h4>
              <p className="text-3xs text-text-muted mt-0.5">{__( 'Official Fee Collection Slip', 'codeclove-school-management' )}</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-3xs uppercase font-bold text-text-subtle tracking-wider block">
              {__( 'Receipt No.', 'codeclove-school-management' )}
            </span>
            <span className="font-mono text-xs font-bold text-brand block mt-0.5">
              #{receiptNum}
            </span>
          </div>
        </div>

        {/* ─── 2. Student Details Grid ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl border border-border/70 bg-bg-surface text-xs">
          <div>
            <span className="text-3xs uppercase font-bold text-text-subtle tracking-wider block">
              {__( 'Student Name', 'codeclove-school-management' )}
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <User className="w-3.5 h-3.5 text-text-subtle shrink-0" />
              <span className="font-semibold text-text">{currentStudent?.full_name || __( 'Student', 'codeclove-school-management' )}</span>
            </div>
          </div>

          <div>
            <span className="text-3xs uppercase font-bold text-text-subtle tracking-wider block">
              {__( 'Student / Adm ID', 'codeclove-school-management' )}
            </span>
            <div className="flex items-center gap-1.5 mt-1 font-mono">
              <Hash className="w-3.5 h-3.5 text-text-subtle shrink-0" />
              <span className="font-semibold text-text">{studentId}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-border/50">
            <span className="text-3xs uppercase font-bold text-text-subtle tracking-wider block">
              {getLabel('academic_unit', false, __( 'Class', 'codeclove-school-management' ))}
            </span>
            <span className="font-medium text-text mt-1 block">{className}</span>
          </div>

          <div className="pt-2 border-t border-border/50">
            <span className="text-3xs uppercase font-bold text-text-subtle tracking-wider block">
              {__( 'Date Settled', 'codeclove-school-management' )}
            </span>
            <span className="font-semibold text-text mt-1 block">
              {paidDate ? formatDate(paidDate) : __( 'Settled', 'codeclove-school-management' )}
            </span>
          </div>
        </div>

        {/* ─── 3. Payment Amount Highlight ─────────────────────────────────────── */}
        <div className="rounded-xl border border-success/30 bg-success-dim/40 p-4 flex items-center justify-between">
          <div>
            <span className="text-3xs uppercase font-bold text-success tracking-wider block">
              {__( 'Amount Received', 'codeclove-school-management' )}
            </span>
            <span className="text-2xl sm:text-3xl font-black text-success tabular-nums mt-0.5 block">
              {formatCurrency(payment.amount, currency)}
            </span>
          </div>

          <div className="text-right">
            <Badge variant="paid" size="default" className="gap-1 px-3 py-1 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{__( 'Full Payment Cleared', 'codeclove-school-management' )}</span>
            </Badge>
            <span className="text-3xs text-text-subtle block mt-1.5 font-medium">
              {sprintf( __( 'Mode: %s', 'codeclove-school-management' ), methodLabel )}
            </span>
          </div>
        </div>

        {/* ─── 4. Associated Invoice Summary ──────────────────────────────────── */}
        {targetInvoice && (
          <div className="rounded-xl border border-border/70 p-3.5 space-y-2 bg-bg-surface text-xs">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-3xs uppercase font-bold text-text-subtle tracking-wider">
                {__( 'Applied To Invoice', 'codeclove-school-management' )}
              </span>
              <span className="font-mono font-bold text-brand">
                #{invoiceNum}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div>
                <span className="text-3xs text-text-subtle block">{__( 'Invoice Total', 'codeclove-school-management' )}</span>
                <span className="font-semibold text-text tabular-nums text-xs mt-0.5 block">
                  {formatCurrency(targetInvoice.total, currency)}
                </span>
              </div>
              <div>
                <span className="text-3xs text-text-subtle block">{__( 'Total Paid', 'codeclove-school-management' )}</span>
                <span className="font-semibold text-success tabular-nums text-xs mt-0.5 block">
                  {formatCurrency(targetInvoice.paid, currency)}
                </span>
              </div>
              <div>
                <span className="text-3xs text-text-subtle block">{__( 'Balance Due', 'codeclove-school-management' )}</span>
                <span className="font-bold text-text tabular-nums text-xs mt-0.5 block">
                  {formatCurrency(targetInvoice.balance, currency)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ─── 5. Computer-generated footer notice ────────────────────────────── */}
        <p className="text-3xs text-center text-text-subtle leading-relaxed">
          {sprintf(
            __( 'This is an official system-generated payment receipt issued by %s. Please retain this document for tax, bursary, and personal accounting records.', 'codeclove-school-management' ),
            siteName
          )}
        </p>
      </div>

      <ModalFooter>
        <Button
          variant="secondary"
          size="sm"
          onClick={handlePrint}
          className="h-8 text-xs font-semibold gap-1.5"
        >
          <Printer className="w-3.5 h-3.5 text-text-subtle" />
          <span>{__( 'Print Receipt', 'codeclove-school-management' )}</span>
        </Button>
        <Button variant="default" size="sm" onClick={onClose} className="h-8 text-xs">
          {__( 'Close', 'codeclove-school-management' )}
        </Button>
      </ModalFooter>

      {/* Hidden container for printElement execution */}
      <div className="hidden">
        <div ref={printRef}>
          <PrintPaymentReceipt
            payment={printablePayment}
            invoice={printableInvoice}
            school={school}
          />
        </div>
      </div>
    </Modal>
  )
}
