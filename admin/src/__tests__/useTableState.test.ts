import { describe, it, expect } from 'vitest'
import {
  cycleSort,
  computeQueryParams,
  toggleIdInList,
  toggleAllIdsInList,
} from '../lib/useTableState'

describe('useTableState pure logic', () => {
  describe('cycleSort (Sorting state machine)', () => {
    it('initializes new field to asc', () => {
      const next = cycleSort('', 'asc', 'name')
      expect(next).toEqual({ orderby: 'name', order: 'asc' })
    })

    it('switches to a different field in asc order', () => {
      const next = cycleSort('code', 'desc', 'name')
      expect(next).toEqual({ orderby: 'name', order: 'asc' })
    })

    it('cycles from asc to desc on same field', () => {
      const next = cycleSort('name', 'asc', 'name')
      expect(next).toEqual({ orderby: 'name', order: 'desc' })
    })

    it('cycles from desc to none on same field', () => {
      const next = cycleSort('name', 'desc', 'name')
      expect(next).toEqual({ orderby: '', order: 'asc' })
    })
  })

  describe('computeQueryParams (REST API Parameter Mapping)', () => {
    it('maps standard table state into API query parameters', () => {
      const params = computeQueryParams(2, 25, 'admission_number', 'desc')
      expect(params).toEqual({
        page: 2,
        per_page: 25,
        orderby: 'admission_number',
        order_by: 'admission_number',
        order: 'desc',
      })
    })

    it('converts perPage="all" to per_page=-1 for WordPress REST endpoints', () => {
      const params = computeQueryParams(1, 'all', 'name', 'asc')
      expect(params).toEqual({
        page: 1,
        per_page: -1,
        orderby: 'name',
        order_by: 'name',
        order: 'asc',
      })
    })

    it('omits orderby and order when orderby is empty', () => {
      const params = computeQueryParams(1, 10, '', 'asc')
      expect(params).toEqual({
        page: 1,
        per_page: 10,
        orderby: undefined,
        order_by: undefined,
        order: undefined,
      })
    })
  })

  describe('toggleIdInList (Single row selection)', () => {
    it('adds ID when not present', () => {
      const list = [1, 2]
      expect(toggleIdInList(list, 3)).toEqual([1, 2, 3])
    })

    it('removes ID when already present', () => {
      const list = [1, 2, 3]
      expect(toggleIdInList(list, 2)).toEqual([1, 3])
    })
  })

  describe('toggleAllIdsInList (Multi-row header checkbox selection)', () => {
    it('selects all items when selection is empty', () => {
      const current: number[] = []
      const all = [10, 20, 30]
      expect(toggleAllIdsInList(current, all)).toEqual([10, 20, 30])
    })

    it('selects remaining items when partially selected', () => {
      const current = [10]
      const all = [10, 20, 30]
      expect(toggleAllIdsInList(current, all)).toEqual([10, 20, 30])
    })

    it('deselects all page items when all are currently selected', () => {
      const current = [10, 20, 30, 40]
      const all = [10, 20, 30]
      expect(toggleAllIdsInList(current, all)).toEqual([40])
    })
  })
})
