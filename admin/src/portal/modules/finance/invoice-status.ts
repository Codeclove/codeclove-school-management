import type React from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react'
import { __ } from '@/lib/i18n'

export interface InvoiceStatusMeta {
  label: string
  variant: 'success' | 'warning' | 'danger' | 'default' | 'brand'
  icon: React.FC<{ className?: string }>
  desc: string
  badgeClass: string
}

/**
 * Returns human-readable label and styling badge for invoice status.
 */
export function getInvoiceStatusMeta(status: string, isUS = false): InvoiceStatusMeta {
  const norm = status.toLowerCase()
  switch (norm) {
    case 'paid':
      return {
        label: __( 'Paid in Full', 'codeclove-school-management' ),
        variant: 'success',
        icon: CheckCircle2,
        desc: __( 'This statement has been paid in full. No balance remaining.', 'codeclove-school-management' ),
        badgeClass: 'bg-success-dim text-success border-success/30',
      }
    case 'partially_paid':
      return {
        label: __( 'Partially Paid', 'codeclove-school-management' ),
        variant: 'warning',
        icon: Clock,
        desc: __( 'A partial payment has been applied. Remaining balance is due.', 'codeclove-school-management' ),
        badgeClass: 'bg-warning-dim text-warning border-warning/30',
      }
    case 'overdue':
      return {
        label: isUS
          ? __( 'Past Due', 'codeclove-school-management' )
          : __( 'Overdue', 'codeclove-school-management' ),
        variant: 'danger',
        icon: AlertTriangle,
        desc: isUS
          ? __( 'Payment for this fee statement is past due. Please settle immediately.', 'codeclove-school-management' )
          : __( 'Payment for this fee statement is overdue. Please settle immediately.', 'codeclove-school-management' ),
        badgeClass: 'bg-danger-dim text-danger border-danger/30',
      }
    case 'cancelled':
      return {
        label: __( 'Cancelled', 'codeclove-school-management' ),
        variant: 'default',
        icon: XCircle,
        desc: __( 'This invoice has been cancelled by school administration.', 'codeclove-school-management' ),
        badgeClass: 'bg-bg-base text-text-muted border-border',
      }
    case 'void':
      return {
        label: __( 'Void', 'codeclove-school-management' ),
        variant: 'default',
        icon: XCircle,
        desc: __( 'This invoice has been voided by school administration.', 'codeclove-school-management' ),
        badgeClass: 'bg-bg-base text-text-muted border-border',
      }
    case 'pending':
    case 'issued':
    default:
      return {
        label: __( 'Pending Payment', 'codeclove-school-management' ),
        variant: 'brand',
        icon: Clock,
        desc: __( 'Statement issued and awaiting settlement.', 'codeclove-school-management' ),
        badgeClass: 'bg-brand-dim text-brand border-brand/30',
      }
  }
}
