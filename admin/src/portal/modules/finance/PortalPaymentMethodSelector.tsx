/**
 * Portal Payment Method Selector Component.
 *
 * Dedicated in-page multi-gateway checkout interface supporting Stripe, PayPal,
 * and future payment gateways. Eliminates cramped modal stacking in the Student Portal
 * by providing full-page, mobile-first vertical radio cards, live/sandbox badges,
 * full balance vs custom/partial payment modes, and a single prominent CTA button.
 */

import React, { useState, useEffect, useId, useMemo, useRef } from 'react'
import {
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  Lock,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import {
  useGatewaysConfig,
  useCreateCheckoutSession,
  useVerifyStripeSession,
  type GatewayClientConfig,
  type CheckoutSessionResponse,
} from '@/api/gateways'
import { formatCurrency } from '../../lib/formatter'
import { usePortal } from '../../lib/portal-context'
import { Button, Badge, Card, CardContent, Input, Spinner, Alert } from '@/components/ui'
import { cn } from '@/lib/utils'
import { __, sprintf } from '@/lib/i18n'
export interface PortalPaymentInvoice {
  id: number
  invoice_number: string
  currency?: string
  balance_minor?: number
  balance?: number
  total_minor?: number
  total?: number
  paid_minor?: number
  paid?: number
  student_name?: string
  guardian_email?: string
}

export interface PortalPaymentSuccessResult {
  gateway: string
  session_id?: string
  url?: string
  amount_minor: number
  invoice_id: number
}

export interface PortalPaymentMethodSelectorProps {
  invoice: PortalPaymentInvoice
  defaultGateway?: 'stripe' | 'paypal' | string
  onCancel?: () => void
  onSuccess?: (result: PortalPaymentSuccessResult) => void
  className?: string
  showInvoiceSummary?: boolean
}

interface GatewayVisualMeta {
  title: string
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
}

/**
 * Returns brand metadata (title, subtitle, icon) for a given gateway id.
 */
function getGatewayMeta(gatewayId: string, defaultName?: string): GatewayVisualMeta {
  switch (gatewayId) {
    case 'stripe':
      return {
        title: (defaultName && defaultName !== 'Stripe') ? defaultName : __('Credit / Debit Card', 'codeclove-school-management'),
        subtitle: __('Visa, Mastercard, Amex, Apple Pay, Google Pay', 'codeclove-school-management'),
        icon: CreditCard,
      }
    case 'paypal':
      return {
        title: (defaultName && defaultName !== 'PayPal') ? defaultName : __('PayPal & Pay Later', 'codeclove-school-management'),
        subtitle: __('PayPal Wallet, Pay in 4, or Venmo', 'codeclove-school-management'),
        icon: Wallet,
      }
    default:
      return {
        title: defaultName || __('Online Payment', 'codeclove-school-management'),
        subtitle: __('Fast, secure electronic payment', 'codeclove-school-management'),
        icon: CreditCard,
      }
  }
}

export function PortalPaymentMethodSelector({
  invoice,
  defaultGateway,
  onCancel,
  onSuccess,
  className,
  showInvoiceSummary = true,
}: PortalPaymentMethodSelectorProps) {
  const radioGroupId = useId()
  const customInputId = useId()
  const emailInputId = useId()

  const currency = invoice.currency || 'USD'

  // Derive balance in minor (cents) and major units
  const balanceMinor = useMemo(() => {
    if (typeof invoice.balance_minor === 'number') {
      return invoice.balance_minor
    }
    if (typeof invoice.balance === 'number') {
      return Math.round(invoice.balance * 100)
    }
    return 0
  }, [invoice.balance_minor, invoice.balance])

  const balanceMajor = balanceMinor / 100

  // Gateways configuration query
  const isPro = typeof window === 'undefined' || (
    window.CodeCloveConfig?.isPro !== false &&
    window.CodeClovePortalConfig?.isPro !== false
  )
  const { data: configData, isLoading: isLoadingConfig, isError: isConfigError, refetch: refetchConfig } = useGatewaysConfig({ enabled: isPro })
  const checkoutMutation = useCreateCheckoutSession()
  const verifyStripeMutation = useVerifyStripeSession()
  const [verifySuccess, setVerifySuccess] = useState<boolean>(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  // Filter active/enabled gateways
  const activeGateways = useMemo<GatewayClientConfig[]>(() => {
    if (!configData?.gateways) return []
    return (Object.values(configData.gateways) as GatewayClientConfig[]).filter((g) => g.enabled)
  }, [configData])

  // Selected gateway state — initialized once with defaultGateway or first active
  const [selectedGateway, setSelectedGateway] = useState<string>(() => defaultGateway || 'stripe')
  const initializedRef = useRef<boolean>(false)

  // Auto-select initial gateway only ONCE on mount or when active gateways first arrive
  useEffect(() => {
    if (activeGateways.length === 0) return

    if (!initializedRef.current) {
      initializedRef.current = true
      if (defaultGateway && activeGateways.some((g) => g.id === defaultGateway)) {
        setSelectedGateway(defaultGateway)
      } else if (activeGateways.some((g) => g.id === 'stripe')) {
        setSelectedGateway('stripe')
      } else if (activeGateways.some((g) => g.id === 'paypal')) {
        setSelectedGateway('paypal')
      } else if (activeGateways[0]) {
        setSelectedGateway(activeGateways[0].id)
      }
      return
    }

    // If currently selected gateway was disabled dynamically, fallback to first active
    if (!activeGateways.some((g) => g.id === selectedGateway)) {
      if (activeGateways[0]) {
        setSelectedGateway(activeGateways[0].id)
      }
    }
  }, [activeGateways, defaultGateway, selectedGateway])

  // Payment amount mode: 'full' balance vs 'custom' partial amount
  const [amountMode, setAmountMode] = useState<'full' | 'custom'>('full')
  const [customAmountStr, setCustomAmountStr] = useState<string>(balanceMajor.toFixed(2))

  // Payer email
  const [payerEmail, setPayerEmail] = useState<string>(invoice.guardian_email || '')

  // Active checkout session state
  const [sessionResult, setSessionResult] = useState<CheckoutSessionResponse | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState<boolean>(false)

  // Reset inputs if invoice changes
  useEffect(() => {
    setAmountMode('full')
    setCustomAmountStr(balanceMajor.toFixed(2))
    setPayerEmail(invoice.guardian_email || '')
    setSessionResult(null)
    setCheckoutError(null)
  }, [invoice.id, balanceMajor, invoice.guardian_email])

  // School finance policy: partial payments and minimum floor
  let portalFinance
  try {
    const portal = usePortal()
    portalFinance = portal?.finance
  } catch {
    portalFinance = undefined
  }
  const financeSettings = portalFinance || (typeof window !== 'undefined' ? window.CodeClovePortalConfig?.settings?.finance : undefined)
  const allowPartialPayments = Boolean(financeSettings?.allow_partial_payments)
  const minPartialUnit = typeof financeSettings?.min_partial_amount === 'number' && financeSettings.min_partial_amount > 0
    ? financeSettings.min_partial_amount
    : 5.0
  const minPartialMinor = Math.round(minPartialUnit * 100)

  // Calculate effective amount in minor units
  const parsedCustomMajor = parseFloat(customAmountStr) || 0
  const customAmountMinor = Math.round(parsedCustomMajor * 100)
  const effectiveAmountMinor = (!allowPartialPayments || amountMode === 'full') ? balanceMinor : customAmountMinor
  const effectiveAmountMajor = effectiveAmountMinor / 100

  // Minimum payment threshold
  const minAllowedMinor = Math.min(minPartialMinor, balanceMinor > 0 ? balanceMinor : minPartialMinor)

  // Amount validation error
  const amountError = useMemo<string | null>(() => {
    if (balanceMinor <= 0) {
      return __('This invoice has no outstanding balance.', 'codeclove-school-management')
    }
    if (allowPartialPayments && amountMode === 'custom') {
      if (isNaN(parsedCustomMajor) || customAmountMinor <= 0) {
        return __('Please enter a valid payment amount greater than zero.', 'codeclove-school-management')
      }
      if (customAmountMinor < minAllowedMinor) {
        return sprintf(
          /* translators: %s: minimum amount */
          __('Minimum payment amount is %s.', 'codeclove-school-management'),
          formatCurrency(minAllowedMinor / 100, currency)
        )
      }
      if (customAmountMinor > balanceMinor) {
        return sprintf(
          /* translators: %s: maximum remaining balance */
          __('Amount cannot exceed the remaining balance of %s.', 'codeclove-school-management'),
          formatCurrency(balanceMajor, currency)
        )
      }
    }
    return null
  }, [allowPartialPayments, amountMode, parsedCustomMajor, customAmountMinor, balanceMinor, balanceMajor, minAllowedMinor, currency])

  // Email validation check
  const isEmailValid = useMemo<boolean>(() => {
    if (!payerEmail.trim()) return true // optional
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail.trim())
  }, [payerEmail])

  // Selected gateway configuration
  const selectedConfig = useMemo(() => {
    return activeGateways.find((g) => g.id === selectedGateway)
  }, [activeGateways, selectedGateway])

  const isTestMode = selectedConfig?.test_mode ?? false

  // Quick preset buttons for custom amount
  const setPercentageAmount = (percentage: number) => {
    const calculatedMinor = Math.round((balanceMinor * percentage) / 100)
    const clampedMinor = Math.max(minAllowedMinor, Math.min(balanceMinor, calculatedMinor))
    setCustomAmountStr((clampedMinor / 100).toFixed(2))
    setAmountMode('custom')
  }

  // Handle checkout session initiation
  const handleInitiateCheckout = async () => {
    if (amountError || !isEmailValid || effectiveAmountMinor <= 0 || !selectedGateway) {
      return
    }

    setCheckoutError(null)
    try {
      const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
      const baseUrl = currentUrl.split('?')[0] || ''

      const successUrl =
        selectedGateway === 'stripe'
          ? `${baseUrl}?payment_status=success&session_id={CHECKOUT_SESSION_ID}&gateway=stripe&invoice_id=${invoice.id}`
          : `${baseUrl}?payment_status=success&gateway=paypal&invoice_id=${invoice.id}`

      const cancelUrl = `${baseUrl}?payment_status=cancelled&gateway=${selectedGateway}&invoice_id=${invoice.id}`

      const response = await checkoutMutation.mutateAsync({
        invoice_id: invoice.id,
        gateway: selectedGateway,
        amount_minor: effectiveAmountMinor,
        customer_email: payerEmail.trim() || undefined,
        success_url: successUrl,
        cancel_url: cancelUrl,
      })

      if (response && response.url) {
        setSessionResult(response)
        // Automatically open checkout session in a new window/tab
        if (typeof window !== 'undefined') {
          window.open(response.url, '_blank', 'noopener,noreferrer')
        }
        onSuccess?.({
          gateway: selectedGateway,
          session_id: response.session_id,
          url: response.url,
          amount_minor: effectiveAmountMinor,
          invoice_id: invoice.id,
        })
      } else {
        throw new Error(__('Checkout session returned an empty redirect URL.', 'codeclove-school-management'))
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string }
      const message =
        errorObj?.response?.data?.message ||
        errorObj?.message ||
        __('Unable to initialize payment checkout session. Please try again.', 'codeclove-school-management')
      setCheckoutError(message)
    }
  }

  // Copy session link to clipboard
  const handleCopyLink = async () => {
    if (!sessionResult?.url || typeof navigator === 'undefined') return
    try {
      await navigator.clipboard.writeText(sessionResult.url)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
    } catch {
      // Fallback
    }
  }

  // Verify completed payment directly with gateway upon user return
  const handleVerifyPayment = async () => {
    if (!sessionResult) return
    setVerifyError(null)
    try {
      if (sessionResult.gateway === 'stripe') {
        const res = await verifyStripeMutation.mutateAsync({
          session_id: sessionResult.session_id,
          invoice_id: invoice.id,
        })
        if (res?.success) {
          setVerifySuccess(true)
          onSuccess?.({
            gateway: 'stripe',
            session_id: sessionResult.session_id,
            url: sessionResult.url,
            amount_minor: sessionResult.amount_minor,
            invoice_id: invoice.id,
          })
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null
      setVerifyError(
        msg ||
        __('Payment has not yet completed on Stripe. Please complete the card payment in the checkout window.', 'codeclove-school-management')
      )
    }
  }

  // Active Session Created View (In-Page Reassurance & External Link Dock)
  if (sessionResult) {
    const gatewayMeta = getGatewayMeta(sessionResult.gateway)
    return (
      <Card className={cn('overflow-hidden border-border/80 shadow-sm transition-all', className)}>
        <CardContent className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div className="space-y-1 max-w-md">
              <h3 className="text-lg font-semibold text-foreground">
                {sprintf(
                  /* translators: %s: Gateway Name */
                  __('%s Checkout Session Ready', 'codeclove-school-management'),
                  gatewayMeta.title
                )}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {sessionResult.gateway === 'paypal'
                  ? __(
                      'A secure PayPal window was launched. Log in to your PayPal account or pay with credit/debit card to complete payment.',
                      'codeclove-school-management'
                    )
                  : __(
                      'A secure Stripe Checkout window was launched. Enter your card or digital wallet credentials to complete payment.',
                      'codeclove-school-management'
                    )}
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 border text-xs font-medium text-foreground">
              <span className="text-muted-foreground">{__('Amount Due:', 'codeclove-school-management')}</span>
              <span className="font-bold text-foreground font-mono">
                {formatCurrency(sessionResult.amount_minor ? sessionResult.amount_minor / 100 : effectiveAmountMajor, currency)}
              </span>
            </div>
          </div>

          {/* Action Dock */}
          <div className="space-y-3 max-w-md mx-auto pt-2">
            <Button
              type="button"
              variant="default"
              size="lg"
              className="w-full gap-2 h-11 text-sm font-semibold shadow-xs"
              onClick={() => {
                if (typeof window !== 'undefined' && sessionResult.url) {
                  window.open(sessionResult.url, '_blank', 'noopener,noreferrer')
                }
              }}
            >
              <ExternalLink className="w-4 h-4" />
              {__('Open Payment Window Again', 'codeclove-school-management')}
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="w-full gap-2 h-11 text-sm font-medium"
              onClick={handleCopyLink}
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {__('Payment Link Copied!', 'codeclove-school-management')}
                  </span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-muted-foreground" />
                  <span>{__('Copy Direct Payment Link', 'codeclove-school-management')}</span>
                </>
              )}
            </Button>

            {sessionResult.gateway === 'stripe' && (
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="w-full gap-2 h-11 text-sm font-semibold border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                onClick={handleVerifyPayment}
                disabled={verifyStripeMutation.isPending || verifySuccess}
              >
                {verifySuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{__('Payment Verified & Recorded!', 'codeclove-school-management')}</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className={cn('w-4 h-4', verifyStripeMutation.isPending && 'animate-spin')} />
                    <span>
                      {verifyStripeMutation.isPending
                        ? __('Verifying with Stripe...', 'codeclove-school-management')
                        : __('I Have Completed Payment', 'codeclove-school-management')}
                    </span>
                  </>
                )}
              </Button>
            )}

            {verifyError && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>{verifyError}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setSessionResult(null)
                  setCheckoutError(null)
                }}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors underline-offset-4 hover:underline py-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {__('Change Gateway or Amount', 'codeclove-school-management')}
              </button>

              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline py-1"
                >
                  {__('Return to Invoice', 'codeclove-school-management')}
                </button>
              )}
            </div>
          </div>

          <div className="pt-2 text-center border-t border-border/60">
            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-muted-foreground" />
              {__(
                'Your payment is encrypted and verified securely. Once settled, your receipt will be available immediately.',
                'codeclove-school-management'
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Optional In-Page Invoice Summary Header */}
      {showInvoiceSummary && (
        <Card className="border-border/80 bg-muted/20">
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {__('Invoice', 'codeclove-school-management')}
                </span>
                <span className="text-xs font-mono font-bold text-foreground">
                  #{invoice.invoice_number}
                </span>
              </div>
              {invoice.student_name && (
                <p className="text-xs text-muted-foreground">
                  {sprintf(
                    /* translators: %s: student name */
                    __('Student: %s', 'codeclove-school-management'),
                    invoice.student_name
                  )}
                </p>
              )}
            </div>

            <div className="text-left sm:text-right">
              <p className="text-xs text-muted-foreground font-medium">
                {__('Total Outstanding Balance', 'codeclove-school-management')}
              </p>
              <p className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-mono">
                {formatCurrency(balanceMajor, currency)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Alert */}
      {checkoutError && (
        <Alert variant="danger" title={__('Checkout Error', 'codeclove-school-management')} className="animate-in fade-in-50 duration-150">
          <p className="text-xs leading-relaxed">{checkoutError}</p>
        </Alert>
      )}

      {/* Section 1: Payment Method Selection (Vertical Radio Cards) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs sm:text-sm font-semibold text-text flex items-center gap-2">
            <span>{__('Select Payment Method', 'codeclove-school-management')}</span>
          </label>

          {isTestMode && (
            <Badge variant="warning" size="sm" className="font-medium">
              {__('Sandbox / Test Mode', 'codeclove-school-management')}
            </Badge>
          )}
        </div>
        {/* Loading State */}
        {isLoadingConfig ? (
          <div className="flex items-center justify-center p-8 border border-border/80 rounded-xl bg-bg-surface space-x-3">
            <Spinner className="w-5 h-5 text-brand" />
            <span className="text-xs text-text-muted font-medium">
              {__('Loading available payment gateways...', 'codeclove-school-management')}
            </span>
          </div>
        ) : isConfigError ? (
          /* Error Fetching Config */
          <div className="p-4 rounded-xl border border-danger/30 bg-danger/5 space-y-2 text-center">
            <AlertCircle className="w-6 h-6 text-danger mx-auto" />
            <p className="text-xs font-semibold text-danger">
              {__('Unable to load payment configuration', 'codeclove-school-management')}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => refetchConfig()}
              className="text-xs gap-1.5 h-8 mx-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {__('Retry', 'codeclove-school-management')}
            </Button>
          </div>
        ) : activeGateways.length === 0 ? (
          /* Empty State: No Gateways Configured */
          <div className="p-5 rounded-xl border border-warning/30 bg-warning/5 space-y-2 text-center">
            <AlertCircle className="w-6 h-6 text-warning mx-auto" />
            <p className="text-xs font-semibold text-foreground">
              {__('Online Payments Not Available', 'codeclove-school-management')}
            </p>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto leading-relaxed">
              {isPro
                ? __(
                    'Online tuition payment gateways are currently disabled. Please contact the school finance administration to settle your dues.',
                    'codeclove-school-management'
                  )
                : __(
                    'Online tuition payments are not supported in the free version. Please contact the school administration to settle your dues.',
                    'codeclove-school-management'
                  )}
            </p>
          </div>
        ) : (
          /* Vertical Stack of Radio Cards */
          <div
            role="radiogroup"
            aria-labelledby={radioGroupId}
            className="space-y-2.5"
          >
            {activeGateways.map((gateway) => {
              const meta = getGatewayMeta(gateway.id, gateway.name)
              const isSelected = selectedGateway === gateway.id
              const GatewayIcon = meta.icon || CreditCard

              return (
                <div
                  key={gateway.id}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onClick={() => setSelectedGateway(gateway.id)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault()
                      setSelectedGateway(gateway.id)
                    }
                  }}
                  className={cn(
                    'relative group flex items-start sm:items-center justify-between p-3.5 sm:p-4 rounded-xl border cursor-pointer transition-all duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-brand',
                    isSelected
                      ? 'border-brand ring-1 ring-brand/20 bg-brand-dim/40 shadow-2xs'
                      : 'border-border/80 hover:border-border hover:bg-bg-base/40'
                  )}
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                    {/* Visual Brand Icon Box */}
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-brand-dim text-brand flex items-center justify-center border border-brand/10">
                      <GatewayIcon className="w-5 h-5" />
                    </div>
                    {/* Titles and Subtitle */}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs sm:text-sm font-semibold text-text tracking-tight">
                          {meta.title}
                        </span>
                        {gateway.test_mode && (
                          <Badge variant="warning" size="sm" className="text-3xs font-semibold">
                            {__('Sandbox', 'codeclove-school-management')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-2xs sm:text-xs text-text-subtle line-clamp-1 leading-normal">
                        {meta.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Radio Selection Dot / Checkmark */}
                  <div className="shrink-0 ml-3 pt-0.5 sm:pt-0">
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full border flex items-center justify-center transition-colors duration-150',
                        isSelected
                          ? 'border-brand bg-brand text-white shadow-2xs'
                          : 'border-border-strong group-hover:border-text-subtle'
                      )}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Interactive payment form controls: only when active gateways exist */}
      {activeGateways.length > 0 && (
        <>
          {/* Section 2: Payment Amount Mode (Full Balance vs Custom/Partial Amount) */}
      <div className="space-y-3 pt-1">
        <label className="text-xs sm:text-sm font-semibold text-text block">
          {__('Payment Amount', 'codeclove-school-management')}
        </label>

        {allowPartialPayments ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Option A: Full Balance */}
            <button
              type="button"
              onClick={() => setAmountMode('full')}
              className={cn(
                'flex flex-col p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand',
                amountMode === 'full'
                  ? 'border-brand bg-brand-dim/30 ring-1 ring-brand/20 shadow-2xs'
                  : 'border-border/80 hover:border-border hover:bg-bg-base/40'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text">
                  {__('Pay Full Balance', 'codeclove-school-management')}
                </span>
                <div
                  className={cn(
                    'w-4 h-4 rounded-full border flex items-center justify-center',
                    amountMode === 'full'
                      ? 'border-brand bg-brand text-white'
                      : 'border-border-strong'
                  )}
                >
                  {amountMode === 'full' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
              </div>
              <span className="text-sm font-mono font-bold text-text mt-1.5 tabular-nums">
                {formatCurrency(balanceMajor, currency)}
              </span>
              <span className="text-2xs text-text-subtle mt-0.5">
                {__('Settles all outstanding dues on this invoice', 'codeclove-school-management')}
              </span>
            </button>

            {/* Option B: Custom / Partial Amount */}
            <button
              type="button"
              onClick={() => {
                setAmountMode('custom')
              }}
              className={cn(
                'flex flex-col p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand',
                amountMode === 'custom'
                  ? 'border-brand bg-brand-dim/30 ring-1 ring-brand/20 shadow-2xs'
                  : 'border-border/80 hover:border-border hover:bg-bg-base/40'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text">
                  {__('Pay Custom / Partial Amount', 'codeclove-school-management')}
                </span>
                <div
                  className={cn(
                    'w-4 h-4 rounded-full border flex items-center justify-center',
                    amountMode === 'custom'
                      ? 'border-brand bg-brand text-white'
                      : 'border-border-strong'
                  )}
                >
                  {amountMode === 'custom' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
              </div>
              <span className="text-sm font-mono font-bold text-text mt-1.5 tabular-nums">
                {amountMode === 'custom' && !isNaN(parsedCustomMajor) && parsedCustomMajor > 0
                  ? formatCurrency(parsedCustomMajor, currency)
                  : __('Specify Amount', 'codeclove-school-management')}
              </span>
              <span className="text-2xs text-text-subtle mt-0.5">
                {__('Specify a partial payment amount', 'codeclove-school-management')}
              </span>
            </button>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl border border-border/80 bg-bg-base/30 flex items-center justify-between">
            <div>
              <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted block">
                {__('Full Balance Outstanding', 'codeclove-school-management')}
              </span>
              <span className="text-base font-bold font-mono text-text mt-0.5 block">
                {formatCurrency(balanceMajor, currency)}
              </span>
            </div>
            <span className="text-2xs font-medium text-text-subtle">
              {__('Settles invoice in full', 'codeclove-school-management')}
            </span>
          </div>
        )}
        {/* Custom Amount Input & Quick Percentages */}
        {allowPartialPayments && amountMode === 'custom' && (
          <div className="p-4 rounded-xl border border-border/80 bg-bg-base/40 space-y-3.5 animate-in fade-in-50 duration-150">
            <div>
              <label htmlFor={customInputId} className="text-xs font-semibold text-text block mb-1.5">
                {sprintf(
                  /* translators: %s: currency code */
                  __('Amount to Pay (%s)', 'codeclove-school-management'),
                  currency
                )}
              </label>

              <div className="relative">
                <Input
                  id={customInputId}
                  type="number"
                  step="0.01"
                  min={(minAllowedMinor / 100).toString()}
                  max={balanceMajor.toString()}
                  value={customAmountStr}
                  onChange={(e) => setCustomAmountStr(e.target.value)}
                  placeholder="0.00"
                  className={cn(
                    'h-10 text-sm font-mono font-semibold pl-3 bg-bg-surface',
                    amountError ? 'border-danger focus-visible:ring-danger/30' : ''
                  )}
                />
              </div>

              {amountError && (
                <p className="text-2xs text-danger mt-1.5 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {amountError}
                </p>
              )}
            </div>

            {/* Quick Percentage Presets */}
            {balanceMinor > 0 && (
              <div className="space-y-1.5">
                <span className="text-3xs uppercase font-bold tracking-wider text-text-subtle block">
                  {__('Quick Presets:', 'codeclove-school-management')}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[25, 50, 75].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setPercentageAmount(pct)}
                      className="px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-bg-surface border border-border/80 text-text hover:bg-bg-base/70 hover:border-border transition-colors shadow-2xs"
                    >
                      {pct}% ({formatCurrency(balanceMajor * (pct / 100), currency)})
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setCustomAmountStr(balanceMajor.toFixed(2))
                      setAmountMode('full')
                    }}
                    className="px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-bg-surface border border-border/80 text-text hover:bg-bg-base/70 hover:border-border transition-colors shadow-2xs"
                  >
                    100% ({__('Full', 'codeclove-school-management')})
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 3: Payer / Confirmation Email */}
      <div className="space-y-1.5 pt-1">
        <label htmlFor={emailInputId} className="text-xs sm:text-sm font-semibold text-text flex items-center justify-between">
          <span>{__('Receipt & Confirmation Email', 'codeclove-school-management')}</span>
          <span className="text-2xs text-text-subtle font-normal">
            {__('Optional', 'codeclove-school-management')}
          </span>
        </label>
        <Input
          id={emailInputId}
          type="email"
          value={payerEmail}
          onChange={(e) => setPayerEmail(e.target.value)}
          placeholder="parent@example.com"
          className={cn(
            'h-10 text-xs sm:text-sm bg-bg-surface',
            !isEmailValid ? 'border-danger focus-visible:ring-danger/30' : ''
          )}
        />
        {!isEmailValid ? (
          <p className="text-2xs text-danger">
            {__('Please enter a valid email address format.', 'codeclove-school-management')}
          </p>
        ) : (
          <p className="text-2xs text-text-subtle">
            {__('An official payment slip and transaction receipt will be emailed here once settled.', 'codeclove-school-management')}
          </p>
        )}
      </div>

      {/* Section 4: Single Prominent Call-to-Action (CTA) Button */}
      <div className="pt-2 space-y-3">
        {(() => {
          const selectedMeta = getGatewayMeta(selectedGateway, selectedConfig?.name)
          const gatewayName = selectedGateway === 'paypal' ? 'PayPal' : selectedGateway === 'stripe' ? 'Stripe' : selectedMeta.title
          const formattedPayAmount = formatCurrency(effectiveAmountMajor, currency)
          const isSubmitting = checkoutMutation.isPending
          const isDisabled =
            isSubmitting ||
            activeGateways.length === 0 ||
            balanceMinor <= 0 ||
            Boolean(amountError) ||
            !isEmailValid ||
            effectiveAmountMinor <= 0

          return (
            <Button
              type="button"
              variant="default"
              size="lg"
              disabled={isDisabled}
              onClick={handleInitiateCheckout}
              className="w-full h-11 text-sm font-semibold shadow-xs gap-2 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Spinner className="w-4 h-4 text-primary-foreground" />
                  <span>{__('Connecting to payment gateway...', 'codeclove-school-management')}</span>
                </>
              ) : (
                <>
                  <span>
                    {sprintf(
                      /* translators: 1: formatted amount, 2: gateway name */
                      __('Pay %1$s via %2$s', 'codeclove-school-management'),
                      formattedPayAmount,
                      gatewayName
                    )}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          )
        })()}

        {/* Security Reassurance Footnote */}
        <div className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            {__(
              'Bank-grade 256-bit SSL encryption. Card details are processed directly and securely.',
              'codeclove-school-management'
            )}
          </span>
        </div>
      </div>
        </>
      )}
    </div>
  )
}
