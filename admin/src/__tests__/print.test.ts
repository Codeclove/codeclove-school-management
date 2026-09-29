import { describe, it, expect, vi } from 'vitest'
import { printElement } from '../lib/print'
import PrintInvoiceSheet from '../modules/finance/PrintInvoiceSheet'
import PrintPaymentReceipt from '../modules/finance/PrintPaymentReceipt'
import React from 'react'
import { renderToString } from 'react-dom/server'

// Mock useFormatter so component renders without QueryClient in node test env
vi.mock('@/lib/formatter', () => ({
  useFormatter: () => ({
    formatCurrency: (val: number) => `₹${(val / 100).toFixed(2)}`,
    formatDate: (val: string) => val,
  })
}))

describe('Print Dimension & Layout Safety (Diagnosing Bug)', () => {
  const mockInvoice: any = {
    id: 1,
    invoice_number: 'INV202610001',
    status: 'paid',
    student_first_name: 'Ananya',
    student_last_name: 'Joshi',
    student_number: 'STU20260001',
    academic_unit_id: 25,
    guardian_name: 'Aarav Patel',
    guardian_email: 'aarav.patel@example.com',
    issue_date: '2026-09-05',
    due_date: '2026-09-20',
    subtotal_minor: 50000,
    discount_minor: 5000,
    discount_note: 'Waiver',
    total_minor: 45000,
    paid_minor: 45000,
    balance_minor: 0,
    line_items: [
      { id: 1, description: 'Tuition Fee', discount_minor: 5000, total_minor: 45000 }
    ],
    payments: [
      { id: 1, payment_number: 'PAY202610001', paid_on: '2026-09-05', method: 'cash', reference: 'TXN-10000001', amount_minor: 45000, status: 'completed' }
    ]
  }

  const mockSchool = {
    name: 'CodeClove International Academy (India)',
    address: 'Plot 42, Knowledge Park, Bandra Kurla Complex, Mumbai, Maharashtra - 400051',
    email: 'admin.in@codecloveschool.edu',
    website: 'https://india.codecloveschool.edu'
  }

  it('PrintInvoiceSheet must not use fixed 190mm width that overflows printable A4 width (186mm) with padding', () => {
    const html = renderToString(React.createElement(PrintInvoiceSheet, { invoice: mockInvoice, school: mockSchool }))
    
    // Check root data-print-area styling
    expect(html).toContain('data-print-area')
    
    // Symptom check: width: 190mm combined with 10mm padding and no border-box causes 210mm width,
    // which overflows standard A4 printable width (186mm) by 24mm!
    // The component MUST use box-sizing: border-box and responsive max-width.
    expect(html).toContain('box-sizing:border-box')
    expect(html).not.toMatch(/width:\s*190mm/)
  })

  it('PrintPaymentReceipt must enforce box-sizing: border-box on its print area', () => {
    const mockPayment: any = {
      id: 1,
      payment_number: 'PAY202610001',
      paid_on: '2026-09-05',
      method: 'cash',
      amount_minor: 45000,
      status: 'completed'
    }
    const html = renderToString(React.createElement(PrintPaymentReceipt, { payment: mockPayment, invoice: mockInvoice, school: mockSchool }))
    expect(html).toContain('data-print-area')
    expect(html).toContain('box-sizing:border-box')
  })

  it('print.ts must inject universal box-sizing: border-box and [data-print-area] constraints into the iframe', () => {
    let capturedHtml = ''
    const mockDoc = {
      open: vi.fn(),
      write: vi.fn((content: string) => {
        capturedHtml += content
      }),
      close: vi.fn(),
      querySelectorAll: vi.fn(() => [])
    }
    const mockIframe: any = {
      style: {},
      contentWindow: {
        document: mockDoc,
        focus: vi.fn(),
        print: vi.fn(),
        addEventListener: vi.fn()
      }
    }

    // Set up minimal global document mock in node
    const originalDocument = (globalThis as any).document
    ;(globalThis as any).document = {
      createElement: vi.fn((tag: string) => {
        if (tag === 'iframe') return mockIframe
        return { style: {}, innerHTML: '' }
      }),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
      querySelectorAll: vi.fn(() => []),
    }

    try {
      const testEl: any = {
        innerHTML: '<div data-print-area>Invoice Content</div>'
      }

      printElement(testEl)

      // The iframe CSS MUST include universal box-sizing: border-box
      expect(capturedHtml).toContain('box-sizing: border-box')
      // The iframe CSS MUST ensure A4 portrait and safe max-width
      expect(capturedHtml).toContain('size: A4 portrait')
      expect(capturedHtml).toContain('max-width: 100%')
    } finally {
      (globalThis as any).document = originalDocument
    }
  })

  it('print.ts must wrap content in #codeclove-portal-root when printing in portal context', () => {
    let capturedHtml = ''
    const mockDoc = {
      open: vi.fn(),
      write: vi.fn((content: string) => {
        capturedHtml += content
      }),
      close: vi.fn(),
      querySelectorAll: vi.fn(() => []),
    }
    const mockIframe: any = {
      style: {},
      contentWindow: {
        document: mockDoc,
        focus: vi.fn(),
        print: vi.fn(),
        addEventListener: vi.fn(),
      },
    }

    const originalDocument = (globalThis as any).document
    ;(globalThis as any).document = {
      createElement: vi.fn((tag: string) => (tag === 'iframe' ? mockIframe : {})),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
      querySelectorAll: vi.fn(() => []),
      getElementById: vi.fn((id: string) => (id === 'codeclove-portal-root' ? {} : null)),
    }

    try {
      printElement({ innerHTML: '<div>Card Content</div>' } as any)
      expect(capturedHtml).toContain('<div id="codeclove-portal-root">')
      expect(capturedHtml).toContain('</div></body></html>')
    } finally {
      (globalThis as any).document = originalDocument
    }
  })
})
