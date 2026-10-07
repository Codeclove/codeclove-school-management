/**
 * Invoice Detail Modal Component.
 *
 * Displays full itemized invoice breakdown, due dates, balance,
 * and payment receipts history using shared CodeClove Modal and UI primitives.
 */

import React, { useState, useEffect, useRef } from 'react'
import { Printer, CreditCard, Wallet } from 'lucide-react'
import type { Invoice, InvoicePayment } from '../../types'
import type { Invoice as FinanceInvoice } from '@/api/finance'
import { formatCurrency, formatDate } from '../../lib/formatter'
import { usePortal } from '../../lib/portal-context'
import { Badge, Button, Modal, ModalFooter } from '@/components/ui'
import { PrintInvoiceSheet, printElement } from '@/components/print'
import { __, sprintf } from '@/lib/i18n'

interface InvoiceDetailModalProps {
  invoice: Invoice | null
  currency: string
  onClose: () => void
  onViewReceipt?: (payment: InvoicePayment) => void
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  invoice,
  currency,
  onClose,
  onViewReceipt,
}) => {
  const { school, currentStudent } = usePortal()
  const printRef = useRef<HTMLDivElement>(null)
  const [loadingCheckout, setLoadingCheckout] = useState(false)
  const [activeGateway, setActiveGateway] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [availableGateways, setAvailableGateways] = useState<string[]>([])

  useEffect(() => {
    const isPro = typeof window === 'undefined' || window.CodeClovePortalConfig?.isPro !== false
    if (!isPro) return

    const fetchGateways = async () => {
      try {
        const restBase = window.CodeClovePortalConfig?.restUrl ?? '/wp-json/codeclove/v1/'
        const cleanBase = restBase.replace(/\/portal\/?$/, '').replace(/\/$/, '')
        const res = await fetch(`${cleanBase}/finance/gateways/config`)
        if (res.ok) {
          const data = await res.json()
          if (data?.data?.gateways) {
            const enabledList = Object.entries(data.data.gateways)
              .filter(([, cfg]) => (cfg as { enabled?: boolean })?.enabled)
              .map(([id]) => id)
            if (enabledList.length > 0) {
              setAvailableGateways(enabledList)
            }
          }
        }
      } catch {
        // Fallback to default
      }
    }
    fetchGateways()
  }, [])

  if (!invoice) return null
  const lineItems = invoice.line_items ?? []
  const payments = invoice.payments ?? []

  const handlePrint = () => {
    if (printRef.current) {
      printElement(printRef.current)
    }
  }

  const isPayable = invoice ? invoice.status !== 'paid' && invoice.status !== 'cancelled' && invoice.status !== 'void' && invoice.balance > 0 : false

  const handleStartCheckout = async (gateway = 'stripe') => {
    if (!invoice) return
    setLoadingCheckout(true)
    setActiveGateway(gateway)
    setCheckoutError(null)
    try {
      const restBase = window.CodeClovePortalConfig?.restUrl ?? '/wp-json/codeclove/v1/'
      const cleanBase = restBase.replace(/\/portal\/?$/, '').replace(/\/$/, '')
      const url = `${cleanBase}/finance/gateways/checkout-session`
      const nonce = window.CodeClovePortalConfig?.nonce ?? ''

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(nonce ? { 'X-WP-Nonce': nonce } : {}),
        },
        body: JSON.stringify({
          invoice_id: invoice.id,
          gateway,
          amount_minor: Math.round(invoice.balance * 100),
          success_url: `${window.location.href.split('?')[0]}?payment_status=success&gateway=${gateway}`,
          cancel_url: `${window.location.href.split('?')[0]}?payment_status=cancelled&gateway=${gateway}`,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || __( 'Failed to initialize checkout session.', 'codeclove-school-management' ))
      }

      if (data?.data?.url) {
        window.location.href = data.data.url
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string }
      setCheckoutError(errorObj?.message || __( 'Payment initiation failed.', 'codeclove-school-management' ))
    } finally {
      setLoadingCheckout(false)
      setActiveGateway(null)
    }
  }
  const printableInvoice = {
    ...invoice,
    student_first_name: currentStudent?.first_name || '',
    student_last_name: currentStudent?.last_name || '',
    student_number: currentStudent?.student_number || '',
    academic_unit_name: currentStudent?.unit_name || '',
    academic_group_name: currentStudent?.group_name || '',
    total_minor: invoice.total_minor ?? Math.round(invoice.total * 100),
    paid_minor: invoice.paid_minor ?? Math.round(invoice.paid * 100),
    balance_minor: invoice.balance_minor ?? Math.round(invoice.balance * 100),
  } as unknown as FinanceInvoice

  return (
    <Modal
      open={Boolean(invoice)}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      container={typeof document !== 'undefined' ? document.getElementById('codeclove-portal-root') : undefined}
      title={
        <div className="flex items-center gap-2">
          <span>{sprintf( __( 'Invoice #%s', 'codeclove-school-management' ), invoice.invoice_number )}</span>
          <Badge variant={invoice.status as unknown as React.ComponentProps<typeof Badge>['variant']} size="sm">
            {invoice.status.replace('_', ' ')}
          </Badge>
        </div>
      }
      description={sprintf(
        __( 'Issued %1$s • Due %2$s', 'codeclove-school-management' ),
        formatDate(invoice.issue_date),
        formatDate(invoice.due_date)
      )}
      size="md"
    >
      <div className="space-y-6 pt-1">
        {/* Amount Overview Cards */}
        <div className="grid grid-cols-3 gap-3 rounded-lg bg-bg-base p-3 border border-border text-center">
          <div>
            <span className="text-2xs uppercase font-semibold text-text-muted">{__( 'Total', 'codeclove-school-management' )}</span>
            <p className="text-sm font-bold text-text mt-0.5 tabular-nums">
              {formatCurrency(invoice.total, currency)}
            </p>
          </div>
          <div>
            <span className="text-2xs uppercase font-semibold text-text-muted">{__( 'Paid', 'codeclove-school-management' )}</span>
            <p className="text-sm font-bold text-success mt-0.5 tabular-nums">
              {formatCurrency(invoice.paid, currency)}
            </p>
          </div>
          <div>
            <span className="text-2xs uppercase font-semibold text-text-muted">{__( 'Balance', 'codeclove-school-management' )}</span>
            <p className="text-sm font-bold text-danger mt-0.5 tabular-nums">
              {formatCurrency(invoice.balance, currency)}
            </p>
          </div>
        </div>

        {/* Line Items */}
        <div>
          <h4 className="text-2xs font-bold uppercase tracking-wider text-text-muted mb-2">
            {__( 'Itemized Line Items', 'codeclove-school-management' )}
          </h4>
          {lineItems.length === 0 ? (
            <div className="rounded-lg border border-border-subtle bg-bg-base/50 p-4 text-xs text-text-subtle text-center">
              {__( 'Standard School Tuition & Term Fees', 'codeclove-school-management' )}
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden bg-bg-surface">
              {lineItems.map((item, i) => (
                <div key={item.id ?? i} className="flex items-center justify-between p-3 text-xs">
                  <span className="font-medium text-text">{item.description}</span>
                  <span className="font-semibold text-text tabular-nums">
                    {formatCurrency(item.amount, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Receipts History */}
        <div>
          <h4 className="text-2xs font-bold uppercase tracking-wider text-text-muted mb-2">
            {__( 'Payment Receipts History', 'codeclove-school-management' )}
          </h4>
          {payments.length === 0 ? (
            <div className="rounded-lg border border-border-subtle bg-bg-base/50 p-4 text-xs text-text-subtle text-center">
              {__( 'No payment transactions recorded for this invoice yet.', 'codeclove-school-management' )}
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden bg-bg-surface">
              {payments.map((pmt, i) => (
                <div key={pmt.id ?? i} className="flex items-center justify-between p-3 text-xs">
                  <div>
                    <p className="font-semibold text-text">
                      {sprintf( __( 'Receipt #%s', 'codeclove-school-management' ), pmt.payment_number )}
                    </p>
                    <p className="text-2xs text-text-subtle mt-0.5">
                      {formatDate(pmt.paid_on)}
                      {pmt.method && ` • ${pmt.method.replace('_', ' ').toUpperCase()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-success tabular-nums">
                      +{formatCurrency(pmt.amount, currency)}
                    </span>
                    {onViewReceipt && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onViewReceipt(pmt)}
                        className="h-6 px-2 text-3xs font-semibold rounded-md gap-1 border border-border/60 hover:border-border/90"
                        title={__( 'View official payment receipt slip', 'codeclove-school-management' )}
                      >
                        <Printer className="w-3 h-3 text-text-subtle" />
                        <span>{__( 'Receipt', 'codeclove-school-management' )}</span>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ModalFooter>
        <Button
          variant="secondary"
          size="sm"
          onClick={handlePrint}
          className="h-8 text-xs font-semibold gap-1.5"
        >
          <Printer className="w-3.5 h-3.5 text-text-subtle" />
          <span>{__( 'Print Statement', 'codeclove-school-management' )}</span>
        </Button>
        {isPayable && (
          <div className="flex items-center gap-1.5">
            {availableGateways.includes('stripe') && (
              <Button
                variant="default"
                size="sm"
                onClick={() => handleStartCheckout('stripe')}
                disabled={loadingCheckout}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>
                  {loadingCheckout && activeGateway === 'stripe'
                    ? __( 'Connecting to Stripe...', 'codeclove-school-management' )
                    : __( 'Pay via Stripe', 'codeclove-school-management' )}
                </span>
              </Button>
            )}
            {availableGateways.includes('paypal') && (
              <Button
                variant="default"
                size="sm"
                onClick={() => handleStartCheckout('paypal')}
                disabled={loadingCheckout}
                className="h-8 text-xs font-semibold gap-1.5 bg-[#0070BA] hover:bg-[#003087] text-white"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>
                  {loadingCheckout && activeGateway === 'paypal'
                    ? __( 'Connecting to PayPal...', 'codeclove-school-management' )
                    : __( 'Pay via PayPal', 'codeclove-school-management' )}
                </span>
              </Button>
            )}
          </div>
        )}
        <Button variant="default" size="sm" onClick={onClose} className="h-8 text-xs">
          {__( 'Close', 'codeclove-school-management' )}
        </Button>
      </ModalFooter>
      {checkoutError && (
        <div className="px-6 pb-4">
          <p className="text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
            {checkoutError}
          </p>
        </div>
      )}

      {/* Hidden container for printElement execution */}
      <div className="hidden">
        <div ref={printRef}>
          <PrintInvoiceSheet invoice={printableInvoice} school={school} />
        </div>
      </div>
    </Modal>
  )
}
