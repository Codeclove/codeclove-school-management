import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { InvoiceStatementView } from '../modules/finance/InvoiceStatementView'
import type { Invoice } from '../types'

// Mock portal context
vi.mock('../lib/portal-context', () => ({
  usePortal: () => ({
    currentStudent: {
      id: 101,
      full_name: 'Arthur Pendelton',
      first_name: 'Arthur',
      last_name: 'Pendelton',
      student_number: 'CC-2026-0881',
      unit_name: 'Grade 10',
      group_name: 'Section A',
      session_name: '2025–2026 Academic Year',
      guardian_name: 'Eleanor Pendelton',
      guardian_email: 'eleanor.p@example.com',
    },
    siteName: 'CodeClove International Academy',
    logoUrl: 'https://example.com/logo.png',
    school: {
      name: 'CodeClove International Academy',
      address: '742 Evergreen Terrace, Springfield, OR',
      phone: '+1 (555) 019-2834',
      email: 'bursar@codeclove-academy.edu',
      website: 'https://codeclove-academy.edu',
      logo: 'https://example.com/logo.png',
    },
    localization: {
      currency: 'USD',
      date_format: 'Y-m-d',
    },
    user: {
      id: 50,
      name: 'Eleanor Pendelton',
      email: 'eleanor.p@example.com',
    },
  }),
}))

// Mock portal labels
vi.mock('../lib/labels', () => ({
  usePortalLabels: () => ({
    getLabel: (_key: string, _plural: boolean, fallback?: string) => fallback || 'Class / Grade',
  }),
}))

// Mock portal formatter
vi.mock('../lib/formatter', () => ({
  formatCurrency: (amount: number, _currency: string = 'USD') => `$${Number(amount).toFixed(2)}`,
  formatDate: (dateStr: string) => dateStr,
}))

// Mock admin formatter used by PrintInvoiceSheet
vi.mock('@/lib/formatter', () => ({
  useFormatter: () => ({
    formatCurrency: (amount: number, _currency: string = 'USD') => `$${Number(amount).toFixed(2)}`,
    formatDate: (dateStr: string) => dateStr,
  }),
}))

// Mock gateways config & checkout session hooks used by PortalPaymentMethodSelector
vi.mock('@/api/gateways', () => ({
  useGatewaysConfig: () => ({
    data: {
      gateways: {
        stripe: {
          id: 'stripe',
          name: 'Stripe',
          enabled: true,
          test_mode: false,
          publishable_key: 'pk_live_xxx',
        },
        paypal: {
          id: 'paypal',
          name: 'PayPal',
          enabled: true,
          test_mode: true,
          client_id: 'client_xxx',
        },
      },
    },
    isLoading: false,
  }),
  useCreateCheckoutSession: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}))

describe('InvoiceStatementView Component', () => {
  const mockInvoice: Invoice = {
    id: 42,
    invoice_number: 'INV-2026-0042',
    issue_date: '2026-09-01',
    due_date: '2026-10-01',
    total: 1500,
    paid: 500,
    balance: 1000,
    status: 'partially_paid',
    line_items: [
      { id: 1, description: 'Term 1 Tuition Fee', quantity: 1, amount: 1200 },
      { id: 2, description: 'Science Laboratory & Technology Fee', quantity: 1, amount: 300 },
    ],
    payments: [
      {
        id: 7,
        payment_number: 'REC-2026-0019',
        amount: 500,
        paid_on: '2026-09-10',
        method: 'stripe',
        status: 'completed',
      },
    ],
  }

  it('renders official statement header with school branding, invoice number, and status badge', () => {
    const html = renderToString(
      <InvoiceStatementView
        invoice={mockInvoice}
        currency="USD"
        onBack={() => {}}
      />
    )

    expect(html).toContain('INV-2026-0042')
    expect(html).toContain('CodeClove International Academy')
    expect(html).toContain('Official Fee Statement &amp; Tax Invoice')
    expect(html).toContain('Partially Paid')
  })

  it('renders student and academic enrollment details', () => {
    const html = renderToString(
      <InvoiceStatementView
        invoice={mockInvoice}
        currency="USD"
        onBack={() => {}}
      />
    )

    expect(html).toContain('Arthur Pendelton')
    expect(html).toContain('CC-2026-0881')
    expect(html).toContain('Grade 10 • Section A')
    expect(html).toContain('Eleanor Pendelton')
    expect(html).toContain('eleanor.p@example.com')
  })

  it('renders financial summary cards with total billed, paid, and outstanding balance', () => {
    const html = renderToString(
      <InvoiceStatementView
        invoice={mockInvoice}
        currency="USD"
        onBack={() => {}}
      />
    )

    expect(html).toContain('$1500.00')
    expect(html).toContain('$500.00')
    expect(html).toContain('$1000.00')
    expect(html).toContain('Total Billed')
    expect(html).toContain('Amount Cleared')
    expect(html).toContain('Balance Outstanding')
  })

  it('renders itemized fee schedule table with descriptions and line totals', () => {
    const html = renderToString(
      <InvoiceStatementView
        invoice={mockInvoice}
        currency="USD"
        onBack={() => {}}
      />
    )

    expect(html).toContain('Term 1 Tuition Fee')
    expect(html).toContain('$1200.00')
    expect(html).toContain('Science Laboratory &amp; Technology Fee')
    expect(html).toContain('$300.00')
    expect(html).toContain('Subtotal Billed')
  })

  it('renders verifiable payment receipts history with receipt number and settlement date', () => {
    const html = renderToString(
      <InvoiceStatementView
        invoice={mockInvoice}
        currency="USD"
        onBack={() => {}}
      />
    )

    expect(html).toContain('REC-2026-0019')
    expect(html).toContain('2026-09-10')
    expect(html).toContain('Stripe')
    expect(html).toContain('View Slip')
  })

  it('renders online payment dock with payment method selector when balance is due', () => {
    const html = renderToString(
      <InvoiceStatementView
        invoice={mockInvoice}
        currency="USD"
        onBack={() => {}}
      />
    )

    expect(html).toContain('id="payment-dock"')
    expect(html).toContain('Pay Invoice Online')
  })

  it('renders full settlement completion banner when invoice is paid in full', () => {
    const paidInvoice: Invoice = {
      ...mockInvoice,
      balance: 0,
      paid: 1500,
      status: 'paid',
    }

    const html = renderToString(
      <InvoiceStatementView
        invoice={paidInvoice}
        currency="USD"
        onBack={() => {}}
      />
    )

    expect(html).toContain('Paid in Full')
    expect(html).toContain('Invoice Fully Settled — No Payment Due')
    expect(html).not.toContain('Pay Invoice Online')
  })

  it('includes 1-click print statement controls and hidden printable sheet', () => {
    const html = renderToString(
      <InvoiceStatementView
        invoice={mockInvoice}
        currency="USD"
        onBack={() => {}}
      />
    )

    expect(html).toContain('Print Statement')
    expect(html).toContain('data-print-area')
  })
})
