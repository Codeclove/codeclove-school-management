/**
 * Unified Payment Checkout Modal Component.
 *
 * Provides a unified modal to initiate payment checkout sessions for an invoice
 * supporting multiple payment gateways (Stripe and PayPal).
 */
import { useState, useEffect } from 'react'
import {
  CreditCard,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Wallet,
  Check,
} from 'lucide-react'
import { Button, Modal, ModalFooter, Input, Spinner } from '@/components/ui'
import { useGatewaysConfig, useCreateCheckoutSession, type GatewayClientConfig } from '@/api/gateways'
import { useFormatter } from '@/lib/formatter'
import { useToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { __, sprintf } from '@/lib/i18n'

export interface UnifiedCheckoutModalProps {
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
  defaultGateway?: 'stripe' | 'paypal'
  onPaymentSuccess?: () => void
}

export function UnifiedCheckoutModal({
  open,
  onClose,
  invoice,
  defaultGateway,
  onPaymentSuccess,
}: UnifiedCheckoutModalProps) {
  const toast = useToast()
  const { formatCurrency } = useFormatter()
  const isPro = typeof window === 'undefined' || window.CodeCloveConfig?.isPro !== false

  const { data: configData, isLoading: isLoadingConfig } = useGatewaysConfig({ enabled: isPro })
  const checkoutMutation = useCreateCheckoutSession()

  const [amountMinor, setAmountMinor] = useState<number>(invoice.balance_minor)
  const [payerEmail, setPayerEmail] = useState<string>(invoice.guardian_email || '')
  const [sessionUrl, setSessionUrl] = useState<string | null>(null)
  const [selectedGateway, setSelectedGateway] = useState<'stripe' | 'paypal'>('stripe')

  // Get active gateways list
  const activeGateways = configData?.gateways
    ? (Object.values(configData.gateways) as GatewayClientConfig[]).filter((cfg) => cfg.enabled)
    : []

  const isStripeAvailable = Boolean(configData?.gateways?.stripe?.enabled)
  const isPaypalAvailable = Boolean(configData?.gateways?.paypal?.enabled)

  // Auto-select preferred gateway when configuration loads
  useEffect(() => {
    if (defaultGateway && configData?.gateways?.[defaultGateway]?.enabled) {
      setSelectedGateway(defaultGateway)
    } else if (isStripeAvailable) {
      setSelectedGateway('stripe')
    } else if (isPaypalAvailable) {
      setSelectedGateway('paypal')
    }
  }, [defaultGateway, isStripeAvailable, isPaypalAvailable, configData])

  // Reset inputs when modal opens with new invoice
  useEffect(() => {
    if (open) {
      setAmountMinor(invoice.balance_minor)
      setPayerEmail(invoice.guardian_email || '')
      setSessionUrl(null)
    }
  }, [open, invoice.balance_minor, invoice.guardian_email])

  const handleStartCheckout = async () => {
    try {
      const currentUrl = window.location.href
      const baseUrl = currentUrl.split('?')[0]

      const successUrl =
        selectedGateway === 'stripe'
          ? `${baseUrl}?payment_status=success&session_id={CHECKOUT_SESSION_ID}&gateway=stripe`
          : `${baseUrl}?payment_status=success&gateway=paypal`

      const cancelUrl = `${baseUrl}?payment_status=cancelled&gateway=${selectedGateway}`

      const res = await checkoutMutation.mutateAsync({
        invoice_id: invoice.id,
        gateway: selectedGateway,
        amount_minor: amountMinor,
        customer_email: payerEmail || undefined,
        success_url: successUrl,
        cancel_url: cancelUrl,
      })

      if (res.url) {
        setSessionUrl(res.url)
        // Automatically open checkout URL in new tab / window
        window.open(res.url, '_blank', 'noopener,noreferrer')
        toast.success(
          sprintf(
            /* translators: %s: gateway name */
            __('%s checkout session initiated.', 'codeclove-school-management'),
            selectedGateway === 'paypal' ? 'PayPal' : 'Stripe'
          )
        )
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string }
      const msg =
        errorObj?.response?.data?.message ||
        errorObj?.message ||
        __('Failed to initialize payment checkout.', 'codeclove-school-management')
      toast.error(msg)
    }
  }

  const handleReset = () => {
    setSessionUrl(null)
    onClose()
  }

  const selectedGatewayConfig = configData?.gateways?.[selectedGateway]
  const isSelectedTestMode = selectedGatewayConfig?.test_mode ?? false

  return (
    <Modal
      open={open}
      onOpenChange={(val) => !val && handleReset()}
      title={sprintf(
        /* translators: %s: invoice number */
        __('Pay Invoice #%s Online', 'codeclove-school-management'),
        invoice.invoice_number
      )}
      size="md"
    >
      <div className="space-y-4 py-2">
        {sessionUrl ? (
          <div className="p-5 rounded-xl border bg-success/5 border-success/20 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-success mx-auto animate-in zoom-in-50 duration-200" />
            <div className="space-y-1">
              <h4 className="font-semibold text-foreground text-sm">
                {selectedGateway === 'paypal'
                  ? __('PayPal Checkout Session Created', 'codeclove-school-management')
                  : __('Stripe Checkout Session Created', 'codeclove-school-management')}
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {selectedGateway === 'paypal'
                  ? __(
                      'A secure PayPal window has been opened. Log in to your PayPal account or pay with card to complete payment.',
                      'codeclove-school-management'
                    )
                  : __(
                      'A secure Stripe Checkout window has been opened. Complete your payment card details there.',
                      'codeclove-school-management'
                    )}
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
              <a
                href={sessionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm w-full sm:w-auto"
              >
                <span>
                  {selectedGateway === 'paypal'
                    ? __('Continue to PayPal', 'codeclove-school-management')
                    : __('Resume Stripe Checkout', 'codeclove-school-management')}
                </span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSessionUrl(null)
                  onPaymentSuccess?.()
                }}
                className="text-xs w-full sm:w-auto"
              >
                {__('I Have Completed Payment', 'codeclove-school-management')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Invoice Overview Card */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/20">
              <div>
                <p className="text-xs text-muted-foreground font-medium">
                  {__('Remaining Balance Due', 'codeclove-school-management')}
                </p>
                <p className="text-xl font-bold text-foreground">
                  {formatCurrency(invoice.balance_minor)}
                </p>
                {invoice.student_name && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {sprintf(
                      /* translators: %s: student name */
                      __('Student: %s', 'codeclove-school-management'),
                      invoice.student_name
                    )}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground font-medium">
                  {__('Invoice Total', 'codeclove-school-management')}
                </p>
                <p className="text-sm font-semibold text-muted-foreground">
                  {formatCurrency(invoice.total_minor)}
                </p>
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono uppercase border border-border text-muted-foreground mt-1">
                  {invoice.currency}
                </span>
              </div>
            </div>

            {/* Gateway Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>{__('Select Payment Method', 'codeclove-school-management')}</span>
                {isSelectedTestMode && (
                  <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    {__('Sandbox Active', 'codeclove-school-management')}
                  </span>
                )}
              </label>

              {isLoadingConfig ? (
                <div className="flex items-center justify-center py-6 border rounded-xl bg-muted/10">
                  <Spinner className="w-5 h-5 text-primary" />
                  <span className="text-xs text-muted-foreground ml-2">
                    {__('Loading payment options...', 'codeclove-school-management')}
                  </span>
                </div>
              ) : activeGateways.length === 0 ? (
                <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-center space-y-1">
                  <AlertCircle className="w-6 h-6 text-destructive mx-auto" />
                  <p className="text-xs font-semibold text-destructive">
                    {__('No Payment Gateways Configured', 'codeclove-school-management')}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {isPro
                      ? __(
                          'Please configure and enable Stripe or PayPal in Settings → Payment Gateways to accept online payments.',
                          'codeclove-school-management'
                        )
                      : __(
                          'Online payment gateways are available in CodeClove Pro.',
                          'codeclove-school-management'
                        )}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Stripe Card */}
                  {isStripeAvailable && (
                    <button
                      type="button"
                      onClick={() => setSelectedGateway('stripe')}
                      className={cn(
                        'relative flex flex-col p-3 rounded-xl border text-left transition-all duration-150',
                        selectedGateway === 'stripe'
                          ? 'border-brand ring-2 ring-brand/20 bg-brand/5 shadow-xs'
                          : 'border-border hover:border-border-strong hover:bg-muted/10'
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div
                          className={cn(
                            'w-4 h-4 rounded-full border flex items-center justify-center transition-colors',
                            selectedGateway === 'stripe'
                              ? 'border-brand bg-brand text-white'
                              : 'border-border-strong'
                          )}
                        >
                          {selectedGateway === 'stripe' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-foreground">
                        {__('Credit / Debit Card', 'codeclove-school-management')}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                        {__('Visa, Mastercard, Apple Pay, Google Pay', 'codeclove-school-management')}
                      </span>
                    </button>
                  )}

                  {/* PayPal Card */}
                  {isPaypalAvailable && (
                    <button
                      type="button"
                      onClick={() => setSelectedGateway('paypal')}
                      className={cn(
                        'relative flex flex-col p-3 rounded-xl border text-left transition-all duration-150',
                        selectedGateway === 'paypal'
                          ? 'border-brand ring-2 ring-brand/20 bg-brand/5 shadow-xs'
                          : 'border-border hover:border-border-strong hover:bg-muted/10'
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Wallet className="w-4 h-4" />
                        </div>
                        <div
                          className={cn(
                            'w-4 h-4 rounded-full border flex items-center justify-center transition-colors',
                            selectedGateway === 'paypal'
                              ? 'border-brand bg-brand text-white'
                              : 'border-border-strong'
                          )}
                        >
                          {selectedGateway === 'paypal' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-foreground">
                        {__('PayPal & Pay Later', 'codeclove-school-management')}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                        {__('PayPal Wallet, Pay in 4, Venmo', 'codeclove-school-management')}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Inputs: Amount and Payer Email */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  {__('Payment Amount', 'codeclove-school-management')}
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="1"
                    max={(invoice.balance_minor / 100).toString()}
                    value={(amountMinor / 100).toString()}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0
                      setAmountMinor(Math.round(val * 100))
                    }}
                    className="pr-14 text-sm font-semibold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground uppercase font-bold">
                    {invoice.currency}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[11px] text-muted-foreground">
                  <span>{__('Partial payments accepted.', 'codeclove-school-management')}</span>
                  {amountMinor !== invoice.balance_minor && (
                    <button
                      type="button"
                      onClick={() => setAmountMinor(invoice.balance_minor)}
                      className="text-brand hover:underline font-medium"
                    >
                      {__('Reset to full balance', 'codeclove-school-management')}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  {__('Receipt / Confirmation Email', 'codeclove-school-management')}
                </label>
                <Input
                  type="email"
                  value={payerEmail}
                  onChange={(e) => setPayerEmail(e.target.value)}
                  placeholder="parent@example.com"
                  className="text-sm"
                />
              </div>
            </div>

            {/* Security Notice */}
            <div className="p-3 rounded-xl border border-border/70 bg-muted/10 flex items-start gap-2.5 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-brand shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                {selectedGateway === 'paypal'
                  ? __(
                      'Encrypted checkout via PayPal REST API. You will be redirected to PayPal to authorize the payment securely.',
                      'codeclove-school-management'
                    )
                  : __(
                      '256-bit encrypted checkout via Stripe. Cardholder credentials are tokenized directly with Stripe and never touch our servers.',
                      'codeclove-school-management'
                    )}
              </div>
            </div>
          </>
        )}
      </div>

      <ModalFooter>
        <Button variant="secondary" size="sm" onClick={handleReset}>
          {sessionUrl ? __('Close', 'codeclove-school-management') : __('Cancel', 'codeclove-school-management')}
        </Button>

        {!sessionUrl && (
          <Button
            size="sm"
            onClick={handleStartCheckout}
            disabled={
              checkoutMutation.isPending ||
              amountMinor <= 0 ||
              activeGateways.length === 0 ||
              isLoadingConfig
            }
            className="gap-2"
          >
            {checkoutMutation.isPending ? (
              <Spinner className="w-4 h-4" />
            ) : selectedGateway === 'paypal' ? (
              <Wallet className="w-4 h-4" />
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
            {sprintf(
              /* translators: 1: formatted amount, 2: gateway name */
              __('Pay %1$s via %2$s', 'codeclove-school-management'),
              formatCurrency(amountMinor),
              selectedGateway === 'paypal' ? 'PayPal' : 'Stripe'
            )}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  )
}
