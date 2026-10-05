/**
 * finance-utils.ts — Shared display helpers for the finance module.
 */
import type { BadgeProps } from '@/components/ui'

export const getStatusVariant = (s: string): BadgeProps['variant'] =>
  (s || 'default') as BadgeProps['variant']

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', bank_transfer: 'Bank Transfer', cheque: 'Cheque',
  upi: 'UPI / QR', card: 'Card', other: 'Other',
}
export const getMethodLabel = (m: string): string => METHOD_LABELS[m] || m
