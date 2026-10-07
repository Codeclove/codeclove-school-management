import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { InvoiceStatementView, getInvoiceStatusMeta } from '../modules/finance/InvoiceStatementView'
import type { Invoice } from '../types'
// Mock portal context
const { mockPortalLocalization, mockPortalSchool } = vi.hoisted(() => ({
  mockPortalLocalization: {
    currency: 'USD',
    date_format: 'Y-m-d',
  },
  mockPortalSchool: {
    name: 'CodeClove International Academy',
    address: '742 Evergreen Terrace, Springfield, OR',
    phone: '+1 (555) 019-2834',
    email: 'bursar@codeclove-academy.edu',
    website: 'https://codeclove-academy.edu',
    logo: 'https://example.com/logo.png',
    code: undefined as string | undefined,
  },
}))

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
    school: mockPortalSchool,
    localization: mockPortalLocalization,
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
  useVerifyStripeSession: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}))

describe('InvoiceStatementView Component', () => {
  beforeEach(() => {
    mockPortalLocalization.currency = 'USD'
    mockPortalLocalization.date_format = 'Y-m-d'
    mockPortalSchool.code = undefined
  })

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

  it('renders official statement header with school branding and invoice number', () => {
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

  it('does not render online payment dock in the free edition (isPro: false)', () => {
    const originalWindow = globalThis.window
    const env = globalThis as unknown as { window?: { CodeClovePortalConfig?: unknown } }
    env.window = {
      CodeClovePortalConfig: {
        isPro: false,
      },
    }

    const html = renderToString(
      <InvoiceStatementView
        invoice={mockInvoice}
        currency="USD"
        onBack={() => {}}
      />
    )

    expect(html).not.toContain('id="payment-dock"')
    expect(html).not.toContain('Pay Invoice Online')

    env.window = originalWindow as unknown as { CodeClovePortalConfig?: unknown }
  })
  it('does not render payment dock or settled card when invoice is settled in full', () => {
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

    expect(html).not.toContain('Pay Invoice Online')
    expect(html).not.toContain('Invoice Fully Settled — No Payment Due')
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
  it('renders clean breadcrumb navigation bar with document trail', () => {
    const html = renderToString(
      <InvoiceStatementView
        invoice={mockInvoice}
        currency="USD"
        onBack={() => {}}
      />
    )

    // Verify breadcrumb exists with navigation trail
    expect(html).toContain('Fee Records')
    expect(html).toContain('Invoices')
    expect(html).toContain('INV-2026-0042')
  })

  it('does not render school.code badge on fee statement headers to keep stationery clean', () => {
    mockPortalSchool.code = 'CC-ACAD-01'
    const html = renderToString(
      <InvoiceStatementView
        invoice={mockInvoice}
        currency="USD"
      />
    )

    // Rendered on-screen letterhead should be clean and unencumbered by internal codes
    expect(html).not.toContain('text-3xs font-mono font-semibold px-1.5 py-0.5 rounded bg-bg-subtle text-text-muted border border-border')
    // Rendered in printable sheet letterhead
    expect(html).not.toContain('text-3xs font-mono font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200')
  })

  it('does not render school.code badge when code is empty string or absent', () => {
    mockPortalSchool.code = ''
    const htmlEmpty = renderToString(
      <InvoiceStatementView
        invoice={mockInvoice}
        currency="USD"
      />
    )
    expect(htmlEmpty).not.toContain('text-3xs font-mono font-semibold px-1.5 py-0.5 rounded bg-bg-subtle')

    mockPortalSchool.code = undefined
    const htmlUndefined = renderToString(
      <InvoiceStatementView
        invoice={mockInvoice}
        currency="USD"
      />
    )
    expect(htmlUndefined).not.toContain('text-3xs font-mono font-semibold px-1.5 py-0.5 rounded bg-bg-subtle')
  })

})
describe('getInvoiceStatusMeta helper', () => {
  it('returns country-aware labels for overdue status', () => {
    expect(getInvoiceStatusMeta('overdue', true).label).toBe('Past Due')
    expect(getInvoiceStatusMeta('overdue', false).label).toBe('Overdue')
  })

  it('returns clean single labels for cancelled and void statuses without slashes', () => {
    expect(getInvoiceStatusMeta('cancelled').label).toBe('Cancelled')
    expect(getInvoiceStatusMeta('void').label).toBe('Void')
  })
})
