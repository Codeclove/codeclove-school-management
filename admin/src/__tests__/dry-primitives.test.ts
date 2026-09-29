import { describe, it, expect } from 'vitest'
import { QUERY_KEYS } from '../lib/constants'

describe('Code Consistency & DRY Primitives', () => {
  describe('Finance Query Keys Consistency', () => {
    it('QUERY_KEYS.invoices is a string array matching TanStack Query prefix expectations', () => {
      expect(QUERY_KEYS.invoices).toEqual(['invoices'])
      expect(QUERY_KEYS.invoices[0]).toBe('invoices')
    })
  })

  describe('REST URL Path Normalization', () => {
    function normalizeUrl(baseUrl: string, path: string): string {
      return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
    }

    it('correctly handles base URLs with or without trailing slash', () => {
      expect(normalizeUrl('https://example.test/wp-json/codeclove/v1/', 'students')).toBe(
        'https://example.test/wp-json/codeclove/v1/students'
      )
      expect(normalizeUrl('https://example.test/wp-json/codeclove/v1', 'students')).toBe(
        'https://example.test/wp-json/codeclove/v1/students'
      )
      expect(normalizeUrl('https://example.test/wp-json/codeclove/v1///', '///students')).toBe(
        'https://example.test/wp-json/codeclove/v1/students'
      )
    })
  })

  describe('TablePagination Boundary Math', () => {
    function calculatePagination(page: number, perPage: number | 'all', total: number) {
      if (total <= 0) return null
      const isAll = perPage === 'all'
      const numericPerPage = isAll ? total : perPage
      const from = isAll ? 1 : Math.min((page - 1) * numericPerPage + 1, total)
      const to = isAll ? total : Math.min(page * numericPerPage, total)
      const canPrev = !isAll && page > 1
      const canNext = !isAll && page * numericPerPage < total
      return { from, to, canPrev, canNext }
    }

    it('calculates first page boundaries correctly', () => {
      const res = calculatePagination(1, 10, 45)
      expect(res).toEqual({ from: 1, to: 10, canPrev: false, canNext: true })
    })

    it('calculates middle page boundaries correctly', () => {
      const res = calculatePagination(3, 10, 45)
      expect(res).toEqual({ from: 21, to: 30, canPrev: true, canNext: true })
    })

    it('calculates last page boundaries correctly', () => {
      const res = calculatePagination(5, 10, 45)
      expect(res).toEqual({ from: 41, to: 45, canPrev: true, canNext: false })
    })

    it('clamps "from" index when page exceeds total records', () => {
      const res = calculatePagination(5, 10, 8)
      expect(res).toEqual({ from: 8, to: 8, canPrev: true, canNext: false })
    })

    it('handles perPage="all" correctly', () => {
      const res = calculatePagination(1, 'all', 120)
      expect(res).toEqual({ from: 1, to: 120, canPrev: false, canNext: false })
    })
  })
})
