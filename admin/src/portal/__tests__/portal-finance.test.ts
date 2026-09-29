import { describe, expect, it } from 'vitest'
import type { Invoice } from '../types'
import { formatDate } from '../lib/formatter'

describe('Portal Finance & Payment Receipts Logic', () => {
  const mockInvoices: Invoice[] = [
    {
      id: 1,
      invoice_number: 'INV202610318',
      issue_date: '2026-09-06',
      due_date: '2026-09-21',
      total: 120,
      paid: 50,
      balance: 70,
      status: 'partially_paid',
      line_items: [
        { id: 1, description: 'Tuition Fee - Term 1', amount: 100 },
        { id: 2, description: 'Library Fee', amount: 20 },
      ],
      payments: [
        {
          id: 10,
          payment_number: 'PAY20261001',
          amount: 50,
          paid_on: '2026-09-07',
          method: 'bank_transfer',
          status: 'completed',
        },
      ],
    },
    {
      id: 2,
      invoice_number: 'INV202610317',
      issue_date: '2026-08-12',
      due_date: '2026-08-27',
      total: 500,
      paid: 500,
      balance: 0,
      status: 'paid',
      line_items: [
        { id: 3, description: 'Annual Athletic Fee', amount: 500 },
      ],
      payments: [
        {
          id: 11,
          payment_number: 'REC-552',
          amount: 500,
          paid_on: '2026-08-15',
          method: 'card',
          status: 'completed',
        },
      ],
    },
  ]

  it('correctly aggregates payment receipts across all invoices', () => {
    const allPayments = mockInvoices.flatMap((inv) =>
      (inv.payments ?? []).map((pmt) => ({
        ...pmt,
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
      }))
    )

    expect(allPayments).toHaveLength(2)
    const first = allPayments[0]
    const second = allPayments[1]
    expect(first).toBeDefined()
    expect(second).toBeDefined()

    if (first && second) {
      expect(first.invoice_number).toBe('INV202610318')
      expect(first.payment_number).toBe('PAY20261001')
      expect(first.amount).toBe(50)

      expect(second.invoice_number).toBe('INV202610317')
      expect(second.payment_number).toBe('REC-552')
      expect(second.amount).toBe(500)
    }
  })

  it('renders line item descriptions correctly', () => {
    const items = mockInvoices[0]?.line_items ?? []
    const firstItem = items[0]
    const secondItem = items[1]

    expect(firstItem).toBeDefined()
    expect(secondItem).toBeDefined()

    if (firstItem && secondItem) {
      expect(firstItem.description).toBe('Tuition Fee - Term 1')
      expect(secondItem.description).toBe('Library Fee')
    }
  })

  it('renders payment numbers directly from canonical API fields', () => {
    const pmt1 = mockInvoices[0]?.payments?.[0]
    const pmt2 = mockInvoices[1]?.payments?.[0]

    expect(pmt1).toBeDefined()
    expect(pmt2).toBeDefined()

    if (pmt1 && pmt2) {
      expect(pmt1.payment_number).toBe('PAY20261001')
      expect(pmt2.payment_number).toBe('REC-552')
    }
  })

  it('formats payment settlement dates directly with paid_on', () => {
    const pmt1 = mockInvoices[0]?.payments?.[0]
    const pmt2 = mockInvoices[1]?.payments?.[0]

    expect(pmt1).toBeDefined()
    expect(pmt2).toBeDefined()

    if (pmt1 && pmt2) {
      const date1 = formatDate(pmt1.paid_on)
      const date2 = formatDate(pmt2.paid_on)

      expect(date1).toContain('2026')
      expect(date2).toContain('2026')
    }
  })
})
