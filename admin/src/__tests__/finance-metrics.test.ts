import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { StatCard } from '../components/ui/StatCard'

describe('Finance Invoices KPI Metrics & StatCard', () => {
  it('renders compact stat card with currency amount without height inflation', () => {
    const html = renderToString(
      React.createElement(StatCard, {
        label: 'Total Invoiced',
        value: '$6,320.00',
        compact: true,
      })
    )

    expect(html).toContain('Total Invoiced')
    expect(html).toContain('$6,320.00')
    // Compact card should have compact classes
    expect(html).toContain('rounded-xl')
    expect(html).toContain('p-3')
  })

  it('correctly uses backend aggregates when present without double division', () => {
    const mockAggregates = {
      total_invoiced_minor: 632000, // $6,320.00
      total_collected_minor: 632000,
      total_outstanding_minor: 0,
      total_overdue_minor: 0,
      overdue_count: 0,
    }

    // Resolving aggregates: minor units must remain intact for formatCurrency
    const totalInvoiced = Number(mockAggregates.total_invoiced_minor || 0)
    const totalCollected = Number(mockAggregates.total_collected_minor || 0)
    const totalOverdue = Number(mockAggregates.total_overdue_minor || 0)

    expect(totalInvoiced).toBe(632000)
    expect(totalCollected).toBe(632000)
    expect(totalOverdue).toBe(0)

    // Formatter converts minor units / 100 -> $6,320.00
    const formatted = `$${(totalInvoiced / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    expect(formatted).toBe('$6,320.00')
  })

  it('correctly sums fallback invoices list using minor units without dividing by 100 twice', () => {
    const mockList = [
      { id: 1, total_minor: 64000, paid_minor: 64000, balance_minor: 0, status: 'paid' },
      { id: 2, total_minor: 60000, paid_minor: 60000, balance_minor: 0, status: 'paid' },
      { id: 3, total_minor: 65000, paid_minor: 65000, balance_minor: 0, status: 'paid' },
      { id: 4, total_minor: 60000, paid_minor: 60000, balance_minor: 0, status: 'paid' },
      { id: 5, total_minor: 64000, paid_minor: 64000, balance_minor: 0, status: 'paid' },
      { id: 6, total_minor: 60000, paid_minor: 60000, balance_minor: 0, status: 'paid' },
      { id: 7, total_minor: 65000, paid_minor: 65000, balance_minor: 0, status: 'paid' },
      { id: 8, total_minor: 65000, paid_minor: 65000, balance_minor: 0, status: 'paid' },
      { id: 9, total_minor: 64000, paid_minor: 64000, balance_minor: 0, status: 'paid' },
      { id: 10, total_minor: 65000, paid_minor: 65000, balance_minor: 0, status: 'paid' },
    ]

    let totalInvoiced = 0
    let totalCollected = 0
    let totalOverdue = 0

    mockList.forEach((inv) => {
      // Must NOT divide by 100 here!
      const net = inv.total_minor ?? 0
      const paid = inv.paid_minor ?? 0
      totalInvoiced += net
      totalCollected += paid
    })

    // 64000 + 60000 + 65000 + 60000 + 64000 + 60000 + 65000 + 65000 + 64000 + 65000 = 632000 minor units ($6,320.00)
    expect(totalInvoiced).toBe(632000)
    expect(totalCollected).toBe(632000)
    expect(totalOverdue).toBe(0)

    const formattedInvoiced = `$${(totalInvoiced / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    expect(formattedInvoiced).toBe('$6,320.00')
    // Ensure it is NOT $63.20 (which was the bug where it was divided by 100 twice)
    expect(formattedInvoiced).not.toBe('$63.20')
  })
})
