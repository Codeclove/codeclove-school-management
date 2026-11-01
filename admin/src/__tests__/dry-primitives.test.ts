import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { QUERY_KEYS } from '../lib/constants'
import { resolveBadgeVariant, StatCard } from '../components/ui'
import { getStatusVariant } from '../modules/finance/finance-utils'
import { calculateTermSplits } from '../modules/academics/academic-utils'

describe('Code Consistency & DRY Primitives', () => {
  describe('Finance Query Keys Consistency', () => {
    it('QUERY_KEYS.invoices is a string array matching TanStack Query prefix expectations', () => {
      expect(QUERY_KEYS.invoices).toEqual(['invoices'])
      expect(QUERY_KEYS.invoices[0]).toBe('invoices')
    })
  })

  describe('Status Badge Variant Resolution & Aliasing', () => {
    it('aliases "partial" to "partially_paid"', () => {
      expect(resolveBadgeVariant('partial')).toBe('partially_paid')
      expect(getStatusVariant('partial')).toBe('partially_paid')
    })

    it('resolves direct domain statuses cleanly', () => {
      expect(resolveBadgeVariant('active')).toBe('active')
      expect(resolveBadgeVariant('inactive')).toBe('inactive')
      expect(resolveBadgeVariant('graduated')).toBe('graduated')
      expect(resolveBadgeVariant('suspended')).toBe('suspended')
      expect(resolveBadgeVariant('withdrawn')).toBe('withdrawn')
      expect(resolveBadgeVariant('archived')).toBe('archived')
      expect(resolveBadgeVariant('paid')).toBe('paid')
      expect(resolveBadgeVariant('partially_paid')).toBe('partially_paid')
      expect(resolveBadgeVariant('overdue')).toBe('overdue')
    })

    it('normalizes casing and whitespace', () => {
      expect(resolveBadgeVariant('  ACTIVE  ')).toBe('active')
      expect(resolveBadgeVariant('Partial')).toBe('partially_paid')
    })

    it('falls back to "default" for null, undefined or unknown statuses', () => {
      expect(resolveBadgeVariant(null)).toBe('default')
      expect(resolveBadgeVariant(undefined)).toBe('default')
      expect(resolveBadgeVariant('')).toBe('default')
      expect(resolveBadgeVariant('completely_unrecognized_status')).toBe('default')
    })
  })

  describe('StatCard KPI Primitive Expansion', () => {
    it('renders label and value without an icon cleanly', () => {
      const html = renderToString(
        React.createElement(StatCard, { label: 'Total Invoiced', value: '$50,000' })
      )
      expect(html).toContain('Total Invoiced')
      expect(html).toContain('$50,000')
    })

    it('renders optional children (progress bar) and footer', () => {
      const html = renderToString(
        React.createElement(
          StatCard,
          {
            label: 'Total Collected',
            value: '$35,000',
            subtext: 'Active session revenue',
            footer: React.createElement('span', { 'data-testid': 'footer-link' }, 'Drilldown'),
          },
          React.createElement('div', { 'data-testid': 'progress-bar' }, 'Progress 70%')
        )
      )
      expect(html).toContain('Total Collected')
      expect(html).toContain('$35,000')
      expect(html).toContain('Progress 70%')
      expect(html).toContain('Active session revenue')
      expect(html).toContain('Drilldown')
    })

    it('supports custom badge, valueClassName, and ReactNode value', () => {
      const html = renderToString(
        React.createElement(StatCard, {
          label: 'Past Due Invoices',
          value: React.createElement('span', { className: 'font-extrabold' }, '3 invoices'),
          valueClassName: 'text-danger',
          badge: React.createElement('span', { className: 'badge-warning' }, 'Action needed'),
        })
      )
      expect(html).toContain('Past Due Invoices')
      expect(html).toContain('3 invoices')
      expect(html).toContain('text-danger')
      expect(html).toContain('Action needed')
    })
  })

  describe('Academic Term Auto-Partition (calculateTermSplits)', () => {
    it('generates 2 semesters strictly within session boundaries without timezone skew', () => {
      const splits = calculateTermSplits('2027-04-01', '2028-03-31', 2, 'Term')
      expect(splits).toHaveLength(2)
      expect(splits[0]!.start_date).toBe('2027-04-01')
      expect(splits[1]!.end_date).toBe('2028-03-31')
      expect(splits[0]!.start_date >= '2027-04-01').toBe(true)
      expect(splits[1]!.end_date <= '2028-03-31').toBe(true)
    })

    it('generates 3 terms strictly within session boundaries', () => {
      const splits = calculateTermSplits('2027-04-01', '2028-03-31', 3, 'Term')
      expect(splits).toHaveLength(3)
      expect(splits[0]!.start_date).toBe('2027-04-01')
      expect(splits[2]!.end_date).toBe('2028-03-31')
      for (const item of splits) {
        expect(item.start_date >= '2027-04-01').toBe(true)
        expect(item.end_date <= '2028-03-31').toBe(true)
        expect(item.start_date <= item.end_date).toBe(true)
      }
    })

    it('generates 4 quarters strictly within session boundaries', () => {
      const splits = calculateTermSplits('2027-04-01', '2028-03-31', 4, 'Term')
      expect(splits).toHaveLength(4)
      expect(splits[0]!.start_date).toBe('2027-04-01')
      expect(splits[3]!.end_date).toBe('2028-03-31')
      for (const item of splits) {
        expect(item.start_date >= '2027-04-01').toBe(true)
        expect(item.end_date <= '2028-03-31').toBe(true)
      }
    })
  })
})
