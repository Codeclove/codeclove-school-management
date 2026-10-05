/**
 * Stripe Checkout Modal Component.
 *
 * Backwards-compatible wrapper around UnifiedCheckoutModal with Stripe as default gateway.
 */
import { UnifiedCheckoutModal } from './UnifiedCheckoutModal'

export interface StripeCheckoutModalProps {
  open: boolean
  onClose: () => void
  invoice: {
    id: number
    invoice_number: string
    currency: string
    balance_minor: number
    total_minor: number
    student_name?: string
    guardian_email?: string
  }
  onPaymentSuccess?: () => void
}

export function StripeCheckoutModal({
  open,
  onClose,
  invoice,
  onPaymentSuccess,
}: StripeCheckoutModalProps) {
  return (
    <UnifiedCheckoutModal
      open={open}
      onClose={onClose}
      invoice={invoice}
      defaultGateway="stripe"
      onPaymentSuccess={onPaymentSuccess}
    />
  )
}
