/**
 * finance-utils.ts — Shared display helpers for the finance module.
 * ponytail: extracted from InvoicesPage, InvoiceDetailPage, FinanceDashboard, PaymentsPage
 */

const STATUS_VARIANTS: Record<string, string> = {
  draft: 'draft', issued: 'issued', partially_paid: 'partially_paid',
  paid: 'paid', overdue: 'overdue', cancelled: 'cancelled', void: 'void',
}
export const getStatusVariant = (s: string): any => STATUS_VARIANTS[s] || 'default'

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', bank_transfer: 'Bank Transfer', cheque: 'Cheque',
  upi: 'UPI / QR', card: 'Card', other: 'Other',
}
export const getMethodLabel = (m: string): string => METHOD_LABELS[m] || m
