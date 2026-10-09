/**
 * Portal Finance Page.
 *
 * Provides overview of fees, payments, balances, overdue dues, and an invoice ledger
 * with detail inspection modal, using shared CodeClove design system primitives.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Eye,
  FileText,
  Receipt,
  X,
} from 'lucide-react'
import { useVerifyStripeSession, useCapturePayPalOrder } from '@/api/gateways'
import { usePortal } from '../../lib/portal-context'
import { useFinance } from '../../api/portal'
import { formatCurrency, formatDate } from '../../lib/formatter'
import { InvoiceStatementView } from './InvoiceStatementView'
import { ReceiptSlipView } from './ReceiptSlipView'
import type { Invoice, InvoicePayment } from '../../types'
import { SegmentedTabs, type SegmentedTab } from '../../components/SegmentedTabs'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  TableRoot,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { __ } from '@/lib/i18n'

export const FinancePage: React.FC = () => {
  const { currentStudent, localization } = usePortal()
  const { data: financeData, isLoading } = useFinance(currentStudent?.id)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [selectedPayment, setSelectedPayment] = useState<(InvoicePayment & { invoice_number?: string; invoice?: Invoice }) | null>(null)
  const [activeTab, setActiveTab] = useState<'invoices' | 'receipts'>('invoices')
  const [returnBanner, setReturnBanner] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const queryClient = useQueryClient()
  const verifyStripeMutation = useVerifyStripeSession()
  const capturePaypalMutation = useCapturePayPalOrder()

  // Handle automatic payment return verification from Stripe or PayPal
  useEffect(() => {
    if (typeof window === 'undefined') return

    const isPro = window.CodeClovePortalConfig?.isPro !== false
    if (!isPro) return
    const searchParams = new URLSearchParams(window.location.search)
    const hashIndex = window.location.hash.indexOf('?')
    const hashParams = new URLSearchParams(hashIndex >= 0 ? window.location.hash.substring(hashIndex + 1) : '')

    const paymentStatus = searchParams.get('payment_status') || hashParams.get('payment_status')
    if (!paymentStatus) return

    const gateway = searchParams.get('gateway') || hashParams.get('gateway') || 'stripe'
    const sessionId = searchParams.get('session_id') || hashParams.get('session_id')
    const invoiceId = searchParams.get('invoice_id') || hashParams.get('invoice_id')
    const token = searchParams.get('token') || hashParams.get('token')

    const cleanPaymentUrlParams = () => {
      if (typeof window === 'undefined' || !window.history?.replaceState) return
      const url = new URL(window.location.href)
      url.searchParams.delete('payment_status')
      url.searchParams.delete('session_id')
      url.searchParams.delete('gateway')
      url.searchParams.delete('invoice_id')
      url.searchParams.delete('token')
      url.searchParams.delete('PayerID')
      if (url.hash.includes('?')) {
        const [hashPath] = url.hash.split('?')
        url.hash = hashPath ?? ''
      }
      window.history.replaceState({}, document.title, url.toString())
    }

    if (paymentStatus === 'success') {
      if (gateway === 'stripe') {
        verifyStripeMutation.mutate(
          {
            session_id: sessionId || '',
            invoice_id: invoiceId ? Number(invoiceId) : undefined,
          },
          {
            onSuccess: () => {
              setReturnBanner({
                type: 'success',
                message: __('Payment captured successfully! Your invoice ledger has been updated.', 'codeclove-school-management'),
              })
              queryClient.invalidateQueries({ queryKey: ['portal', 'finance'] })
              cleanPaymentUrlParams()
            },
            onError: (err: unknown) => {
              const errMsg = err instanceof Error ? err.message : null
              setReturnBanner({
                type: 'info',
                message: errMsg || __('Payment received. Please review your updated invoices below.', 'codeclove-school-management'),
              })
              queryClient.invalidateQueries({ queryKey: ['portal', 'finance'] })
              cleanPaymentUrlParams()
            },
          }
        )
      } else if (gateway === 'paypal' && token) {
        capturePaypalMutation.mutate(
          {
            order_id: token,
            invoice_id: invoiceId ? Number(invoiceId) : undefined,
          },
          {
            onSuccess: () => {
              setReturnBanner({
                type: 'success',
                message: __('PayPal payment captured successfully! Your invoice ledger has been updated.', 'codeclove-school-management'),
              })
              queryClient.invalidateQueries({ queryKey: ['portal', 'finance'] })
              cleanPaymentUrlParams()
            },
            onError: (err: unknown) => {
              const errMsg = err instanceof Error ? err.message : null
              setReturnBanner({
                type: 'error',
                message: errMsg || __('Unable to capture PayPal payment.', 'codeclove-school-management'),
              })
              cleanPaymentUrlParams()
            },
          }
        )
      }
    } else if (paymentStatus === 'cancelled') {
      setReturnBanner({
        type: 'info',
        message: __('Payment was cancelled. You can retry payment anytime.', 'codeclove-school-management'),
      })
      cleanPaymentUrlParams()
    }
  }, [])

  const summary = financeData?.summary
  const invoices = financeData?.invoices ?? []
  const currency = summary?.currency ?? localization?.currency ?? 'USD'

  const totalInvoiced = summary?.total_invoiced ?? 0
  const totalPaid = summary?.total_paid ?? 0
  const balance = summary?.balance ?? 0
  const overdue = summary?.overdue ?? summary?.overdue_amount ?? 0

  // Flatten payments across all invoices for the Receipts view
  const allPayments = useMemo(() => {
    return invoices.flatMap((inv) =>
      (inv.payments ?? []).map((pmt) => ({
        ...pmt,
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        invoice: inv,
      }))
    )
  }, [invoices])

  const tabs = useMemo<Array<SegmentedTab<'invoices' | 'receipts'>>>(
    () => [
      {
        id: 'invoices',
        label: __( 'Invoices', 'codeclove-school-management' ),
        icon: FileText,
        count: invoices.length,
      },
      {
        id: 'receipts',
        label: __( 'Payment Receipts', 'codeclove-school-management' ),
        icon: Receipt,
        count: allPayments.length,
      },
    ],
    [invoices.length, allPayments.length]
  )

  // Dedicated In-Page View 1: Receipt Slip View
  if (selectedPayment) {
    return (
      <ReceiptSlipView
        payment={selectedPayment}
        invoice={selectedPayment.invoice || selectedInvoice}
        currency={currency}
        onBack={() => setSelectedPayment(null)}
        onBackToInvoice={() => setSelectedPayment(null)}
        onBackToLedger={() => {
          setSelectedPayment(null)
          setSelectedInvoice(null)
        }}
        onViewInvoice={(inv) => {
          setSelectedPayment(null)
          setSelectedInvoice(inv)
        }}
      />
    )
  }

  // Dedicated In-Page View 2: Invoice Statement & Payment Dock View
  if (selectedInvoice) {
    return (
      <InvoiceStatementView
        invoice={selectedInvoice}
        currency={currency}
        onBack={() => setSelectedInvoice(null)}
        onBackToLedger={() => setSelectedInvoice(null)}
        onViewReceipt={(pmt) => {
          setSelectedPayment({
            ...pmt,
            invoice: selectedInvoice,
            invoice_number: selectedInvoice.invoice_number,
          })
        }}
      />
    )
  }
  return (
    <div className="space-y-6">
      {/* Payment Return Notification Banner */}
      {returnBanner && (
        <div
          className={cn(
            returnBanner.type === 'success' && 'bg-success-dim border border-success text-success',
            returnBanner.type === 'info' && 'bg-info-dim border border-info text-info',
            returnBanner.type === 'error' && 'bg-danger-dim border border-danger text-danger'
          )}
        >
          <div className="flex items-start gap-2.5">
            {returnBanner.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
            ) : returnBanner.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-info shrink-0 mt-0.5" />
            )}
            <p className="text-sm font-medium leading-relaxed">{returnBanner.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setReturnBanner(null)}
            className="p-1 rounded-md hover:bg-hover-bg transition-colors"
            aria-label={__( 'Dismiss', 'codeclove-school-management' )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title={__( 'Fee & Payment Records', 'codeclove-school-management' )}
        description={__( 'Invoices, payment history, and fee balances', 'codeclove-school-management' )}
      />

      {isLoading ? (
        <div className="space-y-6 animate-pulse">
          <Card className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-3 w-20 rounded bg-bg-base" />
                    <div className="h-6 w-6 rounded-lg bg-bg-base" />
                  </div>
                  <div className="h-7 w-28 rounded bg-bg-base" />
                  <div className="h-3 w-24 rounded bg-bg-base" />
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-6 space-y-4">
            <div className="h-4 w-32 rounded bg-bg-base" />
            <div className="space-y-3 pt-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-bg-base/70" />
              ))}
            </div>
          </Card>
        </div>
      ) : (
        <>
          {/* Executive Fee Overview Cards (Divided Grid Pattern) */}
          <Card className="rounded-xl border border-border overflow-hidden shadow-card">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border">
              {/* Total Invoiced */}
              <div className="p-5 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-muted">{__( 'Total Invoiced', 'codeclove-school-management' )}</span>
                  <span className="p-1.5 rounded-lg bg-brand-dim text-brand">
                    <Receipt className="w-4 h-4" />
                  </span>
                </div>
                <div>
                  <p className="text-2xl sm:text-3xl font-bold tracking-tight text-text tabular-nums">
                    {formatCurrency(totalInvoiced, currency)}
                  </p>
                  <p className="text-xs text-text-subtle mt-1">{__( 'All term fees billed', 'codeclove-school-management' )}</p>
                </div>
              </div>

              {/* Total Paid */}
              <div className="p-5 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-muted">{__( 'Total Paid', 'codeclove-school-management' )}</span>
                  <span className="p-1.5 rounded-lg bg-success-dim text-success">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                </div>
                <div>
                  <p className="text-2xl sm:text-3xl font-bold tracking-tight text-success tabular-nums">
                    {formatCurrency(totalPaid, currency)}
                  </p>
                  <p className="text-xs text-text-subtle mt-1">{__( 'Cleared payments', 'codeclove-school-management' )}</p>
                </div>
              </div>

              {/* Balance Due */}
              <div className="p-5 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-muted">{__( 'Balance Due', 'codeclove-school-management' )}</span>
                  <span
                    className={cn(
                      'p-1.5 rounded-lg',
                      balance > 0 ? 'bg-warning-dim text-warning' : 'bg-brand-dim text-brand'
                    )}
                  >
                    <CreditCard className="w-4 h-4" />
                  </span>
                </div>
                <div>
                  <p
                    className={cn(
                      'text-2xl sm:text-3xl font-bold tracking-tight tabular-nums',
                      balance > 0 ? 'text-warning' : 'text-text'
                    )}
                  >
                    {formatCurrency(balance, currency)}
                  </p>
                  <p className="text-xs text-text-subtle mt-1">{__( 'Outstanding dues', 'codeclove-school-management' )}</p>
                </div>
              </div>

              {/* Overdue */}
              <div className="p-5 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-muted">{__( 'Overdue', 'codeclove-school-management' )}</span>
                  <span
                    className={cn(
                      'p-1.5 rounded-lg',
                      overdue > 0 ? 'bg-danger-dim text-danger' : 'bg-brand-dim text-brand'
                    )}
                  >
                    <AlertCircle className="w-4 h-4" />
                  </span>
                </div>
                <div>
                  <p
                    className={cn(
                      'text-2xl sm:text-3xl font-bold tracking-tight tabular-nums',
                      overdue > 0 ? 'text-danger' : 'text-text'
                    )}
                  >
                    {formatCurrency(overdue, currency)}
                  </p>
                  <p className="text-xs text-text-subtle mt-1">{__( 'Past payment date', 'codeclove-school-management' )}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Sub-Navigation Tabs Bar (Segmented Capsule Track) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <SegmentedTabs<'invoices' | 'receipts'>
              tabs={tabs}
              activeTab={activeTab}
              onChange={setActiveTab}
              ariaLabel={__( 'Finance records views', 'codeclove-school-management' )}
            />
            <div className="hidden sm:flex items-center gap-2 text-xs text-text-subtle font-medium">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand/50" />
              <span>
                {activeTab === 'invoices'
                  ? __( 'Click any invoice to view breakdown & receipts', 'codeclove-school-management' )
                  : __( 'Official record of payments received', 'codeclove-school-management' )}
              </span>
            </div>
          </div>
          {/* Invoices & Receipts Ledger Card */}
          <Card
            id={`panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
            className="rounded-xl border border-border overflow-hidden shadow-card"
          >
            {activeTab === 'invoices' && (
              invoices.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title={__( 'No invoices found', 'codeclove-school-management' )}
                  description={__( 'No invoices or payment statements have been generated for this student.', 'codeclove-school-management' )}
                  className="py-12"
                />
              ) : (
                <TableRoot responsiveMode="scroll" className="w-full">
                  <Thead className="border-b border-border bg-bg-surface">
                    <Tr className="border-b border-border">
                      <Th className="text-2xs uppercase tracking-wider font-semibold text-text-muted">{__( 'Invoice #', 'codeclove-school-management' )}</Th>
                      <Th className="text-2xs uppercase tracking-wider font-semibold text-text-muted">{__( 'Issued Date', 'codeclove-school-management' )}</Th>
                      <Th className="text-2xs uppercase tracking-wider font-semibold text-text-muted">{__( 'Due Date', 'codeclove-school-management' )}</Th>
                      <Th className="text-2xs uppercase tracking-wider font-semibold text-text-muted text-right">{__( 'Total', 'codeclove-school-management' )}</Th>
                      <Th className="text-2xs uppercase tracking-wider font-semibold text-text-muted text-right">{__( 'Paid', 'codeclove-school-management' )}</Th>
                      <Th className="text-2xs uppercase tracking-wider font-semibold text-text-muted text-right">{__( 'Balance', 'codeclove-school-management' )}</Th>
                      <Th className="text-2xs uppercase tracking-wider font-semibold text-text-muted text-center">{__( 'Status', 'codeclove-school-management' )}</Th>
                      <Th className="text-2xs uppercase tracking-wider font-semibold text-text-muted text-right">{__( 'Actions', 'codeclove-school-management' )}</Th>
                    </Tr>
                  </Thead>
                  <Tbody className="divide-y divide-border">
                    {invoices.map((inv) => (
                      <Tr
                        key={inv.id}
                        className="cursor-pointer hover:bg-hover-bg border-b border-border last:border-b-0 transition-colors"
                        onClick={() => setSelectedInvoice(inv)}
                      >
                        <Td className="font-semibold text-text whitespace-nowrap">
                          #{inv.invoice_number}
                        </Td>
                        <Td className="text-text-muted whitespace-nowrap">
                          {formatDate(inv.issue_date)}
                        </Td>
                        <Td className="text-text-muted whitespace-nowrap">
                          {formatDate(inv.due_date)}
                        </Td>
                        <Td className="font-medium text-text tabular-nums text-right whitespace-nowrap">
                          {formatCurrency(inv.total, currency)}
                        </Td>
                        <Td className="text-success font-medium tabular-nums text-right whitespace-nowrap">
                          {formatCurrency(inv.paid, currency)}
                        </Td>
                        <Td className="font-semibold text-text tabular-nums text-right whitespace-nowrap">
                          {formatCurrency(inv.balance, currency)}
                        </Td>
                        <Td className="text-center whitespace-nowrap">
                          <Badge variant={inv.status} size="sm">
                            {inv.status.replace('_', ' ')}
                          </Badge>
                        </Td>
                        <Td className="text-right whitespace-nowrap">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedInvoice(inv)
                            }}
                            className="h-7 px-2.5 text-xs font-semibold rounded-lg border border-border hover:border-border-strong hover:bg-hover-bg"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1 text-text-subtle" />
                            {__( 'View', 'codeclove-school-management' )}
                          </Button>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </TableRoot>
              )
            )}

            {/* Tab 2: Payment Receipts */}
            {activeTab === 'receipts' && (
              allPayments.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title={__( 'No payment receipts found', 'codeclove-school-management' )}
                  description={__( 'No payments or transaction receipts have been recorded for this student yet.', 'codeclove-school-management' )}
                  className="py-12"
                />
              ) : (
                <TableRoot responsiveMode="scroll" className="w-full">
                  <Thead className="border-b border-border bg-bg-surface">
                    <Tr className="border-b border-border">
                      <Th className="text-2xs uppercase tracking-wider font-semibold text-text-muted">{__( 'Receipt #', 'codeclove-school-management' )}</Th>
                      <Th className="text-2xs uppercase tracking-wider font-semibold text-text-muted">{__( 'Date Paid', 'codeclove-school-management' )}</Th>
                      <Th className="text-2xs uppercase tracking-wider font-semibold text-text-muted">{__( 'For Invoice', 'codeclove-school-management' )}</Th>
                      <Th className="text-2xs uppercase tracking-wider font-semibold text-text-muted">{__( 'Method', 'codeclove-school-management' )}</Th>
                      <Th className="text-2xs uppercase tracking-wider font-semibold text-text-muted text-right">{__( 'Amount', 'codeclove-school-management' )}</Th>
                      <Th className="text-2xs uppercase tracking-wider font-semibold text-text-muted text-center">{__( 'Status', 'codeclove-school-management' )}</Th>
                      <Th className="text-2xs uppercase tracking-wider font-semibold text-text-muted text-right">{__( 'Action', 'codeclove-school-management' )}</Th>
                    </Tr>
                  </Thead>
                  <Tbody className="divide-y divide-border">
                    {allPayments.map((pmt, idx) => {
                      const receiptNum = pmt.payment_number
                      const paidDate = pmt.paid_on
                      const payMethod = pmt.method
                      return (
                        <Tr
                          key={pmt.id ?? idx}
                          className="cursor-pointer hover:bg-hover-bg border-b border-border last:border-b-0 transition-colors"
                          onClick={() => setSelectedPayment(pmt)}
                        >
                          <Td className="font-mono text-xs font-semibold text-text whitespace-nowrap">
                            #{receiptNum}
                          </Td>
                          <Td className="text-text-muted whitespace-nowrap">
                            {paidDate ? formatDate(paidDate) : '—'}
                          </Td>
                          <Td className="font-mono text-xs text-brand font-semibold whitespace-nowrap">
                            #{pmt.invoice_number}
                          </Td>
                          <Td className="text-text-muted whitespace-nowrap capitalize">
                            {payMethod ? payMethod.replace('_', ' ') : __( 'Standard', 'codeclove-school-management' )}
                          </Td>
                          <Td className="text-success font-semibold tabular-nums text-right whitespace-nowrap">
                            +{formatCurrency(pmt.amount, currency)}
                          </Td>
                          <Td className="text-center whitespace-nowrap">
                            <Badge variant="paid" size="sm">
                              {pmt.status ? pmt.status.replace('_', ' ') : __( 'Completed', 'codeclove-school-management' )}
                            </Badge>
                          </Td>
                          <Td className="text-right whitespace-nowrap">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedPayment(pmt)
                              }}
                              className="h-7 px-2.5 text-xs font-semibold rounded-lg border border-border hover:border-border-strong hover:bg-hover-bg"
                            >
                              <Receipt className="w-3.5 h-3.5 mr-1 text-text-subtle" />
                              {__( 'View', 'codeclove-school-management' )}
                            </Button>
                          </Td>
                        </Tr>
                      )
                    })}
                  </Tbody>
                </TableRoot>
              )
            )}
          </Card>
        </>
      )}

    </div>
  )
}
