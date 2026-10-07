import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ReceiptSlipView } from '../modules/finance/ReceiptSlipView'
import type { Invoice, InvoicePayment } from '../types'

// Mock portal context
const { mockPortalSchool } = vi.hoisted(() => ({
  mockPortalSchool: {
    name: 'Springdale International Academy',
    address: '123 Education Boulevard, New Delhi',
    phone: '+91 11 2345 6789',
    email: 'bursar@springdale.edu',
    code: undefined as string | undefined,
  },
}))

vi.mock('../lib/portal-context', () => ({
  usePortal: () => ({
    currentStudent: {
      id: 101,
      full_name: 'Ananya Sharma',
      first_name: 'Ananya',
      last_name: 'Sharma',
      student_number: 'STU-2026-089',
      admission_number: 'ADM-2026-089',
      unit_name: 'Grade 10',
      group_name: 'Section A',
      session_name: '2026-2027 Academic Session',
    },
    siteName: 'Springdale International Academy',
    logoUrl: 'https://example.com/logo.png',
    school: mockPortalSchool,
    localization: {
      currency: 'USD',
    },
  }),
}))

// Mock portal labels
vi.mock('../lib/labels', () => ({
  usePortalLabels: () => ({
    getLabel: (_key: string, _plural: boolean, fallback?: string) => fallback || 'Class',
  }),
}))

// Mock formatter
vi.mock('../lib/formatter', () => ({
  formatCurrency: (amount: number, _currency: string = 'USD') => `$${Number(amount).toFixed(2)}`,
  formatDate: (dateStr: string) => dateStr,
}))

// Mock admin formatter used by PrintPaymentReceipt
vi.mock('@/lib/formatter', () => ({
  useFormatter: () => ({
    formatCurrency: (val: number) => `$${(val / 100).toFixed(2)}`,
    formatDate: (val: string) => val,
  }),
}))

describe('ReceiptSlipView Component', () => {
  beforeEach(() => {
    mockPortalSchool.code = undefined
  })

  const mockPayment: InvoicePayment & { invoice_number?: string; invoice?: Invoice } = {
    payment_number: 'PAY-2026-9901',
    amount: 350,
    amount_minor: 35000,
    paid_on: '2026-09-18',
    method: 'stripe',
    status: 'completed',
    invoice_number: 'INV-2026-1044',
  }

  const mockInvoice: Invoice = {
    id: 12,
    invoice_number: 'INV-2026-1044',
    issue_date: '2026-09-01',
    due_date: '2026-09-20',
    total: 500,
    paid: 350,
    balance: 150,
    status: 'partially_paid',
    line_items: [
      { id: 1, description: 'Term 1 Tuition Fee', amount: 400 },
      { id: 2, description: 'Science Lab Fee', amount: 100 },
    ],
  }

  it('renders official receipt header with school branding and receipt number', () => {
    const html = renderToString(
      <ReceiptSlipView
        payment={mockPayment}
        invoice={mockInvoice}
        currency="USD"
      />
    )

    expect(html).toContain('Springdale International Academy')
    expect(html).toContain('Official Fee Collection Slip')
    expect(html).toContain('PAY-2026-9901')
  })

  it('renders student and academic enrollment metadata correctly', () => {
    const html = renderToString(
      <ReceiptSlipView
        payment={mockPayment}
        invoice={mockInvoice}
      />
    )

    expect(html).toContain('Ananya Sharma')
    expect(html).toContain('STU-2026-089')
    expect(html).toContain('Grade 10 • Section A')
    expect(html).toContain('2026-2027 Academic Session')
  })

  it('renders total amount received, payment method, and formatted currency', () => {
    const html = renderToString(
      <ReceiptSlipView
        payment={mockPayment}
        invoice={mockInvoice}
        currency="USD"
      />
    )

    expect(html).toContain('$350.00')
    expect(html).toContain('Total Amount Received &amp; Cleared')
    expect(html).toContain('Stripe (Card / Online)')
  })

  it('renders associated invoice ledger breakdown and covered fee categories', () => {
    const html = renderToString(
      <ReceiptSlipView
        payment={mockPayment}
        invoice={mockInvoice}
        currency="USD"
      />
    )
    expect(html).toContain('INV-2026-1044')
    expect(html).toContain('Invoice Total Billed')
    expect(html).toContain('$500.00')
    expect(html).toContain('Total Paid to Date')
    expect(html).toContain('$350.00')
    expect(html).toContain('Remaining Balance Due')
    expect(html).toContain('$150.00')
    expect(html).toContain('Term 1 Tuition Fee')
    expect(html).toContain('Science Lab Fee')
  })

  it('does not render bottom electronic verification card on clean receipt slip', () => {
    const html = renderToString(
      <ReceiptSlipView
        payment={mockPayment}
        invoice={mockInvoice}
      />
    )

    expect(html).not.toContain('Official Electronic Receipt &amp; Verification')
    expect(html).not.toContain('CC-VERIFIED-')
  })

  it('includes 1-click print receipt buttons and hidden printable letterhead container', () => {
    const html = renderToString(
      <ReceiptSlipView
        payment={mockPayment}
        invoice={mockInvoice}
      />
    )

    expect(html).toContain('Print Receipt')
    expect(html).toContain('Print Official Receipt')
    expect(html).toContain('data-print-area')
    expect(html).toContain('box-sizing:border-box')
  })

  it('renders navigation breadcrumbs and back buttons with invoice context', () => {
    const html = renderToString(
      <ReceiptSlipView
        payment={mockPayment}
        invoice={mockInvoice}
        onBackToInvoice={() => {}}
      />
    )

    expect(html).toContain('Back to Invoice #INV-2026-1044')
    expect(html).toContain('Back to Invoice')
    expect(html).toContain('Copy Receipt ID')
    expect(html).toContain('Copy #')
  })

  it('renders school.code in a styled badge with font-mono text when present', () => {
    mockPortalSchool.code = 'SCH-2026-DEL'
    const html = renderToString(
      <ReceiptSlipView
        payment={mockPayment}
        invoice={mockInvoice}
      />
    )

    expect(html).toContain('SCH-2026-DEL')
    expect(html).toContain('text-2xs font-mono font-semibold px-2 py-0.5 rounded bg-bg-subtle text-text-muted border border-border')
  })

  it('does not render school.code badge when code is empty string or absent', () => {
    mockPortalSchool.code = ''
    const htmlEmpty = renderToString(
      <ReceiptSlipView
        payment={mockPayment}
        invoice={mockInvoice}
      />
    )
    expect(htmlEmpty).not.toContain('text-2xs font-mono font-semibold')

    mockPortalSchool.code = undefined
    const htmlUndefined = renderToString(
      <ReceiptSlipView
        payment={mockPayment}
        invoice={mockInvoice}
      />
    )
    expect(htmlUndefined).not.toContain('text-2xs font-mono font-semibold')
  })

})
