import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import {
  PortalPaymentMethodSelector,
  type PortalPaymentInvoice,
} from '../modules/finance/PortalPaymentMethodSelector'
import type { GatewaysConfigResponse } from '@/api/gateways'

// Mock gateways API
let mockGatewaysConfig: GatewaysConfigResponse = {
  gateways: {
    stripe: {
      id: 'stripe',
      name: 'Stripe',
      enabled: true,
      test_mode: false,
      publishable_key: 'pk_live_stripe_sample_key',
    },
    paypal: {
      id: 'paypal',
      name: 'PayPal',
      enabled: true,
      test_mode: true,
      client_id: 'client_sandbox_paypal_key',
    },
  },
}

vi.mock('@/api/gateways', () => ({
  useGatewaysConfig: () => ({
    data: mockGatewaysConfig,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useCreateCheckoutSession: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}))

// Mock portal formatter
vi.mock('../lib/formatter', () => ({
  formatCurrency: (amount: number, currency = 'USD') => {
    return `${currency === 'USD' ? '$' : currency + ' '}${Number(amount).toFixed(2)}`
  },
  formatDate: (dateStr: string) => dateStr,
}))

describe('PortalPaymentMethodSelector Component', () => {
  const sampleInvoice: PortalPaymentInvoice = {
    id: 108,
    invoice_number: 'INV-2026-0042',
    currency: 'USD',
    balance_minor: 45000,
    balance: 450,
    total_minor: 90000,
    total: 900,
    student_name: 'Ananya Sharma',
    guardian_email: 'guardian@springdale.edu',
  }

  it('renders invoice summary with invoice number, student name, and remaining balance', () => {
    const html = renderToString(
      <PortalPaymentMethodSelector invoice={sampleInvoice} />
    )

    expect(html).toContain('INV-2026-0042')
    expect(html).toContain('Ananya Sharma')
    expect(html).toContain('$450.00')
    expect(html).toContain('Total Outstanding Balance')
  })

  it('renders multi-gateway radio cards for active gateways (Stripe & PayPal)', () => {
    const html = renderToString(
      <PortalPaymentMethodSelector invoice={sampleInvoice} />
    )

    expect(html).toContain('Credit / Debit Card')
    expect(html).toContain('Visa, Mastercard, Amex, Apple Pay, Google Pay')
    expect(html).toContain('PayPal &amp; Pay Later')
    expect(html).toContain('PayPal Wallet, Pay in 4, or Venmo')
  })

  it('displays sandbox badge for gateways configured in test mode', () => {
    const html = renderToString(
      <PortalPaymentMethodSelector invoice={sampleInvoice} />
    )

    // PayPal is in test_mode: true
    expect(html).toContain('Sandbox')
  })

  it('renders payment amount selection modes (Full Balance vs Custom/Partial)', () => {
    const html = renderToString(
      <PortalPaymentMethodSelector invoice={sampleInvoice} />
    )

    expect(html).toContain('Pay Full Balance')
    expect(html).toContain('Pay Custom / Partial Amount')
    expect(html).toContain('Settles all outstanding dues on this invoice')
    expect(html).toContain('Specify a partial payment amount')
  })

  it('renders payer confirmation email input prefilled with guardian email', () => {
    const html = renderToString(
      <PortalPaymentMethodSelector invoice={sampleInvoice} />
    )

    expect(html).toContain('Receipt &amp; Confirmation Email')
    expect(html).toContain('guardian@springdale.edu')
  })

  it('renders prominent call-to-action button with formatted amount and gateway name', () => {
    const html = renderToString(
      <PortalPaymentMethodSelector invoice={sampleInvoice} defaultGateway="stripe" />
    )

    expect(html).toContain('Pay $450.00 via Stripe')
  })

  it('selects PayPal as default when defaultGateway is paypal', () => {
    const html = renderToString(
      <PortalPaymentMethodSelector invoice={sampleInvoice} defaultGateway="paypal" />
    )

    expect(html).toContain('Pay $450.00 via PayPal')
  })

  it('renders security reassurance lock notice below CTA', () => {
    const html = renderToString(
      <PortalPaymentMethodSelector invoice={sampleInvoice} />
    )

    expect(html).toContain('Bank-grade 256-bit SSL encryption')
    expect(html).toContain('Card details are processed directly and securely.')
  })

  it('allows hiding the invoice summary header via showInvoiceSummary=false', () => {
    const html = renderToString(
      <PortalPaymentMethodSelector invoice={sampleInvoice} showInvoiceSummary={false} />
    )

    expect(html).not.toContain('Total Outstanding Balance')
    // Gateways and CTA should still render
    expect(html).toContain('Credit / Debit Card')
    expect(html).toContain('Pay $450.00 via Stripe')
  })

  it('correctly calculates balance in major units when only balance_minor is supplied', () => {
    const minorOnlyInvoice: PortalPaymentInvoice = {
      id: 202,
      invoice_number: 'INV-2026-9999',
      currency: 'USD',
      balance_minor: 12550, // $125.50
    }

    const html = renderToString(
      <PortalPaymentMethodSelector invoice={minorOnlyInvoice} />
    )

    expect(html).toContain('$125.50')
    expect(html).toContain('Pay $125.50 via Stripe')
  })

  it('disables CTA button when invoice balance is zero', () => {
    const paidInvoice: PortalPaymentInvoice = {
      id: 303,
      invoice_number: 'INV-2026-PAID',
      currency: 'USD',
      balance_minor: 0,
      balance: 0,
    }

    const html = renderToString(
      <PortalPaymentMethodSelector invoice={paidInvoice} />
    )

    expect(html).toContain('disabled=""')
    expect(html).toContain('Pay $0.00 via Stripe')
  })
})
